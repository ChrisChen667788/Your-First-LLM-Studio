import {
  handleEvidenceCollectionTrainGet,
  handleEvidenceCollectionTrainPost,
} from "@/features/experiments/evidence-collection-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleEvidenceCollectionTrainGet();
}

export async function POST(request: Request) {
  return handleEvidenceCollectionTrainPost(request);
}
