# Minecraft Datapack Kit (dpkit) — check datapacks anywhere: CI, scripts, and AI

**English | [简体中文](README.zh-CN.md)**

[![CI](https://github.com/kaiser-1871/Minecraft-Datapack-Kit/actions/workflows/ci.yml/badge.svg)](https://github.com/kaiser-1871/Minecraft-Datapack-Kit/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/dpkit-mc)](https://www.npmjs.com/package/dpkit-mc)

> **⚠️ Testing status**: the author has personally tested dpkit only against their own datapack
> for **Minecraft 26.2**. Other versions (1.14 through the latest) are supported via the upstream
> per-version engine data but have **not** been exhaustively verified by the author — testing and
> feedback on other versions are very welcome! Please report issues at the
> [issue tracker](https://github.com/kaiser-1871/Minecraft-Datapack-Kit/issues).

**dpkit** (short for **Minecraft Datapack Kit**) checks **any** Minecraft datapack against every
game version the upstream data provider covers (**1.14 through the latest release/snapshot**),
running the **exact same engine** as the
[Datapack Helper Plus (Spyglass)](https://marketplace.visualstudio.com/items?itemName=spgoding.datapack-language-server)
VS Code extension — the engine is vendored in this repo ([Built on Spyglass](#built-on-spyglass-the-datapack-helper-plus-engine)
below), and diagnostics are verified identical by a parity gate (in-process engine vs LSP, per-file
signature equality). 1.13 and older have no command-tree/registry data upstream and are rejected
explicitly rather than mis-checked. Unlike the editor, dpkit runs **anywhere**:

- **CI gate**: `--strict` plus exit codes `0/1/2/4` turn a check into a GitHub Actions gate.
- **Deeper checks the editor never shows**: `$` macro-line registry validation, per-version entity-NBT
  schema validation (fields added/removed per version), heuristic "silently breaks in game" gotchas,
  and a game-log self-check that reads `latest.log`.
- **Ground truth for AI**: `--syntax` / `--registry` / `--complete` answer "what exactly is valid in this
  version" offline, and the **MCP server** exposes the same to AI IDEs and coding agents.
- **Zero setup, zero deps**: `npm i -g dpkit-mc` — the published package bundles everything (no runtime
  dependencies, no editor, no game needed); offline after the first data download.

> The tool is **universal**: which datapack/version it checks is decided by flags / env / `.dpkit.json`,
> never hard-coded — the repo ships no save/datapack content of its own.

## Built on Spyglass (the Datapack Helper Plus engine)

dpkit is **not a from-scratch parser** — it runs the real engine behind the
[Datapack Helper Plus](https://marketplace.visualstudio.com/items?itemName=spgoding.datapack-language-server)
VS Code extension, built from the MIT-licensed [SpyglassMC/Spyglass](https://github.com/SpyglassMC/Spyglass)
project (the successor of [SpyglassMC/vscode-datapack](https://github.com/SpyglassMC/vscode-datapack)):

- **Vendored engine, zero external deps**: the built output of the 8 `@spyglassmc/*` packages
  (core / java-edition / json / locales / mcdoc / mcfunction / nbt / language-server) is committed
  in `vendor/spyglass/`, so the repo builds and checks datapacks with **no Spyglass checkout and
  no network** — see [vendor/spyglass/VENDORED.md](vendor/spyglass/VENDORED.md) for the origin,
  license, and the small local patch list.
- **Same per-version data**: command trees, registries, block states, and the `vanilla-mcdoc`
  NBT schema all come from the same [Spyglass API](https://api.spyglassmc.com) the editor uses,
  cached locally — a `--syntax` / `--registry` answer from dpkit is identical to what VS Code shows.
- **Parity is verified, not assumed**: `npm run parity` compares in-process vs LSP diagnostics
  per file (issue-signature equality), so "same engine" is a tested property, not a claim.
- **Beyond the editor**: on top of the Spyglass engine, dpkit adds the checks the editor never
  shows — `$` macro-line registry validation, per-version entity-NBT schema checks, structure-NBT
  parsing, the known-gotcha scan, and the game-log self-check (see
  [Deeper checks](#deeper-checks-the-editor-engine-does-not-show)).

Spyglass is © SPGoding and contributors (MIT) — many thanks to the team for open-sourcing the
engine and its per-version data pipeline.

## Install

```bash
npm install -g dpkit-mc     # the dpkit CLI (plus the dpkit-mcp MCP-server bin)
npx --yes dpkit-mc --help   # or run it without installing
```

From a source checkout: `node dpkit.mjs` (same CLI; `npm run build` first).

## Quick start

```bash
dpkit-mc --datapack=path/to/your-pack --version=26.2   # full check
dpkit-mc --datapack=path/to/your-pack --strict         # exit 1 on errors or warnings (CI-friendly)
```

> The examples below use `26.2` only because it is the latest release at the time of writing;
> every version flag accepts any cached/available id (`1.20.4`, `1.21.11`, `latest release`, …).

Or put your defaults in a config file (below) so a bare `dpkit` works.

## Config (.dpkit.json)

Put your default datapack/version in a config file and you don't need to pass flags each time.
Lookup order: cwd `.dpkit.json` → home `.dpkit.json`; or `--config=<path>` / `DPKIT_CONFIG`.
Relative paths resolve against the config file's directory. Fields:

| Field | Meaning |
|---|---|
| `datapack` | Datapack path (absolute, or relative to the config file) |
| `version` | Game version: `"auto"` (default, reads pack.mcmeta) / `"latest release"` / `"1.21.4"` … |
| `ignore` | Extra ignore patterns (substring or `/regex/`, same as `--ignore`) |
| `minecraftRoot` | Minecraft install root (the dir containing `versions/`, `logs/`), for auto-detect & log self-check |
| `baselineFile` | `--delta` baseline file (default `.dpkit-baseline.json`) |
| `gotchas` / `logcheck` | Disable the gotcha scan / log self-check (both default on) |
| `workspace` / `additionalDatapacks` | Read-only workspace datapack symbol providers |
| `resourcePacks` | Read-only resource-pack symbol providers |
| `cacheMiss` | `download` (default) / `fallback` / `fail` for missing per-version data |
| `falsePositives` | `false` disables all rules; a string array enables a subset |
| `checkWorkspace` | Also run a full separate check for every workspace datapack |

Per-value precedence: **CLI flag > env var > config file > built-in default**. Env vars:
`DPKIT_DATAPACK`, `DPKIT_VERSION`, `DPKIT_CONFIG` (recognized by both CLI and MCP; empty strings count
as unset). See `.dpkit.example.json` — copy it to `.dpkit.json` and edit the paths.

## Checking a datapack

```bash
node dpkit.mjs                                   # check the datapack (defaults from .dpkit.json)
node dpkit.mjs --version=auto                    # let the engine auto-detect version from pack.mcmeta
node dpkit.mjs --datapack=D:\other-pack --version=1.21.4   # check another datapack/version
node dpkit.mjs --files=test/function/*.mcfunction      # only some files (* glob, relative to data/)
node dpkit.mjs --engine=inproc|lsp|pool          # in-process (default) / legacy LSP / pooled (reuse across calls)
node dpkit.mjs --mode=analyze                    # LSP engine only: use spyglassmc/analyzeProject
node dpkit.mjs --json                            # machine-readable JSON output (scripts/CI)
node dpkit.mjs --delta                           # only re-report issues that changed since last --delta
node dpkit.mjs --no-ignore                       # do not auto-filter known false positives (incl. data-driven vanilla)
node dpkit.mjs --ignore='/Unknown key ["“]X["”]/' # extra ignore (substring or /regex/)
node dpkit.mjs --verbose                         # print the engine's own log lines
node dpkit.mjs --no-gotchas                      # disable the known-gotcha scan (heuristic, on by default)
node dpkit.mjs --no-macro                        # disable the $ macro-line registry-ID check (on by default)
node dpkit.mjs --no-entity-nbt                   # disable the entity-NBT schema check (summon/data; on by default)
node dpkit.mjs --strict                          # warnings also exit 1 (CI-friendly)
node dpkit.mjs --no-log                          # disable the game-log self-check (on by default)
node dpkit.mjs --watch                           # re-check on file changes (pooled engine; Ctrl-C to stop)
node dpkit.mjs --config=my.json                  # specify a config file
node dpkit.mjs --baseline=my-baseline.json       # specify the --delta baseline file
node dpkit.mjs --versions                        # list available game versions + whether a newer one exists
node dpkit.mjs --versions --uncached              # list versions whose command data isn't cached yet
node dpkit.mjs --cache-versions=1.19.4,1.20.4      # pre-download per-version data (batch warm-up)
node dpkit.mjs --check-updates                   # is the vendored Spyglass engine up to date with GitHub main?
node dpkit.mjs --help                            # all options
```

`--json` adds `engine` (`inproc`/`lsp`/`pool`) and `schemaVersion` (currently `1`) to the existing shape.

Exit codes: `0` no errors · `1` the report contains errors or file-level engine internal
failures (warnings too with `--strict`) · `2` environment/network failure or dpkit's own crash
(an uncaught internal exception) · `4` usage/configuration error.
Auto-filtered known false positives do not count toward the exit code.

### CI (GitHub Actions)

```yaml
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: 22 }
      - run: npx --yes dpkit-mc --datapack=pack --version=26.2 --strict   # exit 1 blocks the merge
```


## Multi-pack workspaces & read-only resource packs (new in 1.0)

`--workspace=<dir-or-zip>[,<dir-or-zip>...]` / `--additional-datapacks=…` make the checked pack
see symbols declared by other datapacks **without checking those packs**. Resolution precedence:
**current pack > workspace packs > vanilla**. Every resolved symbol is listed in the report as
`resolved from workspace datapack <path> (symbol provider only, not checked)`. Without a workspace,
a missing cross-pack function/advancement/predicate/… becomes a **scope hint** (not an
error/warning): `Cannot find function animated_java:* — pass --workspace=… if another pack declares it`.

`--check-workspace` runs an additional full, separate check for every workspace datapack (still
off by default; workspace packs remain provider-only in the main report).

`--resource-pack=<dir-or-zip>` / `--resource-packs=…` are **read-only** providers too. dpkit reads
only `assets/<ns>/sounds.json` sound events, `assets/<ns>/font/*.json` font IDs, and (optionally)
`assets/<ns>/lang/*.json` translation keys. It never validates textures/models/blockstates/atlas,
never checks the resource pack's pack_format, and never treats resource files as datapack files.
Resolved diagnostics are labelled `resolved from resource pack (auxiliary symbol only, not validated)`.

## Known-false-positive rule database

Built-in, version-aware rules default on and can be disabled with `--no-false-positives` or
configured in `.dpkit.json` (`falsePositives: false` disables all, a string array enables a subset):
`overlay-formats-single-int`, `text-opacity-negative-one`, `glow-color-override-negative-one`,
`interaction-response-byte`, `custom-model-data-predicate`, `macro-line-no-arguments`,
`max-format-unbounded`, `cross-pack-scope-hint`. They apply before `--ignore`; `--no-ignore` shows raw diagnostics.

## Version support range

The per-version data provider currently starts at **1.14** (data-pack version 4) and goes through
the latest release/snapshot. **1.13 and older have no upstream command-tree/registry data**, so
dpkit rejects them with an explicit `no version data before 1.14` error instead of silently
checking them with wrong grammar. The checkable range is printed by `--versions`.

## Offline cache policy & version ranges

A pinned `--version` with no local command data no longer silently "checks incompletely".
`--cache-miss=download` (default) tries an on-demand download and exits 2 if it fails;
`--cache-miss=fallback` checks with the nearest cached version and prints the target/actual/cache
source/unchecked range in the report header; `--cache-miss=fail` exits 2 without downloading.
`auto` now reads the whole `min_format`/`max_format` range, recognizes `max_format:9999999` as
unbounded, and prefers the release matching the base `pack.pack_format` when that dpv is inside
the declared range. A pack written as `pack_format:94, min_format:88, max_format:9999999`
therefore auto-detects as **1.21.11** (dpv 94), not the newest in-range release; pinning
`--version=1.21.11` prints `pack supports dpv 88..unbounded; target 1.21.11 (dpv 94) is inside range.`

## Deeper checks the editor engine does not show

dpkit runs the DHP engine for syntax/references, then layers on its own post-scans. These catch the
"0 errors in the editor, but silently broken in game" class.

### $ macro-line registry validation

The engine's parser does **no registry validation** on `$` macro lines (it only splits them into
literal chunks + `$(var)` interpolations) — so `$execute run effect give @s minecraft:knockback`
passes with 0 errors in 26.2 (knockback removed) while the same line without `$` reports
`Cannot find mob_effect`. dpkit validates macro lines independently:

- Walks the literal tokens outside `$(...)` through the command tree, checks registry argument
  slots (e.g. `effect give <target> <effect>`) against the version's registry values, and
  reports a `[macro]`-prefixed Warning on a miss.
- Also validates clearly invalid literal numbers / ranges / booleans / coordinates
  (e.g. `$effect give $(target) minecraft:speed banana` now reports `'banana' is not a valid
  integer (1..1000000)` as `[macro] macro-syntax`). Parsers without a safe conservative
  validator stay syntax-unchecked, never warned.
- **Conservative**: positions with macro variables / custom namespaces / `#tag` / desynced tree
  traversal are marked "unchecked" and never warned; pack-declared data-driven registries
  (damage_type/worldgen/biome/…) are auto-allowed **only for the namespace they were declared
  in** — `data/x/advancement/foo.json` validates `x:foo`, not `minecraft:foo`.
- **Transparent coverage**: the report adds a `coverage` line (macro lines · checked/unchecked ·
  auto-filtered), and files with unchecked positions are annotated with
  `⚠ N macro-line registry position(s) unchecked` — no more fake-green "this wasn't checked".
- `--no-macro` disables it; `--ignore=/\[macro\]/` suppresses macro warnings alone.

### Structure-NBT validation (`structure(s)/*.nbt`)

The engine registers structure files for cross-references but has no binary NBT parser, so a
corrupted structure file used to be counted as clean. dpkit now validates the container (raw /
gzip / zlib), the NBT wire format (recursive bounds-checked, no payload materialization), and
the required top-level structure keys (`DataVersion`, `size`, `blocks`, `entities`, `palette`).
Unreadable/truncated NBT is an Error; missing keys or trailing bytes are Warnings.

### Entity-NBT schema validation (summon / data merge)

The engine's NBT schema is loose (it can stay silent on renamed/removed fields), so dpkit checks
entity NBT against **Spyglass's cached `vanilla-mcdoc` schema** — the same data the engine
validates against, which carries each serialized field with `#[since=]`/`#[until=]` game-version
annotations. This catches the silent-failure class the engine misses:

- **Outdated fields**: `summon … {HandItems:[…]}` in 26.2 → `[nbt] … field 'HandItems' was removed
  in 1.21.5` (it merged into `equipment`), or `[nbt] … was added in X` for a too-new field.
- **Nonexistent registry IDs inside NBT**: `DeathLootTable:"minecraft:empty"` in 26.2 →
  `[nbt] loot_table 'minecraft:empty' is not in the loot_table registry`.
- **`data merge entity @s {…}`** is validated for registry-bearing fields (e.g. `DeathLootTable`)
  even though the entity type isn't in the command.
- **Conservative**: unknown entity types / custom namespaces / nested-only fields / macro lines are
  counted "unchecked" and never warned. Globally registry-bearing fields (e.g. `DeathLootTable`)
  are still validated on custom/unknown entity types, because their meaning is entity-independent.
- If candidate `summon`/`data` lines exist but the `vanilla-mcdoc` tarball isn't cached yet,
  coverage reports `entity-NBT scan skipped (mcdoc schema not cached)` instead of silently
  passing (the first online check downloads it). `--no-entity-nbt` disables it;
  `--ignore=/\[nbt\]/` suppresses the warnings alone.

### Known-gotcha scan (heuristic) & game-log self-check

The engine's loose schema stays silent on "unknown keys / wrong nesting" and knows nothing about
runtime behavior — dpkit ships a **universal** heuristic gotcha scanner (content-level regex /
structure walk, not tied to any pack) that catches "0 warnings in dpkit but silently fails in
game" patterns, reported at the end under `== <version> known-gotcha scan ==`:

- **JSON advancement**: `damage.source_entity`/`damage.direct_entity` at the damage level directly
  (should be under `damage.type.source_entity`) — the game **silently drops the whole advancement**.
- **JSON advancement**: multiple criteria sharing one trigger + a `requirements` OR — **does not
  fire**; split multi-source listening into separate advancements.
- **mcfunction**: `particle minecraft:item/block` bare ID — must use map syntax
  (`{item:...}`/`{block_state:...}`), otherwise the **whole function fails to load**.
- **mcfunction**: `summon` entity NBT in lowercase/snake_case field names — must be PascalCase,
  otherwise **silently ignored**.
- **JSON item**: `data/minecraft/item/ender_eye.json` adding `minecraft:consumable` — ender_eye
  keeps its hardcoded throw-on-use behavior, so `consume_item` never fires; track the throw with
  `used_item`/`use_item` instead.

Gotchas are heuristic and **do not count toward the exit code**; `--no-gotchas` disables them.
Messages prefix the actually-effective version.

**Game-log self-check** (`--no-log` disables, runs by default with a full check): uses the same
log discovery as the MCP `read_logs` tool (official / Prism / TLauncher, incl. rotated `.log.gz`),
filters by the datapack's own `data/` namespaces, and reports ① datapack files newer than the log
(**you may not have /reload'ed** — error/count data is stale), ② the most recent advancement count,
③ suspected datapack load-error lines (including the
`Errors in currently selected datapacks prevented the world from loading` summary).

### Honest coverage + which pack is checked

- The report header prints **where the datapack came from** — `(from --datapack)` /
  `(from DPKIT_DATAPACK)` / `(from .dpkit.json)` / `(auto-detected)` — so a stale config can't
  silently point the check at the wrong pack.
- A config/env `datapack` that points at a **missing** path warns loudly and falls back to
  auto-detection; a home-dir `.dpkit.json` that points away from the auto-detected pack prints a
  `⚠` mismatch hint (it still checks the configured pack — pass `--datapack=` to override).
- When positions go unvalidated (macro variables, unknown entities, …) the summary adds a
  `⚠ coverage gap: N position(s) not validated` line — so "0 errors / 0 warnings" no longer reads
  as "everything was checked".
- **Overlay files are version-filtered**: an overlay whose `formats` range does not contain the
  target version's data-pack version is not part of that check; the coverage line reports the
  number of files skipped. If the target dpv is still unknown, every overlay is kept (conservative).
- **Unreadable paths are loud**: a `data/` directory that exists but cannot be listed, or a text
  file that cannot be read, is reported as a `[check]` warning and counted in
  `coverage.unreadableDirs` / `coverage.unreadableFiles` instead of being silently skipped.
- `--version=not-a-version` prints a `⚠ version 'X' not recognized` warning instead of silently
  checking as the latest snapshot.

### Known false positives (data-driven auto-filter)

`Cannot find attribute/mob_effect/… "minecraft:<valid-id>"` — a "vanilla registry not declared in
the pack" false positive — is auto-filtered only when the ID is **exactly** in the current
version's registry values (data-driven per version: 1.21.1's `minecraft:generic.attack_speed` is
legal and filtered; from 1.21.2 it's a real error). Likewise `Cannot find tag/<reg>
"minecraft:<vanilla-tag>"` (e.g. `#minecraft:is_projectile`) when the vanilla tag cache exists.
Removed `minecraft:knockback` and typos still report. `--no-ignore` shows **all raw diagnostics** —
note it also disables the `ignore` rules in `.dpkit.json`.

> **`--files` path note**: the glob is relative to the datapack's `data/` directory, **without the
> `data/` prefix**, e.g. `test/function/*.mcfunction` (not `data/test/...`).

## Teaching AI to write commands (--syntax / --registry / --complete)

Beyond checking, this tool is a **per-version syntax teacher**: it prints the real grammar of a
command from the target version's command tree, for a human or AI to check before/after writing.
Grammar data comes from Spyglass's cached command tree (the same one VS Code DHP uses) — the only
trustworthy syntax source for that version. Target version = `--version=` or the config's `version`.

```bash
node dpkit.mjs --syntax="execute on"             # print the 8 valid values of on + what can chain
node dpkit.mjs --syntax="damage"                 # print the argument chain + a description per argument
node dpkit.mjs --syntax="advancement grant" --depth=6   # deeper commands can expand further (default 4)
node dpkit.mjs --syntax="execute.banana"         # a wrong path errors and lists the known next level (exit 1)
node dpkit.mjs --registry=mob_effect             # list every value of the mob_effect registry (offline)
node dpkit.mjs --registry=?                      # list all available registries + counts (182 in 26.2; per version)
node dpkit.mjs --complete=test/function/x.mcfunction:1:24   # live completion at a cursor (1-based line:col)
node dpkit.mjs --complete-inline="effect give @s knock"     # complete a raw command string (no temp pack)
node dpkit.mjs --dump-all                        # generate the full reference command-reference-<version>.md
node dpkit.mjs --dump=ref.md --version=1.21.4    # generate the reference for another version
```

- `--syntax`/`--registry`/`--dump` read the local cache (no engine, no datapack); when the
  version's data isn't cached yet they download it on demand (offline: a clean one-line error).
  `--cache-versions=1.19.4,1.20.4` pre-warms a set.
- `--complete` starts the engine and parses the specified file (`data/`-relative path + line:col)
  to return the valid values at that position; `--complete-inline="<text>"` completes the end of a
  raw command string (still needs a datapack for project context — `--datapack=` or config).
  **Known limit**: `$` macro lines yield no completions (engine returns empty); normal lines work;
  large projects wait for file parsing first.
- `--syntax` error paths also list the valid enum (e.g. `Expected "attacker", …, "vehicle"`), usable
  as fix feedback.

## MCP server (native AI-IDE calls)

Exposes dpkit's capabilities as MCP tools so any AI IDE / coding agent can call the real engine
instead of guessing syntax:

```json
{
  "mcpServers": {
    "dpkit": { "command": "npx", "args": ["--yes", "dpkit-mcp"] }
  }
}
```

(Add that to your MCP client's config, or a project `.mcp.json`. From a source checkout, the same
server runs via `npm run mcp`.)

Tools: `check_datapack`, `query_syntax`, `complete_at`, `list_registry`, `list_versions`,
`scan_gotchas`, `read_logs`, `get_vanilla_data`, `get_block_states`. `check_datapack` also returns
macro-line validation results and `coverage` (above); `list_registry` lists a registry's valid
values in one call (check before writing an ID, especially inside `$` macro lines); `read_logs`
tails the active launcher's latest.log (official / Prism / TLauncher, including rotated `.log.gz`)
to diagnose runtime issues; `get_vanilla_data` / `get_block_states` query the vanilla game's data
files and block-state properties for a version (offline, from the shared cache).
`get_vanilla_data` currently catalogs 57 data categories, including 26.2 registries
(`cat_variant`, `trade_set`, `test_instance`, …) and 26.3 worldgen split-outs
(`worldgen/feature`, `worldgen/carver`, `worldgen/material_rule`, …). Default
datapack/version come from `.dpkit.json` and `$DPKIT_DATAPACK` / `$DPKIT_VERSION`; tool arguments
override per call. `.dpkit.json`'s `minecraftRoot` also feeds `read_logs` (a `minecraftRoot=` arg
overrides it).

Every tool result is a JSON envelope: success adds `ok: true` (plus `count` / `total` where
relevant), errors keep the legacy `{ error, ok: false }` shape with `isError: true`. Large arrays
(diagnostics, registry values, completion items, file-key lists, block-id lists) are truncated
with `total` + `truncated` + a `hint` (pass `search=` / `block=` to narrow). A `dpkit-workflow`
prompt (`prompts/list`) encodes the version-first workflow: pin the version, check `query_syntax`
before writing a command, verify IDs with `list_registry`, then run `check_datapack` and clear all
errors.
Smoke test: `node tests/mcp-smoke.mjs` (runs on `tests/fixtures/pack`, reproducible anywhere).

Inspiration & data sources: the MCP additions (multi-launcher `read_logs`, vanilla-data lookup,
block-state queries, the workflow prompt, and the envelope/truncation conventions) were inspired by
the [MineCode MCP](https://github.com/AnCarsenat/minecode-mcp) project. The underlying data comes
from the [misode/mcmeta](https://github.com/misode/mcmeta) summaries and the
[Spyglass API](https://api.spyglassmc.com), fetched once and cached locally per dpkit's
offline-first design — unlike MineCode, dpkit does not depend on live network calls at query time.

## Using dpkit with AI agents

The MCP tools are built for a **version-first workflow** — the same one the `dpkit-workflow`
prompt encodes. A client that loads the prompt gets it automatically; otherwise steer the agent
through the same six steps:

1. **Pin the version first.** Read the datapack's `pack.mcmeta`, resolve the target version, and
   pass it to every tool call. Watch out for `min_format`/`max_format` skewing auto-detection —
   pin `--version=` explicitly when it matters.
2. **Check syntax before writing a command.** `query_syntax(path, version)` returns the real
   per-version grammar — never let the agent guess a subcommand or enum from memory (e.g. the 8
   valid values of `execute on`).
3. **Verify IDs before writing them.** `list_registry(registry, version, search=)` confirms an ID
   exists in that version (e.g. `mob_effect` has no `knockback` in 26.2). Critical inside `$`
   macro lines, where the engine does not validate IDs.
4. **Re-check after every round of edits.** `check_datapack(datapack, version)` → fix all errors
   until the summary is clean; then `scan_gotchas` for silent-failure patterns (advancement
   damage nesting, particle map syntax, summon NBT casing).
5. **Diagnose runtime issues with `read_logs`.** Tails the active launcher's `latest.log`
   (official / Prism / TLauncher, incl. rotated `.log.gz`) — load errors that never surface in a
   static check live here.
6. **Use vanilla data as reference.** `get_vanilla_data(category, search=)` for vanilla files
   (loot tables, recipes, worldgen), `get_block_states(block=)` for block-state properties — both
   offline from the shared cache.

**Reading results.** Every tool returns a JSON envelope: `ok: true` (plus `count`/`total`) on
success, `{ error, ok: false }` + `isError: true` on failure. Large arrays are truncated with
`total`/`truncated`/`hint` — query progressively (`search=`/`block=`) instead of requesting full
lists. An uncached version offline yields a clean structured error, not a crash: one online run
caches the data, then everything works offline.

**Known agent pitfalls.** Forgetting the `version` arg (falls back to the config); expecting
completions on `$` macro lines (`complete_at` returns empty — complete on a normal line first);
trusting memory over `query_syntax`/`list_registry` for anything version-specific.

## Typed API (scripts/tools call directly)

CLI and MCP both call the same typed API (`dist/api.d.ts`):

```ts
import { checkDatapack, querySyntax, completeAt } from 'dpkit-mc';   // npm package-name import
const r = await checkDatapack({ datapack, version: '26.2' });      // → CheckReport
querySyntax('execute on', '26.2');                                 // synchronous, offline
await completeAt({ datapack, version, rel, line, column });        // → completion items
```

## Incremental report (--delta)

`--delta` still does a **full check** — cross-references need complete project context; skipping
unchanged files would misreport undeclaredSymbol — but hides diagnostics of files unchanged since
the last run, highlighting **new / changed / resolved** issues:

```text
baseline : 54 error / 718 warning
current  : 54 error / 718 warning
new      :  0 error /   0 warning
resolved :  0 error /   0 warning
== x.mcfunction ==  ✓ resolved (previously 2 issue(s))        ← 2 issues fixed since last run
```

`--json` carries the same four counters under `report.delta.baseline/current/new/resolved`.

The baseline lives in `.dpkit-baseline.json` (repo root, git-ignored), keyed per `datapack@@version`
so different packs/versions don't clobber each other; `--baseline=` changes the file. A first
`--delta` for a pack is treated as all-new. Legacy single-entry files are read and migrated, and
current files carry a `formatVersion` field for forward/backward compatibility.

## Build & test

```bash
npm run build          # tsc --emitDeclarationOnly + esbuild bundle → dist/ (self-contained, zero runtime deps)
npm test               # regression tests (unit + fixture integration + CLI + MCP)
npm run test:versions  # 1.14→26.2 version matrix (DPKIT_TEST_VERSIONS to override)
npm run parity         # inproc vs LSP per-file issueSig comparison (version defaults to latest release)
npm run test:all       # npm test + multi-version matrix + parity (full gate)
npm run bench          # performance baseline (engine / full check / post-scans)
npm run mcp            # start the MCP server from the repo
```

Multi-version guard: `tests/multi-version.spec.mjs` checks the engine, macro scan, and entity-NBT
scan against `DPKIT_TEST_VERSIONS` (default `1.14,1.15.2,1.16.5,1.18.2,1.19.4,1.20.4,1.21.4,1.21.11,26.2`). Versions whose command
data isn't cached are skipped; pre-warm CI or a local run with
`node dpkit.mjs --cache-versions=1.14,1.15.2,1.16.5,1.18.2,1.19.4,1.20.4,1.21.4,1.21.11,26.2`
(pre-warms commands, registries, block states, and the vanilla data/resource archives the engine
needs for those versions). Parity uses
`DPKIT_PARITY_VERSION` (default `latest release`) so the engine gate isn't pinned to one release.

Source in `src/`: `cli.ts` (entry) / `api.ts` (typed API + report assembly) / `engine/inproc.ts`
(in-process engine) / `lsp-legacy.ts` (LSP fallback) / `mcp.ts` (MCP server) / `config.ts` (config) /
several pure-logic modules. The vendored `@spyglassmc/*` engine is bundled into `dist/` at build time
(`scripts/build-bundle.mjs`); `npm run vendor -- --spyglass=<path>` refreshes it from a source
checkout. `tests/fixtures/pack` is a self-contained fixture datapack (namespace `test`);
integration/parity/smoke tests all run on it, no real save needed.

## Version updates (keeping up)

**How new versions are supported:** command tree, registry, block states, and NBT schema
(vanilla-mcdoc) are all **data** served by Spyglass. Every engine run does a conditional request
with `if-none-match` (ETag) — when the server publishes new data, the **next online run pulls and
recognizes it automatically**, no cache-clearing or code change needed.

```bash
node dpkit.mjs --versions                    # see versions, latest release, which are cached
node dpkit.mjs --version=1.21.4              # switch to a new version (first use downloads)
node dpkit.mjs --version="latest release"    # always follow the latest release
node dpkit.mjs --version="latest snapshot"   # always follow the latest snapshot
```

**Stale-version hint:** a normal check auto-detects at the end — if the checked version is behind
the latest release, it suggests `switch to: node dpkit.mjs --version="…"`. Not shown when checking
a snapshot newer than the latest release.

**Caveats:**
- `.zip` datapacks are supported by `check_datapack`/CLI/MCP checks (extracted to a temp dir);
  `--watch` and `--complete` still require a directory.
- Requires **online** for new data; offline falls back to the last cached data (possibly stale).
- Packs with `min_format`/`max_format` skew `--version=auto` to a newer version — **pin the version**.
- If a pinned version isn't in the (possibly stale) cached version list, dpkit prints a
  `⚠ version 'X' not recognized` warning and the engine falls back to the latest snapshot —
  don't ignore it; confirm with `--versions` that the version is listed before checking.
- Only brand-new parameter types / command-format overhauls need re-vendoring the engine:
  `npm run vendor -- --spyglass=<updated-checkout>` then `npm install` (the engine build is
  vendored inside this repo at `vendor/spyglass/`, so day-to-day use needs no Spyglass checkout).
  Regular new commands/subcommands/registry values/NBT fields do not.
- Engine freshness: `node dpkit.mjs --check-updates` compares the vendored build record against
  Spyglass's GitHub `main` and tells you when to re-vendor.

## Notes

- **Version**: default = `--version=` / `DPKIT_VERSION` / config `version` / built-in `auto`
  (`DEFAULT_VERSION` in `src/config.ts`). `auto` reads the pack's `pack.mcmeta`; when a pack has
  `min_format`/`max_format` **and** a base `pack_format`, it prefers the release matching the base
  dpv if that dpv is inside the declared range. Range-only packs (no base `pack_format`) still
  resolve to the newest in-range release — pin `--version=` when that isn't the intended target.
  Offline syntax/gotcha scans (`--syntax`/`--dump`/non-complete pure file scans) default to the
  latest release in the local cache.
- **Game data**: the first run downloads the target version's command tree/registry/vanilla data
  from `api.spyglassmc.com` and caches it (`%LOCALAPPDATA%\spyglassmc-nodejs\Cache`); offline after.
- **Known engine gotcha**: client capabilities must include
  `workspace.didChangeWatchedFiles.dynamicRegistration`, otherwise the engine doesn't track the
  datapack's own files and function/scoreboard/tag cross-references all misreport undeclaredSymbol.
- **Known false positive**: `Unknown key "LastHurtMob"` (valid in-game but missing from Spyglass's
  mcdoc entity NBT schema) is auto-filtered: not counted, listed separately at the end of the
  report under `== ignored (known false positives, not counted) ==`. Use `--no-ignore` to see raw
  diagnostics. Note the engine renders key names with typographic quotes `" "`, so prefer
  `/regex/` ignore forms, e.g. `/Unknown key ["“]LastHurtMob["”]/`.

## Contributing & community

- [CONTRIBUTING.md](CONTRIBUTING.md) — dev setup, build/test commands, commit conventions, and the Spyglass vendoring flow.
- [SECURITY.md](SECURITY.md) — how to report a security issue (privately, first).
- [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md) — Contributor Covenant 2.1.

## License

[MIT](LICENSE) — Copyright (c) 2026 dpkit contributors.

This project is built on the **MIT-licensed [Spyglass](https://github.com/SpyglassMC/Spyglass)
engine** (© SPGoding and contributors) and bundles third-party code (the vendored Spyglass
engine and `@zip.js/zip.js`) whose licenses are reproduced in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
