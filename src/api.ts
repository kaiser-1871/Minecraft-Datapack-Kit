// api.ts — the typed public API for dpkit. Both the CLI and the MCP server call these
// functions; nothing here talks to the terminal or a process — that's the caller's job.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINE_FILE } from './paths.js';
import { DEFAULT_VERSION } from './config.js';
import { collectFiles, FILES_EMPTY_HINT, toRel } from './collect.js';
import { createIgnoreFilter, isVanillaRegistryMiss } from './ignore.js';
import { loadRegistries, normalizeRegistryName, registryIndex } from './registry.js';
import { loadVanillaTags } from './vanilla-tags.js';
import { buildDeclaredRegistryIds, scanMacroRegistry } from './macrocheck.js';
import type { MacroIssue, MacroStats } from './macrocheck.js';
import { loadEntitySchemas, scanEntityNbt } from './entity-nbt.js';
import type { NbtIssue, NbtScanStats } from './entity-nbt.js';
import type { CommandTree } from './syntax.js';
import { issueSig, loadBaseline, saveBaseline } from './delta.js';
import { scanGotchas } from './gotchas.js';
import { gameLogReport } from './logcheck.js';
import { createLspEngine } from './lsp-legacy.js';
import { createInProcEngine, createInProcEnginePool } from './engine/inproc.js';
import { loadCommandTree, loadCachedVersions, cachedCommandVersions, renderPath, renderAll, resolveConcreteVersion } from './syntax.js';
import type { BaselineEntry, CheckLog, CompletionItemDTO, GameLogReport, GotchaIssue, RawDiagnostic, ReportIssue, SyntaxResult } from './types.js';
import type { CheckEngine, EngineCheckResult, EngineSnapshot } from './engine/types.js';

export type { CheckEngine } from './engine/types.js';

export type EngineKind = 'inproc' | 'lsp' | 'pool';

/** Exit code for usage/config errors (bad flags, missing/malformed config, bad args). */
export const EXIT_USAGE = 4;

/** A user-facing error with a specific exit code (default 2 = environment/network/internal). */
export class DpkitError extends Error {
  constructor(message: string, readonly exitCode = 2) {
    super(message);
    this.name = 'DpkitError';
  }
}

// ---- options & results --------------------------------------------------------

export interface CheckOptions {
  datapack: string;
  version: string;
  only?: string;
  mode?: 'open' | 'analyze';
  /** Engine to use. Default 'inproc'; 'lsp' is the legacy subprocess path (parity reference).
   * A CheckEngine instance may be passed to reuse a pooled engine across calls (caller owns its lifecycle). */
  engine?: EngineKind | CheckEngine;
  /** Reuse the engine's live diagnostics instead of running a check (watch-mode incremental
   * re-render: the caller has already refreshed changed files via engine.updateFile()). */
  engineSnapshot?: EngineSnapshot;
  ignore?: { useIgnore: boolean; extra: string[] };
  delta?: boolean;
  baselineFile?: string;
  noGotchas?: boolean;
  /** Disable the $ macro-line registry-ID validation (on by default). */
  noMacro?: boolean;
  /** Disable the entity-NBT schema validation (on by default). */
  noEntityNbt?: boolean;
  noLog?: boolean;
  verbose?: boolean;
  /** Where the datapack path came from ('cli' | 'env' | 'config' | 'auto'), for the report. */
  datapackSource?: 'cli' | 'env' | 'config' | 'auto';
  /** Minecraft install root, for the game-log self-check. */
  minecraftRoot?: string;
  onLog?: (msg: string) => void;
}

/** The JSON-serialized report (matches the legacy --json shape + engine + schemaVersion). */
export interface CheckReport {
  datapack: string;
  /** Where the datapack path came from ('cli' | 'env' | 'config' | 'auto'), when known. */
  datapackSource?: 'cli' | 'env' | 'config' | 'auto';
  version: string;
  resolvedVersion: string | null;
  files: { checked: number; clean: number };
  summary: { errors: number; warnings: number; ignored: number; internalFailures: number; gotchas: number };
  issues: ReportIssue[];
  ignored: ReportIssue[];
  gotchas: { file: string; items: GotchaIssue[] }[];
  log: CheckLog;
  byMessage: { message: string; count: number }[];
  /** What was actually covered vs skipped (macro lines, engine-failed files, auto-filtered). */
  coverage: {
    filesChecked: number;
    filesSkipped: number;
    macroLines: number;
    macroChecked: number;
    macroUnchecked: number;
    /** entity-NBT (summon/data) lines + field positions validated/skipped. */
    nbtLines: number;
    nbtChecked: number;
    nbtUnchecked: number;
    autoFiltered: number;
  };
  delta?: { changedFiles: number; resolvedFiles: number };
  engine: EngineKind;
  schemaVersion: 1;
}

