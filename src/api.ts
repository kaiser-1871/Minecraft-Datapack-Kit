// api.ts — the typed public API for dpkit. Both the CLI and the MCP server call these
// functions; nothing here talks to the terminal or a process — that's the caller's job.
import { closeSync, existsSync, openSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { BASELINE_FILE } from './paths.js';
import { DEFAULT_VERSION } from './config.js';
import { collectFiles, FILES_EMPTY_HINT, matchesOnly, toRel } from './collect.js';
import type { UnreadableDir } from './collect.js';
import { findDuplicateDataFiles, isRecognizedDataFile, isWrongFolderDiagnostic, parseDataRel, validateDataFilePaths } from './datapack-structure.js';
import { activeDataRoots, activeOverlayDirs, dataPackVersionOf, resolveVersionForFormatRange, scanPackMcmeta } from './pack-mcmeta.js';
import { scanStructureNbt } from './structure-nbt.js';
import { extractZipDatapack, isZipPath } from './zip-datapack.js';
import { createIgnoreFilter, isVanillaRegistryMiss } from './ignore.js';
import { loadRegistries, normalizeRegistryName, registryIndex } from './registry.js';
import { loadVanillaTags } from './vanilla-tags.js';
import { buildDeclaredRegistryIds, scanMacroRegistry } from './macrocheck.js';
import type { MacroIssue, MacroStats, MacroUncheckedPosition } from './macrocheck.js';
import { loadEntitySchemas, scanEntityNbt } from './entity-nbt.js';
import type { NbtIssue, NbtScanStats, NbtUncheckedPosition } from './entity-nbt.js';
import type { CommandTree } from './syntax.js';
import { issueSig, loadBaseline, saveBaseline, sigCounts } from './delta.js';
import { scanGotchas } from './gotchas.js';
import { gameLogReport } from './logcheck.js';
import { createLspEngine } from './lsp-legacy.js';
import { matchKnownFalsePositive, enabledKnownFpRules, SCOPE_HINT_CATEGORIES } from './known-false-positives.js';
import { prepareAuxPacks, resolveAuxSymbol, scanPackSymbols, splitPathList } from './symbol-providers.js';
import type { AuxPack, ResolvedAuxSymbol } from './symbol-providers.js';
import { planConcreteVersion, planVersionCheck } from './cache-policy.js';
import type { CacheMissPolicy, VersionPlan } from './cache-policy.js';
import { createInProcEngine, createInProcEnginePool } from './engine/inproc.js';
import { loadCommandTree, loadCachedVersions, cachedCommandVersions, renderPath, renderAll, resolveConcreteVersion } from './syntax.js';
import { initPlugins, runAfterCheck, runBeforeCheck } from './plugins.js';
import type { DpkitPlugin, PluginContext } from './plugins.js';
import type { BaselineEntry, CheckLog, CompletionItemDTO, GameLogReport, GotchaIssue, RawDiagnostic, ReportIssue, SyntaxResult } from './types.js';
import type { CheckEngine, EngineCheckResult, EngineSnapshot } from './engine/types.js';

export type { CheckEngine } from './engine/types.js';
export type { CacheMissPolicy } from './cache-policy.js';
export type { DpkitPlugin, PluginContext } from './plugins.js';

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
  /** Workspace datapacks (dirs or .zip): read-only symbol providers only. */
  workspace?: string[];
  /** Alias for workspace; the two lists are merged in flag order. */
  additionalDatapacks?: string[];
  /** Resource packs (dirs or .zip): read-only sounds.json / font / lang symbol providers. */
  resourcePacks?: string[];
  /** Behavior when a requested version's command data is missing from the local cache. */
  cacheMiss?: CacheMissPolicy;
  /** Known-false-positive rule selection: false disables all, string[] enables a subset. */
  falsePositives?: boolean | string[];
  /** Plugins to run around the check (see src/plugins.ts). */
  plugins?: DpkitPlugin[];
  onLog?: (msg: string) => void;
}

/** The JSON-serialized report (matches the legacy --json shape + engine + schemaVersion). */
export interface VersionCheckInfo {
  /** Raw requested version (--version/DPKIT_VERSION/config). */
  target: string;
  /** Concrete version the target resolves to (null while unresolved). */
  targetVersion: string | null;
  /** The version actually handed to the engine. */
  actual: string | null;
  cacheSource: 'local cache' | 'downloaded this run' | 'fallback (nearest cached version)' | 'engine resolved' | 'none';
  fallback: boolean;
  targetDpv: number | null;
  actualDpv: number | null;
  /** What was NOT checked because target != actual, or 'none' when the target was checked. */
  uncheckedRange: string | null;
  message: string | null;
}

export interface ResolvedSymbolReport {
  file: string;
  line: number;
  char: number;
  symbol: string;
  source: 'workspace' | 'resource-pack';
  pack: string;
  note: string;
}

export interface ScopeHint {
  file: string;
  line: number;
  char: number;
  symbol: string;
  message: string;
}

