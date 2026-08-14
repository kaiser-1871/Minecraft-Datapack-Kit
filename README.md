# dpkit — a CLI tool on the DHP engine: check datapacks + teach AI to write commands

Checks **any** datapack with the same engine as **Datapack Helper Plus (Spyglass)**, producing
diagnostics identical to DHP in VS Code (format / command syntax / references / version detection).
The engine runs **in-process** by default (drives `@spyglassmc/core` directly, no subprocess, no
hand-rolled LSP protocol); the old LSP-subprocess path is kept as `--engine=lsp` for parity.
There is also an **MCP server** exposing check / syntax / completion to AI IDEs natively.

Code is TypeScript: source in `src/`, compiled to `dist/` (the root `dpkit.mjs` is a shim;
`node dpkit.mjs` usage is unchanged).

> This tool is **universal**. Which datapack/version it checks by default is set in `.dpkit.json`
> (see below); the repo ships no save/datapack content of its own.

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

Per-value precedence: **CLI flag > env var > config file > built-in default**. Env vars:
`DPKIT_DATAPACK`, `DPKIT_VERSION`, `DPKIT_CONFIG` (recognized by both CLI and MCP). See
`.dpkit.example.json` — copy it to `.dpkit.json` and edit the paths.

## Usage

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
node dpkit.mjs --no-entity-nbt                    # disable the entity-NBT schema check (summon/data; on by default)
node dpkit.mjs --strict                          # warnings also exit 1 (CI-friendly)
node dpkit.mjs --no-log                          # disable the game-log self-check (on by default)
node dpkit.mjs --watch                           # re-check on file changes (pooled engine; Ctrl-C to stop)
node dpkit.mjs --config=my.json                  # specify a config file
node dpkit.mjs --baseline=my-baseline.json       # specify the --delta baseline file
node dpkit.mjs --versions                        # list available game versions + whether a newer one exists
node dpkit.mjs --help                            # all options
```

`--json` adds `engine` (`inproc`/`lsp`/`pool`) and `schemaVersion` (currently `1`) to the existing shape.

Exit codes: `0` no errors · `1` errors/internal failure · `2` environment/network failure · `4` usage/configuration error.
Ignored false positives do not count toward the exit code.

## Teaching the AI to write commands (--syntax / --complete)

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
node dpkit.mjs --registry=?                      # list all available registries (182) + counts
node dpkit.mjs --complete=test/function/x.mcfunction:1:24   # live completion at a cursor (1-based line:col)
node dpkit.mjs --complete-inline="effect give @s knock"     # complete a raw command string (no temp pack)
node dpkit.mjs --dump-all                        # generate the full reference command-reference-<version>.md
node dpkit.mjs --dump=ref.md --version=1.21.4    # generate the reference for another version
```

- `--syntax`/`--registry`/`--dump` are pure offline cache reads (no engine, no datapack);
  `--version=` can point at any cached version.
- `--complete` starts the engine and parses the specified file (`data/`-relative path + line:col)
  to return the valid values at that position; `--complete-inline="<text>"` completes the end of a
  raw command string (still needs a datapack for project context — `--datapack=` or config).
  **Known limit**: `$` macro lines yield no completions (engine returns empty); normal lines work;
  large projects wait for file parsing first.
- `--syntax` error paths also list the valid enum (e.g. `Expected "attacker", …, "vehicle"`), usable
  as fix feedback.

## $ macro-line validation and coverage

The engine's parser does **no registry validation** on `$` macro lines (it only splits them into
literal chunks + `$(var)` interpolations) — so `$execute run effect give @s minecraft:knockback`
passes with 0 errors in 26.2 (knockback removed) while the same line without `$` reports
`Cannot find mob_effect`. dpkit now validates macro lines independently:

- Walks the literal tokens outside `$(...)` through the command tree to registry argument slots
  (e.g. `effect give <target> <effect>`), checks them against the version's registry values, and
  reports a `[macro]`-prefixed Warning on a miss.
- **Conservative**: positions with macro variables / custom namespaces / `#tag` / desynced tree
  traversal are marked "unchecked" and never warned; pack-declared data-driven registries
  (damage_type/worldgen/biome/…) are auto-allowed.