/** Full check result: the serializable report plus text-mode rendering data. */
export interface CheckResult {
  report: CheckReport;
  /** Text-mode per-file/aggregate lines (rendered below the summary line). */
  lines: string[];
  agg: [string, number][];
  ignoredAgg: [string, number][];
  newBaseline: { datapack: string; version: string; files: Record<string, BaselineEntry> };
}

export interface VersionListResult {
  source: string;
  count: number;
  configured: string;
  latestRelease: { id: string; data_pack_version?: number; hasData: boolean } | null;
  latestSnapshot: { id: string; data_pack_version?: number } | null;
  newerThanConfigured: { id: string; data_pack_version?: number } | null;
  isPinned: boolean;
  recent: { id: string; type: string; dpv: number | undefined; hasData: boolean }[];
}

interface McmetaVersion { id: string; name?: string; type?: string; data_pack_version?: number; resource_pack_version?: number }

// ---- engine selection ---------------------------------------------------------
/** True when the engine option is a pre-built engine instance rather than a kind string. */
function isEngineInstance(e: EngineKind | CheckEngine | undefined): e is CheckEngine {
  return typeof e === 'object' && e !== null;
}

/** The report label for an engine option (kind string, instance → 'pool', absent → 'inproc'). */
function engineLabel(e: EngineKind | CheckEngine | undefined): EngineKind {
  if (typeof e === 'string') return e;
  return e ? 'pool' : 'inproc';
}

function makeEngine(kind?: EngineKind): CheckEngine {
  if (kind === 'lsp') return createLspEngine();
  if (kind === 'pool') return createInProcEnginePool();
  return createInProcEngine();
}

