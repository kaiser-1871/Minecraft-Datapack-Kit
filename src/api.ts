// api.ts — the typed public API for dpkit. Both the CLI and the MCP server call these
// functions; nothing here talks to the terminal or a process — that's the caller's job.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINE_FILE } from './paths.js';
import { DEFAULT_VERSION } from './config.js';
import { collectFiles, FILES_EMPTY_HINT, toRel } from './collect.js';
import { createIgnoreFilter, isVanillaRegistryMiss } from './ignore.js';
import { listRegistryValues, loadRegistries, normalizeRegistryName, registryIndex } from './registry.js';
import { loadVanillaTags } from './vanilla-tags.js';
import { buildDeclaredRegistryIds, scanMacroRegistry } from './macrocheck.js';
import type { MacroIssue, MacroStats } from './macrocheck.js';
import type { CommandTree } from './syntax.js';
import { issueSig, loadBaseline, saveBaseline } from './delta.js';
import { scanGotchas } from './gotchas.js';
import { gameLogReport } from './logcheck.js';
import { createLspEngine } from './lsp-legacy.js';
import { createInProcEngine } from './engine/inproc.js';
import { loadCommandTree, loadCachedVersions, cachedCommandVersions, renderPath, renderAll, resolveConcreteVersion } from './syntax.js';
import type { BaselineEntry, CheckLog, CompletionItemDTO, GameLogReport, GotchaIssue, RawDiagnostic, ReportIssue, SyntaxResult } from './types.js';
import type { CheckEngine } from './engine/types.js';

export type { CheckEngine } from './engine/types.js';

export type EngineKind = 'inproc' | 'lsp';

/** A user-facing error with a specific exit code (default 2). */
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
  /** Engine to use. Default 'inproc'; 'lsp' is the legacy subprocess path (parity reference). */
  engine?: EngineKind;
  ignore?: { useIgnore: boolean; extra: string[] };
  delta?: boolean;
  baselineFile?: string;
  noGotchas?: boolean;
  /** Disable the $ macro-line registry-ID validation (on by default). */
  noMacro?: boolean;
  noLog?: boolean;
  verbose?: boolean;
  autoDetected?: boolean;
  /** Minecraft install root, for the game-log self-check. */
  minecraftRoot?: string;
  onLog?: (msg: string) => void;
}

