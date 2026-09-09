import {
  handleExternalEvidenceHandoffTrainGet,
  handleExternalEvidenceHandoffTrainPost,
} from "@/features/experiments/evidence-external-handoff-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleExternalEvidenceHandoffTrainGet();
}

export async function POST(request: Request) {
  return handleExternalEvidenceHandoffTrainPost(request);
}
