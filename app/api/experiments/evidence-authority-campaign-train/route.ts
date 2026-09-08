import {
  handleEvidenceAuthorityCampaignTrainGet,
  handleEvidenceAuthorityCampaignTrainPost,
} from "@/features/experiments/evidence-authority-campaign-application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  return handleEvidenceAuthorityCampaignTrainGet();
}

export async function POST(request: Request) {
  return handleEvidenceAuthorityCampaignTrainPost(request);
}