// ---- check --------------------------------------------------------------------
export async function checkDatapack(opts: CheckOptions): Promise<CheckResult> {
  // Existence first — collectFiles() swallows a missing data/ dir and returns empty, which
  // would otherwise surface the misleading "No files matched (--files hint)" instead of this.
  if (!existsSync(opts.datapack)) {
    throw new DpkitError(
      `[check] datapack directory not found: ${opts.datapack}\n[check] specify --datapack=<absolute-path>, set the DPKIT_DATAPACK env var, or set the datapack field in .dpkit.json.`,
      EXIT_USAGE,
    );
  }
  const { files, rels } = collectFiles(opts.datapack, opts.only ?? '');
  if (rels.length === 0) {
    throw new DpkitError(
      `[check] No files matched (datapack=${opts.datapack}, filter=${opts.only || '(all)'})\n${FILES_EMPTY_HINT}`,
      EXIT_USAGE,
    );
  }
  // Include pack.mcmeta so a broken one surfaces — today it silently skews version auto-detect
  // and produces 0 diagnostics ("this wasn't checked"). Checked DPKIT-side (not via the engine):
  // the LSP path never publishes diagnostics for root-level files and would hang its settle wait.
  const mcmetaPath = join(opts.datapack, 'pack.mcmeta');
  const mcmetaRel = existsSync(mcmetaPath) && !rels.includes('pack.mcmeta') ? 'pack.mcmeta' : null;
  if (mcmetaRel) { files.push(mcmetaPath); rels.push(mcmetaRel); }
  opts.onLog?.(`[check] datapack=${opts.datapack}${opts.datapackSource ? `  (from ${opts.datapackSource})` : ''}  version=${opts.version}  files=${files.length}`);

  let engine: CheckEngine;
  let externalEngine = false;
  if (isEngineInstance(opts.engine)) {
    engine = opts.engine;
    externalEngine = true;
  } else {
    engine = makeEngine(opts.engine);
  }
  try {
    // pack.mcmeta is reported dpkit-side (see scanPackMcmeta) — don't hand it to the engine.
    const engineFiles = mcmetaRel ? files.slice(0, -1) : files;
    const engineRels = mcmetaRel ? rels.slice(0, -1) : rels;
    // Post-scans (macro / entity-NBT) can start before the engine check when the version does
    // not depend on the engine's pack.mcmeta auto-detection: resolve it from the cache first
    // ('latest release' / pinned ids). 'auto' must wait for the engine's resolution.
    let preVersion: string | null = null;
    if (opts.version !== 'auto') {
      try { preVersion = resolveConcreteVersion(opts.version); } catch { preVersion = null; }
    }
    const texts = preVersion ? readFileTexts(engineFiles, engineRels) : null;
    let res: EngineCheckResult;
    let post: PostScans;
    if (opts.engineSnapshot) {
      // Watch-mode incremental re-render: the engine's diagnostics map is already up to date
      // (changed files refreshed via engine.updateFile()) — skip the full analysis entirely.
      res = {
        resolvedVersion: opts.engineSnapshot.resolvedVersion,
        diagnosticsByRel: opts.engineSnapshot.diagnosticsByRel,
        failedRels: new Set(),
      };
      post = runPostScans(opts, engineFiles, engineRels, res.resolvedVersion ?? preVersion ?? opts.version, texts ?? readFileTexts(engineFiles, engineRels));
    } else {
      const prescan = preVersion && texts
        ? Promise.resolve().then(() => runPostScans(opts, engineFiles, engineRels, preVersion!, texts))
        : null;
      res = await engine.check({
        datapack: opts.datapack,
        version: opts.version,
        files: engineFiles,
        rels: engineRels,
        mode: opts.mode ?? 'open',
        noGotchas: opts.noGotchas,
        verbose: opts.verbose,
        onLog: opts.onLog,
      });
      // Use the pre-computed scans when they ran with the engine's own effective version;
      // otherwise (engine resolved differently, or version was 'auto') run them now — still
      // sharing one file read across macro / entity-NBT / gotchas.
      const pre = await (prescan ?? Promise.resolve(null));
      const scanVersion = res.resolvedVersion ?? preVersion ?? opts.version;
      post = pre && (!res.resolvedVersion || res.resolvedVersion === preVersion)
        ? pre
        : runPostScans(opts, engineFiles, engineRels, scanVersion, texts ?? readFileTexts(engineFiles, engineRels));
    }
    const macro = post.macro;
    const nbt = post.nbt;
    const diagnosticsByRel = new Map(res.diagnosticsByRel);
    if (macro) {
      for (const [rel, issues] of macro.issuesByRel) {
        const existing = diagnosticsByRel.get(rel) ?? [];
        diagnosticsByRel.set(rel, [...existing, ...issues.map(iss => ({
          severity: 2,
          message: iss.msg,
          range: { start: { line: iss.line - 1, character: 0 }, end: { line: iss.line - 1, character: 1 } },
        }))]);
      }
    }
    if (nbt) {
      for (const [rel, issues] of nbt.issuesByRel) {
        const existing = diagnosticsByRel.get(rel) ?? [];
        diagnosticsByRel.set(rel, [...existing, ...issues.map(iss => ({
          severity: 2,
          message: iss.msg,
          range: { start: { line: iss.line - 1, character: 0 }, end: { line: iss.line - 1, character: 1 } },
        }))]);
      }
    }
    // pack.mcmeta: give it a clean/err entry so it's counted, not treated as an engine failure.
    if (mcmetaRel) {
      const d = scanPackMcmeta(mcmetaPath);
      diagnosticsByRel.set(mcmetaRel, d ? [d] : []);
    }
    return assembleReport(opts, files, rels, diagnosticsByRel, res.failedRels, res.resolvedVersion, macro, nbt, texts);
  } finally {
    if (!externalEngine) await engine.close();
  }
}

/**
 * Dpkit-side pack.mcmeta check. The engine's version auto-detect reads this file; a broken one
 * silently skews the version and previously produced 0 diagnostics. Returns a severity-1
 * (error) diagnostic when the file is unreadable / not valid JSON / missing the "pack" key.
 */
function scanPackMcmeta(mcmetaPath: string): RawDiagnostic | null {
  let text: string;
  try { text = readFileSync(mcmetaPath, 'utf8'); }
  catch (e) { return mcmetaErr(`pack.mcmeta could not be read: ${(e as Error).message}`); }
  try {
    const obj = JSON.parse(text) as unknown;
    if (!obj || typeof obj !== 'object' || !('pack' in obj)) {
      return mcmetaErr('pack.mcmeta is missing the "pack" key (format: {"pack": {"pack_format": N, "description": "…"}})');
    }
    return null;
  } catch (e) {
    return mcmetaErr(`pack.mcmeta is not valid JSON: ${(e as Error).message}`);
  }
}

function mcmetaErr(message: string): RawDiagnostic {
  return { severity: 1, message, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } };
}

