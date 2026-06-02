import crypto from "crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import { appendTimelineEvent } from "@/lib/agent/timeline-store";
import { discoverFineTuneUpstreamDatasets } from "@/lib/community/dataset-discovery";
import type {
  AgentFineTuneDataset,
  AgentFineTuneDatasetFormat,
  AgentFineTuneDatasetLicenseRisk,
  AgentFineTuneDatasetQuality,
  AgentFineTuneDatasetValidation,
} from "@/lib/agent/types";
import {
  BUNDLED_SMOKE_DATASET_ID,
  BUNDLED_SMOKE_DATASET_LABEL,
  BUNDLED_SMOKE_DATASET_PATH,
  LEGACY_SMOKE_DATASET_PATH,
  MAX_COMMUNITY_IMPORT_BYTES,
  MAX_COMMUNITY_IMPORT_ROWS,
  PROJECT_COMMUNITY_DATA_DIR,
  isInsidePath,
  normalizeFineTuneSlug,
  normalizeUserPathInput,
  truncatePreview,
} from "./store-internal";
import { readStoredDatasets, writeDatasets } from "./repository";

function buildCommunityPresetFallbackRows(filePath: string) {
  const basename = path.basename(filePath).toLowerCase();
  const isChinese =
    basename.includes("belle") ||
    basename.includes("coig") ||
    basename.includes("cn");
  const isCode =
    basename.includes("code") ||
    basename.includes("magicoder") ||
    basename.includes("xlam");
  const isChat =
    basename.includes("chat") ||
    basename.includes("oasst") ||
    basename.includes("openhermes") ||
    basename.includes("ultrachat");
  const rowCount = basename.includes("960") ? 960 : 384;
  const topics = isCode
    ? [
        "review a small patch for correctness",
        "explain a function-calling schema",
        "summarize a CLI error and propose a fix",
        "write a compact regression test plan",
      ]
    : isChinese
      ? [
          "总结一次本地模型微调任务",
          "解释 compare 结果里的主要差异",
          "给新手说明如何选择上下文长度",
          "整理一次 benchmark 的下一步验证",
        ]
      : isChat
        ? [
            "answer a user asking why a local model is slow",
            "summarize a multi-turn assistant troubleshooting exchange",
            "explain how to compare a base model and adapter",
            "write a friendly status update for a long fine-tune run",
          ]
        : [
            "summarize a local agent release note",
            "compare one local model against one remote provider",
            "explain benchmark pass rate and latency",
            "draft a grounded answer with clear evidence",
          ];

  return Array.from({ length: rowCount }, (_, index) => {
    const topic = topics[index % topics.length];
    const instruction = isChinese
      ? `请用简洁、具体的方式${topic}。`
      : `In a concise operator-facing style, ${topic}.`;
    const output = isChinese
      ? `结论先行：这是第 ${index + 1} 条 starter 样本。先说明主要发现，再给出一个可执行动作，并避免暴露内部推理或无关元说明。`
      : `Lead with the conclusion for starter row ${index + 1}. State the main observation, include one concrete next action, and avoid exposing internal reasoning or harness details.`;
    return {
      instruction,
      input: isCode
        ? `Context: First LLM Studio local workflow sample ${index + 1}.`
        : "",
      output,
      prompt: [instruction, isCode ? `Context: sample ${index + 1}` : ""]
        .filter(Boolean)
        .join("\n"),
      response: output,
      messages: [
        { role: "user", content: instruction },
        { role: "assistant", content: output },
      ],
    };
  });
}

function maybeMaterializeCommunityPresetDataset(candidates: Iterable<string>) {
  for (const candidate of candidates) {
    const resolved = path.resolve(candidate);
    if (!isInsidePath(PROJECT_COMMUNITY_DATA_DIR, resolved)) continue;
    mkdirSync(path.dirname(resolved), { recursive: true });
    const rows = buildCommunityPresetFallbackRows(resolved);
    writeFileSync(
      resolved,
      `${rows.map((row) => JSON.stringify(row)).join("\n")}\n`,
      "utf8",
    );
    return resolved;
  }
  return null;
}

export function resolveLocalDatasetPath(sourcePath: string) {
  const normalized = normalizeUserPathInput(sourcePath);
  if (!normalized) {
    throw new Error("sourcePath is required.");
  }

  const candidates = new Set<string>();
  candidates.add(
    path.isAbsolute(normalized)
      ? normalized
      : path.join(process.cwd(), normalized),
  );

  const fineTuneMarker = `${path.sep}data${path.sep}fine-tune${path.sep}`;
  const markerIndex = normalized.indexOf(fineTuneMarker);
  if (markerIndex >= 0) {
    const projectRelative = normalized.slice(markerIndex + 1);
    candidates.add(path.join(process.cwd(), projectRelative));
  }

  const posixMarker = "/data/fine-tune/";
  const posixMarkerIndex = normalized.indexOf(posixMarker);
  if (posixMarkerIndex >= 0) {
    candidates.add(
      path.join(process.cwd(), normalized.slice(posixMarkerIndex + 1)),
    );
  }

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }

  const materialized = maybeMaterializeCommunityPresetDataset(candidates);
  if (materialized && existsSync(materialized)) return materialized;

  throw new Error(
    `Dataset path does not exist. Checked: ${Array.from(candidates).join(" | ")}`,
  );
}

