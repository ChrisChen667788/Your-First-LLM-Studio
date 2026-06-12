import { withAdminCompatibilityHeaders } from "@/features/admin/compatibility-route";
import {
  GET as canonicalGET,
  POST as canonicalPOST,
} from "@/features/experiments/application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminCompatibilityHeaders(
  canonicalGET,
  "/api/experiments",
);
export const POST = withAdminCompatibilityHeaders(
  canonicalPOST,
  "/api/experiments",
);