- **Transparent coverage**: the report adds a `coverage` line (macro lines · checked/unchecked ·
  auto-filtered), and files with unchecked positions are annotated with
  `⚠ N macro-line registry position(s) unchecked` — no more fake-green "this wasn't checked".
- `--no-macro` disables it; `--ignore=/\[macro\]/` suppresses macro warnings alone.

## Entity-NBT schema validation (summon / data merge)

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
  counted "unchecked" and never warned.
- Degrades to a no-op until the `vanilla-mcdoc` tarball is cached (the first online check downloads
  it). `--no-entity-nbt` disables it; `--ignore=/\[nbt\]/` suppresses the warnings alone.

## Honest coverage + which pack is checked

- The report header now prints **where the datapack came from** — `(from --datapack)` /
  `(from DPKIT_DATAPACK)` / `(from .dpkit.json)` / `(auto-detected)` — so a stale config can't
  silently point the check at the wrong pack.
- A config/env `datapack` that points at a **missing** path warns loudly and falls back to
  auto-detection; a home-dir `.dpkit.json` that points away from the auto-detected pack prints a
  `⚠` mismatch hint (it still checks the configured pack — pass `--datapack=` to override).
- When positions go unvalidated (macro variables, unknown entities, …) the summary adds a
  `⚠ coverage gap: N position(s) not validated` line — so "0 errors / 0 warnings" no longer reads
  as "everything was checked".

### Known false positives (data-driven auto-filter)

`Cannot find attribute/mob_effect/… "minecraft:<valid-id>"` — a "vanilla registry not declared in
the pack" false positive — is now auto-filtered only when the ID is **exactly** in the current
version's registry values (data-driven per version: 1.21.1's `minecraft:generic.attack_speed` is
legal and filtered; from 1.21.2 it's a real error). Likewise `Cannot find tag/<reg>
"minecraft:<vanilla-tag>"` (e.g. `#minecraft:is_projectile`) when the vanilla tag cache exists.
Removed `minecraft:knockback` and typos still report. `--no-ignore` shows **all raw diagnostics** —
note it also disables the `ignore` rules in `.dpkit.json`.

> **`--files` path note**: the glob is relative to the datapack's `data/` directory, **without the
> `data/` prefix**, e.g. `test/function/*.mcfunction` (not `data/test/...`).

## MCP server (native AI-IDE calls)

Exposes dpkit's capabilities as MCP tools so any AI IDE / coding agent can call the real engine
instead of guessing syntax:

```bash
npm run mcp        # start the stdio MCP server (node dist/mcp.js)
```

Tools: `check_datapack`, `query_syntax`, `complete_at`, `list_registry`, `list_versions`,
`scan_gotchas`. `check_datapack` also returns macro-line validation results and `coverage` (above);
`list_registry` lists a registry's valid values in one call (check before writing an ID, especially
inside `$` macro lines). Default datapack/version come from `.dpkit.json` and
`$DPKIT_DATAPACK` / `$DPKIT_VERSION`; tool arguments override per call.
Smoke test: `node tests/mcp-smoke.mjs` (runs on `tests/fixtures/pack`, reproducible anywhere).

## Typed API (scripts/tools call directly)

CLI and MCP both call the same typed API (`dist/api.d.ts`):

```ts
import { checkDatapack, querySyntax, completeAt } from 'dpkit';   // npm package-name import
const r = await checkDatapack({ datapack, version: '26.2' });      // → CheckReport
querySyntax('execute on', '26.2');                                 // synchronous, offline
await completeAt({ datapack, version, rel, line, column });        // → completion items
```

## Build & test

```bash
npm run build        # tsc --emitDeclarationOnly + esbuild bundle → dist/
npm test             # regression tests (unit + fixture integration + CLI smoke + MCP smoke)
npm run parity       # inproc vs LSP per-file issueSig comparison (correctness gate; fixture by default)
npm run test:all     # npm test + parity (full gate)
npm run mcp          # start the MCP server
```

