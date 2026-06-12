import { withAdminCompatibilityHeaders } from "@/features/admin/compatibility-route";
import {
  DELETE as canonicalDELETE,
  GET as canonicalGET,
  POST as canonicalPOST,
} from "@/features/retrieval/application";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = withAdminCompatibilityHeaders(canonicalGET, "/api/retrieval");
export const POST = withAdminCompatibilityHeaders(canonicalPOST, "/api/retrieval");
export const DELETE = withAdminCompatibilityHeaders(canonicalDELETE, "/api/retrieval");