export interface CheckReport {
  datapack: string;
  /** Where the datapack path came from ('cli' | 'env' | 'config' | 'auto'), when known. */
  datapackSource?: 'cli' | 'env' | 'config' | 'auto';
  version: string;
  resolvedVersion: string | null;
  /** Target vs actual check version + cache source (see --cache-miss). */
  versionInfo: VersionCheckInfo;
  files: { checked: number; clean: number };
  summary: { errors: number; warnings: number; ignored: number; internalFailures: number; gotchas: number; symbolsResolved: number; scopeHints: number; knownFalsePositives: number };
  issues: ReportIssue[];
  ignored: ReportIssue[];
  gotchas: { file: string; items: GotchaIssue[] }[];
  log: CheckLog;
  byMessage: { message: string; count: number }[];
  /** Symbols that were missing in the engine but resolved from auxiliary providers. */
  resolvedSymbols: ResolvedSymbolReport[];
  /** Cross-pack misses downgraded to scope hints when no workspace was supplied. */
  scopeHints: ScopeHint[];
  /** What was actually covered vs skipped (macro lines, engine-failed files, auto-filtered). */
  coverage: {
    filesChecked: number;
    filesSkipped: number;
    macroLines: number;
    macroChecked: number;
    macroUnchecked: number;
    macroSyntaxChecked: number;
    macroSyntaxUnchecked: number;
    macroApplicableFiles: number;
    macroNotApplicableFiles: number;
    /** entity-NBT (summon/data) lines + field positions validated/skipped. */
    nbtLines: number;
    nbtChecked: number;
    nbtUnchecked: number;
    nbtApplicableFiles: number;
    nbtNotApplicableFiles: number;
    /** false when the check had no data files and skipped the engine entirely. */
    engineUsed: boolean;
    /** post-scan availability (0 counts + unavailable = the data needed was not cached). */
    macroUnavailable: boolean;
    nbtUnavailable: boolean;
    autoFiltered: number;
    knownFalsePositives: number;
    /** File-locatable unresolved positions (line + reason + detail). */
    macroUncheckedPositions: (MacroUncheckedPosition & { file: string })[];
    nbtUncheckedPositions: (NbtUncheckedPosition & { file: string })[];
    /** Inactive overlay files omitted because the target version is outside their formats range. */
    overlayFilesSkipped: number;
    /** Data directories/files that could not be read (checked? no — surfaced, not silently skipped). */
    unreadableDirs: number;
    unreadableFiles: number;
  };
  delta?: {
    changedFiles: number;
    resolvedFiles: number;
    baseline: { errors: number; warnings: number };
    current: { errors: number; warnings: number };
    new: { errors: number; warnings: number };
    resolved: { errors: number; warnings: number };
  };
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
  /** --versions=1.21 / --versions=1.21.11 / --versions=dpv:94 search query. */
  query: string | null;
  latestRelease: { id: string; data_pack_version?: number; hasData: boolean } | null;
  latestSnapshot: { id: string; data_pack_version?: number } | null;
  newerThanConfigured: { id: string; data_pack_version?: number } | null;
  isPinned: boolean;
  recent: { id: string; type: string; dpv: number | undefined; hasData: boolean }[];
  /** Filtered results when query was given (the FULL match set, not a "recent 14"). */
  matches: { id: string; type: string; dpv: number | undefined; hasData: boolean }[];
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

  // A .zip datapack is extracted once into a temp dir; everything below runs on the extracted
  // root while the report/delta/log paths keep the user's original path.
  let workRoot = opts.datapack;
  let cleanupExtracted: (() => void) | null = null;
  try {
    const st = statSync(opts.datapack);
    if (st.isFile()) {
      if (!isZipPath(opts.datapack)) {
        throw new DpkitError(`[check] datapack path is a file but not a .zip archive: ${opts.datapack}\n[check] pass a datapack directory or a .zip datapack.`, EXIT_USAGE);
      }
      try {
        const extracted = await extractZipDatapack(opts.datapack);
        workRoot = extracted.root;
        cleanupExtracted = extracted.cleanup;
      } catch (err) {
        throw new DpkitError(`[check] could not read datapack zip ${opts.datapack}: ${(err as Error).message}`, EXIT_USAGE);
      }
    } else if (!st.isDirectory()) {
      throw new DpkitError(`[check] datapack path is neither a directory nor a .zip file: ${opts.datapack}`, EXIT_USAGE);
    }
  } catch (err) {
    if (err instanceof DpkitError) throw err;
    throw new DpkitError(`[check] could not inspect datapack path ${opts.datapack}: ${(err as Error).message}`, EXIT_USAGE);
  }

  const mcmetaPath = join(workRoot, 'pack.mcmeta');
  const hasMcmeta = existsSync(mcmetaPath);
  let mcmetaText: string | null = null;
  if (hasMcmeta) {
    try { mcmetaText = readFileSync(mcmetaPath, 'utf8'); }
    catch { mcmetaText = null; }
  }

  // Parse pack.mcmeta once to learn overlay dirs. The full diagnostics (which need the
  // resolved target version) are produced later.
  const mcmetaScan0 = mcmetaText ? scanPackMcmeta(mcmetaText, workRoot) : null;
  const declaredOverlays = mcmetaScan0?.overlays ?? [];
  const allOverlayDirs = declaredOverlays.map(o => o.directory);

  // Resolve the target version BEFORE file collection so overlay directories can be filtered
  // by their formats range (an overlay for dpv 500..600 is not part of the target-version check).
  const cachePolicy: CacheMissPolicy = opts.cacheMiss ?? 'download';
  let versionPlan: VersionPlan | null = null;
  let autoDetected: string | null = null;
  try {
    versionPlan = await planVersionCheck(opts.version, cachePolicy);
    if (opts.version === 'auto' && mcmetaScan0) {
      const rangeVersion = resolveVersionForFormatRange(
        mcmetaScan0.minFormat,
        mcmetaScan0.maxFormat,
        mcmetaScan0.hasExplicitRange ? mcmetaScan0.packFormat : null,
      );
      if (rangeVersion) {
        autoDetected = rangeVersion;
        versionPlan = await planConcreteVersion(rangeVersion, cachePolicy, 'auto');
      }
    }
  } catch (err) {
    throw new DpkitError((err as Error).message, 2);
  }
  const engineVersion = versionPlan?.engineVersion ?? opts.version;
  const overlayDpv = versionPlan?.actualDpv
    ?? (autoDetected ? dataPackVersionOf(autoDetected) : null);
  const activeOverlaySet = new Set(activeOverlayDirs(declaredOverlays, overlayDpv));
  const activeDataRootList = activeDataRoots(workRoot, declaredOverlays, overlayDpv);
  const inactiveOverlayCount = allOverlayDirs.length - activeOverlaySet.size;

  // Collect everything, then drop files under overlays that are inactive for the target
  // version. A null dpv (version still unknown) keeps every overlay, never drops files blindly.
  const unreadableDirs: UnreadableDir[] = [];
  const collected = collectFiles(workRoot, opts.only ?? '', allOverlayDirs, entry => unreadableDirs.push(entry));
  const files: string[] = [];
  const rels: string[] = [];
  let skippedOverlayFiles = 0;
  for (let i = 0; i < collected.files.length; i++) {
    const { overlay } = parseDataRel(collected.rels[i]);
    if (overlay !== null && !activeOverlaySet.has(overlay)) { skippedOverlayFiles++; continue; }
    files.push(collected.files[i]);
    rels.push(collected.rels[i]);
  }
  const activeUnreadableDirs = unreadableDirs.filter(e => {
    const { overlay } = parseDataRel(e.rel);
    return overlay === null || activeOverlaySet.has(overlay);
  });

