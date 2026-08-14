// cli.ts — dpkit CLI entry. Thin shell over the typed API: parse args, call the API,
// render text/JSON, set exit codes. All engine/analysis logic lives in api.ts + engines.
//
// Defaults come from a .dpkit.json config file (cwd → home, or --config=<path>) and env
// vars, so the tool works for ANY datapack/version out of the box. Precedence per value:
//   CLI flag  >  env var (DPKIT_DATAPACK / DPKIT_VERSION / DPKIT_CONFIG)
//             >  .dpkit.json  >  built-in default
import { existsSync, readFileSync, statSync, watch, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { parseArgs } from 'node:util';
import { ROOT_DIR, BASELINE_FILE } from './paths.js';
import { detectDefaultDatapack } from './datapack-discovery.js';
import { DEFAULT_VERSION, loadConfig } from './config.js';
import type { DpkitConfig } from './config.js';
import { BUILTIN_IGNORE_DESC } from './ignore.js';
import { loadCachedVersions } from './syntax.js';
import * as api from './api.js';

// ---- parse CLI args (util.parseArgs: --name=value or --name value, --no-*, repeatable --ignore) ----
const { values: V } = (() => {
  try {
    return parseArgs({
      options: {
        version: { type: 'string' },
        datapack: { type: 'string' },
        config: { type: 'string' },
        files: { type: 'string' },
        baseline: { type: 'string' },
        engine: { type: 'string' },
        mode: { type: 'string' },
        syntax: { type: 'string' },
        dump: { type: 'string' },
        depth: { type: 'string' },
        complete: { type: 'string' },
        'complete-inline': { type: 'string' },
        registry: { type: 'string' },
        ignore: { type: 'string', multiple: true },
        json: { type: 'boolean' },
        delta: { type: 'boolean' },
        'no-ignore': { type: 'boolean' },
        verbose: { type: 'boolean' },
        'no-gotchas': { type: 'boolean' },
        'no-macro': { type: 'boolean' },
        'no-entity-nbt': { type: 'boolean' },
        strict: { type: 'boolean' },
        'no-log': { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
        versions: { type: 'boolean' },
        'check-updates': { type: 'boolean' },
        'dump-all': { type: 'boolean' },
        watch: { type: 'boolean' },
      },
      strict: true,
    });
  } catch (err) {
    console.error(`[check] ${(err as Error).message}`);
    process.exit(4);
  }
})();

// ---- config (.dpkit.json) ----
let cfg: DpkitConfig = {};
let cfgPath: string | null = null;
try { const loaded = loadConfig(V.config); cfg = loaded.config; cfgPath = loaded.path; }
catch (err) {
  // --help only prints usage: a broken/missing config must not make it fail (or exit non-zero).
  if (V.help === true) { cfg = {}; cfgPath = null; }
  else { console.error((err as Error).message); process.exit(4); }
}
// Empty-string env vars mean "unset" (CI shells often export them empty); plain ?? would
// let '' win over the config and produce a bogus empty version/datapack down the line.
const dpkitVersionEnv = process.env.DPKIT_VERSION?.trim() || undefined;
const dpkitDatapackEnv = process.env.DPKIT_DATAPACK?.trim() || undefined;
const cfgVersion = dpkitVersionEnv ?? cfg.version;
const cfgDatapack = dpkitDatapackEnv ?? cfg.datapack;

// ---- flags (CLI flag > env/config > default) ----
const GAME_VERSION = V.version ?? cfgVersion ?? DEFAULT_VERSION; // 'auto'(default) | 'latest release' | '1.21.4' ...
let DP_SOURCE: 'cli' | 'env' | 'config' | 'auto' =
  V.datapack !== undefined ? 'cli'
  : dpkitDatapackEnv !== undefined ? 'env'
  : cfg.datapack !== undefined ? 'config'
  : 'auto';
let DATAPACK: string | null = V.datapack ?? cfgDatapack ?? detectDefaultDatapack(GAME_VERSION, cfg.minecraftRoot);

// #2: never silently check a stale/pointed-elsewhere datapack. A dead config/env path used to
// either fail late or (worse) make a green report for the WRONG pack. Warn loudly, fall back to
// auto-detection, and flag a home-dir config that points away from the more-relevant detected pack.
// Offline teach modes (--syntax/--registry/--versions/--dump/--dump-all) read only the local
// cache, --check-updates compares the vendored engine, and --complete-inline completes a raw
// string — none operates on the configured datapack, so a stale/missing-datapack warning is
// noise for them (and --help must stay clean too).
const datapackNeeded = !(
  V.help === true ||
  V.syntax !== undefined || V.dump !== undefined || V['dump-all'] === true ||
  V.registry !== undefined || V.versions === true || V['check-updates'] === true ||
  V['complete-inline'] !== undefined
);
const samePath = (a: string, b: string): boolean => a.toLowerCase().replace(/\\/g, '/') === b.toLowerCase().replace(/\\/g, '/');
if (datapackNeeded && (DP_SOURCE === 'config' || DP_SOURCE === 'env')) {
  const auto = detectDefaultDatapack(GAME_VERSION, cfg.minecraftRoot);
  if (DATAPACK && !existsSync(DATAPACK)) {
    const from = DP_SOURCE === 'env' ? 'DPKIT_DATAPACK' : (cfgPath ?? '.dpkit.json');
    console.error(`⚠ [check] ${from} points at a missing datapack: ${DATAPACK}`);
    if (auto) { console.error(`          falling back to auto-detected: ${auto}`); DATAPACK = auto; DP_SOURCE = 'auto'; }
    else console.error(`          (no datapack auto-detected either; pass --datapack=<path> to be explicit)`);
  } else if (DP_SOURCE === 'config' && cfgPath && DATAPACK && auto && !samePath(auto, DATAPACK)
      && dirname(cfgPath).toLowerCase() === homedir().toLowerCase()) {
    console.error(`⚠ [check] datapack comes from ~/.dpkit.json but auto-detection found a different pack:`);
    console.error(`          checking: ${DATAPACK}`);
    console.error(`          detected: ${auto}`);
    console.error(`          if that's the pack you meant, pass --datapack="${auto}" or remove "datapack" from ~/.dpkit.json`);
  }
}
const ONLY = V.files ?? '';                     // optional data-relative glob filter
const MODE = V.mode ?? 'open';                  // LSP engine only: 'open' | 'analyze'
const ENGINE = V.engine ?? 'inproc';            // in-process by default; 'lsp' keeps the legacy subprocess path
const ENGINE_KIND: api.EngineKind = ENGINE === 'lsp' ? 'lsp' : ENGINE === 'pool' ? 'pool' : 'inproc';
const BASELINE = V.baseline ?? cfg.baselineFile ?? BASELINE_FILE;
const VERBOSE = V.verbose === true;
const JSON_OUT = V.json === true;
const DELTA = V.delta === true;
const USE_IGNORE = V['no-ignore'] !== true;
const HELP = V.help === true;
const NO_GOTCHAS = V['no-gotchas'] === true || cfg.gotchas === false;
const NO_MACRO = V['no-macro'] === true;
const NO_ENTITY_NBT = V['no-entity-nbt'] === true;
const LOGCHECK = V['no-log'] !== true && cfg.logcheck !== false;
const WATCH = V.watch === true;

// ---- "teach AI to write" modes ----
const SYNTAX = V.syntax ?? '';                  // offline: render grammar of a command path
const DUMP = V.dump ?? '';                      // offline: write full command reference to this file
const DUMP_ALL = V['dump-all'] === true;
const COMPLETE = V.complete ?? '';              // live: 'data-relative-path:line:column' completion query at a cursor
const COMPLETE_INLINE = V['complete-inline'];   // live: complete a raw command string (no file)
const COMPLETE_INLINE_GIVEN = V['complete-inline'] !== undefined;
const VERSIONS = V.versions === true;
const CHECK_UPDATES = V['check-updates'] === true; // engine (vendored Spyglass) freshness check
const STRICT = V.strict === true;               // warnings also fail the run (CI-friendly)
const REGISTRY = V.registry ?? '';              // offline: list a registry's values for the version
const SYNTAX_GIVEN = V.syntax !== undefined;
const DUMP_GIVEN = V.dump !== undefined;
const REGISTRY_GIVEN = V.registry !== undefined;
const DEPTH = (() => {
  const v = Number(V.depth ?? '4');
  return Number.isFinite(v) ? Math.max(0, Math.min(8, Math.floor(v))) : 4; // 0=no expansion, capped at 8
})();
const OFFLINE = SYNTAX_GIVEN || DUMP_GIVEN || DUMP_ALL || VERSIONS || REGISTRY_GIVEN;

// ---- ignore extra patterns: config file first, then --ignore=<v> (each comma-separated) ----
// --no-ignore means "show everything raw": it also drops config/--ignore patterns, not just the
// built-in LastHurtMob filter (previously config patterns still applied, which surprised users).
const ignoreExtra = USE_IGNORE
  ? [
      ...(cfg.ignore ?? []),
      ...(V.ignore ?? []),
    ]
  : [];

// Progress/startup lines must not pollute stdout in --json mode (stdout carries pure JSON).
const out = (msg: string): void => { if (JSON_OUT) console.error(msg); else console.log(msg); };

/** Resolve the datapack to actually operate on, or fail with a helpful message. */
function requireDatapack(): string {
  if (!DATAPACK) {
    throw new api.DpkitError(
      '[check] no datapack directory found (auto-detection returned nothing). Specify --datapack=<absolute-path>, set the DPKIT_DATAPACK env var, or set the datapack field in .dpkit.json.',
      api.EXIT_USAGE,
    );
  }
  return DATAPACK;
}

function printHelp(): void {
  console.log(`dpkit — Datapack Kit (Spyglass/DHP engine: check + teach syntax)

Usage:
  node dpkit.mjs [options]

Config: a .dpkit.json in the cwd or home dir sets your defaults (datapack / version /
ignore / minecraftRoot / baselineFile); see .dpkit.example.json. Precedence for every
value: CLI flag > env var (DPKIT_DATAPACK, DPKIT_VERSION, DPKIT_CONFIG) > .dpkit.json
> built-in default.

Options:
  --version=<v>    Game version to check as (default auto: reads the checked datapack's pack.mcmeta)
  --datapack=<p>   Datapack to check (default ${DATAPACK ?? 'auto-detected'})
  --config=<path>  Path to a .dpkit.json config file
  --baseline=<f>   Baseline file for --delta (default ${BASELINE})
  --files=<glob>   Only these files, relative to data/ (e.g. test/function/*.mcfunction)
  --engine=inproc|lsp|pool   Engine to use (default ${ENGINE}; in-process, LSP subprocess, or pooled)
  --mode=open      Open each file (LSP engine only, default)
  --mode=analyze   Use spyglassmc/analyzeProject (LSP engine only)
  --json           Emit a machine-readable JSON report instead of text
  --delta          Only re-report files whose issues changed since the last --delta run
  --no-ignore      Do not filter known false positives (${BUILTIN_IGNORE_DESC})
  --ignore=<p>     Extra ignore pattern: message substring, or /regex/ (repeatable, comma-separated)
  --verbose        Print the server's own log lines
  --no-gotchas     Disable the gotcha linter (heuristic; on by default)
  --no-macro       Disable the \$ macro-line registry-ID check (on by default)
  --no-entity-nbt  Disable the entity-NBT schema check (summon/data field names + registry IDs; on by default)
  --strict         Warnings also make the run fail (exit 1) — for CI
  --no-log         Disable the game-log self-check (reload freshness + pack errors; on by default)
  --watch          Re-check on file changes (incremental: only changed files are re-analyzed; Ctrl-C to stop)

Teach-the-AI modes (ground-truth syntax from the ${GAME_VERSION} command tree):
  --syntax=<path>  Print readable grammar of a command path, e.g. 'execute on'
                   (accepts spaces or dots: 'execute.on'; offline, no datapack needed)
  --registry=<r>   List a registry's values for the version, e.g. --registry=mob_effect
                   (attribute / damage_type / entity_type / …; --registry=? lists all)
  --dump=<file>    Write the whole command reference (all commands) to <file> as Markdown
  --dump-all       Same, to command-reference-<version>.md in the repo root
  --depth=<n>      Expand --syntax/--dump to this many levels (default 4)
  --complete=<rel>:<line>:<col>   Live completion at a cursor in a datapack file
                   e.g. --complete=test/function/x.mcfunction:1:24  (1-based)
  --complete-inline="<text>"      Complete a raw command string (no file needed; still needs a
                   datapack for project context), e.g. --complete-inline="effect give @s knock"
  --versions       List available game versions (server + local cache), show whether a
                   newer release exists and which have data cached
  --check-updates  Check whether Spyglass's GitHub main has moved since the engine was
                   vendored (build it in with: npm run vendor -- --spyglass=<path>)

Exit codes: 0 = no errors, 1 = errors / internal failures (or warnings, with --strict),
2 = environment / network failure, 4 = usage / configuration error.`);
}

/**
 * Warn when --version pins to a string that isn't a known version id. The engine then silently
 * resolves it to the latest snapshot (the report's "server resolved" line shows it), which has
 * surprised users. Uses the cached /mcje/versions list (the same full list --versions prints),
 * so this is offline and instant; when the list isn't cached we stay silent rather than guess.
 * Offline cache commands already fail loudly on a bad version themselves, and --check-updates
 * ignores the version, so only the engine-backed paths (check / complete / watch) warn here.
 */
function warnUnrecognizedVersion(): void {
  if (OFFLINE || CHECK_UPDATES) return;
  // '' = the env var / config slot was empty (unset), not a pin — nothing to warn about.
  if (!GAME_VERSION || ['auto', 'latest release', 'latest snapshot'].includes(GAME_VERSION)) return;
  const cached = loadCachedVersions();
  if (!Array.isArray(cached) || cached.length === 0) return;
  const entries = cached as Array<{ type?: string; id?: string }>;
  const known = new Set(entries.map(e => e.id).filter((x): x is string => typeof x === 'string'));
  if (known.has(GAME_VERSION)) return;
  const fallback = entries.find(e => e.type === 'snapshot')?.id ?? entries[0]?.id ?? 'unknown';
  console.error(`⚠ [check] version '${GAME_VERSION}' not recognized — falling back to latest snapshot (${fallback}); see --versions`);
}

export async function main(): Promise<void> {
  try {
    if (HELP) { printHelp(); return; }
    warnUnrecognizedVersion();
    if (OFFLINE) { await runOffline(); return; }
    if (COMPLETE) { await runComplete(); return; }
    if (COMPLETE_INLINE_GIVEN) { await runCompleteInline(); return; }
    if (CHECK_UPDATES) { await runCheckUpdates(); return; }
    if (WATCH) { await runWatch(); return; }
    await runCheck();
  } catch (err) {
    // Set exitCode and return (rather than process.exit()) so buffered stdout — the normal
    // case for `--json | jq` / `> file` — is fully flushed before the process exits.
    if (err instanceof api.DpkitError) {
      console.error(err.message);
      process.exitCode = err.exitCode;
    } else {
      console.error(`[check] internal failure: ${(err as Error)?.stack ?? err}`);
      process.exitCode = 2;
    }
  }
}

// ---------- offline syntax / dump / versions (no server, no datapack needed) ----------
async function runOffline(): Promise<void> {
  if (SYNTAX_GIVEN && !SYNTAX.trim()) throw new api.DpkitError('[check] --syntax needs a command path, e.g. --syntax="execute on"', api.EXIT_USAGE);
  if (DUMP_GIVEN && !DUMP) throw new api.DpkitError('[check] --dump needs an output file path, e.g. --dump=ref.md', api.EXIT_USAGE);
  if (SYNTAX_GIVEN && (DUMP_GIVEN || DUMP_ALL)) throw new api.DpkitError('[check] --syntax and --dump/--dump-all are mutually exclusive; use them separately', api.EXIT_USAGE);

  if (REGISTRY_GIVEN) {
    if (!REGISTRY.trim()) throw new api.DpkitError('[check] --registry needs a registry name, e.g. --registry=mob_effect (use --registry=? to list all available registries)', api.EXIT_USAGE);
    // '?' is the documented "list every registry" query — a successful answer, not a miss,
    // so it exits 0 (an unknown registry name still exits 1 to stay CI-friendly).
    const isList = REGISTRY === '?';
    const r = api.queryRegistry(REGISTRY, GAME_VERSION);
    if (JSON_OUT) {
      console.log(JSON.stringify(r, null, 2));
      if (!r.found && !(isList && r.cached)) process.exitCode = 1;
      return;
    }
    if (!r.found) {
      const listOk = isList && r.cached;
      if (!listOk) process.exitCode = 1;
      if (!r.cached) {
        out(`registry data for version ${r.version} is not cached yet, so ${isList ? 'no registry index can be listed' : `'${r.name}' cannot be judged`}. Run node dpkit.mjs --version="${r.version}" online once to download it.`);
      } else if (isList) {
        out(`available registries for ${r.version} (${r.index?.length ?? 0}):`);
        for (const x of r.index ?? []) out(`  ${String(x.name).padEnd(40)} ${x.count} entries`);
      } else {
        out(`registry '${r.name}' is not in version ${r.version}'s registry data. Available registries (${r.index?.length ?? 0}):`);
        for (const x of r.index ?? []) out(`  ${String(x.name).padEnd(40)} ${x.count} entries`);
      }
      return;
    }
    out(`registry ${r.name} (${r.version}, ${r.count} entries):`);
    for (const v of r.values ?? []) out(`  ${v}`);
    return;
  }

  if (VERSIONS) { await printVersions(); return; }

  if (DUMP_GIVEN || DUMP_ALL) {
    const refVersion = api.resolveConcreteVersion(GAME_VERSION);
    const target = DUMP || join(ROOT_DIR, `command-reference-${refVersion}.md`);
    const { count, text } = api.dumpSyntax(refVersion, DEPTH);
    writeFileSync(target, `# ${refVersion} command reference (generated offline by dpkit)\n\n> Grammar from Spyglass's cached ${refVersion} command tree (${count} top-level commands).\n> Regenerate: node dpkit.mjs --dump-all [--depth=N] [--version=<v>]\n\n${text}\n`);
    out(`[check] generated a reference for ${count} commands → ${target}`);
    return;
  }

  const result = api.querySyntax(SYNTAX, GAME_VERSION, DEPTH);
  if (JSON_OUT) {
    console.log(JSON.stringify({ syntax: { path: result.path, version: result.version, found: result.found, lines: result.lines } }, null, 2));
  } else {
    out(result.lines.join('\n'));
  }
  if (!result.found) process.exitCode = 1;
}

async function printVersions(): Promise<void> {
  const v = await api.listVersions(GAME_VERSION);
  if (JSON_OUT) {
    console.log(JSON.stringify({
      versions: { source: v.source, count: v.count, configured: v.configured },
      latestRelease: v.latestRelease ? { id: v.latestRelease.id, data_pack_version: v.latestRelease.data_pack_version, hasData: v.latestRelease.hasData } : null,
      latestSnapshot: v.latestSnapshot ? { id: v.latestSnapshot.id, data_pack_version: v.latestSnapshot.data_pack_version } : null,
      newerThanConfigured: v.newerThanConfigured,
      recent: v.recent,
    }, null, 2));
    return;
  }
  out(`Available versions (from ${v.source}, ${v.count} total):`);
  out(`  latest release: ${v.latestRelease?.id}  (data_pack_version ${v.latestRelease?.data_pack_version})${v.latestRelease?.hasData ? '  ✓ data cached' : '  data not cached, first use downloads'}`);
  out(`  latest snapshot: ${v.latestSnapshot?.id}  (data_pack_version ${v.latestSnapshot?.data_pack_version})`);
  if (!v.isPinned) {
    out(`  ⚠ version not pinned (${v.configured}): checks auto-detect each pack's own pack.mcmeta; pin with --version=<concrete-version> or edit the config.`);
  }
  if (v.newerThanConfigured) {
    out(`\n  ⚠ your configured version is ${v.configured}, but the latest release is ${v.newerThanConfigured.id}.`);
    out(`    switch:   node dpkit.mjs --version="${v.newerThanConfigured.id}"`);
    out(`    follow:   node dpkit.mjs --version="latest release"`);
  } else if (v.isPinned) {
    out(`\n  ✓ your configured version ${v.configured} is the latest release.`);
  }
  out(`\n  recent versions (first ${v.recent.length}, ✓ = command data cached):`);
  for (const r of v.recent) out(`    ${String(r.id).padEnd(18)} ${String(r.type).padEnd(8)} dpv ${String(r.dpv).padEnd(4)} ${r.hasData ? '✓' : '—'}`);
  if (v.count > v.recent.length) out(`    …(${v.count} total, showing the latest ${v.recent.length})`);
  out(`\n  tip: new commands/subcommands/registry values/NBT fields are all data-driven; run --version=<new> online once to download them automatically.`);
  out(`       only a brand-new parameter type or a major command-format change requires re-vendoring the engine: npm run vendor -- --spyglass=<updated-checkout>, then npm install.`);
}

/** Engine freshness check: compares the vendored Spyglass build record with GitHub main. */
async function runCheckUpdates(): Promise<void> {
  const info = await api.checkEngineUpdates();
  if (JSON_OUT) {
    console.log(JSON.stringify(info, null, 2));
    return;
  }
  out(`engine update check (vendored Spyglass):`);
  out(``);
  if (info.builtAt) out(`  built at      : ${info.builtAt}`);
  else out(`  built at      : (unknown — vendor/spyglass/BUILD.json missing)`);
  if (info.recorded) out(`  main @ build  : ${info.recorded.sha.slice(0, 12)}  (${info.recorded.date ?? 'date unknown'})${info.sourceMatchesMainHead === false ? '  ⚠ source did not byte-match GitHub main HEAD' : ''}`);
  if (info.latest) {
    out(`  main now      : ${info.latest.sha.slice(0, 12)}  (${info.latest.date ?? 'date unknown'})`);
    if (info.latest.message) out(`                  ${info.latest.message}`);
  }
  out(``);
  if (info.offline || !info.latest) {
    out(`  status        : ? offline — could not reach api.github.com, cannot compare`);
  } else if (info.newer === false) {
    out(`  status        : ✓ up to date — Spyglass main unchanged since vendoring`);
  } else if (info.newer === true) {
    out(`  status        : ⚠ Spyglass main has moved since the engine was vendored.`);
    out(`                  update: pull a fresh checkout, then run  npm run vendor -- --spyglass=<path>`);
  } else {
    out(`  status        : ? no recorded commit to compare against (BUILD.json predates it); consider re-vendoring`);
  }
}

// ---------- check ----------
async function runCheck(): Promise<void> {
  const result = await api.checkDatapack({
    datapack: requireDatapack(),
    version: GAME_VERSION,
    only: ONLY,
    mode: MODE as 'open' | 'analyze',
    engine: ENGINE_KIND,
    ignore: { useIgnore: USE_IGNORE, extra: ignoreExtra },
    delta: DELTA,
    baselineFile: BASELINE,
    noGotchas: NO_GOTCHAS,
    noMacro: NO_MACRO,
    noEntityNbt: NO_ENTITY_NBT,
    noLog: !LOGCHECK,
    verbose: VERBOSE,
    datapackSource: DP_SOURCE,
    minecraftRoot: cfg.minecraftRoot,
    onLog: out,
  });
  const { report } = result;
  versionHint(report.resolvedVersion);

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    renderText(result);
  }
  const failed = report.summary.errors > 0 || report.summary.internalFailures > 0 || (STRICT && report.summary.warnings > 0);
  process.exitCode = failed ? 1 : 0;
}

/** Watch mode: re-check on file changes. Uses a pooled engine so re-checks are fast; plain
 * file edits are incremental (only the changed files are re-parsed/bound/checked in the engine,
 * then the report is re-rendered from the engine's live diagnostics), while file additions /
 * removals / pack.mcmeta changes rebuild the engine and re-analyze the whole pack. */
async function runWatch(): Promise<void> {
  if (JSON_OUT) throw new api.DpkitError('[check] --watch does not support --json (interactive text output only)', api.EXIT_USAGE);
  const datapack = requireDatapack();
  let pooledEngine = api.createInProcEnginePool();
  const MCMETA = join(datapack, 'pack.mcmeta');
  /** The file set + mtimes as of the last check (drives incremental updates). */
  let known = new Map<string, number>();
  let first = true;

  let timer: NodeJS.Timeout | null = null;
  let running = false;
  let pending = false;

  /** Absolute path → mtimeMs for every checkable file + pack.mcmeta. */
  const snapshotFiles = (): Map<string, number> => {
    const m = new Map<string, number>();
    for (const f of api.collectFiles(datapack, ONLY).files) {
      try { m.set(f, statSync(f).mtimeMs); } catch { m.set(f, -1); }
    }
    try { m.set(MCMETA, statSync(MCMETA).mtimeMs); } catch { /* no pack.mcmeta */ }
    return m;
  };

  const checkOptions = (extra: Partial<Parameters<typeof api.checkDatapack>[0]>): Parameters<typeof api.checkDatapack>[0] => ({
    datapack,
    version: GAME_VERSION,
    only: ONLY,
    mode: MODE as 'open' | 'analyze',
    engine: pooledEngine,
    ignore: { useIgnore: USE_IGNORE, extra: ignoreExtra },
    delta: DELTA,
    baselineFile: BASELINE,
    noGotchas: NO_GOTCHAS,
    noMacro: NO_MACRO,
    noLog: !LOGCHECK,
    verbose: VERBOSE,
    datapackSource: DP_SOURCE,
    minecraftRoot: cfg.minecraftRoot,
    onLog: out,
    ...extra,
  });

  const render = (result: api.CheckResult): void => {
    const { report } = result;
    versionHint(report.resolvedVersion);
    console.clear();
    renderText(result);
    const failed = report.summary.errors > 0 || report.summary.internalFailures > 0 || (STRICT && report.summary.warnings > 0);
    console.log(`\n${failed ? '✗' : '✓'} watching ${datapack} for changes… (Ctrl-C to stop)`);
  };

  const check = async (): Promise<void> => {
    if (running) { pending = true; return; }
    running = true;
    try {
      if (first) {
        first = false;
        const result = await api.checkDatapack(checkOptions({}));
        known = snapshotFiles();
        render(result);
      } else {
        const now = snapshotFiles();
        const sameSet = now.size === known.size && [...now.keys()].every(k => known.has(k));
        const mcmetaChanged = (now.get(MCMETA) ?? 0) !== (known.get(MCMETA) ?? 0);
        if (!sameSet || mcmetaChanged) {
          // File added/removed or pack.mcmeta changed → the engine must re-enumerate the world.
          await pooledEngine.close();
          pooledEngine = api.createInProcEnginePool();
          const result = await api.checkDatapack(checkOptions({}));
          known = now;
          render(result);
        } else {
          // Incremental: refresh only the files whose mtime moved.
          const changed: string[] = [];
          for (const [f, mtime] of now) {
            if (f === MCMETA) continue;
            const prev = known.get(f);
            if (prev !== undefined && prev !== mtime) changed.push(f);
          }
          if (changed.length && pooledEngine.updateFile) {
            const { files, rels } = api.collectFiles(datapack, ONLY);
            const relOf = new Map<string, string>(files.map((f, i) => [f, rels[i]]));
            for (const f of changed) {
              const rel = relOf.get(f);
              if (!rel) continue;
              let text = '';
              try { text = readFileSync(f, 'utf8'); } catch { continue; }
              await pooledEngine.updateFile({ rel, file: f, text });
            }
          }
          known = now;
          const snap = pooledEngine.snapshot?.();
          const result = await api.checkDatapack(checkOptions({ engineSnapshot: snap }));
          render(result);
        }
      }
    } catch (err) {
      console.error(err instanceof api.DpkitError ? err.message : `[check] ${(err as Error)?.stack ?? err}`);
    } finally {
      running = false;
      if (pending) { pending = false; void check(); }
    }
  };

  await check();

  const watcher = watch(datapack, { recursive: true }, () => {
    // debounce: coalesce rapid bursts of fs events into one re-check (mtime diffing above
    // decides between an incremental refresh and a full rebuild, so event types don't matter)
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => { timer = null; void check(); }, 150);
  });

  const shutdown = async (): Promise<void> => {
    watcher.close();
    await pooledEngine.close();
    process.exit(0);
  };
  process.on('SIGINT', () => { void shutdown(); });
  process.on('SIGTERM', () => { void shutdown(); });
}

