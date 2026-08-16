# AGENTS.md — dpkit (universal datapack checker: CLI / CI / AI, check + per-version syntax)

This tool is **version-universal within the upstream data range**: it checks any datapack against
any version from **1.14** (earliest command data) through the latest release/snapshot. 1.13 and
older are rejected with a clear error — no upstream command-tree/registry data exists for them. Defaults come
from `.dpkit.json` (lookup order cwd → home, or `--config=<path>`; see `.dpkit.example.json`).
The repo itself ships no save/datapack content — what a bare `node dpkit.mjs` checks is decided
by the config. **For a different pack / version always pass `--datapack=` / `--version=` or edit
the config; never assume a task is always about the same pack/version.** Precedence:
`CLI flag > env var (DPKIT_DATAPACK / DPKIT_VERSION / DPKIT_CONFIG) > .dpkit.json > built-in default`.

**Architecture (after the 2026-08 refactor)**: source is TypeScript under `src/` (cli / api /
engine / lsp-legacy / mcp / syntax / registry / macrocheck / entity-nbt / version / config /
pure-logic modules),
compiled to `dist/`. The root `dpkit.mjs` is a shim; `node dpkit.mjs` usage is unchanged.
**After changing source you must run `npm run build` for it to take effect.** It defaults to the
in-process engine (drives `@spyglassmc/core`'s `Project` directly, no subprocess);
`--engine=lsp` keeps the old LSP-subprocess path for parity. There is also an MCP server
(`npm run mcp`, tools check_datapack / query_syntax / complete_at / list_registry / list_versions /
scan_gotchas / read_logs / get_vanilla_data / get_block_states, plus a `dpkit-workflow` prompt) and
a typed API (`dist/api.d.ts`). MCP tool results are enveloped: success adds `ok:true` (and
`count`/`total`), errors keep the legacy `{error}` + `isError:true` and add `ok:false`; large arrays
are truncated with `total`/`truncated`/`hint` (helpers live in `src/mcp-shape.ts`).
**Engine (self-contained, after the P1 upgrade)**: the `@spyglassmc/*` packages are NOT from
npm — the built output of the 8 engine packages (core / java-edition / json / locales / mcdoc /
mcfunction / nbt / language-server) is **vendored inside this repo** at `vendor/spyglass/`
(lib without source maps + package.json; see `vendor/spyglass/VENDORED.md` for origin, license,
and the patch list). dpkit's `file:` deps point there, so the repo builds/checks datapacks with
no external Spyglass checkout and no network. To refresh the engine from a source checkout:
`npm run vendor -- --spyglass=<path>` (rebuilds with `npx tsgo -b packages`, re-syncs
`vendor/spyglass/`, refreshes `BUILD.json`), then `npm install`. `node dpkit.mjs --check-updates`
reports whether Spyglass's GitHub `main` has moved since the engine was vendored.
Regression tests: `npm test` (unit + fixture integration + CLI smoke + MCP smoke);
`npm run test:versions` runs the multi-version matrix (`tests/multi-version.spec.mjs`,
`DPKIT_TEST_VERSIONS`, default `1.14,1.15.2,1.16.5,1.18.2,1.19.4,1.20.4,1.21.4,1.21.11,26.2`;
uncached versions are skipped, CI pre-warms full engine data with
`node dpkit.mjs --cache-versions=…`); perf baseline: `npm run bench`; correctness gate:
`npm run parity` (inproc vs LSP per-file issueSig equality; version defaults to `latest release`,
set `DPKIT_PARITY_VERSION` for a specific release, and `DPKIT_PARITY_DATAPACK` for a real pack);
`npm run test:all` = test + multi-version matrix + parity.
Key in-process-engine gotcha: projectRoot must go through `core.normalizeUri` (lowercases the
drive letter), otherwise `analyzeProject`'s case-sensitive match finds 0 files and analyzes nothing.

Examples below use 26.2 because it is the current latest release; they are not a default pin.
The tool's default is `auto`, and every query/check is per-version.

## Before writing a command: check ground-truth syntax (important)

**Don't rely on memory to guess whether a command/argument exists in the target version, and
don't guess enum values.** Get the real grammar for that version first, then write. Target
version = `--version=` or the config's `version`:

```bash
# full grammar of a command/subcommand (offline, millisecond-level, no game needed)
node dpkit.mjs --syntax="execute on"            # shows the 8 valid values of on + what can chain
node dpkit.mjs --syntax="damage"                # full argument chain + meaning of each argument
node dpkit.mjs --syntax="advancement grant" --depth=6   # deeper commands can expand further

# registry values (offline; check an ID still exists in this version before writing it)
node dpkit.mjs --registry=mob_effect            # all mob_effect for the version (26.2 has no knockback)
node dpkit.mjs --registry=?                     # list all available registries + counts

# ask "what can go here" at a cursor in a specific file (live, real engine parse)
node dpkit.mjs --complete=<data-relative-path>:line:column
#   ← format: path relative to the datapack's data/:line:column (1-based); $ macro lines are not
#     completable, normal lines are
node dpkit.mjs --complete-inline="effect give @s knock"   # complete a command string, no temp pack needed

# full reference (defaults to the latest release in the local cache, currently 26.2, 92 top-level
# commands) is generated offline:
#   command-reference-26.2.md     regenerate: node dpkit.mjs --dump-all [--depth=N]
```

> Grammar data comes from Spyglass's official per-version command tree (cached at
> `%LOCALAPPDATA%\spyglassmc-nodejs\Cache`), identical to VS Code's Datapack Helper Plus, and is
> **the only trustworthy syntax source for that version**. `--syntax` also lists the valid values
> on error, usable as feedback.