  // #7: --files checks ONLY the files the user listed. pack.mcmeta is included only when the
  // user explicitly asked for it (e.g. --files=pack.mcmeta or --files=*.mcmeta).
  const mcmetaRel = 'pack.mcmeta';
  const includeMcmeta = !opts.only || matchesOnly(mcmetaRel, opts.only);
  const explicitMcmetaOnly = opts.only !== undefined && opts.only !== '' && matchesOnly(mcmetaRel, opts.only);
  if (rels.length === 0 && !hasMcmeta && !explicitMcmetaOnly) {
    throw new DpkitError(
      `[check] No files matched (datapack=${opts.datapack}, filter=${opts.only || '(all)'})
${FILES_EMPTY_HINT}`,
      EXIT_USAGE,
    );
  }
  if (includeMcmeta) {
    files.push(mcmetaPath);
    rels.push(mcmetaRel);
  }

  // Auxiliary providers (--workspace/--additional-datapacks/--resource-pack/--resource-packs).
  // They are symbol providers only — never part of the checked file set, never validated.
  const workspacePaths = splitPathList([...(opts.workspace ?? []), ...(opts.additionalDatapacks ?? [])]);
  const resourcePaths = splitPathList(opts.resourcePacks ?? []);
  let auxPacks: AuxPack[] = [];
  try {
    auxPacks.push(...await prepareAuxPacks(workspacePaths, 'workspace'));
    auxPacks.push(...await prepareAuxPacks(resourcePaths, 'resource-pack'));
  } catch (err) {
    throw new DpkitError(`[check] ${(err as Error).message}`, EXIT_USAGE);
  }

  opts.onLog?.(`[check] datapack=${opts.datapack}${opts.datapackSource ? `  (${({ cli: 'from --datapack', env: 'from DPKIT_DATAPACK', config: 'from .dpkit.json', auto: 'from auto-detected' })[opts.datapackSource]})` : ''}  version=${opts.version}  files=${files.length}${workRoot !== opts.datapack ? '  (extracted from .zip)' : ''}${workspacePaths.length ? `  workspace=${workspacePaths.length} pack(s)` : ''}${resourcePaths.length ? `  resource-packs=${resourcePaths.length}` : ''}`);
  if (versionPlan?.message) opts.onLog?.(`[check] ${versionPlan.message}`);
  if (autoDetected && opts.version === 'auto' && mcmetaScan0?.hasExplicitRange) {
    opts.onLog?.(`[check] auto-detected version ${autoDetected} from pack.mcmeta format range ${mcmetaScan0?.formatRangeLabel ?? mcmetaScan0?.maxFormat ?? '?'}`);
  }
  if (mcmetaText) {
    // The explicit format-range hint (e.g. "pack supports dpv 88..unbounded; target 1.21.11
    // (dpv 94) is inside range.") is printed for the version that will actually be used.
    let hintVersion: string | null = versionPlan?.actualVersion ?? autoDetected ?? null;
    if (!hintVersion && engineVersion !== 'auto') hintVersion = engineVersion;
    if (hintVersion && ['auto', 'latest release', 'latest snapshot'].includes(hintVersion)) {
      try { hintVersion = resolveConcreteVersion(hintVersion); } catch { hintVersion = null; }
    }
    if (hintVersion) {
      const hint = scanPackMcmeta(mcmetaText, workRoot, { version: hintVersion, dataPackVersion: dataPackVersionOf(hintVersion) }).formatHint;
      if (hint) opts.onLog?.(`[check] ${hint}`);
    }
  }

  if (skippedOverlayFiles > 0) {
    const label = versionPlan?.actualVersion ?? autoDetected ?? opts.version;
    opts.onLog?.(`[check] skipped ${skippedOverlayFiles} file(s) from ${inactiveOverlayCount} overlay(s) that are inactive for ${label} (dpv ${overlayDpv ?? '?'})`);
  }

  // dpkit-side structural diagnostics: illegal resource-location paths + case collisions.
  const dataRels = rels.filter(r => r !== mcmetaRel);
  const structuralDiags = mergeDiagnostics(
    validateDataFilePaths(dataRels),
    findDuplicateDataFiles(dataRels),
  );
  const unreadableDiags = new Map<string, RawDiagnostic[]>();
  for (const e of activeUnreadableDirs) {
    const rel = e.rel || 'data/';
    unreadableDiags.set(rel, [{
      severity: 2,
      message: `[check] unreadable data directory "${rel}" (${e.path}) — its files were not checked: ${e.error}`,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    }]);
  }

  // Files the engine has no resource definition for are ignored by Minecraft too. They get a
  // dpkit warning and are NOT sent to the engine (the LSP path would otherwise wait 150s for
  // diagnostics that never come).
  const recognizedIdx: number[] = [];
  const unrecognizedDiags = new Map<string, RawDiagnostic[]>();
  for (let i = 0; i < files.length; i++) {
    if (rels[i] === mcmetaRel) continue;
    if (isRecognizedDataFile(rels[i])) recognizedIdx.push(i);
    else {
      unrecognizedDiags.set(rels[i], [{
        severity: 2,
        message: `[check] unrecognized data file path "${rels[i]}" — this path is not a data-pack resource folder, so Minecraft and the engine ignore it`,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      }]);
    }
  }
  const engineFiles = recognizedIdx.map(i => files[i]);
  const engineRels = recognizedIdx.map(i => rels[i]);
  // Readability preflight for text files: the engine/post-scans skip unreadable files in several
  // places; turn that into an explicit warning instead of a silently incomplete check.
  const unreadableFileDiags = unreadableTextFileDiagnostics(engineFiles, engineRels);
  mergeDiagnosticsInto(unreadableDiags, unreadableFileDiags);
  // Give unreadable-directory diagnostics a report slot. They are pseudo-entries (not engine
  // files); the loop below prints the warning and coverage counts the gap separately.
  for (const e of activeUnreadableDirs) {
    files.push(e.path);
    rels.push(e.rel || 'data/');
  }