/** Read every engine file once; the macro / entity-NBT / gotcha post-scans share these texts. */
function readFileTexts(files: string[], rels: string[]): Map<string, string> {
  const texts = new Map<string, string>();
  for (let i = 0; i < files.length; i++) {
    try { texts.set(rels[i], readFileSync(files[i], 'utf8')); } catch { /* unreadable — scans skip it */ }
  }
  return texts;
}

interface PostScans {
  macro: { issuesByRel: Map<string, MacroIssue[]>; stats: MacroStats; perFileUnchecked: Map<string, number> } | null;
  nbt: { issuesByRel: Map<string, NbtIssue[]>; stats: NbtScanStats; perFileUnchecked: Map<string, number> } | null;
}

/** Run both content post-scans (macro registry IDs + entity NBT) with one shared file read. */
function runPostScans(
  opts: CheckOptions,
  files: string[],
  rels: string[],
  versionLabel: string | null,
  texts: Map<string, string>,
): PostScans {
  return {
    macro: runMacroScan(opts, files, rels, versionLabel, texts),
    nbt: runEntityNbtScan(opts, files, rels, versionLabel, texts),
  };
}

/**
 * Scan .mcfunction files for registry IDs inside $ macro lines. Returns null when disabled or
 * nothing to scan (no file contains "$("), so a pack without macros pays nothing.
 */
function runMacroScan(
  opts: CheckOptions,
  files: string[],
  rels: string[],
  resolvedVersion: string | null,
  texts?: Map<string, string>,
): { issuesByRel: Map<string, MacroIssue[]>; stats: MacroStats; perFileUnchecked: Map<string, number> } | null {
  if (opts.noMacro === true) return null;
  const versionLabel = resolvedVersion ?? opts.version;
  let tree: CommandTree | undefined;
  let regs: Record<string, string[]> = {};
  let declared: Set<string> | undefined;
  const issuesByRel = new Map<string, MacroIssue[]>();
  const perFileUnchecked = new Map<string, number>();
  const stats: MacroStats = { lines: 0, checked: 0, unchecked: 0 };

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f.endsWith('.mcfunction')) continue;
    let text = texts?.get(rels[i]);
    if (text === undefined) {
      try { text = readFileSync(f, 'utf8'); } catch { continue; }
    }
    if (!text.includes('$(')) continue;
    // lazy-load the command tree + registries only once a macro line is actually present
    if (!tree) {
      try { tree = loadCommandTree(versionLabel); } catch { return null; } // no cached tree → skip
      regs = loadRegistries(versionLabel);
    }
    if (!declared) declared = buildDeclaredRegistryIds(opts.datapack);
    const r = scanMacroRegistry(f, tree, regs, declared, text);
    if (r.issues.length) issuesByRel.set(rels[i], r.issues);
    if (r.unchecked > 0) perFileUnchecked.set(rels[i], r.unchecked);
    stats.lines += r.lines;
    stats.checked += r.checked;
    stats.unchecked += r.unchecked;
  }
  if (stats.lines === 0) return null;
  return { issuesByRel, stats, perFileUnchecked };
}

/**
 * Scan .mcfunction files for entity NBT (summon / `data merge entity`) and validate field names +
 * nested registry IDs against the cached mcdoc schema. Returns null when disabled, when the mcdoc
 * tarball isn't cached yet, or when nothing to scan — so a pack without entity NBT pays nothing.
 * Mirrors runMacroScan's lazy loading.
 */
function runEntityNbtScan(
  opts: CheckOptions,
  files: string[],
  rels: string[],
  resolvedVersion: string | null,
  texts?: Map<string, string>,
): { issuesByRel: Map<string, NbtIssue[]>; stats: NbtScanStats; perFileUnchecked: Map<string, number> } | null {
  if (opts.noEntityNbt === true) return null;
  const versionLabel = resolvedVersion ?? opts.version;
  let concrete: string;
  try { concrete = resolveConcreteVersion(versionLabel); } catch { return null; }
  const schema = loadEntitySchemas(concrete);
  if (!schema) return null; // mcdoc tarball not cached yet → degrade to no-op
  const regs = loadRegistries(concrete);
  const declared = buildDeclaredRegistryIds(opts.datapack);
  const issuesByRel = new Map<string, NbtIssue[]>();
  const perFileUnchecked = new Map<string, number>();
  const stats: NbtScanStats = { lines: 0, checked: 0, unchecked: 0 };

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f.endsWith('.mcfunction')) continue;
    let text = texts?.get(rels[i]);
    if (text === undefined) {
      try { text = readFileSync(f, 'utf8'); } catch { continue; }
    }
    if (!/\bsummon\b/.test(text) && !/\bdata\b/.test(text)) continue;
    const r = scanEntityNbt(f, schema, regs, declared, concrete, text);
    if (r.issues.length) issuesByRel.set(rels[i], r.issues);
    if (r.unchecked > 0) perFileUnchecked.set(rels[i], r.unchecked);
    stats.lines += r.lines;
    stats.checked += r.checked;
    stats.unchecked += r.unchecked;
  }
  if (stats.lines === 0) return null;
  return { issuesByRel, stats, perFileUnchecked };
}