## Checking a datapack

```bash
node dpkit.mjs                                       # full check (defaults to the config's datapack/version)
node dpkit.mjs --delta                               # only report new/changed/resolved issues
node dpkit.mjs --files=test/function/*.mcfunction    # only some files
node dpkit.mjs --json                                # machine-readable output
node dpkit.mjs --datapack=D:\other-pack --version=1.21.4 # check any other datapack/version
```

- `--files` is relative to `data/`, **without the `data/` prefix**.
- `pack.mcmeta` is also checked: a broken mcmeta used to silently skew version auto-detection
  (0 diagnostics); now it reports a parse error.
- Known false positives `Unknown key "LastHurtMob"` and `Cannot find <reg> "minecraft:<valid-id>"`
  (vanilla registry not declared in the pack) are auto-filtered; `--no-ignore` shows raw diagnostics.
- Exit codes: 0 = no errors, 1 = the report contains errors (including file-level engine
  internal failures; warnings also count with `--strict`), 2 = environment/network failure or
  dpkit's own uncaught crash, 4 = usage/configuration error.

## Config (.dpkit.json)

Put "which pack/version to check by default" in the config and you don't need to pass flags each
time. Fields: datapack / version / ignore / minecraftRoot / baselineFile / gotchas / logcheck.
Relative paths resolve against the config file's directory.
A config/env `datapack` that points at a **missing** path now warns and falls back to auto-detection,
and the report header prints where the datapack came from (`from --datapack` / `DPKIT_DATAPACK` /
`.dpkit.json` / `auto-detected`) so a stale config can't silently check the wrong pack.

```json
{
  "datapack": "D:/.../datapacks/MyPack",
  "version": "1.21.4",
  "minecraftRoot": "D:/.../.minecraft",
  "ignore": ["/Unknown key [\"“]Foo[\"”]/"]
}
```

`minecraftRoot` also feeds the MCP `read_logs` tool (a `minecraftRoot=` arg overrides it).

## Versions and known issues

- **Support range**: upstream per-version data starts at **1.14** (dpv 4). Requests for
  1.13/older are rejected with an explicit "no version data before 1.14" error, never checked
  with a newer grammar. `--versions` prints the checkable release range.
- **Full engine pre-warm**: `--cache-versions` now downloads commands, registries, block states,
  `vanilla-data/tarball`, and `vanilla-assets-tiny/tarball`. Old releases otherwise fail engine
  initialization because the engine's own fetch timeout is shorter than the slow 1.14/1.15-era
  endpoints; dpkit pre-warms missing dependencies before starting the engine.

