import { NextResponse } from "next/server";
import { appendExperimentEvent } from "@/features/experiments/timeline-service";
import type { ExperimentArtifactReference } from "@/features/experiments/contracts";
import {
  cleanCommunityModelInstallDirectory,
  openCommunityModelInstallDirectory,
  readCommunityModelDiscoverySummary,
  retryCommunityModelInstall,
  scanCommunityModels,
  startCommunityModelInstall,
  verifyCommunityModelInstall,
} from "@/lib/community/model-discovery";

export type ModelDiscoveryRequest =
  | {
      action?: "scan";
      query?: string;
    }
  | {
      action: "install";
      candidateId?: string;
    }
  | {
      action: "verify-install";
      jobId?: string;
    }
  | {
      action: "retry-install" | "clean-install-dir" | "open-install-dir";
      jobId?: string;
    };

export function getRequiredModelDiscoveryId(
  value: string | undefined,
  fieldName: string,
) {
  const id = value?.trim();
  if (!id) {
    throw new Error(`${fieldName} is required.`);
  }
  return id;
}

function buildModelInstallArtifacts(job: {
  installDir: string;
  logFile?: string;
  stateFile?: string;
  repoUrl?: string;
}): ExperimentArtifactReference[] {
  const artifacts: ExperimentArtifactReference[] = [
    {
      kind: "directory",
      role: "model",
      label: "Model install directory",
      uri: job.installDir,
    },
  ];
  if (job.logFile) {
    artifacts.push({ kind: "file", role: "log", label: "Install log", uri: job.logFile, mimeType: "text/plain" });
  }
  if (job.stateFile) {
    artifacts.push({ kind: "file", role: "manifest", label: "Install state", uri: job.stateFile, mimeType: "application/json" });
  }
  if (job.repoUrl) {
    artifacts.push({ kind: "url", role: "input", label: "Model repository", uri: job.repoUrl });
  }
  return artifacts;
}

function appendModelInstallEvent(input: {
  job: {
    id: string;
    candidateId: string;
    label: string;
    installDir: string;
    logFile?: string;
    stateFile?: string;
    repoUrl?: string;
    verification?: { status?: string; summary?: string };
  };
  action: "install" | "retry" | "verify" | "clean";
}) {
  const { job, action } = input;
  const verified = job.verification?.status === "verified";
  const failedVerification = action === "verify" && !verified;
  appendExperimentEvent({
    kind: "model",
    status:
      action === "clean"
        ? "cancelled"
        : failedVerification
          ? "failed"
          : action === "verify"
            ? "completed"
            : "started",
    title:
      action === "clean"
        ? "Model install directory cleaned"
        : action === "verify"
          ? verified
            ? "Model install verified"
            : "Model install verification failed"
          : action === "retry"
            ? "Model install retried"
            : "Model install started",
    summary: job.verification?.summary || `${job.label} · ${job.installDir}`,
    relatedId: job.id,
    artifacts: buildModelInstallArtifacts(job),
    links: [
      { relation: action === "retry" ? "continues" : "produced", entityType: "job", id: job.id },
      { relation: "uses", entityType: "model", id: job.candidateId, label: job.label },
    ],
    metadata: {
      action,
      candidateId: job.candidateId,
      verificationStatus: job.verification?.status,
    },
  });
}

export async function readModelDiscoverySummary() {
  return readCommunityModelDiscoverySummary();
}

export async function runModelDiscoveryAction(body: ModelDiscoveryRequest) {
  if (body.action === "install") {
    const candidateId = getRequiredModelDiscoveryId(
      body.candidateId,
      "candidateId",
    );
    const job = startCommunityModelInstall({ candidateId });
    appendModelInstallEvent({ job, action: "install" });
    const summary = await readCommunityModelDiscoverySummary();
    return { ok: true as const, job, summary };
  }

  if (body.action === "verify-install") {
    const jobId = getRequiredModelDiscoveryId(body.jobId, "jobId");
    const job = await verifyCommunityModelInstall({ jobId });
    appendModelInstallEvent({ job, action: "verify" });
    const summary = await readCommunityModelDiscoverySummary();
    return { ok: true as const, job, summary };
  }

  if (body.action === "retry-install") {
    const jobId = getRequiredModelDiscoveryId(body.jobId, "jobId");
    const job = retryCommunityModelInstall({ jobId });
    appendModelInstallEvent({ job, action: "retry" });
    const summary = await readCommunityModelDiscoverySummary();
    return { ok: true as const, job, summary };
  }

  if (body.action === "clean-install-dir") {
    const jobId = getRequiredModelDiscoveryId(body.jobId, "jobId");
    const job = await cleanCommunityModelInstallDirectory({ jobId });
    appendModelInstallEvent({ job, action: "clean" });
    const summary = await readCommunityModelDiscoverySummary();
    return { ok: true as const, job, summary };
  }

  if (body.action === "open-install-dir") {
    const jobId = getRequiredModelDiscoveryId(body.jobId, "jobId");
    const opened = openCommunityModelInstallDirectory({ jobId });
    const summary = await readCommunityModelDiscoverySummary();
    return { ok: true as const, opened, summary };
  }

  const summary = await scanCommunityModels(
    body.action === "scan" || typeof body.action === "undefined"
      ? body.query
      : undefined,
  );
  appendExperimentEvent({
    kind: "model",
    status: "completed",
    title: "Community model scan completed",
    summary: `${summary.candidates.length} candidate${summary.candidates.length === 1 ? "" : "s"} discovered`,
    metadata: {
      query: summary.query,
      candidateCount: summary.candidates.length,
      jobCount: summary.jobs.length,
    },
  });
  return { ok: true as const, summary };
}

export async function GET() {
  try {
    const summary = await readModelDiscoverySummary();
    return NextResponse.json({
      ok: true,
      summary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Failed to load community model summary.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ModelDiscoveryRequest;
    return NextResponse.json(await runModelDiscoveryAction(body));
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Failed to run community model action.";
    return NextResponse.json(
      {
        ok: false,
        error: message,
      },
      { status: message.endsWith("is required.") ? 400 : 500 },
    );
  }
}