function assembleReport(
  opts: CheckOptions,
  files: string[],
  rels: string[],
  diagnosticsByRel: Map<string, RawDiagnostic[]>,
  failedRels: Set<string>,
  resolvedVersion: string | null,
  macro?: { stats: MacroStats; perFileUnchecked: Map<string, number> } | null,
  nbt?: { stats: NbtScanStats; perFileUnchecked: Map<string, number> } | null,
  texts?: Map<string, string> | null,
): CheckResult {
  const useIgnore = opts.ignore?.useIgnore ?? true;
  const ignoreFilter = createIgnoreFilter(opts.ignore ?? { useIgnore: true, extra: [] });
  const noGotchas = opts.noGotchas === true;
  const logCheck = opts.noLog !== true;
  const delta = opts.delta ?? false;
  const baselineFile = opts.baselineFile ?? BASELINE_FILE;
  const engineKind: EngineKind = engineLabel(opts.engine);

  let errorCount = 0, warnCount = 0, ignoredCount = 0, internalErr = 0, issueFiles = 0;
  let deltaChangedFiles = 0, deltaResolvedFiles = 0;
  const lines: string[] = [];
  const byMessage = new Map<string, number>(); // message -> count (non-ignored only)
  const ignoredByMessage = new Map<string, number>(); // message -> count
  const issues: ReportIssue[] = []; // for --json
  const ignoredList: ReportIssue[] = []; // for --json
  // Baseline key uses the RESOLVED version (not the raw specifier like 'auto'), so --delta
  // doesn't compare issues computed against two different effective versions under one key.
  const baseVersion = resolvedVersion ?? opts.version;
  const newBaseline: { datapack: string; version: string; files: Record<string, BaselineEntry> } = { datapack: opts.datapack, version: baseVersion, files: {} };

  // Known-gotcha scan (heuristic): patterns the engine's loose schema misses but silently
  // fail in-game; messages carry the actually-effective version.
  let versionLabel = resolvedVersion ?? opts.version;
  if (versionLabel === 'auto' || versionLabel === 'latest release' || versionLabel === 'latest snapshot') {
    try { versionLabel = resolveConcreteVersion(versionLabel); } catch { /* keep the raw label */ }
  }
  // Coverage: files the engine failed to check, macro-line validation stats, auto-filter count.
  const coverage: CheckReport['coverage'] = {
    filesChecked: files.length,
    filesSkipped: failedRels.size,
    macroLines: macro?.stats.lines ?? 0,
    macroChecked: macro?.stats.checked ?? 0,
    macroUnchecked: macro?.stats.unchecked ?? 0,
    nbtLines: nbt?.stats.lines ?? 0,
    nbtChecked: nbt?.stats.checked ?? 0,
    nbtUnchecked: nbt?.stats.unchecked ?? 0,
    autoFiltered: 0,
  };
  // Data-driven vanilla registry/tag false-positive filtering: "Cannot find attribute
  // “minecraft:<valid-id>”" and "Cannot find tag/damage_type “minecraft:is_projectile”" are
  // auto-filtered. Registry values are read from the cache for the effective version; the tag
  // set comes from the vanilla-data tarball (tag filtering is off when it isn't cached).
  // regs + vanilla tags only feed the ignore filter: skip the registry load under --no-ignore,
  // and defer the (expensive) vanilla-data tarball decompression until a tag-miss diagnostic
  // actually appears (isVanillaRegistryMiss resolves the getter lazily).
  const regs: Record<string, string[]> = useIgnore ? loadRegistries(versionLabel) : {};
  let vanillaTagsMemo: Set<string> | null | undefined;
  const getVanillaTags = (): Set<string> | null => {
    if (vanillaTagsMemo === undefined) vanillaTagsMemo = loadVanillaTags(versionLabel);
    return vanillaTagsMemo;
  };
  const gotchaByFile = new Map<string, GotchaIssue[]>(); // rel -> [{line,key,msg}]
  let gotchaCount = 0;
  if (!noGotchas) {
    for (let i = 0; i < files.length; i++) {
      // mcfunction=false: the engine's gotcha linters (java-edition) cover mcfunction lines;
      // the post-scan keeps only the JSON gotchas (advancement structure).
      const g = scanGotchas(files[i], rels[i], versionLabel, texts?.get(rels[i]), false);
      if (g.length) { gotchaByFile.set(rels[i], g); gotchaCount += g.length; }
    }
  }
  const glog: GameLogReport = logCheck ? gameLogReport(opts.datapack, files, opts.minecraftRoot) : { found: false };

  const baseline = delta ? loadBaseline(baselineFile, opts.datapack, baseVersion, opts.version) : {};

  for (let i = 0; i < files.length; i++) {
    const f = files[i], rel = rels[i];
    const ds = diagnosticsByRel.get(rel);
    const prev = baseline[rel];

    if (!ds) {
      // No diagnostics at all: either the server threw (logged) or it silently blocked.
      internalErr++; issueFiles++;
      if (failedRels.has(rel)) {
        lines.push(`\n== ${rel} ==  ⚠ server threw during check — no diagnostics (see server log)`);
      } else {
        lines.push(`\n== ${rel} ==  ⚠ no diagnostics received — check blocked or server error`);
      }
      if (delta) deltaChangedFiles++; // surface blocked files so they aren't silently hidden
      continue;
    }
    const nonIgnored: RawDiagnostic[] = [];
    for (const d of ds) {
      const sev = d.severity === 1 ? 'E' : d.severity === 2 ? 'W' : '·';
      // Engine gotcha linters (java-edition) emit "[gotcha] (<key>) <msg>" — partition them
      // into the separate gotchas section (never counted as errors/warnings/ignored).
      const gm = /^\[gotcha\] \((\S+?)\) (.*)$/.exec(d.message);
      if (gm) {
        if (noGotchas) continue; // disabled → drop
        const list = gotchaByFile.get(rel) ?? [];
        // The engine appends " (rule: <name>)" to linter messages — strip it.
        list.push({ line: d.range.start.line + 1, key: gm[1], msg: gm[2].replace(/\s+\(rule: \S+\)$/, '') });
        gotchaByFile.set(rel, list);
        gotchaCount++;
        continue;
      }
      const autoFiltered = useIgnore && isVanillaRegistryMiss(d.message, regs, getVanillaTags);
      if (ignoreFilter(d.message) || autoFiltered) {
        ignoredCount++;
        if (autoFiltered) coverage.autoFiltered++;
        ignoredByMessage.set(d.message, (ignoredByMessage.get(d.message) ?? 0) + 1);
        ignoredList.push({ file: rel, line: d.range.start.line + 1, char: d.range.start.character, severity: sev, message: d.message });
        continue;
      }
      nonIgnored.push(d);
      byMessage.set(d.message, (byMessage.get(d.message) ?? 0) + 1);
      issues.push({ file: rel, line: d.range.start.line + 1, char: d.range.start.character, severity: sev, message: d.message });
      if (d.severity === 1) errorCount++;
      else if (d.severity === 2) warnCount++;
    }

    const sig = issueSig(nonIgnored);
    newBaseline.files[rel] = { sig };

    const macroNote = (() => {
      const n = macro?.perFileUnchecked.get(rel);
      return n ? ` ⚠ ${n} macro-line registry position(s) unchecked (macro variable / custom namespace / unparseable)` : '';
    })();
    const nbtNote = (() => {
      const n = nbt?.perFileUnchecked.get(rel);
      return n ? ` ⚠ ${n} entity-NBT field position(s) unchecked (unknown entity/field / nested / macro)` : '';
    })();
    const coverNote = [macroNote, nbtNote].filter(Boolean).join(' ');

    if (delta) {
      const changed = !prev || prev.sig !== sig;
      if (changed && prev?.sig && sig === '') {
        // was broken last run, now clean (or all ignored) — surface it in delta mode
        deltaResolvedFiles++;
        lines.push(`\n== ${rel} ==  ✓ resolved (previously ${prev.sig.split('\n').length} issue(s))`);
        continue;
      }
      if (!changed) continue; // same issues as last run — nothing new to report
    }

    if (nonIgnored.length === 0) {
      if (coverNote) lines.push(`\n== ${rel} ==${coverNote}`);
      continue; // only ignored diagnostics → effectively clean
    }
    issueFiles++;
    if (delta) deltaChangedFiles++;

    lines.push(`\n== ${rel} (${nonIgnored.length}) ==${coverNote}`);
    for (const d of nonIgnored.sort((a, b) => (a.range.start.line - b.range.start.line) || (a.range.start.character - b.range.start.character))) {
      const line = d.range.start.line + 1, ch = d.range.start.character;
      const sev = d.severity === 1 ? 'E' : d.severity === 2 ? 'W' : '·';
      lines.push(`  [${sev}:${line}:${ch}] ${d.message}`);
    }
  }

  // aggregation sections
  const agg = [...byMessage.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 20);
  const ignoredAgg = [...ignoredByMessage.entries()].sort((a, b) => b[1] - a[1]);

  if (delta) {
    try { saveBaseline(baselineFile, newBaseline); }
    catch (err) { console.error(`[check] could not write baseline ${baselineFile}: ${(err as Error).message}`); }
  }

  const clean = files.length - issueFiles;
  const logJson = glog.found
    ? { found: true as const, path: glog.log as string, stale: glog.stale as boolean, lastLoaded: glog.lastLoaded as string | null, errors: glog.hits as string[] }
    : { found: false as const };

  const report: CheckReport = {
    datapack: opts.datapack,
    ...(opts.datapackSource ? { datapackSource: opts.datapackSource } : {}),
    version: opts.version,
    resolvedVersion,
    files: { checked: files.length, clean },
    summary: { errors: errorCount, warnings: warnCount, ignored: ignoredCount, internalFailures: internalErr, gotchas: gotchaCount },
    issues,
    ignored: ignoredList,
    gotchas: [...gotchaByFile.entries()].map(([file, items]) => ({ file, items })),
    log: logJson,
    byMessage: agg.map(([message, count]) => ({ message, count })),
    coverage,
    ...(delta ? { delta: { changedFiles: deltaChangedFiles, resolvedFiles: deltaResolvedFiles } } : {}),
    engine: engineKind,
    schemaVersion: 1,
  };
  return { report, lines, agg, ignoredAgg, newBaseline };
}

