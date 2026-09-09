import {
  handleExternalEvidenceActivationTrainGet,
  handleExternalEvidenceActivationTrainPost,
} from "@/features/experiments/evidence-external-activation-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleExternalEvidenceActivationTrainGet();
}

export async function POST(request: Request) {
  return handleExternalEvidenceActivationTrainPost(request);
}
