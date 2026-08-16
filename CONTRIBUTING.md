# Contributing to dpkit

Thanks for your interest in contributing! dpkit is a universal Minecraft datapack checker
(CLI / CI / AI) that runs the same engine as the Datapack Helper Plus (Spyglass) VS Code
extension, plus extra per-version checks. This document covers how to set up a dev environment,
run the gates, and follow the project's conventions.

## Development environment

Requirements:

- **Node.js >= 20** (see `engines` in `package.json`)
- npm (comes with Node)

```bash
git clone https://github.com/kaiser-1871/MC-DPKIT.git
cd dpkit
npm install          # installs dev deps; the vendored engine is a set of file: deps under vendor/spyglass/
```

The repo is TypeScript under `src/`, compiled/bundled to `dist/`. The root `dpkit.mjs` is a thin
shim over `dist/`, so **any change to `src/` requires a rebuild before it takes effect**.

## Build, test, and quality gates

```bash
npm run build          # tsc --emitDeclarationOnly + esbuild bundle → dist/ (self-contained, zero runtime deps)
npm test               # npm run build + unit/fixture-integration/CLI tests + MCP smoke test
npm run test:versions  # multi-version matrix (DPKIT_TEST_VERSIONS to override the version list)
npm run parity         # in-process engine vs LSP: per-file issue-signature equality (correctness gate)
npm run test:all       # npm test + test:versions + parity (the full gate)
npm run bench          # performance baseline (engine / full check / post-scans)
npm run mcp            # start the MCP server from the repo
```

- `npm test` is the gate to run before opening a PR. `npm run test:all` is the full release gate.
- `tests/fixtures/pack` is a self-contained fixture datapack (namespace `test`); integration,
  parity, and smoke tests all run on it — no real save or game install is needed.
- Multi-version tests skip versions whose command data isn't cached. Pre-warm them with
  `node dpkit.mjs --cache-versions=1.14,1.15.2,1.16.5,1.18.2,1.19.4,1.20.4,1.21.4,1.21.11,26.2`.

## Commit conventions

Follow the conventional-commit prefixes used by `git log`:

- `feat:` — a new user-facing feature
- `fix:` — a bug fix
- `docs:` — documentation-only changes
- `chore:` — build, CI, or repo hygiene (non-functional)
- `vendor:` — changes to the vendored Spyglass engine under `vendor/spyglass/`
- `refactor:` / `test:` / `perf:` — as appropriate

Keep the subject line short and imperative ("fix: …", not "fixed: …"). One logical change per
commit. Breaking changes should be called out in the body/CHANGELOG (the project follows
Keep a Changelog + SemVer).

## Vendoring the Spyglass engine

The 8 `@spyglassmc/*` engine packages are vendored inside the repo at `vendor/spyglass/` (built
output, MIT-licensed; see `vendor/spyglass/VENDORED.md` for origin and patches). This is what
lets the repo build and check datapacks with no external Spyglass checkout and no network.

To refresh the engine from a source checkout:

```bash
npm run vendor -- --spyglass=<path-to-spyglass-checkout>
npm install
```

This rebuilds the engine (`npx tsgo -b packages`), re-syncs `vendor/spyglass/`, and refreshes
`vendor/spyglass/BUILD.json`. Only run this when a brand-new parameter type / command-format
overhaul lands upstream — regular new commands/registry values/NBT fields are data-driven and
do **not** need re-vendoring. `node dpkit.mjs --check-updates` reports whether Spyglass's GitHub
`main` has moved since the engine was vendored.

## Before you submit

- Run `npm run build` and `npm test` and make sure everything is green.
- Don't leave `console.log` debug lines, `@ts-ignore`/`@ts-expect-error`, or new `TODO`/`FIXME`.
- Add or update tests for behavior changes; the project has near-total module coverage and new
  logic should follow suit.
- Update `CHANGELOG.md` under `[Unreleased]` for user-visible changes.
- See `SECURITY.md` for how to report vulnerabilities privately (do not open a public issue).
- Be nice: see `CODE_OF_CONDUCT.md`.
