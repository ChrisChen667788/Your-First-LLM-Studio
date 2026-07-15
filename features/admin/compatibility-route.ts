import { recordAdminCompatibilityUsage } from "@/features/admin/compatibility-usage";

type RouteHandler = (...args: any[]) => Response | Promise<Response>;

export const ADMIN_COMPATIBILITY_SUNSET = "Wed, 30 Sep 2026 00:00:00 GMT";
export const ADMIN_COMPATIBILITY_SUNSET_ISO = "2026-09-30T00:00:00.000Z";

export const ADMIN_COMPATIBILITY_ROUTES = [
  {
    legacyPath: "/api/admin/knowledge-base",
    canonicalPath: "/api/retrieval",
    methods: ["GET", "POST", "DELETE"],
    smokeMethods: ["GET"],
  },
  {
    legacyPath: "/api/admin/knowledge-base/query",
    canonicalPath: "/api/retrieval/query",
    methods: ["POST"],
    smokeMethods: [],
  },
  {
    legacyPath: "/api/admin/finetune",
    canonicalPath: "/api/finetune",
    methods: ["GET", "POST"],
    smokeMethods: ["GET"],
  },
  {
    legacyPath: "/api/admin/model-discovery",
    canonicalPath: "/api/models/discovery",
    methods: ["GET", "POST"],
    smokeMethods: ["GET"],
  },
  {
    legacyPath: "/api/admin/timeline",
    canonicalPath: "/api/experiments",
    methods: ["GET", "POST"],
    smokeMethods: ["GET"],
  },
] as const;

export function withAdminCompatibilityHeaders<T extends RouteHandler>(
  handler: T,
  canonicalPath: string,
) {
  return (async (...args: Parameters<T>) => {
    recordAdminCompatibilityUsage(args[0], canonicalPath);
    const response = await handler(...args);
    response.headers.set("Deprecation", "true");
    response.headers.set("Sunset", ADMIN_COMPATIBILITY_SUNSET);
    response.headers.set(
      "Link",
      `<${canonicalPath}>; rel="successor-version"`,
    );
    response.headers.set(
      "Warning",
      `299 - "Deprecated Admin compatibility API; use ${canonicalPath}"`,
    );
    return response;
  }) as T;
}