  // Plugin boundary: after file collection / version resolution, before the engine runs.
  const pluginCtx: PluginContext = {
    datapack: opts.datapack,
    workRoot,
    version: opts.version,
    resolvedVersion: versionPlan?.actualVersion ?? autoDetected ?? null,
    files,
    rels,
    opts,
  };
  try {
    await initPlugins(opts.plugins ?? [], pluginCtx);
    await runBeforeCheck(opts.plugins ?? [], pluginCtx);
  } catch (err) {
    throw new DpkitError(`[plugin] ${(err as Error).message}`, EXIT_USAGE);
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
    let preVersion: string | null = null;
    if (engineVersion !== 'auto') {
      try { preVersion = resolveConcreteVersion(engineVersion); } catch { preVersion = null; }
    }
    const texts = preVersion ? readFileTexts(engineFiles, engineRels) : null;

    // Data-less pack (only pack.mcmeta, or --files=pack.mcmeta) — don't start the engine at
    // all; validate metadata and resolve the effective version from the format range.
    if (engineFiles.length === 0) {
      const resolvedVersion = versionPlan?.actualVersion
        ?? autoDetected
        ?? noEngineVersion(opts.version, mcmetaScan0?.minFormat ?? null, mcmetaScan0?.maxFormat ?? null)
        ?? preVersion ?? opts.version;
      const diagnosticsByRel = mergeDiagnostics(structuralDiags, unrecognizedDiags, unreadableDiags);
      if (includeMcmeta) {
        diagnosticsByRel.set(mcmetaRel, packMcmetaDiagnostics(mcmetaText, workRoot, resolvedVersion, true));
      }
      const result = assembleReport(opts, files, rels, diagnosticsByRel, new Set(), resolvedVersion, null, null, texts, workRoot, false, auxPacks, versionPlan, autoDetected, includeMcmeta, skippedOverlayFiles, activeUnreadableDirs.length, unreadableFileDiags.size);
      try {
        const report = await runAfterCheck(opts.plugins ?? [], pluginCtx, result.report);
        const final = { ...result, report };
        syncPluginLines(final);
        return final;
      } catch (err) {
        throw new DpkitError(`[plugin] ${(err as Error).message}`, EXIT_USAGE);
      }
    }

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
      post = runPostScans(opts, workRoot, engineFiles, engineRels, res.resolvedVersion ?? preVersion ?? engineVersion, texts ?? readFileTexts(engineFiles, engineRels), activeDataRootList);
    } else {
      const prescan = preVersion && texts
        ? Promise.resolve().then(() => runPostScans(opts, workRoot, engineFiles, engineRels, preVersion!, texts, activeDataRootList))
        : null;
      res = await engine.check({
        datapack: workRoot,
        version: engineVersion,
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
      const scanVersion = res.resolvedVersion ?? preVersion ?? engineVersion;
      post = pre && (!res.resolvedVersion || res.resolvedVersion === preVersion)
        ? pre
        : runPostScans(opts, workRoot, engineFiles, engineRels, scanVersion, texts ?? readFileTexts(engineFiles, engineRels), activeDataRootList);
    }

    const macro = post.macro;
    const nbt = post.nbt;
    const diagnosticsByRel = mergeDiagnostics(
      new Map(res.diagnosticsByRel),
      structuralDiags,
      unrecognizedDiags,
      unreadableDiags,
      post.structure?.issuesByRel ?? null,
    );
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
    const targetVersion = res.resolvedVersion ?? versionPlan?.actualVersion ?? preVersion ?? engineVersion;
    if (includeMcmeta) {
      diagnosticsByRel.set(mcmetaRel, packMcmetaDiagnostics(mcmetaText, workRoot, targetVersion, true));
    }
    const result = assembleReport(opts, files, rels, diagnosticsByRel, res.failedRels, res.resolvedVersion ?? versionPlan?.actualVersion ?? null, macro, nbt, texts, workRoot, true, auxPacks, versionPlan, autoDetected, includeMcmeta, skippedOverlayFiles, activeUnreadableDirs.length, unreadableFileDiags.size);
    try {
      const report = await runAfterCheck(opts.plugins ?? [], pluginCtx, result.report);
      const final = { ...result, report };
      syncPluginLines(final);
      return final;
    } catch (err) {
      throw new DpkitError(`[plugin] ${(err as Error).message}`, EXIT_USAGE);
    }
  } finally {
    if (!externalEngine) await engine.close();
    for (const aux of auxPacks) {
      try { aux.cleanup(); } catch { /* temp cleanup is best-effort */ }
    }
    cleanupExtracted?.();
  }
}

/** Merge several rel→diagnostics maps (later maps append; null maps are ignored). */
function mergeDiagnostics(...maps: (Map<string, RawDiagnostic[]> | null)[]): Map<string, RawDiagnostic[]> {
  const out = new Map<string, RawDiagnostic[]>();
  for (const m of maps) mergeDiagnosticsInto(out, m);
  return out;
}

/** Append one rel→diagnostics map into another (destructive). */
function mergeDiagnosticsInto(out: Map<string, RawDiagnostic[]>, m: Map<string, RawDiagnostic[]> | null): void {
  if (!m) return;
  for (const [rel, ds] of m) {
    const existing = out.get(rel) ?? [];
    out.set(rel, [...existing, ...ds]);
  }
}

/** pack.mcmeta diagnostics for the resolved target version. */
function packMcmetaDiagnostics(mcmetaText: string | null, root: string, targetVersion: string | null, include = true): RawDiagnostic[] {
  if (!include) return [];
  if (mcmetaText === null) {
    return [{
      severity: 1,
      message: 'pack.mcmeta not found or unreadable — every data pack needs this file at its root',
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    }];
  }
  let concrete = targetVersion;
  if (concrete && ['auto', 'latest release', 'latest snapshot'].includes(concrete)) {
    try { concrete = resolveConcreteVersion(concrete); } catch { /* keep raw label */ }
  }
  return scanPackMcmeta(mcmetaText, root, {
    version: concrete,
    dataPackVersion: concrete ? dataPackVersionOf(concrete) : null,
  }).diagnostics;
}

/** Effective version for a data-less pack (pack.mcmeta only, no engine started). */
function noEngineVersion(version: string, minFormat: number | null, maxFormat: number | null): string | null {
  if (version === 'auto' && maxFormat !== null) return resolveVersionForFormatRange(minFormat, maxFormat);
  try { return resolveConcreteVersion(version); }
  catch { return version === 'auto' ? null : version; }
}

/** Read every engine file once; the macro / entity-NBT / gotcha post-scans share these texts. */
function readFileTexts(files: string[], rels: string[]): Map<string, string> {
  const texts = new Map<string, string>();
  for (let i = 0; i < files.length; i++) {
    try { texts.set(rels[i], readFileSync(files[i], 'utf8')); } catch { /* unreadable — scanUnreadableFiles reports it */ }
  }
  return texts;
}

/** Warning for text files that cannot be read at all (not checked silently). */
function unreadableTextFileDiagnostics(files: string[], rels: string[]): Map<string, RawDiagnostic[]> {
  const out = new Map<string, RawDiagnostic[]>();
  for (let i = 0; i < files.length; i++) {
    if (!files[i].endsWith('.mcfunction') && !files[i].endsWith('.json')) continue;
    // openSync is a readability preflight without paying for a second full read of every file;
    // the engine and post-scans still report any mid-read failure through their normal paths.
    let fd: number | undefined;
    try {
      fd = openSync(files[i], 'r');
    } catch (err) {
      out.set(rels[i], [{
        severity: 2,
        message: `[check] file could not be read (${(err as Error).message}) — its contents were not checked`,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      }]);
    } finally {
      if (fd !== undefined) closeSync(fd);
    }
  }
  return out;
}

interface MacroOutcome {
  issuesByRel: Map<string, MacroIssue[]>;
  stats: MacroStats;
  perFileUnchecked: Map<string, number>;
  uncheckedPositions: (MacroUncheckedPosition & { file: string })[];
  /** .mcfunction files that actually contain $() macro lines. */
  applicableFiles: number;
  /** command data was not cached, so macro lines could not be validated. */
  unavailable: boolean;
}

interface NbtOutcome {
  issuesByRel: Map<string, NbtIssue[]>;
  stats: NbtScanStats;
  perFileUnchecked: Map<string, number>;
  uncheckedPositions: (NbtUncheckedPosition & { file: string })[];
  /** .mcfunction files that actually contain summon / data-merge candidates. */
  applicableFiles: number;
  /** vanilla-mcdoc schema was not cached, so entity NBT could not be validated. */
  unavailable: boolean;
}

interface StructureOutcome {
  issuesByRel: Map<string, RawDiagnostic[]>;
}

interface PostScans {
  macro: MacroOutcome | null;
  nbt: NbtOutcome | null;
  structure: StructureOutcome | null;
}

/** Run content post-scans (macro registry IDs + entity NBT + structure NBT). */
function runPostScans(
  opts: CheckOptions,
  datapackRoot: string,
  files: string[],
  rels: string[],
  versionLabel: string | null,
  texts: Map<string, string>,
  dataRoots: string[],
): PostScans {
  return {
    macro: runMacroScan(opts, datapackRoot, files, rels, versionLabel, texts, dataRoots),
    nbt: runEntityNbtScan(opts, datapackRoot, files, rels, versionLabel, texts, dataRoots),
    structure: runStructureNbtScan(files, rels, versionLabel ?? opts.version),
  };
}

/**
 * Scan .mcfunction files for registry IDs inside $ macro lines. Returns null when disabled or
 * nothing to scan (no file contains "$("), so a pack without macros pays nothing.
 */
function runMacroScan(
  opts: CheckOptions,
  datapackRoot: string,
  files: string[],
  rels: string[],
  resolvedVersion: string | null,
  texts: Map<string, string> | undefined,
  dataRoots: string[],
): MacroOutcome | null {
  if (opts.noMacro === true) return null;
  const versionLabel = resolvedVersion ?? opts.version;
  let tree: CommandTree | undefined;
  let regs: Record<string, string[]> = {};
  let declared: Set<string> | undefined;
  const issuesByRel = new Map<string, MacroIssue[]>();
  const perFileUnchecked = new Map<string, number>();
  const uncheckedPositions: (MacroUncheckedPosition & { file: string })[] = [];
  const stats: MacroStats = { lines: 0, checked: 0, unchecked: 0, syntaxChecked: 0, syntaxUnchecked: 0 };
  let applicableFiles = 0;

  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f.endsWith('.mcfunction')) continue;
    let text = texts?.get(rels[i]);
    if (text === undefined) {
      try { text = readFileSync(f, 'utf8'); } catch { continue; }
    }
    if (!/(^|\n)[ \t]*\$(?!\w+\s*=)/.test(text)) continue;
    applicableFiles++;
    // lazy-load the command tree + registries only once a macro line is actually present
    if (!tree) {
      try { tree = loadCommandTree(versionLabel); } catch { return { issuesByRel, stats, perFileUnchecked, uncheckedPositions, applicableFiles, unavailable: true }; }
      regs = loadRegistries(versionLabel);
    }
    if (!declared) declared = buildDeclaredRegistryIds(datapackRoot, dataRoots);
    const r = scanMacroRegistry(f, tree, regs, declared, text);
    const macroUnchecked = r.unchecked + r.syntaxUnchecked;
    if (r.issues.length) issuesByRel.set(rels[i], r.issues);
    if (macroUnchecked > 0) perFileUnchecked.set(rels[i], macroUnchecked);
    for (const pos of r.uncheckedPositions) uncheckedPositions.push({ ...pos, file: rels[i] });
    stats.lines += r.lines;
    stats.checked += r.checked;
    stats.unchecked += r.unchecked;
    stats.syntaxChecked += r.syntaxChecked;
    stats.syntaxUnchecked += r.syntaxUnchecked;
  }
  if (stats.lines === 0) return null;
  return { issuesByRel, stats, perFileUnchecked, uncheckedPositions, applicableFiles, unavailable: false };
}

