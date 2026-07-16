# GitHub Repository Setup Checklist

Use this checklist after a release or when repository settings drift. It separates repository configuration from claims that require real runtime evidence.

## Repository Identity

- [ ] About description matches the first paragraph of `README.md`.
- [ ] Homepage points to the current project or documentation URL.
- [ ] Topics include `llm`, `mlx`, `apple-silicon`, `coding-agent`, `benchmark`, and `nextjs`.
- [ ] Social preview uses `public/oss-cover.png` and remains legible at GitHub crop sizes.
- [ ] Pinned repository/profile copy matches `docs/open-source-growth-copy.md`.

## Community Files

- [ ] `README.md` and `README.zh-CN.md` describe the same release state.
- [ ] `CONTRIBUTING.md` links the Chinese quickstart.
- [ ] `LICENSE`, `SECURITY.md`, `CODE_OF_CONDUCT.md`, and issue templates are present and current.
- [ ] Support and disclosure routes do not expose private email, endpoint, or credential values.

## Branch And CI Protection

- [ ] `main` requires the CI workflow before merge.
- [ ] CI runs install, typecheck, lint, build, and production route smoke.
- [ ] Route-smoke JSON and server logs are uploaded when CI fails.
- [ ] Force pushes and branch deletion are restricted for `main`.
- [ ] Dependabot or an equivalent dependency alert path is enabled.

## Release Evidence

- [ ] Release tag, GitHub release, package version, and release-train entry agree.
- [ ] README screenshots pass `npm run validate:screenshots`.
- [ ] Dynamic demos have an MP4 plus SHA-256 metadata receipt.
- [ ] Model, benchmark, training, and artifact claims link to durable evidence.
- [ ] Cloud, notarization, organization, and clean-machine claims stay blocked until external receipts exist.

## Security And Secrets

- [ ] No `.env.local`, API keys, provider tokens, model credentials, or secure manifests are tracked.
- [ ] Push protection and secret scanning are enabled where available.
- [ ] External operator identity and production manifests live outside the repository.
- [ ] Generated logs are reviewed before attaching them to public issues.

## Final Verification

```bash
npm run typecheck:changed
npm run smoke:routes
npm run validate:screenshots
```

Record the command results in the release evidence document. Repository settings that cannot be verified from source should remain unchecked until confirmed in GitHub.
