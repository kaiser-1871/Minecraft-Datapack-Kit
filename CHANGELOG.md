# Changelog

## [Unreleased]

### Added

- `auto` version resolution now prefers the release matching the base `pack.pack_format` when the
  declared `min_format`/`max_format` range contains that dpv (e.g. `94 + 88..9999999` → 1.21.11,
  not the newest in-range release).
- Macro-line validation now also catches clearly invalid literal numbers / ranges / booleans /
  coordinates (`[macro] macro-syntax`), scans zero-variable `$` lines too, and reports parsers
  without a conservative validator as syntax-unchecked instead of silently consuming them.
- New known false positive: Spyglass's "Expected at least one macro argument" for zero-variable
  `$` macro lines (valid in-game) is auto-filtered.
- Entity-NBT scanning validates globally registry-bearing fields (e.g. `DeathLootTable`) even for
  custom/unknown entity types.
- New known gotcha: `minecraft:ender_eye` item definitions adding `minecraft:consumable`
  (`consume_item` will not fire; ender_eye keeps its hardcoded throw use action). The rule is
  version-gated to `>=1.21.4` instead of being 26.2-only.
- De-overfit guards: multi-version test matrix (`tests/multi-version.spec.mjs`,
  `DPKIT_TEST_VERSIONS`) covers 1.14→26.2, CI pre-caches full engine data for
  1.14/1.15.2/1.16.5/1.18.2/1.19.4/1.20.4/1.21.4/1.21.11/26.2, CI runs parity across those
  releases, MCP smoke defaults to `latest release`, and standalone parity defaults to
  `latest release` (`DPKIT_PARITY_VERSION` to pin).
- Old-version reliability: version download timeout raised 5s→30s (1.14/1.15-era endpoints can
  take 10s+), `--cache-versions` now pre-warms all engine dependencies
  (`block_states`, `vanilla-data/tarball`, `vanilla-assets-tiny/tarball`), and checks pre-warm
  missing dependencies before starting the engine.
- Explicit support boundary: versions before 1.14 are rejected with a clear error
  (`upstream data starts at 1.14`); `--versions` prints the checkable release range.

- P0/P1 datapack file coverage: `.nbt` structure files, pack.mcmeta overlays, `.zip` datapacks,
  deep pack.mcmeta validation (pack_format/supported_formats/max_format, version match,
  overlays), resource-location path validation + case-collision detection, data-less pack
  checks, and an explicit warning for engine-unrecognized data files.
- P1/P2 hardening: wrong-folder engine hints are promoted to Warnings; structure-NBT binary
  validation (`[structure-nbt]`); entity-NBT/macro coverage now reports when required cache data
  is unavailable; game-log self-check uses the shared multi-launcher logreader.
- P2 reference data: `get_vanilla_data` category catalog expanded to 57 (26.2 registries +
  26.3 worldgen split-outs); default-datapack discovery scans Prism/MultiMC instances and
  `.zip` datapack entries.
- Overlay version filtering: files under an overlay whose `formats` range does not contain the
  target version's data-pack version are skipped; coverage reports `overlayFilesSkipped`.
- Honest unreadable-path coverage: unreadable `data/` directories and text files are surfaced as
  `[check]` warnings and `coverage.unreadableDirs/unreadableFiles`, never silently skipped.
- Namespace-aware pack-declared registries: macro and entity-NBT registry validation now records
  `registry/namespace/id`, so `data/x/.../foo.json` satisfies `x:foo` but not `minecraft:foo`.
- `.zip` datapacks reject exact/case-only duplicate entries before extraction (on Windows a
  later entry would silently overwrite the earlier one before collision detection could run).

### Added

- P3 static-checker improvements: pack-format range detection (`min_format`/`max_format`,
  `9999999` unbounded sentinel), `--workspace`/`--additional-datapacks` read-only symbol
  providers, `--resource-pack(s)` sounds/font/lang providers, version-aware known-false-positive
  rule database, `--cache-miss` offline policy, delta error/warning counters, `--versions`
  search (`1.21`, `1.21.11`, `dpv:94`), and per-position macro/entity-NBT coverage lists.

### Changed

- npm package name settled as **`dpkit-mc`** (the bare name `dpkit` is taken on npm by an
  unrelated project; published bins are `dpkit-mc` and `dpkit-mcp`).
- `collectFiles` now returns overlay rels as `@overlay:<dir>/<data-rel>` and includes `.nbt`;
  callers that build rel maps from it see overlay files automatically.

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
- **`dpkit-mcp` bin**: the npm package ships a second binary for the MCP server (`npx dpkit-mcp`);
  README restructured around the tool's real scope (CI gate / deeper checks / AI ground truth).
- **On-demand version data**: `--syntax`/`--registry`/`--dump` (CLI and MCP) now download the
  version's data themselves when it isn't cached, so one command just works (offline still fails
  cleanly); `--cache-versions=a,b,…` pre-warms a set; `--versions --uncached` lists what's missing.

### Known issues

- `npm audit` reports 1 critical advisory in a dev-only transitive dependency (`decompress`,
  via the vendored engine's dev toolchain; no fixed release upstream yet). It is not shipped:
  the published package has an empty `dependencies` field and installs with 0 vulnerabilities.