/** Version freshness hint (cache was refreshed this run by the engine's own fetch). */
function versionHint(resolvedVersion: string | null): void {
  try {
    const vl = loadCachedVersions();
    if (vl?.length) {
      const versions = vl as { type?: string; id: string; data_pack_version: number }[];
      const latest = versions.filter(v => v.type === 'release')[0];
      const effective = resolvedVersion ?? GAME_VERSION;
      const eff = versions.find(v => v.id === effective);
      const pinned = !['auto', 'latest release', 'latest snapshot'].includes(GAME_VERSION);
      if (latest && eff && pinned && eff.data_pack_version < latest.data_pack_version) {
        out(`\n[check] tip: the latest release is ${latest.id} (data_pack_version ${latest.data_pack_version}), you're checking as ${effective} (dpv ${eff.data_pack_version}).`);
        out(`       switch: node dpkit.mjs --version="${latest.id}"  ·  follow: --version="latest release"  ·  list: --versions`);
      }
    }
  } catch { /* hint is best-effort */ }
}

function renderText(result: api.CheckResult): void {
  const { report, lines, agg, ignoredAgg } = result;
  const verLabel = report.resolvedVersion ?? report.version;
  const sourceLabel = report.datapackSource
    ? report.datapackSource === 'cli' ? 'from --datapack'
    : report.datapackSource === 'env' ? 'from DPKIT_DATAPACK'
    : report.datapackSource === 'config' ? 'from .dpkit.json'
    : 'from auto-detected'
    : null;
  console.log(`\n———— CHECK REPORT ————`);
  console.log(`datapack : ${report.datapack}${sourceLabel ? `   (${sourceLabel})` : ''}`);
  console.log(`version  : ${report.version}  (server resolved: ${report.resolvedVersion ?? 'unknown'})`);
  console.log(`files    : ${report.files.checked} checked, ${report.files.clean} clean${report.delta ? ` · delta: ${report.delta.changedFiles} changed, ${report.delta.resolvedFiles} resolved` : ''}`);
  console.log(`summary  : ${report.summary.errors} error(s) · ${report.summary.warnings} warning(s) · ${report.summary.ignored} ignored · ${report.summary.internalFailures} internal-failure · gotchas ${report.summary.gotchas}`);
  const cov = report.coverage;
  const covParts: string[] = [];
  if (cov.filesSkipped > 0) covParts.push(`skipped (engine failure) ${cov.filesSkipped}`);
  if (cov.macroLines > 0) covParts.push(`macro lines ${cov.macroLines} · registry-ID checked ${cov.macroChecked} · unchecked ${cov.macroUnchecked}`);
  if (cov.nbtLines > 0) covParts.push(`entity-NBT ${cov.nbtLines} lines · field positions checked ${cov.nbtChecked} · unchecked ${cov.nbtUnchecked}`);
  if (cov.autoFiltered > 0) covParts.push(`auto-filtered ${cov.autoFiltered}`);
  if (covParts.length) console.log(`coverage : ${covParts.join(' · ')}`);
  // #3: make "0 warnings" honest — surface how much was NOT validated.
  const uncheckedTotal = cov.macroUnchecked + cov.nbtUnchecked;
  if (uncheckedTotal > 0) {
    console.log(`  ⚠ coverage gap: ${uncheckedTotal} position(s) not validated (macro ${cov.macroUnchecked} · entity-NBT ${cov.nbtUnchecked}) — “0 warnings” does not mean every position was checked`);
  }
  if (lines.length) console.log(lines.join('\n'));
  if (agg.length) {
    console.log(`\n== aggregated by message (top ${agg.length}) ==`);
    for (const [m, c] of agg) console.log(`  ${c}× ${m}`);
  }
  if (ignoredAgg.length) {
    console.log(`\n== ignored (known false positives, not counted) ==`);
    for (const [m, c] of ignoredAgg) console.log(`  ${c}× ${m}`);
  }
  if (report.gotchas.length) {
    console.log(`\n== ${verLabel} known-gotcha scan (heuristic, not counted as errors; --no-gotchas to disable) ==`);
    for (const { file, items } of report.gotchas) {
      console.log(`\n  ${file} (${items.length})`);
      for (const g of items) console.log(`  [gotcha:${g.line}] (${g.key}) ${g.msg}`);
    }
  }
  if (report.log.found) {
    const glog = report.log;
    console.log(`\n== game log (self-check) ==`);
    console.log(`  log   : ${glog.path}`);
    if (glog.stale) console.log(`  ⚠ datapack files are newer than the log — you may not have /reload'ed; errors/advancement counts are stale`);
    else console.log(`  ✓ log is in sync with the datapack (no changes since the last /reload)`);
    console.log(`  adv   : ${glog.lastLoaded ? `last Loaded ${glog.lastLoaded} advancements` : '(no advancement-count line in the log)'}`);
    if (glog.errors.length) {
      console.log(`  errors: ${glog.errors.length} suspected datapack load error(s):`);
      for (const h of glog.errors) console.log(`    ✗ ${h}`);
    } else {
      console.log(`  errors: no suspected datapack load errors`);
    }
  } else if (LOGCHECK) {
    console.log(`\n== game log (self-check) ==`);
    console.log(`  latest.log not found, skipped (--no-log to disable)`);
  }
}

