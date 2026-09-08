import {
  handleEvidenceAdjudicationTrainGet,
  handleEvidenceAdjudicationTrainPost,
} from "@/features/experiments/evidence-adjudication-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleEvidenceAdjudicationTrainGet();
}

export async function POST(request: Request) {
  return handleEvidenceAdjudicationTrainPost(request);
}
