export const MULTIMODAL_EVALUATOR_REVISIONS = {
  mmmu: "268471d0d488258990025331c7528359c324aa25",
  mathvista: "c5acd37d75a8c8f9756cb66c78fe2e54fa2c31fb",
  mmbench: "8eaac9ae42e22eaf42863b218455acd51268ba1c",
  "video-mme-v2": "b2834bd4091d6234ccaf0fa1f149a7ef4eac5875",
} as const;

export type OfficialChoiceEvaluation = {
  extracted: string | null;
  passed: boolean;
  scorable: boolean;
  rationale: string;
};

function lastByPosition(candidates: Array<{ value: string; position: number }>) {
  return candidates.sort((left, right) => right.position - left.position)[0]
    ?.value;
}

export function parseMmmuMultipleChoiceResponse(input: {
  response: string;
  choices: string[];
  choiceTextByLabel: Record<string, string>;
}) {
  const labels = input.choices.map((choice) => choice.toUpperCase());
  const trimmed = input.response.trim().replace(/^[,.!?;:'"]+|[,.!?;:'"]+$/g, "");
  const padded = ` ${trimmed} `;
  const bracketed = labels.flatMap((label) => {
    const token = `(${label})`;
    const position = padded.lastIndexOf(token);
    return position >= 0 ? [{ value: label, position }] : [];
  });
  if (bracketed.length) return lastByPosition(bracketed) || null;

  const bare = labels.flatMap((label) => {
    const token = ` ${label} `;
    const position = padded.lastIndexOf(token);
    return position >= 0 ? [{ value: label, position }] : [];
  });
  if (bare.length) return lastByPosition(bare) || null;

  if (trimmed.split(/\s+/).length > 5) {
    const lower = trimmed.toLowerCase();
    const content = labels.flatMap((label) => {
      const answer = input.choiceTextByLabel[label]?.toLowerCase();
      const position = answer ? lower.lastIndexOf(answer) : -1;
      return position >= 0 ? [{ value: label, position }] : [];
    });
    if (content.length) return lastByPosition(content) || null;
  }
  return null;
}

export function evaluateMmmuMultipleChoice(input: {
  response: string;
  answer: string | string[];
  choices: string[];
  choiceTextByLabel: Record<string, string>;
}): OfficialChoiceEvaluation {
  const extracted = parseMmmuMultipleChoiceResponse(input);
  if (!extracted) {
    return {
      extracted: null,
      passed: false,
      scorable: false,
      rationale:
        "MMMU rule extraction failed. The upstream random-guess fallback is intentionally not fabricated outside a seeded batch run.",
    };
  }
  const answers = Array.isArray(input.answer) ? input.answer : [input.answer];
  const passed = answers.includes(extracted);
  return {
    extracted,
    passed,
    scorable: true,
    rationale: passed ? "MMMU choice matched." : `Expected ${answers.join("/")}, received ${extracted}.`,
  };
}

function normalizeMmmuValue(value: string): Array<string | number> {
  const trimmed = value.trim();
  const numeric = Number(trimmed.replace(/,/g, ""));
  if (trimmed && Number.isFinite(numeric)) return [Number(numeric.toFixed(2))];
  const lower = trimmed.toLowerCase();
  return lower.length === 1 ? [` ${lower}`, `${lower} `] : [lower];
}

export function evaluateMmmuOpenAnswer(answer: string | string[], predictions: string[]) {
  const answers = (Array.isArray(answer) ? answer : [answer]).flatMap<string | number>(normalizeMmmuValue);
  const normalizedPredictions = predictions.flatMap<string | number>(normalizeMmmuValue);
  return normalizedPredictions.some((prediction) =>
    answers.some((gold) =>
      typeof prediction === "number" && typeof gold === "number"
        ? prediction === gold
        : typeof prediction === "string" && typeof gold === "string"
          ? prediction.includes(gold)
          : false,
    ),
  );
}

export function parseMmmuOpenResponse(response: string) {
  const normalized = response.trim().replace(/\.$/, "").toLowerCase();
  const sentences = normalized.split(/\.\s(?=[A-Z])|\n/);
  const indicators = [
    "could be ",
    "so ",
    "is ",
    "thus ",
    "therefore ",
    "final ",
    "answer ",
    "result ",
  ];
  const keyResponses = sentences.flatMap((sentence, index) => {
    const activeIndicators =
      index === sentences.length - 1 ? [...indicators, "="] : indicators;
    const candidates = activeIndicators.flatMap((indicator) => {
      const position = sentence.lastIndexOf(indicator);
      return position >= 0
        ? [sentence.slice(position + indicator.length).trim()]
        : [];
    }).filter((value) => value && !/^[:,.!?;'\"]$/.test(value));
    return candidates.length
      ? [candidates.sort((left, right) => left.length - right.length)[0]]
      : [];
  });
  const base = keyResponses.length ? keyResponses : [normalized];
  const numbers = base.flatMap((value) =>
    value.match(/-?\b\d{1,3}(?:,\d{3})+\b|-?\d+(?:\.\d+)?[eE][+-]?\d+|-?(?:\d+\.\d+|\.\d+|\d+\b)(?![eE][+-]?\d+)(?![,\d])/g) || [],
  );
  return [...new Set([...base, ...numbers])];
}

function levenshtein(left: string, right: string) {
  const previous = Array.from({ length: right.length + 1 }, (_, index) => index);
  for (let leftIndex = 1; leftIndex <= left.length; leftIndex += 1) {
    const current = [leftIndex];
    for (let rightIndex = 1; rightIndex <= right.length; rightIndex += 1) {
      current[rightIndex] = Math.min(
        current[rightIndex - 1] + 1,
        previous[rightIndex] + 1,
        previous[rightIndex - 1] +
          (left[leftIndex - 1] === right[rightIndex - 1] ? 0 : 1),
      );
    }
    previous.splice(0, previous.length, ...current);
  }
  return previous[right.length];
}

export function normalizeMathVistaAnswer(input: {
  extraction: unknown;
  choices: string[];
  questionType: "multi_choice" | "free_form";
  answerType: "integer" | "float" | "list" | "text";
  precision?: number;
}) {
  const extraction = String(input.extraction ?? "").trim();
  if (input.questionType === "multi_choice") {
    const bracketed = extraction.match(/\(([a-zA-Z])\)/)?.[1]?.toUpperCase();
    const candidate = bracketed || extraction;
    const labels = input.choices.map((_, index) => String.fromCharCode(65 + index));
    if (labels.includes(candidate)) return input.choices[labels.indexOf(candidate)];
    return [...input.choices].sort(
      (left, right) =>
        levenshtein(extraction, left) - levenshtein(extraction, right),
    )[0] ?? null;
  }
  if (input.answerType === "integer") {
    const number = Number(extraction);
    return Number.isFinite(number) ? String(Math.trunc(number)) : null;
  }
  if (input.answerType === "float") {
    const number = Number(extraction);
    return Number.isFinite(number)
      ? String(Number(number.toFixed(Math.max(0, Math.trunc(input.precision || 0)))))
      : null;
  }
  if (input.answerType === "list") return extraction;
  return extraction || null;
}

export function evaluateMathVistaNormalized(input: {
  extraction: unknown;
  answer: unknown;
  choices: string[];
  questionType: "multi_choice" | "free_form";
  answerType: "integer" | "float" | "list" | "text";
  precision?: number;
}) {
  const prediction = normalizeMathVistaAnswer(input);
  return {
    prediction,
    passed: prediction === String(input.answer),
    extractionMode: "official-normalizer" as const,
    requiresJudgeExtraction:
      input.questionType !== "multi_choice" &&
      input.answerType !== "integer" &&
      input.answerType !== "float",
  };
}

export function evaluateMmbenchCircular(input: {
  expectedByPass: string[];
  extractedByPass: Array<string | null>;
}) {
  const passResults = input.expectedByPass.map(
    (answer, index) => input.extractedByPass[index] === answer,
  );
  const complete = input.expectedByPass.length > 0 &&
    input.extractedByPass.length === input.expectedByPass.length;
  return {
    complete,
    passed: complete && passResults.every(Boolean),
    passResults,
    requiredPasses: input.expectedByPass.length,
    completedPasses: input.extractedByPass.filter(Boolean).length,
  };
}

export function extractVideoMmeV2Choice(response: string) {
  const prefixes = [
    "Final Answer:",
    "The best answer is",
    "The correct answer is",
    "The answer is",
    "The answer",
    "The best option is",
    "The correct option is",
    "Best answer:",
    "Best option:",
    "Answer:",
    "Option:",
  ];
  let normalized = response.trim();
  for (const prefix of prefixes) normalized = normalized.replaceAll(prefix, "");
  return normalized.match(/[A-H]/)?.[0] || null;
}

export function scoreVideoMmeV2Relevance(scores: boolean[]) {
  const correct = scores.filter(Boolean).length;
  return ({ 0: 0, 1: 100 / 16, 2: 25, 3: 56.25, 4: 100 } as Record<number, number>)[correct] || 0;
}

export function scoreVideoMmeV2Logic(
  scores: boolean[],
  structure: "[1, 2, 3, 4]" | "[1, [2, 3], 4]" | "[[1, 2], 3, 4]",
) {
  let lastCorrect = -1;
  for (let index = 0; index < scores.length; index += 1) {
    if (!scores[index]) break;
    lastCorrect = index;
  }
  if (structure === "[1, [2, 3], 4]" && lastCorrect === 0 && scores[2]) {
    lastCorrect += 1;
  }
  if (structure === "[[1, 2], 3, 4]" && lastCorrect === -1 && scores[1]) {
    lastCorrect += 1;
  }
  const maps = {
    "[1, 2, 3, 4]": [0, 100 / 16, 25, 56.25, 100],
    "[1, [2, 3], 4]": [0, 100 / 12, 100 / 3, 700 / 12, 100],
    "[[1, 2], 3, 4]": [0, 10, 20, 50, 100],
  } as const;
  return maps[structure][lastCorrect + 1];
}

export function runMultimodalEvaluatorConformance() {
  const checks = [
    {
      id: "mmmu-choice-parser",
      passed:
        evaluateMmmuMultipleChoice({
          response: "After reviewing the diagram, the answer is (C).",
          answer: "C",
          choices: ["A", "B", "C", "D"],
          choiceTextByLabel: { A: "one", B: "two", C: "three", D: "four" },
        }).passed === true,
    },
    {
      id: "mmmu-open-normalization",
      passed: evaluateMmmuOpenAnswer(
        "1,234.001",
        parseMmmuOpenResponse("Therefore the result is 1234.00"),
      ),
    },
    {
      id: "mathvista-choice-normalizer",
      passed:
        evaluateMathVistaNormalized({
          extraction: "(B)",
          answer: "triangle",
          choices: ["circle", "triangle", "square"],
          questionType: "multi_choice",
          answerType: "text",
        }).passed === true,
    },
    {
      id: "mathvista-float-normalizer",
      passed:
        evaluateMathVistaNormalized({
          extraction: "3.14159",
          answer: "3.14",
          choices: [],
          questionType: "free_form",
          answerType: "float",
          precision: 2,
        }).passed === true,
    },
    {
      id: "mmbench-circular-all-pass",
      passed:
        evaluateMmbenchCircular({
          expectedByPass: ["A", "D", "C", "B"],
          extractedByPass: ["A", "D", "C", "B"],
        }).passed === true,
    },
    {
      id: "mmbench-circular-single-failure",
      passed:
        evaluateMmbenchCircular({
          expectedByPass: ["A", "D", "C", "B"],
          extractedByPass: ["A", "D", "A", "B"],
        }).passed === false,
    },
    {
      id: "video-mme-v2-choice-parser",
      passed: extractVideoMmeV2Choice("Final Answer: G") === "G",
    },
    {
      id: "video-mme-v2-relevance-rating",
      passed: scoreVideoMmeV2Relevance([true, true, true, false]) === 56.25,
    },
    {
      id: "video-mme-v2-logic-rating",
      passed:
        scoreVideoMmeV2Logic(
          [true, false, true, false],
          "[1, [2, 3], 4]",
        ) === 100 / 3,
    },
  ];
  return {
    checks,
    passed: checks.filter((check) => check.passed).length,
    total: checks.length,
  };
}
