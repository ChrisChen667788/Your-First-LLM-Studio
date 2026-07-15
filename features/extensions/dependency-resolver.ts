import type { ExtensionManifest } from "@/features/extensions/registry";

export const EXTENSION_DEPENDENCY_SCHEMA_VERSION = "extensions.dependencies.v1" as const;

function parse(version: string) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/);
  return match ? [Number(match[1]), Number(match[2]), Number(match[3])] as const : null;
}

function compare(a: readonly number[], b: readonly number[]) {
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

export function satisfiesExtensionVersion(version: string, range: string) {
  const actual = parse(version);
  if (!actual) return false;
  const trimmed = range.trim();
  if (trimmed === "*" || trimmed === "latest") return true;
  const expected = parse(trimmed.replace(/^(\^|~|>=|>)/, ""));
  if (!expected) return false;
  if (trimmed.startsWith("^")) return actual[0] === expected[0] && compare(actual, expected) >= 0;
  if (trimmed.startsWith("~")) return actual[0] === expected[0] && actual[1] === expected[1] && compare(actual, expected) >= 0;
  if (trimmed.startsWith(">=")) return compare(actual, expected) >= 0;
  if (trimmed.startsWith(">")) return compare(actual, expected) > 0;
  return compare(actual, expected) === 0;
}

export function resolveExtensionDependencies(manifests: ExtensionManifest[]) {
  const byId = new Map(manifests.map((manifest) => [manifest.id, manifest]));
  const errors: string[] = [];
  const edges: Array<{ from: string; to: string; range: string }> = [];
  for (const manifest of manifests) {
    for (const [dependencyId, range] of Object.entries(manifest.dependencies || {})) {
      edges.push({ from: manifest.id, to: dependencyId, range });
      const dependency = byId.get(dependencyId);
      if (!dependency) errors.push(`${manifest.id} requires missing dependency ${dependencyId}@${range}.`);
      else if (!satisfiesExtensionVersion(dependency.version, range)) {
        errors.push(`${manifest.id} requires ${dependencyId}@${range}, received ${dependency.version}.`);
      }
    }
  }
  const visiting = new Set<string>();
  const visited = new Set<string>();
  const visit = (id: string): boolean => {
    if (visiting.has(id)) return true;
    if (visited.has(id)) return false;
    visiting.add(id);
    const cycle = edges.filter((edge) => edge.from === id).some((edge) => visit(edge.to));
    visiting.delete(id);
    visited.add(id);
    return cycle;
  };
  if (manifests.some((manifest) => visit(manifest.id))) errors.push("Extension dependency graph contains a cycle.");
  const installOrder: string[] = [];
  const ordered = new Set<string>();
  const order = (id: string) => {
    if (ordered.has(id)) return;
    edges.filter((edge) => edge.from === id).forEach((edge) => order(edge.to));
    ordered.add(id);
    if (byId.has(id)) installOrder.push(id);
  };
  manifests.forEach((manifest) => order(manifest.id));
  return {
    schemaVersion: EXTENSION_DEPENDENCY_SCHEMA_VERSION,
    valid: errors.length === 0,
    errors,
    edges,
    installOrder,
  };
}