- **Defaults to auto, not pinned**: version comes from `--version=` / `DPKIT_VERSION` / config's
  `version` / built-in default `auto` (`DEFAULT_VERSION` in `src/config.ts`). `auto` reads the
  pack's pack.mcmeta; packs with `min_format`/`max_format` **and** a base `pack_format` now prefer
  the release matching that base dpv when it is inside the declared range (`pack_format:94,
  min_format:88, max_format:9999999` → `1.21.11`). Range-only packs still resolve to the newest
  in-range release — pin `--version=` when that is not the intended target. Offline syntax/gotcha
  scans (`--syntax`/`--dump`) default to the latest release in the local cache, and now
  auto-download missing per-version data when online (`--cache-versions=a,b` pre-warms a set;
  `--versions --uncached` lists what's missing; all in `src/version-data.ts`).
- **Upgrading to a new version**: command tree/registry/NBT schema are all data-driven; run
  `node dpkit.mjs --version=<new>` online to auto-download and recognize it; `--versions` lists
  available versions. `--version="latest release"` always follows the latest release. A hint at the
  end of the report flags a stale version. Only brand-new parameter types / format overhauls need
  re-vendoring the engine: `npm run vendor -- --spyglass=<updated-checkout>` + `npm install`.
- **Gotchas and log self-check are both universal**: content-level regex/namespace inference, not
  tied to any specific pack; messages prefix the effective version. `--no-gotchas` / `--no-log`
  disable them. The three mcfunction-line gotchas (particle-bare-id / nbt-field-casing /
  attribute-multiplier-direction) run as ENGINE linters now (java-edition's `mcfunction/linter.ts`,
  default severity Hint); dpkit partitions their `[gotcha] (<key>)` diagnostics into the separate
  gotchas report section (never counted as errors/warnings), and `--no-gotchas` disables the rules
  in the engine config. The JSON gotchas (advancement damage nesting / multi-criteria-OR) remain a
  dpkit post-scan (`src/gotchas.ts`), which the standalone MCP scan_gotchas tool runs in full.
  There is also `$` macro-line validation (`src/macrocheck.ts`, on by
  default, `--no-macro` disables): the engine does **no validation** on macro lines, so dpkit walks
  the command tree independently, checks literal IDs outside `$(...)` against the registry
  (`[macro]` Warning on a miss), and also validates clearly invalid literal numbers / ranges /
  booleans / coordinates (`[macro] macro-syntax`). Conservative by design — macro variables /
  custom namespaces / `#tag` / desynced tree traversal / parsers without a safe validator are
  marked "unchecked" and never warned; pack-declared data-driven registries are auto-allowed only
  for the declaring namespace (`data/x/advancement/foo.json` validates `x:foo`, not `minecraft:foo`).
  The report carries a `coverage` line (macro lines / registry-ID checked / literal-syntax checked /
  unchecked), and files with unchecked positions are annotated.
- **File-set validation** (`src/collect.ts` / `src/datapack-structure.ts` / `src/pack-mcmeta.ts`):
  collects `.mcfunction`/`.json`/`.nbt` under `data/` **and pack.mcmeta overlay dirs**
  (`@overlay:<dir>/` rels); overlays whose `formats` range does not contain the target version's
  data-pack version are skipped (coverage: `overlayFilesSkipped`; unknown dpv keeps all
  overlays). It validates every resource-location path + case collisions, reports unrecognized
  data files as dpkit warnings (they are never sent to the LSP engine), promotes wrong-folder
  engine Hints to Warnings, deeply validates pack.mcmeta (format fields, version match,
  overlays), and turns unreadable data directories/files into `[check]` warnings
  (`coverage.unreadableDirs` / `coverage.unreadableFiles`) instead of silent skips. A pack with
  only `pack.mcmeta` checks without an engine. `.zip` datapacks are extracted by
  `src/zip-datapack.ts` for checks (`--watch`/`--complete` still want a directory); zip entries
  with exact/case-only duplicate paths are rejected before extraction.
- **Structure-NBT validation** (`src/structure-nbt.ts`): binary NBT parser for
  `data/<ns>/structure(s)/*.nbt` (raw/gzip/zlib, required top-level keys).
- **Entity-NBT schema validation** (`src/entity-nbt.ts`, on by default, `--no-entity-nbt`
  disables): the engine's NBT schema is loose, so dpkit validates `summon` / `data merge entity`
  NBT against the cached `vanilla-mcdoc` tarball (same schema the engine uses). The tarball's
  .mcdoc files are parsed with `@spyglassmc/mcdoc`'s real `module_` parser (no regex guessing —
  verified 0 parse errors on the current tarball), then the AST is walked for `struct` definitions
  and `dispatch minecraft:entity[…]` statements, carrying each field's `#[since=]`/`#[until=]`
  game-version annotations and `#[id(…)]` registry markers (both `registry="…"` and positional
  string forms). Flags `[nbt] … field 'X' was removed in <v>` / `… added in <v>` and
  `[nbt] <reg> '<id>' is not in the <reg> registry` (e.g. `DeathLootTable:"minecraft:empty"` in
  26.2). Conservative: unknown entity types / custom namespaces / nested-only fields are
  "unchecked", never warned; a file whose parse reports any error is skipped entirely; degrades
  to no-op until the mcdoc tarball is cached (first online check downloads it). `src/version.ts`
  compares game versions (`1.21.5` < `26.1`) for the since/until ranges. Post-scans (macro /
  entity-NBT / gotchas) share one file read; when the version is pinned (not `auto`) they also
  start before the engine check finishes.
- **Data-driven false-positive filtering**: `Cannot find <reg> "minecraft:<valid-id>"` is
  auto-filtered when the ID is exactly in the current version's registry values (data-driven per
  version, e.g. 1.21.1's `generic.attack_speed` is legal, removed from 1.21.2);
  `Cannot find tag/<reg> "minecraft:<vanilla-tag>"` is likewise filtered (when the vanilla-data
  tarball is cached). Real typos / removed IDs still report. `--strict` makes warnings exit 1 (CI).
  `--no-ignore` shows all raw diagnostics (it also disables the `ignore` rules in `.dpkit.json`).
- `$` macro lines (`$execute ...`): Spyglass does **no completion** on macro lines (returns empty),
  but `--syntax`/`--registry` offline queries are unaffected; macro-line **registry-ID validation**
  is done by dpkit post-processing (above). To complete, write the fragment to a normal line first,
  or use `--complete-inline="<command>"`.
- Game-log self-check (`src/logcheck.ts`) now delegates discovery/reading to
  `src/logreader.ts` (official / Prism / TLauncher, rotated `.log.gz`), like MCP `read_logs`.
- `--watch` is incremental: plain file edits re-parse/bind/check only the changed files in the
  pooled engine (mtime diffing drives `engine.updateFile()`), then re-render the report from the
  engine's live diagnostics snapshot; file additions/removals or a pack.mcmeta change rebuild the
  engine and re-analyze the whole pack. Unchanged files keep their previous diagnostics until then.