/** The JSON-serialized report (matches the legacy --json shape + engine + schemaVersion). */
export interface CheckReport {
  datapack: string;
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
function makeEngine(kind?: EngineKind): CheckEngine {
  return (kind ?? 'inproc') === 'inproc' ? createInProcEngine() : createLspEngine();
}

// ---- check --------------------------------------------------------------------
export async function checkDatapack(opts: CheckOptions): Promise<CheckResult> {
  const { files, rels } = collectFiles(opts.datapack, opts.only ?? '');
  if (rels.length === 0) {
    throw new DpkitError(
      `[check] No files matched (datapack=${opts.datapack}, filter=${opts.only || '(all)'})\n${FILES_EMPTY_HINT}`,
    );
  }
  // Include pack.mcmeta so a broken one surfaces — today it silently skews version auto-detect
  // and produces 0 diagnostics ("this wasn't checked"). Checked DPKIT-side (not via the engine):
  // the LSP path never publishes diagnostics for root-level files and would hang its settle wait.
  const mcmetaPath = join(opts.datapack, 'pack.mcmeta');
  const mcmetaRel = existsSync(mcmetaPath) && !rels.includes('pack.mcmeta') ? 'pack.mcmeta' : null;
  if (mcmetaRel) { files.push(mcmetaPath); rels.push(mcmetaRel); }
  opts.onLog?.(`[check] datapack=${opts.datapack}${opts.autoDetected ? '  (自动探测)' : ''}  version=${opts.version}  files=${files.length}`);
  if (!existsSync(opts.datapack)) {
    throw new DpkitError(
      `[check] 找不到数据包目录: ${opts.datapack}\n[check] 用 --datapack=<绝对路径> 指定, 或设 DPKIT_DATAPACK 环境变量, 或在 .dpkit.json 里配置 datapack 字段。`,
    );
  }

  const engine = makeEngine(opts.engine);
  try {
    // pack.mcmeta is reported dpkit-side (see scanPackMcmeta) — don't hand it to the engine.
    const engineFiles = mcmetaRel ? files.slice(0, -1) : files;
    const engineRels = mcmetaRel ? rels.slice(0, -1) : rels;
    const res = await engine.check({
      datapack: opts.datapack,
      version: opts.version,
      files: engineFiles,
      rels: engineRels,
      mode: opts.mode ?? 'open',
      verbose: opts.verbose,
      onLog: opts.onLog,
    });
    // $ macro lines are skipped by the engine's parser; validate their literal registry IDs here.
    const macro = runMacroScan(opts, engineFiles, engineRels, res.resolvedVersion);
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
    // pack.mcmeta: give it a clean/err entry so it's counted, not treated as an engine failure.
    if (mcmetaRel) {
      const d = scanPackMcmeta(mcmetaPath);
      diagnosticsByRel.set(mcmetaRel, d ? [d] : []);
    }
    return assembleReport(opts, files, rels, diagnosticsByRel, res.failedRels, res.resolvedVersion, macro);
  } finally {
    await engine.close();
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
  catch (e) { return mcmetaErr(`pack.mcmeta 无法读取: ${(e as Error).message}`); }
  try {
    const obj = JSON.parse(text) as unknown;
    if (!obj || typeof obj !== 'object' || !('pack' in obj)) {
      return mcmetaErr('pack.mcmeta 缺少 "pack" 字段(格式: {"pack": {"pack_format": N, "description": "…"}})');
    }
    return null;
  } catch (e) {
    return mcmetaErr(`pack.mcmeta 不是合法 JSON: ${(e as Error).message}`);
  }
}

function mcmetaErr(message: string): RawDiagnostic {
  return { severity: 1, message, range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } } };
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
    let text: string;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    if (!text.includes('$(')) continue;
    // lazy-load the command tree + registries only once a macro line is actually present
    if (!tree) {
      try { tree = loadCommandTree(versionLabel); } catch { return null; } // no cached tree → skip
      regs = loadRegistries(versionLabel);
    }
    if (!declared) declared = buildDeclaredRegistryIds(opts.datapack);
    const r = scanMacroRegistry(f, tree, regs, declared);
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
): CheckResult {
  const useIgnore = opts.ignore?.useIgnore ?? true;
  const ignoreFilter = createIgnoreFilter(opts.ignore ?? { useIgnore: true, extra: [] });
  const noGotchas = opts.noGotchas === true;
  const logCheck = opts.noLog !== true;
  const delta = opts.delta ?? false;
  const baselineFile = opts.baselineFile ?? BASELINE_FILE;
  const engineKind: EngineKind = opts.engine ?? 'inproc';
  const dataDir = join(opts.datapack, 'data');

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

  // 已知坑扫描(heuristic):引擎宽松 schema 漏掉、游戏里却静默失败的写法;消息带实际生效版本
  let versionLabel = resolvedVersion ?? opts.version;
  if (versionLabel === 'auto' || versionLabel === 'latest release' || versionLabel === 'latest snapshot') {
    try { versionLabel = resolveConcreteVersion(versionLabel); } catch { /* keep the raw label */ }
  }
  // 覆盖度:引擎检查失败的文件、宏行校验统计、自动过滤数(F3)。
  const coverage: CheckReport['coverage'] = {
    filesChecked: files.length,
    filesSkipped: failedRels.size,
    macroLines: macro?.stats.lines ?? 0,
    macroChecked: macro?.stats.checked ?? 0,
    macroUnchecked: macro?.stats.unchecked ?? 0,
    autoFiltered: 0,
  };
  // F3:数据驱动 vanilla 注册表/标签误报过滤 —— "Cannot find attribute “minecraft:<合法ID>”"、
  // "Cannot find tag/damage_type “minecraft:is_projectile”" 自动过滤。注册表值按生效版本读缓存;
  // 标签集来自 vanilla-data tarball(未缓存则标签过滤自然关闭)。
  const regs: Record<string, string[]> = loadRegistries(versionLabel);
  const vanillaTags: Set<string> | null = useIgnore ? loadVanillaTags(versionLabel) : null;
  const gotchaByFile = new Map<string, GotchaIssue[]>(); // rel -> [{line,key,msg}]
  let gotchaCount = 0;
  if (!noGotchas) {
    for (let i = 0; i < files.length; i++) {
      const g = scanGotchas(files[i], rels[i], versionLabel);
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
      const autoFiltered = useIgnore && isVanillaRegistryMiss(d.message, regs, vanillaTags);
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
      return n ? ` ⚠ 含 ${n} 处宏行注册表位置未校验(宏变量/自定义命名空间/无法解析)` : '';
    })();

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
      if (macroNote) lines.push(`\n== ${rel} ==${macroNote}`);
      continue; // only ignored diagnostics → effectively clean
    }
    issueFiles++;
    if (delta) deltaChangedFiles++;

    lines.push(`\n== ${rel} (${nonIgnored.length}) ==${macroNote}`);
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
  engine?: EngineKind;
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
    catch { throw new DpkitError(`[check] 找不到文件: ${file} (相对 datapack 的 data/ 目录)`); }
  }
  const lineCount = text.split('\n').length;
  if (opts.line < 1 || opts.column < 1) {
    throw new DpkitError(`[check] --complete 行/列必须 ≥1 (1-based); 收到 行=${opts.line} 列=${opts.column}`);
  }
  if (opts.line > lineCount) {
    throw new DpkitError(`[check] --complete 行号 ${opts.line} 超出文件行数 ${lineCount}`);
  }

  const engine = makeEngine(opts.engine);
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
    await engine.close();
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
  values?: string[];
  count: number;
  /** Present only when the requested registry is unknown — the full registry index. */
  index?: { name: string; count: number }[];
}

export function queryRegistry(name: string, version = DEFAULT_VERSION): RegistryQueryResult {
  const concrete = resolveConcreteVersion(version);
  const normalized = normalizeRegistryName(name);
  const values = listRegistryValues(concrete, normalized);
  if (values) return { name: normalized, version: concrete, found: true, values, count: values.length };
  return { name: normalized, version: concrete, found: false, count: 0, index: registryIndex(concrete) };
}

export async function listVersions(configured: string): Promise<VersionListResult> {
  let list: unknown[] | null = null, src = '本地缓存';
  try {
    const res = await fetch('https://api.spyglassmc.com/mcje/versions', { signal: AbortSignal.timeout(6000) });
    if (res.ok) { list = await res.json() as unknown[]; src = '服务器(在线)'; }
  } catch { /* offline → fall back to cache below */ }
  const cached = cachedCommandVersions();
  if (!list) list = loadCachedVersions();
  if (!Array.isArray(list) || list.length === 0) {
    throw new DpkitError('[check] 无法获取版本列表(在线请求失败且本地无缓存)');
  }
  const versions = list as McmetaVersion[];
  const releases = versions.filter(v => v.type === 'release');
  const latestRelease = releases[0] ?? null;
  const latestSnapshot = versions[0] ?? null;
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
  // Macro-line registry IDs are also surfaced here (key "宏行注册表"), loaded lazily.
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
          const r = scanMacroRegistry(files[i], tree, regs, declared);
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