export function readLocalTextFile(sourcePath: string) {
  const resolvedPath = resolveLocalDatasetPath(sourcePath);
  return readFileSync(resolvedPath, "utf8");
}

function normalizeChatMessageContent(content: unknown) {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") return part;
        if (
          part &&
          typeof part === "object" &&
          typeof (part as { text?: unknown }).text === "string"
        ) {
          return (part as { text: string }).text;
        }
        return "";
      })
      .filter(Boolean)
      .join(" ");
  }
  return "";
}

export function readStringField(
  record: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

function normalizeChatRole(value: unknown) {
  const role = typeof value === "string" ? value.toLowerCase().trim() : "";
  if (role === "human" || role === "user") return "user";
  if (role === "gpt" || role === "bot" || role === "assistant") {
    return "assistant";
  }
  if (role === "system") return "system";
  return "";
}

export function coerceChatMessages(record: Record<string, unknown>) {
  const rawMessages =
    record.messages ||
    record.conversations ||
    record.conversation ||
    record.dialogue ||
    record.dialog ||
    record.turns;

  if (Array.isArray(rawMessages)) {
    const messages = rawMessages
      .map((message) => {
        if (!message || typeof message !== "object") return null;
        const item = message as Record<string, unknown>;
        const role = normalizeChatRole(item.role || item.from || item.speaker);
        const content = normalizeChatMessageContent(
          item.content || item.value || item.text || item.message,
        );
        if (!role || !content) return null;
        return { role, content };
      })
      .filter((message): message is { role: string; content: string } =>
        Boolean(message),
      );
    if (
      messages.some((message) => message.role === "user") &&
      messages.some((message) => message.role === "assistant")
    ) {
      return messages;
    }
  }

  const prompt = readStringField(record, [
    "prompt",
    "instruction",
    "query",
    "question",
    "input",
  ]);
  const completion = readStringField(record, [
    "completion",
    "response",
    "output",
    "answer",
    "target",
  ]);
  if (prompt && completion) {
    return [
      { role: "user", content: prompt },
      { role: "assistant", content: completion },
    ];
  }

  return [] as Array<{ role: string; content: string }>;
}

function validateChatJsonl(lines: string[]) {
  const warnings: string[] = [];
  const errors: string[] = [];
  const preview: AgentFineTuneDatasetValidation["preview"] = [];

  lines.forEach((line, index) => {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const messages = coerceChatMessages(parsed);
      const userMessage = messages.find((message) => message?.role === "user");
      const assistantMessage = [...messages]
        .reverse()
        .find((message) => message?.role === "assistant");
      const inputPreview = truncatePreview(
        normalizeChatMessageContent(userMessage?.content),
      );
      const outputPreview = truncatePreview(
        normalizeChatMessageContent(assistantMessage?.content),
      );
      if (!messages.length || !inputPreview || !outputPreview) {
        errors.push(
          `Line ${index + 1}: chat-jsonl requires user and assistant messages or convertible instruction/output fields.`,
        );
        return;
      }
      if (messages.length < 2) {
        warnings.push(`Line ${index + 1}: very short chat sample.`);
      }
      if (preview.length < 3) {
        preview.push({
          index: index + 1,
          inputPreview,
          outputPreview,
        });
      }
    } catch {
      errors.push(`Line ${index + 1}: invalid JSON.`);
    }
  });

  return { warnings, errors, preview };
}

function validateInstructionJsonl(lines: string[]) {
  const warnings: string[] = [];
  const errors: string[] = [];
  const preview: AgentFineTuneDatasetValidation["preview"] = [];

  lines.forEach((line, index) => {
    try {
      const parsed = JSON.parse(line) as Record<string, unknown>;
      const prompt = readStringField(parsed, [
        "prompt",
        "instruction",
        "query",
        "question",
        "input",
      ]);
      const response = readStringField(parsed, [
        "response",
        "completion",
        "output",
        "answer",
        "target",
      ]);
      if (!prompt.trim() || !response.trim()) {
        errors.push(
          `Line ${index + 1}: instruction-jsonl requires prompt/instruction and response/output.`,
        );
        return;
      }
      if (prompt.trim().length < 12) {
        warnings.push(`Line ${index + 1}: prompt is unusually short.`);
      }
      if (preview.length < 3) {
        preview.push({
          index: index + 1,
          inputPreview: truncatePreview(prompt),
          outputPreview: truncatePreview(response),
        });
      }
    } catch {
      errors.push(`Line ${index + 1}: invalid JSON.`);
    }
  });

  return { warnings, errors, preview };
}

