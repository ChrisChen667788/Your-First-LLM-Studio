import { withAdminCompatibilityHeaders } from "@/features/admin/compatibility-route";
import {
  GET as canonicalGET,
  POST as canonicalPOST,
} from "@/features/models/application";

export const runtime = "nodejs";

export const GET = withAdminCompatibilityHeaders(
  canonicalGET,
  "/api/models/discovery",
);
export const POST = withAdminCompatibilityHeaders(
  canonicalPOST,
  "/api/models/discovery",
);
