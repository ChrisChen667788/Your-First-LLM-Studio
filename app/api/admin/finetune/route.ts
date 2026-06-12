import { withAdminCompatibilityHeaders } from "@/features/admin/compatibility-route";
import {
  GET as canonicalGET,
  POST as canonicalPOST,
} from "@/features/finetune/application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminCompatibilityHeaders(canonicalGET, "/api/finetune");
export const POST = withAdminCompatibilityHeaders(canonicalPOST, "/api/finetune");
