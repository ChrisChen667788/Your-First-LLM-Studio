import {
  handleEvidenceAcceptanceTrainGet,
  handleEvidenceAcceptanceTrainPost,
} from "@/features/experiments/evidence-acceptance-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleEvidenceAcceptanceTrainGet();
}

export async function POST(request: Request) {
  return handleEvidenceAcceptanceTrainPost(request);
}
