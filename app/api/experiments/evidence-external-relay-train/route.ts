import {
  handleExternalEvidenceRelayTrainGet,
  handleExternalEvidenceRelayTrainPost,
} from "@/features/experiments/evidence-external-relay-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleExternalEvidenceRelayTrainGet();
}

export async function POST(request: Request) {
  return handleExternalEvidenceRelayTrainPost(request);
}
