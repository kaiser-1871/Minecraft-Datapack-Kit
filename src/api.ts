// api.ts — the typed public API for dpkit. Both the CLI and the MCP server call these
// functions; nothing here talks to the terminal or a process — that's the caller's job.
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINE_FILE } from './paths.js';
import { collectFiles, FILES_EMPTY_HINT, toRel } from './collect.js';
import { createIgnoreFilter } from './ignore.js';
import { issueSig, loadBaseline, saveBaseline } from './delta.js';
import { scanGotchas } from './gotchas.js';
import { gameLogReport } from './logcheck.js';
import { createLspEngine } from './lsp-legacy.js';
import { loadCommandTree, loadCachedVersions, cachedCommandVersions, renderPath, renderAll } from './syntax.js';
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
  /** Default 'lsp' until the in-process engine lands; M3 flips to 'inproc'. */
  engine?: EngineKind;
  ignore?: { useIgnore: boolean; extra: string[] };
  delta?: boolean;
  baselineFile?: string;
  noGotchas?: boolean;
  noLog?: boolean;
  verbose?: boolean;
  autoDetected?: boolean;
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
  if (kind === 'inproc') {
    // M3 replaces this with a real import of engine/inproc.ts.
    throw new DpkitError('[check] 进程内引擎尚未实现 (M3); 请用 --engine=lsp', 2);
  }
  return createLspEngine();
}

// ---- check --------------------------------------------------------------------
export async function checkDatapack(opts: CheckOptions): Promise<CheckResult> {
  const { files, rels } = collectFiles(opts.datapack, opts.only ?? '');
  if (rels.length === 0) {
    throw new DpkitError(
      `[check] No files matched (datapack=${opts.datapack}, filter=${opts.only || '(all)'})\n${FILES_EMPTY_HINT}`,
    );
  }
  opts.onLog?.(`[check] datapack=${opts.datapack}${opts.autoDetected ? '  (自动探测)' : ''}  version=${opts.version}  files=${files.length}`);
  if (!existsSync(opts.datapack)) {
    throw new DpkitError(
      `[check] 找不到数据包目录: ${opts.datapack}\n[check] 用 --datapack= 指定, 例如 --datapack="D:\\Minecraft\\.minecraft\\versions\\26.2\\saves\\111\\datapacks\\pvp"`,
    );
  }

  const engine = makeEngine(opts.engine);
  try {
    const res = await engine.check({
      datapack: opts.datapack,
      version: opts.version,
      files,
      rels,
      mode: opts.mode ?? 'open',
      verbose: opts.verbose,
      onLog: opts.onLog,
    });
    return assembleReport(opts, files, rels, res.diagnosticsByRel, res.failedRels, res.resolvedVersion);
  } finally {
    await engine.close();
  }
}

function assembleReport(
  opts: CheckOptions,
  files: string[],
  rels: string[],
  diagnosticsByRel: Map<string, RawDiagnostic[]>,
  failedRels: Set<string>,
  resolvedVersion: string | null,
): CheckResult {
  const ignoreFilter = createIgnoreFilter(opts.ignore ?? { useIgnore: true, extra: [] });
  const noGotchas = opts.noGotchas === true;
  const logCheck = opts.noLog !== true;
  const delta = opts.delta ?? false;
  const baselineFile = opts.baselineFile ?? BASELINE_FILE;
  const engineKind: EngineKind = opts.engine ?? 'lsp';
  const dataDir = join(opts.datapack, 'data');

  let errorCount = 0, warnCount = 0, ignoredCount = 0, internalErr = 0, issueFiles = 0;
  let deltaChangedFiles = 0, deltaResolvedFiles = 0;
  const lines: string[] = [];
  const byMessage = new Map<string, number>(); // message -> count (non-ignored only)
  const ignoredByMessage = new Map<string, number>(); // message -> count
  const issues: ReportIssue[] = []; // for --json
  const ignoredList: ReportIssue[] = []; // for --json
  const newBaseline: { datapack: string; version: string; files: Record<string, BaselineEntry> } = { datapack: opts.datapack, version: opts.version, files: {} };

  // 26.2 已知坑扫描(heuristic):引擎宽松 schema 漏掉、游戏里却静默失败的写法
  const gotchaByFile = new Map<string, GotchaIssue[]>(); // rel -> [{line,key,msg}]
  let gotchaCount = 0;
  if (!noGotchas) {
    for (const f of files) {
      const rel = toRel(f, dataDir);
      const g = scanGotchas(f, rel);
      if (g.length) { gotchaByFile.set(rel, g); gotchaCount += g.length; }
    }
  }
  const glog: GameLogReport = logCheck ? gameLogReport(opts.datapack, files) : { found: false };

  const baseline = delta ? loadBaseline(baselineFile, opts.datapack, opts.version) : {};

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
      if (ignoreFilter(d.message)) {
        ignoredCount++;
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

    if (nonIgnored.length === 0) continue; // only ignored diagnostics → effectively clean
    issueFiles++;
    if (delta) deltaChangedFiles++;

    lines.push(`\n== ${rel} (${nonIgnored.length}) ==`);
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
  /** data/-relative path, e.g. battle/function/x.mcfunction */
  rel: string;
  line: number;
  column: number;
  engine?: EngineKind;
  verbose?: boolean;
  onLog?: (msg: string) => void;
}

export async function completeAt(opts: CompleteOptions): Promise<CompletionItemDTO[]> {
  const file = join(opts.datapack, 'data', opts.rel);
  let text: string;
  try { text = readFileSync(file, 'utf8'); }
  catch { throw new DpkitError(`[check] 找不到文件: ${file} (相对 datapack 的 data/ 目录)`); }
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
      verbose: opts.verbose,
      onLog: opts.onLog,
    });
  } finally {
    await engine.close();
  }
}

// ---- syntax / dump / versions (offline, no engine) ---------------------------
export function querySyntax(path: string, version = '26.2', depth = 4): SyntaxResult {
  const tree = loadCommandTree(version);
  const segs = path.trim().split(/[.\s]+/).filter(Boolean);
  const { found, lines } = renderPath(tree, segs, depth);
  return { path: segs.join(' '), version, found, lines };
}

export function dumpSyntax(version: string, depth: number): { count: number; text: string } {
  return renderAll(loadCommandTree(version), depth);
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
export function scanGotchasStandalone(datapack: string, only = ''): { file: string; items: GotchaIssue[] }[] {
  const { files, rels } = collectFiles(datapack, only);
  const dataDir = join(datapack, 'data');
  const out: { file: string; items: GotchaIssue[] }[] = [];
  for (let i = 0; i < files.length; i++) {
    const items = scanGotchas(files[i], rels[i]);
    if (items.length) out.push({ file: toRel(files[i], dataDir), items });
  }
  return out;
}

export { collectFiles, FILES_EMPTY_HINT } from './collect.js';
export { detectDefaultDatapack, AUTO_DETECTED } from './datapack-discovery.js';
export { createLspEngine };
