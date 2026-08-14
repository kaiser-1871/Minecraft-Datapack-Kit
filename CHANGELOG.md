# Changelog

All notable changes to this project are documented in this file. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to
[Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] — 2026-08-14

First public release.

### Fixed

- **Publish blocker**: the package is now self-contained at runtime — all sources plus the
  vendored `@spyglassmc/*` engine (and every transitive dependency) are bundled into
  `dist/` by esbuild, and the published `dependencies` field is empty. Installing the
  tarball in a clean project no longer requires `file:vendor/spyglass/*` paths (which
  previously made `npm install dpkit` fail with ENOENT). `--engine=lsp` now spawns
  `dist/spyglass-server.js` instead of `node_modules/@spyglassmc/language-server/bin/server.js`,
  and `--check-updates` keeps working via the shipped `vendor/spyglass/BUILD.json`.
- **cacheDir / pool race**: the in-process engine pool now shares and initializes its cache
  directory safely across concurrent checks (no more racing on first use).
- **CLI polish**: exit codes normalized (4 = usage/configuration error) and the report header
  now prints where the datapack came from, so a stale config cannot silently check the wrong pack.
- **`--registry=?` now exits 0**: listing every registry is a successful answer, not a miss
  (an unknown registry name still exits 1 to stay CI-friendly).
- **CLI smoke tests**: `tests/integration/cli-smoke.test.mjs` exercises the CLI shell through
  the real `dpkit.mjs` entry point (help, exit codes 0/1/4, offline teach modes, datapack
  warning gating, broken-mcmeta and missing-datapack error paths), closing the CLI coverage gap.

### Changed

- The three mcfunction-line gotchas, the `$` macro-line registry validation, and the
  entity-NBT schema validation ship as described in the README.
- Build pipeline: `npm run build` = `tsc --emitDeclarationOnly` + `node scripts/build-bundle.mjs`.

### Known issues

- `npm audit` reports 1 critical advisory in a dev-only transitive dependency (`decompress`,
  via the vendored engine's dev toolchain; no fixed release upstream yet). It is not shipped:
  the published package has an empty `dependencies` field and installs with 0 vulnerabilities.