/**
 * Scan .mcfunction files for entity NBT (summon / `data merge entity`) and validate field names +
 * nested registry IDs against the cached mcdoc schema. Returns null when disabled or when there
 * is nothing to scan; returns unavailable:true when candidate lines exist but the schema isn't
 * cached (the report then says so instead of silently skipping).
 */
function runEntityNbtScan(
  opts: CheckOptions,
  datapackRoot: string,
  files: string[],
  rels: string[],
  resolvedVersion: string | null,
  texts: Map<string, string> | undefined,
  dataRoots: string[],
): NbtOutcome | null {
  if (opts.noEntityNbt === true) return null;
  const versionLabel = resolvedVersion ?? opts.version;

  // Gather candidate files first: a pack without summon/data must not pay for schema loading.
  const candidates: Array<{ file: string; rel: string; text: string }> = [];
  for (let i = 0; i < files.length; i++) {
    const f = files[i];
    if (!f.endsWith('.mcfunction')) continue;
    let text = texts?.get(rels[i]);
    if (text === undefined) {
      try { text = readFileSync(f, 'utf8'); } catch { continue; }
    }
    if (/\bsummon\b/.test(text) || /\bdata\b/.test(text)) candidates.push({ file: f, rel: rels[i], text });
  }
  if (candidates.length === 0) return null;

  let concrete: string;
  try { concrete = resolveConcreteVersion(versionLabel); } catch {
    return { issuesByRel: new Map(), stats: { lines: 0, checked: 0, unchecked: 0 }, perFileUnchecked: new Map(), uncheckedPositions: [], applicableFiles: candidates.length, unavailable: true };
  }
  const schema = loadEntitySchemas(concrete);
  if (!schema) {
    return { issuesByRel: new Map(), stats: { lines: 0, checked: 0, unchecked: 0 }, perFileUnchecked: new Map(), uncheckedPositions: [], applicableFiles: candidates.length, unavailable: true };
  }
  const regs = loadRegistries(concrete);
  const declared = buildDeclaredRegistryIds(datapackRoot, dataRoots);
  const issuesByRel = new Map<string, NbtIssue[]>();
  const perFileUnchecked = new Map<string, number>();
  const uncheckedPositions: (NbtUncheckedPosition & { file: string })[] = [];
  const stats: NbtScanStats = { lines: 0, checked: 0, unchecked: 0 };
  let applicableFiles = 0;

  for (const { file, rel, text } of candidates) {
    const r = scanEntityNbt(file, schema, regs, declared, concrete, text);
    if (r.issues.length) issuesByRel.set(rel, r.issues);
    if (r.unchecked > 0) perFileUnchecked.set(rel, r.unchecked);
    for (const pos of r.uncheckedPositions) uncheckedPositions.push({ ...pos, file: rel });
    stats.lines += r.lines;
    stats.checked += r.checked;
    stats.unchecked += r.unchecked;
    if (r.lines > 0) applicableFiles++;
  }
  if (stats.lines === 0) return null;
  return { issuesByRel, stats, perFileUnchecked, uncheckedPositions, applicableFiles, unavailable: false };
}