// ---- complete ----------------------------------------------------------------
export interface CompleteOptions {
  datapack: string;
  version: string;
  /** data/-relative path, e.g. test/function/x.mcfunction */
  rel: string;
  line: number;
  column: number;
  /** Inline text to complete instead of reading the file from disk (e.g. --complete-inline). */
  text?: string;
  /** Engine kind, or a pre-built engine instance to reuse (caller owns its lifecycle). */
  engine?: EngineKind | CheckEngine;
  verbose?: boolean;
  onLog?: (msg: string) => void;
}

export async function completeAt(opts: CompleteOptions): Promise<CompletionItemDTO[]> {
  const file = join(opts.datapack, 'data', opts.rel);
  let text: string;
  if (opts.text !== undefined) {
    text = opts.text;
  } else {
    try { text = readFileSync(file, 'utf8'); }
    catch { throw new DpkitError(`[check] file not found: ${file} (relative to the datapack's data/ directory)`, EXIT_USAGE); }
  }
  const lineCount = text.split('\n').length;
  if (opts.line < 1 || opts.column < 1) {
    throw new DpkitError(`[check] --complete line/column must be ≥1 (1-based); got line=${opts.line} column=${opts.column}`, EXIT_USAGE);
  }
  if (opts.line > lineCount) {
    throw new DpkitError(`[check] --complete line ${opts.line} exceeds the file's ${lineCount} lines`, EXIT_USAGE);
  }

  let engine: CheckEngine;
  let externalEngine = false;
  if (isEngineInstance(opts.engine)) {
    engine = opts.engine;
    externalEngine = true;
  } else {
    engine = makeEngine(opts.engine);
  }
  try {
    return await engine.complete({
      datapack: opts.datapack,
      version: opts.version,
      file,
      rel: opts.rel,
      line: opts.line,
      column: opts.column,
      text: opts.text,
      verbose: opts.verbose,
      onLog: opts.onLog,
    });
  } finally {
    if (!externalEngine) await engine.close();
  }
}

