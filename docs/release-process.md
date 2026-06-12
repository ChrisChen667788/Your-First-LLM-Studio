# Release Process

## Goal

Keep each stable node easy to compare, roll back, and explain.

## Steps

1. Update [`VERSION`](../VERSION)
   - Use `SemVer`, for example `0.1.1`.

2. Generate the release note skeleton
   - Run:

```bash
./scripts/prepare-release.sh
```

3. Fill the generated release note
   - File pattern:
     - `docs/releases/vX.Y.Z_YYYY-MM-DD.md`
   - Required sections:
     - `Scope`
     - `Included`
     - `Verification`
     - `Screenshots`
     - `Notes`

4. Run the minimum verification set
   - `npm run typecheck:changed`
   - `npm run build`
   - `npm run smoke:routes`
   - `npm run smoke:screenshots`
   - verify [http://localhost:3011/agent](http://localhost:3011/agent)
   - verify [http://localhost:3011/compare](http://localhost:3011/compare)
   - verify [http://localhost:3011/fine-tune](http://localhost:3011/fine-tune)
   - verify [http://localhost:3011/models](http://localhost:3011/models)
   - verify [http://localhost:3011/benchmarks](http://localhost:3011/benchmarks)
   - verify [http://localhost:3011/retrieval](http://localhost:3011/retrieval)
   - verify [http://localhost:3011/experiments](http://localhost:3011/experiments)
   - verify [http://localhost:3011/admin](http://localhost:3011/admin)
   - record one benchmark summary if the release touches runtime or benchmark behavior

5. Capture the stable node
   - Git commit message:
     - `release: vX.Y.Z`
   - Git tag:
     - `vX.Y.Z`

## Stable node checklist

- UI order and density match the current roadmap direction
- Local runtime can report status without crashing the page
- Benchmark can at least run one local and one remote smoke path
- Benchmark release evidence is visible from `/benchmarks` before a release note is cut
- Retrieval CRUD/query smoke passes through the foreground `/api/retrieval` contract
- Experiments timeline and retention endpoints return a valid feature-owned response
- Release note contains a real verification summary, not placeholders
- Production build follows a passing partitioned typecheck; Next's build-time
  monolithic checker remains disabled in favor of that explicit release gate

## Notes

- Keep release notes short and factual.
- If a release is UI-only, benchmark can be a smoke summary rather than a full formal suite.
- `v0.2.x` cadence guidance: [v0.2.x-cadence.md](./v0.2.x-cadence.md)
- `v0.3.0` preread: [v0.3.0-preread.md](./v0.3.0-preread.md)
