import { withAdminCompatibilityHeaders } from "@/features/admin/compatibility-route";
import { POST as canonicalPOST } from "@/features/retrieval/query-application";

export const runtime = "nodejs";

export const POST = withAdminCompatibilityHeaders(
  canonicalPOST,
  "/api/retrieval/query",
);