// ---------- complete ----------
async function runComplete(): Promise<void> {
  const m = COMPLETE.match(/^(.*):(\d+):(\d+)$/);
  if (!m) throw new api.DpkitError('[check] --complete must be <data-relative-path>:<line>:<column> (1-based), e.g. test/function/x.mcfunction:1:24', api.EXIT_USAGE);
  const rel = m[1], ln = +m[2], col = +m[3];
  const items = await api.completeAt({
    datapack: requireDatapack(),
    version: GAME_VERSION,
    rel,
    line: ln,
    column: col,
    engine: ENGINE_KIND,
    verbose: VERBOSE,
    onLog: out,
  });
  if (JSON_OUT) {
    console.log(JSON.stringify({
      complete: { file: rel, line: ln, column: col, version: GAME_VERSION },
      count: items.length,
      items: items.slice(0, 200),
      truncated: items.length > 200,
    }, null, 2));
    return;
  }
  if (!items.length) { out(`[complete] ${rel}:${ln}:${col} — no completions (this spot may not be a completable position)`); return; }
  out(`[complete] ${rel}:${ln}:${col} — ${items.length} completion(s) (version ${GAME_VERSION}):`);
  for (const it of items.slice(0, 60)) {
    const detail = it.detail ? ` — ${it.detail}` : '';
    const d = it.documentation ? `  |  ${it.documentation.replace(/\s*\n\s*/g, ' ').slice(0, 140)}` : '';
    out(`  ${it.label}  [${it.kind}]${detail}${d}`);
  }
  if (items.length > 60) out(`  …(${items.length - 60} more, truncated)`);
}

