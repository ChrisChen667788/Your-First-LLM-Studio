type RouteHandler = (...args: never[]) => Response | Promise<Response>;

const ADMIN_COMPATIBILITY_SUNSET = "Wed, 30 Sep 2026 00:00:00 GMT";

export function withAdminCompatibilityHeaders<T extends RouteHandler>(
  handler: T,
  canonicalPath: string,
) {
  return (async (...args: Parameters<T>) => {
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