/** Binary-NBT structure validation for data/<ns>/structure(s)/*.nbt. */
function runStructureNbtScan(files: string[], rels: string[], versionLabel: string): StructureOutcome | null {
  const issuesByRel = new Map<string, RawDiagnostic[]>();
  for (let i = 0; i < files.length; i++) {
    if (!files[i].endsWith('.nbt')) continue;
    const ds = scanStructureNbt(files[i], rels[i], versionLabel);
    if (ds.length) issuesByRel.set(rels[i], ds);
  }
  return issuesByRel.size ? { issuesByRel } : null;
}


function assembleReport(
  opts: CheckOptions,
  files: string[],
  rels: string[],
  diagnosticsByRel: Map<string, RawDiagnostic[]>,
  failedRels: Set<string>,
  resolvedVersion: string | null,
  macro?: MacroOutcome | null,
  nbt?: NbtOutcome | null,
  texts?: Map<string, string> | null,
  workRoot?: string,
  engineUsed = true,
  auxPacks: AuxPack[] = [],
  versionPlan: VersionPlan | null = null,
  autoDetected: string | null = null,
  includeMcmeta = true,
  overlayFilesSkipped = 0,
  unreadableDirs = 0,
  unreadableFiles = 0,
): CheckResult {
  const useIgnore = opts.ignore?.useIgnore ?? true;
  const ignoreFilter = createIgnoreFilter(opts.ignore ?? { useIgnore: true, extra: [] });
  const noGotchas = opts.noGotchas === true;
  const logCheck = opts.noLog !== true;
  const delta = opts.delta ?? false;
  const baselineFile = opts.baselineFile ?? BASELINE_FILE;
  const engineKind: EngineKind = engineLabel(opts.engine);

  let errorCount = 0, warnCount = 0, ignoredCount = 0, internalErr = 0, issueFiles = 0;
  let knownFpCount = 0, symbolsResolved = 0, scopeHintsCount = 0;
  let deltaChangedFiles = 0, deltaResolvedFiles = 0;
  const lines: string[] = [];
  const byMessage = new Map<string, number>(); // message -> count (non-ignored only)
  const ignoredByMessage = new Map<string, number>(); // message -> count
  const issues: ReportIssue[] = []; // for --json
  const ignoredList: ReportIssue[] = []; // for --json
  const resolvedSymbols: ResolvedSymbolReport[] = [];
  const scopeHints: ScopeHint[] = [];
  const workspacePaths = splitPathList([...(opts.workspace ?? []), ...(opts.additionalDatapacks ?? [])]);
  const resourcePaths = splitPathList(opts.resourcePacks ?? []);
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
  const knownFpEnabled = enabledKnownFpRules(opts.falsePositives, useIgnore);
  const providers: AuxPack[] = [
    { kind: 'current', display: opts.datapack, root: workRoot ?? opts.datapack, symbols: scanPackSymbols(workRoot ?? opts.datapack, true), cleanup: () => {} },
    ...auxPacks,
  ];
  const mcfunctionFileCount = files.filter(f => f.endsWith('.mcfunction')).length;
  // Coverage: files the engine failed to check, macro-line validation stats, auto-filter count.
  const coverage: CheckReport['coverage'] = {
    filesChecked: files.length,
    filesSkipped: failedRels.size,
    engineUsed,
    macroLines: macro?.stats.lines ?? 0,
    macroChecked: macro?.stats.checked ?? 0,
    macroUnchecked: macro?.stats.unchecked ?? 0,
    macroSyntaxChecked: macro?.stats.syntaxChecked ?? 0,
    macroSyntaxUnchecked: macro?.stats.syntaxUnchecked ?? 0,
    macroApplicableFiles: macro?.applicableFiles ?? 0,
    macroNotApplicableFiles: Math.max(0, mcfunctionFileCount - (macro?.applicableFiles ?? 0)),
    nbtLines: nbt?.stats.lines ?? 0,
    nbtChecked: nbt?.stats.checked ?? 0,
    nbtUnchecked: nbt?.stats.unchecked ?? 0,
    nbtApplicableFiles: nbt?.applicableFiles ?? 0,
    nbtNotApplicableFiles: Math.max(0, mcfunctionFileCount - (nbt?.applicableFiles ?? 0)),
    macroUnavailable: macro?.unavailable ?? false,
    nbtUnavailable: nbt?.unavailable ?? false,
    autoFiltered: 0,
    knownFalsePositives: 0,
    macroUncheckedPositions: (macro?.uncheckedPositions ?? []).map(p => ({ ...p, file: p.file })),
    nbtUncheckedPositions: (nbt?.uncheckedPositions ?? []).map(p => ({ ...p, file: p.file })),
    overlayFilesSkipped,
    unreadableDirs,
    unreadableFiles,
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
  const logFiles = workRoot !== opts.datapack ? [opts.datapack] : files;
  const glog: GameLogReport = logCheck ? gameLogReport(opts.datapack, logFiles, opts.minecraftRoot, workRoot ?? opts.datapack) : { found: false };

  const baseline = delta ? loadBaseline(baselineFile, opts.datapack, baseVersion, opts.version) : {};
  const deltaBaselineCounts = { errors: 0, warnings: 0 };
  const deltaNewCounts = { errors: 0, warnings: 0 };
  const deltaResolvedCounts = { errors: 0, warnings: 0 };

  for (let i = 0; i < files.length; i++) {
    const f = files[i], rel = rels[i];
    const ds = diagnosticsByRel.get(rel);
    const prev = baseline[rel];
    const prevCounts = sigCounts(prev?.sig);
    deltaBaselineCounts.errors += prevCounts.errors;
    deltaBaselineCounts.warnings += prevCounts.warnings;

    if (failedRels.has(rel)) {
      // Engine failure is always surfaced, even when a dpkit post-scan also has diagnostics for
      // the same file — otherwise a macro/structural warning could mask a real engine failure.
      internalErr++; issueFiles++;
      if (delta) deltaChangedFiles++;
      const concrete = !['auto', 'latest release', 'latest snapshot'].includes(versionLabel);
      const dataCached = concrete && cachedCommandVersions().has(versionLabel);
      const why = dataCached ? 'see server log'
        : concrete ? `command data for ${versionLabel} is not cached locally — the upstream fetch failed or was never downloaded`
        : 'see server log';
      lines.push(`\n== ${rel} ==  ⚠ server threw during check (${why})`);
    }
    if (!ds) {
      // No diagnostics at all and no engine-failure marker: the check was silently blocked.
      if (!failedRels.has(rel)) {
        internalErr++; issueFiles++;
        if (delta) deltaChangedFiles++;
        lines.push(`\n== ${rel} ==  ⚠ no diagnostics received — check blocked or server error`);
      }
      continue;
    }
    const nonIgnored: RawDiagnostic[] = [];
    for (const d of ds) {
      const effectiveSeverity = d.severity === 4 && isWrongFolderDiagnostic(d.message) ? 2 : d.severity;
      const sev = effectiveSeverity === 1 ? 'E' : effectiveSeverity === 2 ? 'W' : '·';
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

      // Version-aware known-false-positive rules (independent of, and applied before, --ignore).
      const fpText = texts?.get(rel) ?? (() => { try { return readFileSync(f, 'utf8'); } catch { return ''; } })();
      const fp = matchKnownFalsePositive(d, { version: versionLabel, rel, fileText: fpText }, knownFpEnabled);
      if (fp) {
        knownFpCount++;
        ignoredCount++;
        coverage.knownFalsePositives++;
        const key = `[known-fp:${fp.name}] ${d.message}`;
        ignoredByMessage.set(key, (ignoredByMessage.get(key) ?? 0) + 1);
        ignoredList.push({ file: rel, line: d.range.start.line + 1, char: d.range.start.character, severity: sev, message: `${key} — ${fp.description}` });
        continue;
      }

      // Auxiliary symbol providers. Order = current pack > workspaces > resource packs.
      const aux = resolveAuxSymbol(d.message, providers);
      if (aux) {
        if (aux.source === 'current') {
          ignoredCount++;
          coverage.autoFiltered++;
          ignoredByMessage.set(d.message, (ignoredByMessage.get(d.message) ?? 0) + 1);
          ignoredList.push({ file: rel, line: d.range.start.line + 1, char: d.range.start.character, severity: sev, message: `${d.message} — ${aux.note}` });
        } else {
          symbolsResolved++;
          resolvedSymbols.push({
            file: rel,
            line: d.range.start.line + 1,
            char: d.range.start.character,
            symbol: aux.symbol,
            source: aux.source as 'workspace' | 'resource-pack',
            pack: aux.pack,
            note: aux.note,
          });
        }
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

      // Cross-pack symbols without --workspace become scope hints, not errors/warnings.
      const cm = d.message.match(/^Cannot find ([\w/.-]+) [“"]([^”"]+)[”"]/);
      if (useIgnore && knownFpEnabled.has('cross-pack-scope-hint') && workspacePaths.length === 0
          && cm && SCOPE_HINT_CATEGORIES.has(cm[1]) && !cm[2].startsWith('minecraft:') && !cm[2].startsWith('#minecraft:')) {
        scopeHintsCount++;
        scopeHints.push({
          file: rel,
          line: d.range.start.line + 1,
          char: d.range.start.character,
          symbol: `${cm[1]} ${cm[2]}`,
          message: `[scope hint] ${d.message} — not found in this datapack; if it is declared by another datapack, pass --workspace=<pack> (or --additional-datapacks=<pack>)`,
        });
        continue;
      }

      nonIgnored.push(d);
      byMessage.set(d.message, (byMessage.get(d.message) ?? 0) + 1);
      issues.push({ file: rel, line: d.range.start.line + 1, char: d.range.start.character, severity: sev, message: d.message });
      if (effectiveSeverity === 1) errorCount++;
      else if (effectiveSeverity === 2) warnCount++;
    }

    const sig = issueSig(nonIgnored);
    newBaseline.files[rel] = { sig };
    const curCounts = sigCounts(sig);

    // Delta arithmetic: new = issue counts that appeared/increased, resolved = disappeared/decreased.
    if (delta) {
      if (!prev && sig) {
        deltaNewCounts.errors += curCounts.errors;
        deltaNewCounts.warnings += curCounts.warnings;
      } else if (prev && prev.sig !== sig) {
        if (curCounts.errors > prevCounts.errors) deltaNewCounts.errors += curCounts.errors - prevCounts.errors;
        if (curCounts.warnings > prevCounts.warnings) deltaNewCounts.warnings += curCounts.warnings - prevCounts.warnings;
        if (prevCounts.errors > curCounts.errors) deltaResolvedCounts.errors += prevCounts.errors - curCounts.errors;
        if (prevCounts.warnings > curCounts.warnings) deltaResolvedCounts.warnings += prevCounts.warnings - curCounts.warnings;
      }
    }

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
        lines.push(`\n== ${rel} ==  ✓ resolved (previously ${prev.sig.split(String.fromCharCode(10)).length} issue(s))`);
        continue;
      }
      if (!changed) continue; // same issues as last run — nothing new to report
    }

    if (nonIgnored.length === 0) {
      if (coverNote) lines.push(`\n== ${rel} ==${coverNote}`);
      continue; // only ignored diagnostics → effectively clean
    }
    if (!failedRels.has(rel)) issueFiles++;
    if (delta && !failedRels.has(rel)) deltaChangedFiles++;

    lines.push(`\n== ${rel} (${nonIgnored.length}) ==${coverNote}`);
    for (const d of nonIgnored.sort((a, b) => (a.range.start.line - b.range.start.line) || (a.range.start.character - b.range.start.character))) {
      const line = d.range.start.line + 1, ch = d.range.start.character;
      const effectiveSeverity = d.severity === 4 && isWrongFolderDiagnostic(d.message) ? 2 : d.severity;
      const sev = effectiveSeverity === 1 ? 'E' : effectiveSeverity === 2 ? 'W' : '·';
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

  const targetVersion = versionPlan?.targetVersion
    ?? autoDetected
    ?? (resolvedVersion && !['auto', 'latest release', 'latest snapshot'].includes(opts.version) ? opts.version : null);
  const concreteTarget = targetVersion;
  const versionInfo: VersionCheckInfo = {
    target: opts.version,
    targetVersion: concreteTarget,
    actual: resolvedVersion,
    cacheSource: versionPlan ? versionPlan.cacheSource : resolvedVersion ? 'engine resolved' : 'none',
    fallback: versionPlan?.fallback ?? false,
    targetDpv: concreteTarget ? dataPackVersionOf(concreteTarget) : versionPlan?.targetDpv ?? null,
    actualDpv: resolvedVersion ? dataPackVersionOf(resolvedVersion) : versionPlan?.actualDpv ?? null,
    uncheckedRange: versionPlan?.fallback
      ? `requested ${versionPlan.targetVersion} (dpv ${versionPlan.targetDpv ?? '?'}) vs actual ${versionPlan.actualVersion} (dpv ${versionPlan.actualDpv ?? '?'})`
      : 'none',
    message: versionPlan?.message ?? null,
  };

  const report: CheckReport = {
    datapack: opts.datapack,
    ...(opts.datapackSource ? { datapackSource: opts.datapackSource } : {}),
    version: opts.version,
    resolvedVersion,
    versionInfo,
    files: { checked: files.length, clean },
    summary: {
      errors: errorCount,
      warnings: warnCount,
      ignored: ignoredCount,
      internalFailures: internalErr,
      gotchas: gotchaCount,
      symbolsResolved,
      scopeHints: scopeHintsCount,
      knownFalsePositives: knownFpCount,
    },
    issues,
    ignored: ignoredList,
    resolvedSymbols,
    scopeHints,
    gotchas: [...gotchaByFile.entries()].map(([file, items]) => ({ file, items })),
    log: logJson,
    byMessage: agg.map(([message, count]) => ({ message, count })),
    coverage,
    ...(delta ? {
      delta: {
        changedFiles: deltaChangedFiles,
        resolvedFiles: deltaResolvedFiles,
        baseline: deltaBaselineCounts,
        current: { errors: errorCount, warnings: warnCount },
        new: deltaNewCounts,
        resolved: deltaResolvedCounts,
      },
    } : {}),
    engine: engineKind,
    schemaVersion: 1,
  };
  return { report, lines, agg, ignoredAgg, newBaseline };
}

/**
 * After plugins have run, `result.lines` may be stale (it was rendered from the pre-plugin
 * report). Append any report issues that are not already represented so text-mode output shows
 * plugin-added issues too. JSON output is always authoritative because it reads `report.issues`.
 */
function syncPluginLines(result: CheckResult): void {
  const seen = new Set<string>();
  for (const line of result.lines) {
    const t = line.trim();
    if (t.startsWith('[')) seen.add(t);
  }
  const missing: string[] = [];
  for (const issue of result.report.issues) {
    const t = `[${issue.severity}:${issue.line}:${issue.char}] ${issue.message}`;
    if (!seen.has(t)) {
      missing.push(`  ${t}   (${issue.file})`);
      seen.add(t);
    }
  }
  if (missing.length) {
    result.lines.push('', '== plugin-added issues ==', ...missing);
  }
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

export async function listVersions(configured: string, query?: string): Promise<VersionListResult> {
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
  const q = query?.trim() || null;
  const matches = (q ? filterVersionEntries(versions, q) : []).map(v => ({
    id: v.id, type: v.type ?? '?', dpv: v.data_pack_version, hasData: cached.has(String(v.id)),
  }));
  return {
    source: src,
    count: versions.length,
    configured,
    query: q,
    latestRelease: latestRelease ? { id: latestRelease.id, data_pack_version: latestRelease.data_pack_version, hasData: cached.has(latestRelease.id) } : null,
    latestSnapshot: latestSnapshot ? { id: latestSnapshot.id, data_pack_version: latestSnapshot.data_pack_version } : null,
    newerThanConfigured,
    isPinned,
    recent,
    matches,
  };
}

/** --versions search: id prefix/substring, or dpv:<data-pack-version>. */
function filterVersionEntries(versions: McmetaVersion[], query: string): McmetaVersion[] {
  const q = query.trim();
  if (!q) return versions;
  const dpvMatch = /^dpv:(\d+)$/.exec(q);
  if (dpvMatch) {
    const dpv = Number(dpvMatch[1]);
    return versions.filter(v => v.data_pack_version === dpv);
  }
  return versions.filter(v => {
    const id = String(v.id ?? '');
    return id === q || id.startsWith(q) || id.toLowerCase().includes(q.toLowerCase());
  });
}

// ---- gotchas without an engine (pure file scan) ------------------------------
export function scanGotchasStandalone(datapack: string, only = '', version = DEFAULT_VERSION): { file: string; items: GotchaIssue[] }[] {
  if (isZipPath(datapack)) {
    throw new DpkitError('[check] scan_gotchas does not support .zip datapacks yet — run check_datapack instead.', EXIT_USAGE);
  }
  const label = resolveConcreteVersion(version);
  let overlays: ReturnType<typeof scanPackMcmeta>['overlays'] = [];
  try { overlays = scanPackMcmeta(readFileSync(join(datapack, 'pack.mcmeta'), 'utf8')).overlays; } catch { /* pack.mcmeta unreadable — engine/pack check reports it */ }
  const dpv = dataPackVersionOf(label);
  const activeDirs = activeOverlayDirs(overlays, dpv);
  const activeRoots = activeDataRoots(datapack, overlays, dpv);
  const { files, rels } = collectFiles(datapack, only, activeDirs);
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
          if (!declared) declared = buildDeclaredRegistryIds(datapack, activeRoots);
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
export { addIssue, loadPluginModules } from './plugins.js';
