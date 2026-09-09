import { createHash, createPublicKey } from "node:crypto";
import { closeSync, constants, fstatSync, openSync, readFileSync } from "node:fs";
import { ActivationIntakeError, trustSchema, type ActivationTrust } from "./contracts";

export function publicKeyFingerprint(pem: string) {
  const key = createPublicKey(pem);
  if (key.asymmetricKeyType !== "ed25519") throw new ActivationIntakeError("trust-invalid", 503);
  return createHash("sha256").update(key.export({ format: "der", type: "spki" })).digest("hex");
}

export function parseActivationTrust(input: unknown): ActivationTrust {
  try {
    const trust = trustSchema.parse(input);
    const ids = new Set<string>();
    const fingerprints = new Set<string>();
    for (const key of trust.keys) {
      const id = `${key.issuerId}:${key.keyId}`;
      if (ids.has(id) || fingerprints.has(key.fingerprint) ||
          !/^-----BEGIN PUBLIC KEY-----/u.test(key.publicKeyPem) ||
          publicKeyFingerprint(key.publicKeyPem) !== key.fingerprint ||
          Date.parse(key.notBefore) >= Date.parse(key.notAfter) ||
          new Set(key.stages).size !== key.stages.length || new Set(key.milestones).size !== key.milestones.length) {
        throw new ActivationIntakeError("trust-invalid", 503);
      }
      ids.add(id);
      fingerprints.add(key.fingerprint);
    }
    return trust;
  } catch {
    throw new ActivationIntakeError("trust-invalid", 503);
  }
}

export function loadActivationTrust(): ActivationTrust {
  const file = process.env.FIRST_LLM_EVIDENCE_TRUST_PATH;
  if (!file) throw new ActivationIntakeError("unconfigured", 503);
  let descriptor: number | undefined;
  try {
    descriptor = openSync(file, constants.O_RDONLY | constants.O_NOFOLLOW);
    const metadata = fstatSync(descriptor);
    if (!metadata.isFile() || metadata.size > 256 * 1024 || (metadata.mode & 0o022) !== 0) {
      throw new Error("Untrusted configuration file.");
    }
    return parseActivationTrust(JSON.parse(readFileSync(descriptor, "utf8")));
  } catch {
    throw new ActivationIntakeError("trust-invalid", 503);
  } finally {
    if (descriptor !== undefined) closeSync(descriptor);
  }
}