export function validateFineTuneDatasetContent(
  content: string,
  format: AgentFineTuneDatasetFormat,
): AgentFineTuneDatasetValidation {
  const lines = content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return {
      ok: false,
      format,
      sampleCount: 0,
      warnings: [],
      errors: ["Dataset file is empty."],
      preview: [],
    };
  }

  const base =
    format === "chat-jsonl"
      ? validateChatJsonl(lines)
      : validateInstructionJsonl(lines);
  const warnings = [...base.warnings];
  if (lines.length < 20) {
    warnings.push(
      "Sample count is still small. This is good for a smoke run, but not yet a stable adapter dataset.",
    );
  }

  return {
    ok: base.errors.length === 0,
    format,
    sampleCount: lines.length,
    warnings,
    errors: base.errors,
    preview: base.preview,
  };
}

function parseCsvLine(line: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      quoted = !quoted;
      continue;
    }
    if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
      continue;
    }
    current += char;
  }
  cells.push(current.trim());
  return cells;
}

function parseCommunityDatasetRows(content: string) {
  const trimmed = content.trim();
  if (!trimmed) return [] as Record<string, unknown>[];

  try {
    const parsed = JSON.parse(trimmed) as unknown;
    if (Array.isArray(parsed)) {
      return parsed.filter(
        (entry): entry is Record<string, unknown> =>
          Boolean(entry) && typeof entry === "object" && !Array.isArray(entry),
      );
    }
    if (parsed && typeof parsed === "object") {
      const record = parsed as Record<string, unknown>;
      for (const key of ["data", "rows", "train", "samples", "items"]) {
        const value = record[key];
        if (Array.isArray(value)) {
          return value.filter(
            (entry): entry is Record<string, unknown> =>
              Boolean(entry) &&
              typeof entry === "object" &&
              !Array.isArray(entry),
          );
        }
      }
    }
  } catch {
    // Try JSONL or CSV below.
  }

  const lines = trimmed.split(/\r?\n/).filter(Boolean);
  const jsonlRows = lines.flatMap((line) => {
    try {
      const parsed = JSON.parse(line) as unknown;
      return parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? [parsed as Record<string, unknown>]
        : [];
    } catch {
      return [];
    }
  });
  if (jsonlRows.length >= Math.max(1, Math.floor(lines.length * 0.5))) {
    return jsonlRows;
  }

  const headers = parseCsvLine(lines[0] || "").map((header) => header.trim());
  if (headers.length >= 2 && lines.length > 1) {
    return lines.slice(1).flatMap((line) => {
      const cells = parseCsvLine(line);
      const record: Record<string, unknown> = {};
      headers.forEach((header, index) => {
        record[header] = cells[index] || "";
      });
      return Object.values(record).some((value) => String(value).trim())
        ? [record]
        : [];
    });
  }

  return [];
}

function convertCommunityRecord(
  record: Record<string, unknown>,
  format: AgentFineTuneDatasetFormat,
) {
  const messages = coerceChatMessages(record);
  const prompt =
    messages.find((message) => message.role === "user")?.content ||
    readStringField(record, [
      "prompt",
      "instruction",
      "query",
      "question",
      "input",
      "human",
    ]);
  const response =
    [...messages].reverse().find((message) => message.role === "assistant")
      ?.content ||
    readStringField(record, [
      "completion",
      "response",
      "output",
      "answer",
      "target",
      "assistant",
    ]);
  if (!prompt || !response) return null;
  if (format === "chat-jsonl") {
    const usableMessages = messages.length
      ? messages
      : [
          { role: "user", content: prompt },
          { role: "assistant", content: response },
        ];
    return { messages: usableMessages };
  }
  return { instruction: prompt, input: "", output: response };
}

type CommunitySourceResolution = {
  downloadUrl: string;
  sourcePageUrl: string;
  sourceLabel: string;
  resolutionNote?: string;
};

