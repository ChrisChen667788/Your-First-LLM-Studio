import {
  handleEvidenceOperationsTrainGet,
  handleEvidenceOperationsTrainPost,
} from "@/features/experiments/evidence-operations-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleEvidenceOperationsTrainGet();
}

export async function POST(request: Request) {
  return handleEvidenceOperationsTrainPost(request);
}
