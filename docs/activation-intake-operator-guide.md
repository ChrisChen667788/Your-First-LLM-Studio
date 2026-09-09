# Signed Evidence Intake

## Trust and Lineage

Set `FIRST_LLM_EVIDENCE_TRUST_PATH` to a server-owned JSON file outside the
repository. It must be a regular non-symlink file, at most 256 KiB, with no
group/other write permission. The web API never accepts public keys or private
keys in an import request. Only public Ed25519 keys belong in this file.

The exact schema is `features/evidence/activation-intake/contracts.ts`:

```json
{
  "schemaVersion": "evidence.activation-trust.v1",
  "audience": "studio-acceptance",
  "keys": [
    {
      "issuerId": "organization-authority",
      "keyId": "authority-2026-09",
      "role": "authority",
      "publicKeyPem": "<organization-supplied PUBLIC KEY PEM>",
      "fingerprint": "<sha256 of DER-encoded SPKI public key>",
      "status": "active",
      "notBefore": "2026-09-09T00:00:00.000Z",
      "notAfter": "2026-10-09T00:00:00.000Z",
      "stages": ["authority-discovery"],
      "milestones": []
    }
  ]
}
```

Placeholders above are intentionally invalid; provisioning is an operator task.
Add separate `observer`, `verifier` and `decision` issuers with explicit stages
and milestone grants. The authority key must match the pinned activation
manifest and Relay configuration. Observer/verifier roles cannot impersonate the
activation authority. Each domain pair needs different issuer identities and
the same evidence digest. Duplicate public-key fingerprints are rejected.

Rotation keeps old public keys in the file with `status: revoked`; historical
signatures remain verifiable while current coverage excludes the old key.
Replacing or deleting historical keys makes history unverifiable and intake
fails closed. This implementation does not fetch keys from a caller-supplied URL.

Register a manifest only after the corresponding Relay configuration and
handoff exist in their server registries. Both IDs and digests must match.
There is no import-time bypass for missing lineage.

## Signing Protocol

`activationSigningBytes` in `features/evidence/activation-intake/verify.ts`
defines the exact protocol: UTF-8 domain prefix
`first-llm-studio/activation-envelope/v1`, a newline, and compact JSON in the
declared field order. Sign those bytes with Ed25519 and encode the 64-byte
signature as canonical padded base64. The signature field is excluded from the
signing bytes. Every field in the body, including supersession/revocation targets,
is signed. Native object key order in incoming JSON does not affect verification.

Bodies support `observation`, `decision`, `revocation`, and `resolution`.
Observations carry stage, optional domain, evidence digest and optional
supersession digest. Global stages require a null domain; observer/verification
stages require a known domain. All windows must fit the manifest and public-key
windows. Future timestamps are rejected. Nonces are unique per issuer.

Retain the externally issued original evidence in its authoritative system;
this service verifies the signature over its digest and lineage. It does not
download an archive or attest that an underlying workload actually ran.

## Operator Commands

Use `BASE_URL` or `--url` for the running Studio instance. Remote instances
require HTTPS and `FIRST_LLM_OPERATOR_TOKEN`; credentials never go into arguments
or input JSON. The same token variable is recognized by the server. Loopback
operator access follows the existing application policy.

```bash
npm run evidence:activation-intake -- --action status
npm run evidence:activation-intake -- --action register-manifest --file /secure/runtime/manifest.json
npm run evidence:activation-intake -- --action import --file /secure/runtime/envelopes.json --expected-revision 0 --dry-run
npm run evidence:activation-intake -- --action import --file /secure/runtime/envelopes.json --expected-revision 0
npm run evidence:activation-intake -- --action export --output /secure/runtime/activation-backup.json
npm run evidence:activation-intake -- --action restore --file /secure/runtime/activation-backup.json --expected-revision 1
```

Use the revision returned by status, not the example numbers. A preview returns
the projected revision but does not change the persisted revision. Import takes
a JSON array of up to 100 envelopes for one manifest and at most 2 MiB per HTTP request.
One rejected envelope rejects the entire candidate batch. Its digest and a safe
error code are recorded in a manifest-scoped quarantine. Only that manifest's
authority can resolve it. Exact retry is idempotent; stale revisions
return 409. Malformed HTTP commands are rejected before evidence intake.

The Experiments activation panel supports file import, preview, registration,
backup export and merge. Controls become available after trust is configured.
For token-protected servers use the CLI or an authenticated deployment gateway;
the inbox does not store operator tokens in the browser.

## Restore and Readiness

Export includes signed envelopes and a ledger checksum, without raw evidence or
private keys. Restore checks the checksum, re-verifies signatures, and merges
with the current revision. It never deletes newer records, revocations or
quarantine cases. New records imported from backup must still be current;
expired evidence needs renewal by its issuer. Keep exports below the HTTP limit
or split current envelopes into batches. Historical records remain in the
existing ledger; automatic destructive replacement is not provided.

A corrupt/missing primary ledger with an existing backup is an explicit error.
The intake service refuses automatic rollback to an older backup that may omit
revocations. Recover a damaged primary from an operator-reviewed authoritative
copy before using merge. This is a single-host durable JSON adapter, not a
distributed consensus store or protection against a privileged disk attacker.

Eligible-for-review means current signatures, lineage, all global stages,
fourteen independently signed matching domain pairs, and no open quarantine.
An accepted decision receipt remains a record; distribution and production
authorization stay with the independent authorities.