// ---- syntax / dump / versions (offline, no engine) ---------------------------
export function querySyntax(path: string, version = DEFAULT_VERSION, depth = 4): SyntaxResult {
  const concrete = resolveConcreteVersion(version);
  const tree = loadCommandTree(concrete);
  const segs = path.trim().split(/[.\s]+/).filter(Boolean);
  const { found, lines } = renderPath(tree, segs, depth);
  return { path: segs.join(' '), version: concrete, found, lines };
}

export function dumpSyntax(version: string, depth: number): { count: number; text: string } {
  return renderAll(loadCommandTree(resolveConcreteVersion(version)), depth);
}

// ---- registry (offline, no engine) -------------------------------------------

export interface RegistryQueryResult {
  name: string;
  version: string;
  found: boolean;
  /** Whether ANY registry data is cached for the version (false = cache miss, not "removed"). */
  cached: boolean;
  values?: string[];
  count: number;
  /** Present only when the requested registry is unknown — the full registry index. */
  index?: { name: string; count: number }[];
}

export function queryRegistry(name: string, version = DEFAULT_VERSION): RegistryQueryResult {
  const concrete = resolveConcreteVersion(version);
  const normalized = normalizeRegistryName(name);
  const data = loadRegistries(concrete);
  const cached = Object.keys(data).length > 0;
  const values = data[normalized];
  if (values) return { name: normalized, version: concrete, found: true, cached, values, count: values.length };
  return { name: normalized, version: concrete, found: false, cached, count: 0, index: registryIndex(concrete) };
}