Source in `src/`: `cli.ts` (entry) / `api.ts` (typed API + report assembly) / `engine/inproc.ts`
(in-process engine) / `lsp-legacy.ts` (LSP fallback) / `mcp.ts` (MCP server) / `config.ts` (config) /
several pure-logic modules. `tests/fixtures/pack` is a self-contained fixture datapack (namespace
`test`); integration/parity/smoke tests all run on it, no real save needed.

## False-positive filtering

The known false positive `Unknown key "LastHurtMob"` (valid in-game but missing from Spyglass's
mcdoc entity NBT schema) is auto-filtered by default: not counted, listed separately at the end of
the report under `== ignored (known false positives, not counted) ==`. Use `--no-ignore` to see
raw diagnostics.

`--ignore=<pattern>` or the config's `ignore` array appends custom ignores: a plain string matches
as a substring; `/regex/` matches as a regex (repeatable, comma-separated).

> Note: the engine renders key names with **typographic quotes `“ ”`**, not ASCII `"`. To match a
> quoted message prefer the `/regex/` form, e.g. `/Unknown key ["“]LastHurtMob["”]/`.

## Incremental report (--delta)

`--delta` still does a **full check** — cross-references need complete project context; skipping
unchanged files would misreport undeclaredSymbol — but hides diagnostics of files unchanged since
the last run, highlighting **new / changed / resolved** issues:

```text
files : 72 checked, 71 clean · delta: 1 changed, 0 resolved   ← only 1 file has new/changed issues
== x.mcfunction ==  ✓ resolved (previously 2 issue(s))        ← 2 issues fixed since last run
```

The baseline lives in `.dpkit-baseline.json` (repo root, git-ignored), keyed per `datapack@@version`
so different packs/versions don't clobber each other; `--baseline=` changes the file. A first
`--delta` for a pack is treated as all-new. Legacy single-entry files are read and migrated.

## Known-gotcha scan (heuristic) & game-log self-check

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

Gotchas are heuristic and **do not count toward the exit code**; `--no-gotchas` disables them.
Messages prefix the actually-effective version.

**Game-log self-check** (`--no-log` disables, runs by default with a full check): derives
`latest.log` from the datapack's `versions` segment / config's `minecraftRoot` / `%APPDATA%`,
filters by the datapack's own `data/` namespaces, and reports ① datapack files newer than the log
(**you may not have /reload'ed** — error/count data is stale), ② the most recent advancement count,
③ suspected datapack load-error lines.

## Notes

- **Version**: default = `--version=` / `DPKIT_VERSION` / config `version` / built-in `auto`
  (`DEFAULT_VERSION` in `src/config.ts`). `auto` reads the pack's `pack.mcmeta`, pinning nothing;
  packs with `min_format`/`max_format` get detected as a newer version — pin the version in config
  when you need to. Offline syntax/gotcha scans (`--syntax`/`--dump`/non-complete pure file scans)
  default to the latest release in the local cache.
- **Game data**: the first run downloads the target version's command tree/registry/vanilla data
  from `api.spyglassmc.com` and caches it (`%LOCALAPPDATA%\spyglassmc-nodejs\Cache`); offline after.
- **Known engine gotcha**: client capabilities must include
  `workspace.didChangeWatchedFiles.dynamicRegistration`, otherwise the engine doesn't track the
  datapack's own files and function/scoreboard/tag cross-references all misreport undeclaredSymbol.

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
- Requires **online**; offline falls back to the last cached data (possibly stale).
- Packs with `min_format`/`max_format` skew `--version=auto` to a newer version — **pin the version**.
- **If a requested version isn't in a (stale) version list, the engine silently falls back to the
  latest snapshot** instead of erroring — offline / just-released versions may quietly be checked
  as another version. Confirm with `--versions` that the version is listed before checking.
- Only brand-new parameter types / command-format overhauls need re-vendoring the engine:
  `npm run vendor -- --spyglass=<updated-checkout>` then `npm install` (the engine build is
  vendored inside this repo at `vendor/spyglass/`, so day-to-day use needs no Spyglass checkout).
  Regular new commands/subcommands/registry values/NBT fields do not.
- Engine freshness: `node dpkit.mjs --check-updates` compares the vendored build record against
  Spyglass's GitHub `main` and tells you when to re-vendor.