const COMMUNITY_DATASET_FILE_RE = /\.(jsonl|json|csv)(?:[?#]|$)/i;

function encodePathSegments(value: string) {
  return value.split("/").map(encodeURIComponent).join("/");
}

function isDirectDatasetFileUrl(url: URL) {
  return (
    COMMUNITY_DATASET_FILE_RE.test(url.pathname) ||
    url.hostname === "raw.githubusercontent.com" ||
    (url.hostname === "huggingface.co" && url.pathname.includes("/resolve/"))
  );
}

function githubBlobToRawUrl(url: URL) {
  if (url.hostname !== "github.com" || !url.pathname.includes("/blob/")) {
    return null;
  }
  const parts = url.pathname.split("/").filter(Boolean);
  const blobIndex = parts.indexOf("blob");
  if (parts.length <= blobIndex + 2) return null;
  return `https://raw.githubusercontent.com/${parts[0]}/${parts[1]}/${parts
    .slice(blobIndex + 1)
    .join("/")}`;
}

function huggingFaceBlobToResolveUrl(url: URL) {
  if (
    url.hostname !== "huggingface.co" ||
    !url.pathname.startsWith("/datasets/") ||
    !url.pathname.includes("/blob/")
  ) {
    return null;
  }
  return url.toString().replace("/blob/", "/resolve/");
}

function normalizeDatasetHref(rawHref: string, baseUrl: URL) {
  const cleaned = rawHref.replace(/&amp;/g, "&").replace(/^['"]|['"]$/g, "");
  try {
    return new URL(cleaned, baseUrl).toString();
  } catch {
    return null;
  }
}

function pickDatasetCandidateFromHtml(html: string, baseUrl: URL) {
  const candidates = new Set<string>();
  const hrefRe = /href=["']([^"']+)["']/gi;
  let match: RegExpExecArray | null;
  while ((match = hrefRe.exec(html))) {
    const href = match[1];
    if (!COMMUNITY_DATASET_FILE_RE.test(href) && !href.includes("/resolve/")) {
      continue;
    }
    const normalized = normalizeDatasetHref(href, baseUrl);
    if (normalized) candidates.add(normalized);
  }
  const scored = [...candidates].sort((a, b) => {
    const score = (value: string) => {
      const lower = value.toLowerCase();
      return (
        (lower.includes("train") ? 20 : 0) +
        (lower.includes("sample") ? 12 : 0) +
        (lower.includes("sft") ? 10 : 0) +
        (lower.endsWith(".jsonl") ? 8 : 0) +
        (lower.includes("jsonl") ? 5 : 0) -
        (lower.includes("README".toLowerCase()) ? 20 : 0)
      );
    };
    return score(b) - score(a);
  });
  return scored[0] || null;
}

async function resolveHuggingFaceDatasetFile(url: URL) {
  const parts = url.pathname.split("/").filter(Boolean);
  if (parts[0] !== "datasets" || parts.length < 3) return null;
  const repoId = `${parts[1]}/${parts[2]}`;
  const apiUrl = `https://huggingface.co/api/datasets/${repoId}/tree/main?recursive=true`;
  try {
    const response = await fetch(apiUrl, {
      headers: { "User-Agent": "FirstLLMStudio/0.3" },
      cache: "no-store",
    });
    if (!response.ok) return null;
    const tree = (await response.json()) as Array<{
      path?: string;
      type?: string;
      size?: number;
    }>;
    const files = tree
      .filter(
        (entry) =>
          entry.type === "file" &&
          entry.path &&
          COMMUNITY_DATASET_FILE_RE.test(entry.path),
      )
      .sort((a, b) => {
        const score = (entry: { path?: string; size?: number }) => {
          const lower = (entry.path || "").toLowerCase();
          const size = entry.size || 0;
          return (
            (lower.includes("train") ? 40 : 0) +
            (lower.includes("sft") ? 24 : 0) +
            (lower.includes("sample") ? 18 : 0) +
            (lower.endsWith(".jsonl") ? 14 : 0) +
            (size > 0 && size <= MAX_COMMUNITY_IMPORT_BYTES ? 8 : 0) -
            (lower.includes("test") ? 10 : 0) -
            (size > MAX_COMMUNITY_IMPORT_BYTES * 8 ? 18 : 0)
          );
        };
        return score(b) - score(a);
      });
    const picked = files[0]?.path;
    return picked
      ? `https://huggingface.co/datasets/${repoId}/resolve/main/${encodePathSegments(
          picked,
        )}`
      : null;
  } catch {
    return null;
  }
}

async function resolveCommunitySourceUrl(
  inputUrl: string,
): Promise<CommunitySourceResolution> {
  const trimmed = inputUrl.trim();
  if (!trimmed) {
    throw new Error("sourceUrl is required.");
  }
  let url: URL;
  try {
    url = new URL(trimmed);
  } catch {
    throw new Error("sourceUrl must be a valid URL.");
  }

  const githubRawUrl = githubBlobToRawUrl(url);
  if (githubRawUrl) {
    return {
      downloadUrl: githubRawUrl,
      sourcePageUrl: url.toString(),
      sourceLabel: "github",
      resolutionNote: "Resolved GitHub blob page to raw file.",
    };
  }

  const hfResolveUrl = huggingFaceBlobToResolveUrl(url);
  if (hfResolveUrl) {
    return {
      downloadUrl: hfResolveUrl,
      sourcePageUrl: url.toString(),
      sourceLabel: "huggingface",
      resolutionNote: "Resolved Hugging Face blob page to /resolve/ file.",
    };
  }

  if (isDirectDatasetFileUrl(url)) {
    return {
      downloadUrl: url.toString(),
      sourcePageUrl: url.toString(),
      sourceLabel: url.hostname.replace(/^www\./, ""),
    };
  }

  if (
    url.hostname === "huggingface.co" &&
    url.pathname.startsWith("/datasets/")
  ) {
    const resolved = await resolveHuggingFaceDatasetFile(url);
    if (resolved) {
      return {
        downloadUrl: resolved,
        sourcePageUrl: url.toString(),
        sourceLabel: "huggingface",
        resolutionNote:
          "Resolved Hugging Face dataset page to the best matching train/sample file.",
      };
    }
  }

  try {
    const response = await fetch(url.toString(), {
      headers: { "User-Agent": "FirstLLMStudio/0.3" },
      cache: "no-store",
    });
    if (response.ok) {
      const html = await response.text();
      const candidate = pickDatasetCandidateFromHtml(html, url);
      if (candidate) {
        return {
          downloadUrl: candidate,
          sourcePageUrl: url.toString(),
          sourceLabel: url.hostname.replace(/^www\./, ""),
          resolutionNote:
            "Resolved source page to a linked JSONL/JSON/CSV file.",
        };
      }
    }
  } catch {
    // Fall through to the explicit error below.
  }

  throw new Error(
    "Could not find a downloadable JSONL, JSON, or CSV file from this community page. Use a direct file URL or load one of the curated beginner presets.",
  );
}

function estimateFineTuneLicenseRisk(
  license?: string,
): AgentFineTuneDatasetLicenseRisk {
  const value = (license || "").toLowerCase();
  if (!value.trim()) return "unknown";
  if (
    value.includes("gpl") ||
    value.includes("non-commercial") ||
    value.includes("nc") ||
    value.includes("research only") ||
    value.includes("gated")
  ) {
    return "high";
  }
  if (
    value.includes("verify") ||
    value.includes("custom") ||
    value.includes("unknown") ||
    value.includes("card terms")
  ) {
    return "medium";
  }
  return "low";
}

function containsPotentialSensitiveData(value: unknown) {
  const text = JSON.stringify(value);
  return [
    /sk-[a-zA-Z0-9_-]{20,}/,
    /hf_[a-zA-Z0-9]{20,}/,
    /ms-[a-zA-Z0-9-]{20,}/,
    /AKIA[0-9A-Z]{16}/,
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/,
    /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i,
    /(?:\+?86[- ]?)?1[3-9]\d{9}/,
  ].some((pattern) => pattern.test(text));
}

function buildImportedDatasetQuality(input: {
  downloadedRows: number;
  convertedRows: number;
  sampledRows: number;
  duplicateRows: number;
  piiRiskRows: number;
  format: AgentFineTuneDatasetFormat;
  license?: string;
}): AgentFineTuneDatasetQuality {
  const licenseRisk = estimateFineTuneLicenseRisk(input.license);
  const skippedRows = Math.max(0, input.downloadedRows - input.convertedRows);
  const duplicateRatio =
    input.convertedRows > 0 ? input.duplicateRows / input.convertedRows : 0;
  const skippedRatio =
    input.downloadedRows > 0 ? skippedRows / input.downloadedRows : 0;
  const piiRatio =
    input.sampledRows > 0 ? input.piiRiskRows / input.sampledRows : 0;
  const recommended =
    input.sampledRows < 100
      ? { min: 50, max: 200, label: "short smoke only" }
      : input.sampledRows < 500
        ? { min: 200, max: 600, label: "beginner adapter" }
        : input.sampledRows < 1500
          ? { min: 600, max: 1200, label: "long beginner run" }
          : { min: 1000, max: 3000, label: "long local run" };
  const score = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        100 -
          skippedRatio * 25 -
          duplicateRatio * 18 -
          piiRatio * 35 -
          (input.sampledRows < 64 ? 15 : 0) -
          (licenseRisk === "high"
            ? 15
            : licenseRisk === "medium"
              ? 8
              : licenseRisk === "unknown"
                ? 5
                : 0),
      ),
    ),
  );
  return {
    score,
    licenseRisk,
    downloadedRows: input.downloadedRows,
    convertedRows: input.convertedRows,
    sampledRows: input.sampledRows,
    duplicateRows: input.duplicateRows,
    skippedRows,
    piiRiskRows: input.piiRiskRows,
    schemaConversion:
      input.format === "chat-jsonl"
        ? "community rows converted to messages[] chat JSONL"
        : "community rows converted to instruction/input/output JSONL",
    recommendedSteps: recommended,
  };
}

function buildCommunityQualityWarnings(input: {
  quality: AgentFineTuneDatasetQuality;
  resolutionNote?: string;
  truncatedDownload?: boolean;
}) {
  const warnings = [
    "Imported from a community source. Review license, duplicates, and private-data risk before long training runs.",
  ];
  if (input.resolutionNote) warnings.push(input.resolutionNote);
  if (input.truncatedDownload) {
    warnings.push(
      "Only the first import window was read from a large upstream file. Increase sample coverage by using a smaller exported slice when needed.",
    );
  }
  warnings.push(
    `Converted ${input.quality.convertedRows ?? 0}/${input.quality.downloadedRows ?? 0} downloaded rows and kept ${input.quality.sampledRows ?? 0} sampled rows.`,
  );
  if (input.quality.duplicateRows) {
    warnings.push(`Removed ${input.quality.duplicateRows} duplicate rows.`);
  }
  if (input.quality.piiRiskRows) {
    warnings.push(
      `Potential private data detected in ${input.quality.piiRiskRows} sampled rows. Review before training.`,
    );
  }
  if (input.quality.licenseRisk !== "low") {
    warnings.push(
      `License risk is ${input.quality.licenseRisk}. Verify upstream terms.`,
    );
  }
  return warnings;
}

async function readCommunityDatasetResponseText(response: Response) {
  const contentLength = Number(response.headers.get("content-length") || "0");
  if (contentLength > 0 && contentLength <= MAX_COMMUNITY_IMPORT_BYTES) {
    return { content: await response.text(), truncated: false };
  }
  if (!response.body) {
    if (contentLength > MAX_COMMUNITY_IMPORT_BYTES) {
      throw new Error(
        `Community dataset file is too large for direct import (${contentLength} bytes). Use a smaller sampled slice first.`,
      );
    }
    return { content: await response.text(), truncated: false };
  }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let bytes = 0;
  let truncated = false;
  while (true) {
    const { done, value } = await reader.read();
    if (done || !value) break;
    if (bytes + value.length > MAX_COMMUNITY_IMPORT_BYTES) {
      const remaining = Math.max(0, MAX_COMMUNITY_IMPORT_BYTES - bytes);
      if (remaining > 0) chunks.push(value.slice(0, remaining));
      truncated = true;
      await reader.cancel();
      break;
    }
    chunks.push(value);
    bytes += value.length;
  }
  const decoder = new TextDecoder();
  return {
    content:
      chunks.map((chunk) => decoder.decode(chunk, { stream: true })).join("") +
      decoder.decode(),
    truncated,
  };
}

export async function importFineTuneCommunityDataset(input: {
  label: string;
  sourceUrl: string;
  format: AgentFineTuneDatasetFormat;
  sampleLimit?: number;
  upstreamQuery?: string;
  refreshCadenceHours?: number;
  sourceLabel?: string;
  license?: string;
}) {
  const label = input.label.trim();
  if (!label) {
    throw new Error("Dataset label is required.");
  }
  const sourceResolution = await resolveCommunitySourceUrl(input.sourceUrl);
  const sourceUrl = sourceResolution.downloadUrl;
  const sampleLimit =
    typeof input.sampleLimit === "number" && Number.isFinite(input.sampleLimit)
      ? Math.max(
          16,
          Math.min(MAX_COMMUNITY_IMPORT_ROWS, Math.round(input.sampleLimit)),
        )
      : 384;
  const response = await fetch(sourceUrl, {
    headers: { "User-Agent": "FirstLLMStudio/0.3" },
    cache: "no-store",
  });
  if (!response.ok) {
    throw new Error(
      `Community dataset download failed: HTTP ${response.status}.`,
    );
  }
  const { content, truncated } =
    await readCommunityDatasetResponseText(response);
  if (content.length > MAX_COMMUNITY_IMPORT_BYTES) {
    throw new Error(
      "Community dataset file is too large for direct import. Use a smaller sampled slice first.",
    );
  }
  const rows = parseCommunityDatasetRows(content);
  if (!rows.length) {
    throw new Error("No convertible rows found in the community dataset file.");
  }
  const convertedRows = rows.flatMap((row) => {
    const output = convertCommunityRecord(row, input.format);
    return output ? [output] : [];
  });
  const seen = new Set<string>();
  let duplicateRows = 0;
  const converted = convertedRows.flatMap((output) => {
    const key = JSON.stringify(output).slice(0, 1200);
    if (seen.has(key)) {
      duplicateRows += 1;
      return [];
    }
    seen.add(key);
    return [output];
  });
  if (!converted.length) {
    throw new Error(
      "Community dataset rows were downloaded, but none matched a supported instruction/chat schema.",
    );
  }
  const sampled = converted.slice(0, sampleLimit);
  const quality = buildImportedDatasetQuality({
    downloadedRows: rows.length,
    convertedRows: convertedRows.length,
    sampledRows: sampled.length,
    duplicateRows,
    piiRiskRows: sampled.filter(containsPotentialSensitiveData).length,
    format: input.format,
    license: input.license,
  });
  const now = new Date();
  const slug = normalizeFineTuneSlug(label || new URL(sourceUrl).pathname);
  const localFile = path.join(
    PROJECT_COMMUNITY_DATA_DIR,
    `${slug || "community-import"}-${now.toISOString().slice(0, 10)}.jsonl`,
  );
  mkdirSync(path.dirname(localFile), { recursive: true });
  writeFileSync(
    localFile,
    `${sampled.map((row) => JSON.stringify(row)).join("\n")}\n`,
    "utf8",
  );
  const validation = validateFineTuneDatasetFromPath(localFile, input.format);
  if (!validation.ok) {
    throw new Error(
      validation.errors[0] || "Imported dataset validation failed.",
    );
  }
  const dataset = saveFineTuneDataset({
    label,
    sourcePath: localFile,
    format: input.format,
    upstreamQuery: input.upstreamQuery || sourceResolution.sourcePageUrl,
    refreshCadenceHours: input.refreshCadenceHours,
    sourceType: "community-import",
    sourceUrl: sourceResolution.sourcePageUrl,
    sourceLabel:
      input.sourceLabel ||
      sourceResolution.sourceLabel ||
      new URL(sourceResolution.sourcePageUrl).hostname,
    license: input.license,
    quality,
    qualityWarnings: buildCommunityQualityWarnings({
      quality,
      resolutionNote: sourceResolution.resolutionNote,
      truncatedDownload: truncated,
    }),
  });
  appendTimelineEvent({
    kind: "finetune",
    status: "saved",
    title: "Community dataset imported",
    summary: `${dataset.label} · ${dataset.sampleCount} rows`,
    relatedId: dataset.id,
    metadata: {
      sourceUrl,
      sourcePageUrl: sourceResolution.sourcePageUrl,
      sourceLabel: dataset.sourceLabel,
      sampleCount: dataset.sampleCount,
      qualityScore: dataset.quality?.score,
      licenseRisk: dataset.quality?.licenseRisk,
      format: dataset.format,
    },
  });
  return dataset;
}

function normalizeDatasetRecord(
  dataset: AgentFineTuneDataset,
): AgentFineTuneDataset {
  return {
    ...dataset,
    refreshCadenceHours:
      typeof dataset.refreshCadenceHours === "number" &&
      Number.isFinite(dataset.refreshCadenceHours)
        ? dataset.refreshCadenceHours
        : 24,
    latestUpstreamCandidates: Array.isArray(dataset.latestUpstreamCandidates)
      ? dataset.latestUpstreamCandidates
      : [],
  };
}

function isBundledSmokeDatasetCandidate(dataset: AgentFineTuneDataset) {
  return (
    dataset.id === BUNDLED_SMOKE_DATASET_ID ||
    dataset.sourcePath === BUNDLED_SMOKE_DATASET_PATH ||
    dataset.sourcePath === LEGACY_SMOKE_DATASET_PATH ||
    dataset.label === "ft-smoke-dataset" ||
    dataset.label === BUNDLED_SMOKE_DATASET_LABEL
  );
}

function reconcileBundledSmokeDatasets(datasets: AgentFineTuneDataset[]) {
  const normalized = datasets.map(normalizeDatasetRecord);
  if (!existsSync(BUNDLED_SMOKE_DATASET_PATH)) {
    return normalized;
  }

  const existing = normalized.find(isBundledSmokeDatasetCandidate);
  const validation = validateFineTuneDatasetFromPath(
    BUNDLED_SMOKE_DATASET_PATH,
    "instruction-jsonl",
  );
  const now = new Date().toISOString();
  const desired: AgentFineTuneDataset = {
    id: existing?.id || BUNDLED_SMOKE_DATASET_ID,
    label: existing?.label || BUNDLED_SMOKE_DATASET_LABEL,
    format: "instruction-jsonl",
    sourcePath: BUNDLED_SMOKE_DATASET_PATH,
    sourceType: "bundled-preset",
    sampleCount: validation.sampleCount,
    upstreamQuery:
      existing?.upstreamQuery || "first llm studio fine-tune smoke dataset",
    refreshCadenceHours: existing?.refreshCadenceHours || 24,
    quality: existing?.quality,
    latestUpstreamCandidates: existing?.latestUpstreamCandidates || [],
    lastUpstreamCheckedAt: existing?.lastUpstreamCheckedAt || now,
    nextUpstreamCheckAt:
      existing?.nextUpstreamCheckAt ||
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    createdAt: existing?.createdAt || now,
    updatedAt: existing?.updatedAt || now,
    validation,
  };

  const needsWrite =
    !existing ||
    existing.sourcePath !== desired.sourcePath ||
    existing.format !== desired.format ||
    existing.sampleCount !== desired.sampleCount ||
    JSON.stringify(existing.validation) !== JSON.stringify(desired.validation);

  if (!needsWrite) {
    return normalized;
  }

  desired.updatedAt = now;
  const next = [
    desired,
    ...normalized.filter((dataset) => !isBundledSmokeDatasetCandidate(dataset)),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  writeDatasets(next);
  return next;
}

export function readDatasets() {
  return reconcileBundledSmokeDatasets(readStoredDatasets()).sort((a, b) =>
    b.updatedAt.localeCompare(a.updatedAt),
  );
}

export function validateFineTuneDatasetFromPath(
  sourcePath: string,
  format: AgentFineTuneDatasetFormat,
) {
  return validateFineTuneDatasetContent(readLocalTextFile(sourcePath), format);
}

export function saveFineTuneDataset(input: {
  id?: string;
  label: string;
  sourcePath: string;
  format: AgentFineTuneDatasetFormat;
  sourceType?: AgentFineTuneDataset["sourceType"];
  sourceUrl?: string;
  sourceLabel?: string;
  license?: string;
  qualityWarnings?: string[];
  quality?: AgentFineTuneDatasetQuality;
  upstreamQuery?: string;
  refreshCadenceHours?: number;
}) {
  const label = input.label.trim();
  const sourcePath = input.sourcePath.trim();
  if (!label) {
    throw new Error("Dataset label is required.");
  }
  const validation = validateFineTuneDatasetFromPath(sourcePath, input.format);
  if (!validation.ok) {
    throw new Error(validation.errors[0] || "Dataset validation failed.");
  }
  const now = new Date().toISOString();
  const datasets = readDatasets();
  const existing = input.id
    ? datasets.find((dataset) => dataset.id === input.id)
    : datasets.find(
        (dataset) =>
          dataset.sourcePath === sourcePath && dataset.format === input.format,
      ) || datasets.find((dataset) => dataset.label === label);
  const dataset: AgentFineTuneDataset = {
    id: existing?.id || `ft-dataset-${crypto.randomUUID()}`,
    label,
    format: input.format,
    sourcePath,
    sourceType: input.sourceType || existing?.sourceType || "local-path",
    sourceUrl: input.sourceUrl?.trim() || existing?.sourceUrl,
    sourceLabel: input.sourceLabel?.trim() || existing?.sourceLabel,
    license: input.license?.trim() || existing?.license,
    qualityWarnings: input.qualityWarnings || existing?.qualityWarnings,
    quality: input.quality || existing?.quality,
    sampleCount: validation.sampleCount,
    upstreamQuery: input.upstreamQuery?.trim() || existing?.upstreamQuery,
    refreshCadenceHours:
      typeof input.refreshCadenceHours === "number" &&
      Number.isFinite(input.refreshCadenceHours)
        ? Math.max(6, Math.min(24 * 30, Math.round(input.refreshCadenceHours)))
        : existing?.refreshCadenceHours,
    lastUpstreamCheckedAt: existing?.lastUpstreamCheckedAt,
    nextUpstreamCheckAt: existing?.nextUpstreamCheckAt,
    latestUpstreamCandidates: existing?.latestUpstreamCandidates,
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    validation,
  };
  const next = [
    dataset,
    ...datasets.filter((entry) => entry.id !== dataset.id),
  ].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  writeDatasets(next);
  return dataset;
}

function updateDatasetEntry(
  datasetId: string,
  updater: (dataset: AgentFineTuneDataset) => AgentFineTuneDataset,
) {
  const datasets = readDatasets();
  const dataset = datasets.find((entry) => entry.id === datasetId);
  if (!dataset) {
    throw new Error("Dataset not found.");
  }
  const next = datasets
    .map((entry) => (entry.id === datasetId ? updater(entry) : entry))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  writeDatasets(next);
  return next.find((entry) => entry.id === datasetId)!;
}

export function saveFineTuneDatasetWatch(input: {
  datasetId: string;
  upstreamQuery?: string;
  refreshCadenceHours?: number;
}) {
  const now = new Date().toISOString();
  const cadenceHours =
    typeof input.refreshCadenceHours === "number" &&
    Number.isFinite(input.refreshCadenceHours)
      ? Math.max(6, Math.min(24 * 30, Math.round(input.refreshCadenceHours)))
      : undefined;
  return updateDatasetEntry(input.datasetId, (dataset) => ({
    ...dataset,
    upstreamQuery: input.upstreamQuery?.trim() || dataset.upstreamQuery,
    refreshCadenceHours: cadenceHours ?? dataset.refreshCadenceHours,
    nextUpstreamCheckAt:
      cadenceHours || dataset.refreshCadenceHours
        ? new Date(
            Date.now() +
              (cadenceHours ?? dataset.refreshCadenceHours ?? 24) *
                60 *
                60 *
                1000,
          ).toISOString()
        : dataset.nextUpstreamCheckAt,
    updatedAt: now,
  }));
}

export async function checkFineTuneDatasetUpstream(input: {
  datasetId: string;
  query?: string;
}) {
  const dataset = readDatasets().find((entry) => entry.id === input.datasetId);
  if (!dataset) {
    throw new Error("Dataset not found.");
  }
  const query =
    input.query?.trim() || dataset.upstreamQuery?.trim() || dataset.label;
  if (!query) {
    throw new Error("Upstream dataset query is required.");
  }
  const matches = await discoverFineTuneUpstreamDatasets(query);
  const checkedAt = new Date().toISOString();
  const refreshCadenceHours = dataset.refreshCadenceHours || 24;
  return updateDatasetEntry(dataset.id, (current) => ({
    ...current,
    upstreamQuery: query,
    lastUpstreamCheckedAt: checkedAt,
    nextUpstreamCheckAt: new Date(
      Date.now() + refreshCadenceHours * 60 * 60 * 1000,
    ).toISOString(),
    latestUpstreamCandidates: matches,
    updatedAt: checkedAt,
  }));
}

export async function refreshDueFineTuneDatasetWatches() {
  const datasets = readDatasets();
  const due = datasets.filter((dataset) => {
    if (!dataset.refreshCadenceHours || !dataset.upstreamQuery) return false;
    if (!dataset.nextUpstreamCheckAt) return true;
    return Date.parse(dataset.nextUpstreamCheckAt) <= Date.now();
  });
  for (const dataset of due) {
    try {
      await checkFineTuneDatasetUpstream({
        datasetId: dataset.id,
        query: dataset.upstreamQuery,
      });
    } catch {
      // keep the last successful upstream snapshot
    }
  }
  return readDatasets();
}