export async function listVersions(configured: string): Promise<VersionListResult> {
  let list: unknown[] | null = null, src = 'local cache';
  try {
    const res = await fetch('https://api.spyglassmc.com/mcje/versions', { signal: AbortSignal.timeout(6000) });
    if (res.ok) { list = await res.json() as unknown[]; src = 'server (online)'; }
  } catch { /* offline → fall back to cache below */ }
  const cached = cachedCommandVersions();
  if (!Array.isArray(list)) list = loadCachedVersions(); // non-array online response → degrade to cache
  if (!Array.isArray(list) || list.length === 0) {
    throw new DpkitError('[check] could not get the version list (online request failed and no local cache)');
  }
  const versions = list as McmetaVersion[];
  const releases = versions.filter(v => v.type === 'release');
  const latestRelease = releases[0] ?? null;
  const latestSnapshot = versions.find(v => v.type === 'snapshot') ?? null;
  const isPinned = !['auto', 'latest release', 'latest snapshot'].includes(configured);
  const newerThanConfigured = (isPinned && latestRelease && latestRelease.id !== configured)
    ? { id: latestRelease.id, data_pack_version: latestRelease.data_pack_version }
    : null;
  const recent = versions.slice(0, 14).map(v => ({
    id: v.id, type: v.type ?? '?', dpv: v.data_pack_version, hasData: cached.has(String(v.id)),
  }));
  return {
    source: src,
    count: versions.length,
    configured,
    latestRelease: latestRelease ? { id: latestRelease.id, data_pack_version: latestRelease.data_pack_version, hasData: cached.has(latestRelease.id) } : null,
    latestSnapshot: latestSnapshot ? { id: latestSnapshot.id, data_pack_version: latestSnapshot.data_pack_version } : null,
    newerThanConfigured,
    isPinned,
    recent,
  };
}

// ---- gotchas without an engine (pure file scan) ------------------------------
export function scanGotchasStandalone(datapack: string, only = '', version = DEFAULT_VERSION): { file: string; items: GotchaIssue[] }[] {
  const label = resolveConcreteVersion(version);
  const { files, rels } = collectFiles(datapack, only);
  const dataDir = join(datapack, 'data');
  // Macro-line registry IDs are also surfaced here (key "macro-registry"), loaded lazily.
  let tree: CommandTree | undefined;
  let regs: Record<string, string[]> = {};
  let declared: Set<string> | undefined;
  const out: { file: string; items: GotchaIssue[] }[] = [];
  for (let i = 0; i < files.length; i++) {
    const items = scanGotchas(files[i], rels[i], label);
    if (files[i].endsWith('.mcfunction')) {
      let text: string;
      try { text = readFileSync(files[i], 'utf8'); } catch { text = ''; }
      if (text.includes('$(')) {
        if (!tree) {
          try { tree = loadCommandTree(label); } catch { /* no cached tree → skip macro scan */ }
          regs = loadRegistries(label);
        }
        if (tree) {
          if (!declared) declared = buildDeclaredRegistryIds(datapack);
          const r = scanMacroRegistry(files[i], tree, regs, declared, text);
          for (const iss of r.issues) items.push({ line: iss.line, key: iss.key, msg: iss.msg });
        }
      }
    }
    if (items.length) out.push({ file: toRel(files[i], dataDir), items });
  }
  return out;
}

export { collectFiles, FILES_EMPTY_HINT } from './collect.js';
export { resolveConcreteVersion } from './syntax.js';
export { detectDefaultDatapack } from './datapack-discovery.js';
export { createLspEngine };
export { createInProcEnginePool };
export { checkEngineUpdates, loadEngineBuildInfo } from './update-check.js';
