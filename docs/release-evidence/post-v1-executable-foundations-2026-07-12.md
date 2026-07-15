# Post-v1 Executable Foundations

Date: 2026-07-12

## Delivered

- Desktop package manifest signing with a local Ed25519 rehearsal key.
- Isolated install, upgrade, rollback, and uninstall filesystem rehearsal.
- Separate Apple Developer ID `codesign` verification status; local signatures never count as notarization.
- Bounded HTTP Range model-transfer worker with `.part` files, pause/resume, byte progress, ETag/range evidence, SHA-256 verification, and atomic completion rename.
- Ollama bridge for `/api/version`, `/api/tags`, model prewarm, and unload with normalized unavailable/timeout/model errors.
- Extension package digest/signature verification against configured publisher roots or an explicitly local non-production rehearsal root.
- Failed extension packages are written to a non-executable quarantine directory with durable receipts.
- Persisted workflow execution reducer with graph-version checks, approval state, failure/resume behavior, event deduplication, and protected-tool idempotency keys.
- SQLite migration and parameterized query boundary enforcing organization/workspace membership, role permissions, and resource workspace identity in the database query.
- Real Apple release preflight and execution path for `codesign --verify`, `notarytool submit --wait`, `stapler staple`, and `stapler validate`.
- Hugging Face automatic repository-tree manifests and ModelScope explicit manifests, both backed by the bounded transfer worker.
- Ollama model-level conformance with discover, prewarm, deterministic generation, timing/token metrics, and unload.
- Extension dependency graph validation plus a stripped-environment Node permission subprocess rehearsal.
- Persisted workflow breakpoints and a route-owned `/workflows` editor/inspector.
- Postgres 16 RLS migration, OIDC discovery boundary, and fail-closed SCIM Users/Groups endpoints.

## Real Rehearsal

Command:

```bash
npm run rehearse:post-v1-foundations
```

Observed result:

- Desktop install/upgrade/rollback/uninstall: `pass`.
- Apple Developer ID verification: `false` because no signed/notarized app package is configured.
- Model transfer: `372000` bytes, pause/resume exercised, SHA-256 `85a98c028d0fb4088c5d378e4237f797ca54d3e111ab16a12bd7c276344991b2` verified.
- The latest transferred fixture is retained under `~/Library/Application Support/local-agent-lab/observability/model-downloads/` so the registry does not point at a deleted completion artifact.
- Ollama: `qwen3:0.6b` was pulled and passed discover, prewarm, deterministic generation, and unload. The response was `OLLAMA_OK`, total duration was about `253 ms`, and measured generation throughput was about `147.5 tok/s`.
- Extension: signed fixture accepted and verified; tampered fixture rejected and quarantined.
- Extension sandbox: input/output contract passed and an attempted filesystem write was denied by the Node permission model. This remains defense-in-depth, not an OS/container security boundary.
- Workflow: protected-tool graph reached `completed` with seven durable events; duplicate side-effect event is checked by the rehearsal.
- Workflow breakpoint: a persisted breakpoint on `model` produced `paused-breakpoint` before the node executed; the breakpoint was then disabled after rehearsal.
- Workspace ACL: same-workspace read allowed, cross-workspace read denied, viewer write denied.
- Postgres RLS: a real `postgres:16-alpine` container passed same-workspace visibility, cross-workspace denial, and FORCE RLS checks.
- Hub transfer: Hugging Face downloaded `config.json`, `tokenizer_config.json`, and `vocab.json`; ModelScope downloaded `config.json` and `tokenizer_config.json`, all with materialized SHA-256 values.

Runtime report:

`~/Library/Application Support/local-agent-lab/observability/post-v1-runtime-rehearsal.json`

## Evidence Boundary

The rehearsal proves executable local contracts, a live Ollama model, and ephemeral Postgres RLS behavior. It does not prove Apple notarization, production extension trust roots, OS/container-grade sandbox security, external OIDC/SCIM interoperability, or multi-node production behavior.

Apple release signing remains blocked because no valid Developer ID identity, notary keychain profile, or release package is configured. OIDC and SCIM remain blocked because issuer/client and bearer-token settings are absent. Their APIs fail closed and do not emit simulated production receipts.

## Verification

- `node --check scripts/rehearse-post-v1-foundations.mjs`: pass.
- `npm run rehearse:post-v1-foundations`: pass.
- `npm run rehearse:postgres-rls`: pass against `postgres:16-alpine`.
- `/api/runtime/ollama/conformance`: passing report for `qwen3:0.6b`.
- `/api/extensions/sandbox`: passing process permission receipt.
- `/api/scim/v2/Users`: HTTP `503` without a configured bearer token, as required by the fail-closed boundary.
- `npm run typecheck:changed`: pass, 11/11 changed partitions.
- `npm run smoke:routes`: pass, 60/60 UI/API/compatibility checks.
- `/workflows`: browser visual check passed with route-owned main graph and right inspector; no console errors.
- Post-v1 foundation projection: 2 foundation-ready, 6 partial, 2 blocked, 31% average foundation completion.
- `git diff --check`: pass.
