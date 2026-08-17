# Changelog

## [Unreleased]

### Added

- Full command validation: `--check-command="<cmd>"` validates one complete command with
  `verification` (`full`/`partial`/`none`) and evidence-carrying diagnostics; exposed as the MCP
  `check_command` tool.
- Macro expansion validation: `--macro=<ns:path>` + `--macro-args='{...}'` expands `$` macro
  lines and validates each expanded command; missing args are marked `unverified`, never errors;
  exposed as the MCP `check_macro` tool.
- Project rule engine (`src/rules.ts`): built-in `cleanup-id-coverage`, `on-eat-completeness`,
  `advancement-revoke-coverage`, `attribute-modifier-cleanup`, and `schedule-cleanup` rules,
  all off by default via `--rules=...`; exposed as the MCP `lint_rules` tool.
- Automatic report file writing + diff: `--write-report` is now the default, `--no-write-report`
  disables it, `--report=<file>` sets the path; each run reads the previous report and writes
  `diff_from_last`; exposed as MCP `write_report` and `diff_reports`.
- Version capability matrix: reports `version_profile` (`full`/`partial`/`none`/`ambiguous`),
  `registry_coverage`, `unchecked_registry_ids`, and `can_give_suggestions`; incomplete or
  ambiguous version data switches dpkit into conservative mode and suppresses suggestions.
- Enhanced diagnostics: `code`, `evidence`, `confidence`, `suggestion`, and
  `suggestion_confidence` fields on issues and rule alerts.
- `--suggestions` flag: suggestion output is opt-in and only emitted when confidence >= 0.9 and
  version data is complete.

- Plugin API (`src/plugins.ts`): plugins can run `setup` / `beforeCheck` / `afterCheck` around a
  check; loadable from the API, `.dpkit.json` `plugins`, or `--plugin=<path>`. Design inspired by
  [mcbeet/beet](https://github.com/mcbeet/beet)'s plugin/`Context` pipeline.
- `dpkit init` subcommand: scaffolds `.dpkit.json` and an optional GitHub Actions workflow.
- Test helpers (`dpkit-mc/testing`): `assertDatapackClean`, `assertDatapackSnapshot`,
  `checkDatapackForTest`, `formatReport` for golden/snapshot testing.
- `dpkit check` is now accepted as an explicit alias for the default checking command.
- `auto` version resolution now prefers the release matching the base `pack.pack_format` when the
  declared `min_format`/`max_format` range contains that dpv (e.g. `94 + 88..9999999` → 1.21.11,
  not the newest in-range release).
- Macro-line validation now also catches clearly invalid literal numbers / ranges / booleans /
  coordinates (`[macro] macro-syntax`), scans zero-variable `$` lines too, and reports parsers
  without a conservative validator as syntax-unchecked instead of silently consuming them.
- New known false positive: Spyglass's "Expected at least one macro argument" for zero-variable
  `$` macro lines (valid in-game) is auto-filtered.
- `--workspace` / `--additional-datapacks` now resolve **scoreboard objectives, teams, and
  structures** declared in other datapacks (previously only functions/tags/advancements/loot
  tables/predicates/item modifiers/recipes/sound events/fonts/translations were visible).
  Missing cross-pack objectives/teams/structures also become scope hints instead of warnings when
  no workspace is provided.
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

### Fixed

- **In-process engine no longer reports clean files as internal failures.** `analyzeProject()`
  emits `documentUpdated` for every file that parses/binds/checks successfully, including files
  with zero diagnostics; dpkit now listens to it (one-shot and pooled engines) instead of treating
  every file that never emitted `documentErrored` as a server failure.
- **Paths containing `+` no longer break in-process checks on Windows.** `pathToFileURL` leaves
  `+` unencoded while Spyglass's file walker percent-encodes it as `%2B`, so dpkit's uri→rel map
  missed every event and reported whole packs as internal failures. All file URIs, project roots,
  and event matching now use one canonical URI form.
- **Entity-NBT: ambiguous `since==until` schema annotations are unchecked, never warned.** The
  cached vanilla-mcdoc marks fields such as `Team` on many entity types as `since=until=26.3`,
  which is a schema artifact; these positions are now treated as “cannot judge” instead of false
  “added in 26.3” warnings.
- **Entity-NBT: loot-table sentinels `none` / `empty` / `""` are no longer flagged.**
  `DeathLootTable:"none"` and friends are long-standing “no loot table” sentinels Minecraft
  accepts but the vanilla `loot_table` registry does not list.
- **New known-false-positive rules** for lenient in-game behavior Spyglass rejects:
  - `Rotation:[0f]`-style list-length diagnostics;
  - NBT booleans written as `0`/`1` integers and NBT shorts written as plain integers
    (e.g. `Amplifier:255`);
  - trailing whitespace after a complete command making Spyglass expect an optional next argument
    (`particle ... force `, `effect ... 0 `, `playsound ... 1 2 `, `schedule ... 2t `, `tp ... ~ `);
  - `Cannot find loot_table "minecraft:none"/"minecraft:empty"`;
  - text-component `"color": ""` being treated as a missing `#hex` color.

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