// ---------- complete-inline ----------
async function runCompleteInline(): Promise<void> {
  const text = COMPLETE_INLINE ?? '';
  const ln = text.split('\n').length;
  const col = (text.split('\n').pop() ?? '').length + 1;
  const label = `inline:${ln}:${col}`;
  const items = await api.completeAt({
    datapack: requireDatapack(),
    version: GAME_VERSION,
    rel: '__inline__.mcfunction',
    line: ln,
    column: col,
    text,
    engine: ENGINE_KIND,
    verbose: VERBOSE,
    onLog: out,
  });
  if (JSON_OUT) {
    console.log(JSON.stringify({
      complete: { file: label, line: ln, column: col, version: GAME_VERSION, inline: text },
      count: items.length,
      items: items.slice(0, 200),
      truncated: items.length > 200,
    }, null, 2));
    return;
  }
  if (!items.length) { out(`[complete] ${label} — no completions (text: "${text}")`); return; }
  out(`[complete] ${label} — ${items.length} completion(s) (version ${GAME_VERSION}) — text: "${text}"`);
  for (const it of items.slice(0, 60)) {
    const detail = it.detail ? ` — ${it.detail}` : '';
    const d = it.documentation ? `  |  ${it.documentation.replace(/\s*\n\s*/g, ' ').slice(0, 140)}` : '';
    out(`  ${it.label}  [${it.kind}]${detail}${d}`);
  }
  if (items.length > 60) out(`  …(${items.length - 60} more, truncated)`);
}
