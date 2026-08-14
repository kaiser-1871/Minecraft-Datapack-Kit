// inproc.ts — the default engine: drives @spyglassmc/core's Project in-process (no
// subprocess, no LSP protocol). Mirrors how language-server/lib/server.js constructs
// its Service, so behavior matches the LSP path — which is why --engine=lsp is kept
// as the parity reference.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import * as core from '@spyglassmc/core';
import { getNodeJsExternals } from '@spyglassmc/core/lib/nodejs.js';
import * as je from '@spyglassmc/java-edition';
import * as mcdoc from '@spyglassmc/mcdoc';
import envPaths from 'env-paths';
import { InProcFileWatcher } from './inproc-file-watcher.js';
import { completionItemsOf } from '../completion-map.js';
import type { Logger } from '@spyglassmc/core';
import type { CompletionItemDTO, RawDiagnostic } from '../types.js';
import type { CheckEngine, EngineCheckOptions, EngineCheckResult, EngineCompleteOptions, EngineSnapshot } from './types.js';

/** Captures logger output (quiet by default) so we can recover the resolved version. */
class RecordingLogger implements Logger {
  readonly lines: string[] = [];
  error(): void {}
  info(data: unknown, ...args: unknown[]): void { this.#capture(data, args); }
  log(): void {}
  warn(): void {}

  #capture(data: unknown, args: unknown[]): void {
    const parts = [data, ...args]
      .map(a => (typeof a === 'string' ? a : safeStringify(a)))
      .filter(s => s !== '');
    if (parts.length) this.lines.push(parts.join(' '));
  }
}

function safeStringify(v: unknown): string {
  try { return JSON.stringify(v) ?? String(v); } catch { return String(v); }
}

function makeService(datapack: string, version: string, logger: core.Logger, noGotchas: boolean): core.Service {
  const cacheRoot = core.fileUtil.ensureEndingSlash(pathToFileURL(envPaths('spyglassmc').cache).toString());
  const externals = getNodeJsExternals({ cacheRoot, logger });
  // Normalize the project root (lowercases the Windows drive letter) so that
  // `isSubUriOf(watchedUri, root)` matches the URIs the watcher stores — the check in
  // analyzeProject() is case-sensitive (fileUtil.getRelativeUriFromBase).
  const projectRoot = core.normalizeUri(core.fileUtil.ensureEndingSlash(pathToFileURL(datapack).href)) as core.RootUriString;
  // Gotcha heuristics live in the engine now (java-edition linter); --no-gotchas disables the
  // rules at the config level so the engine never runs them.
  const env: Record<string, unknown> = { gameVersion: version, enableMcdocCaching: true };
  if (noGotchas) {
    env.lint = {
      gotchaAttributeMultiplier: null,
      gotchaNbtFieldCasing: null,
      gotchaParticleBareId: null,
    };
  }
  return new core.Service({
    isDebugging: false,
    logger,
    profilers: core.ProfilerFactory.noop(),
    project: {
      defaultConfig: core.ConfigService.merge(core.VanillaConfig, { env }),
      cacheRoot,
      externals,
      initializers: [mcdoc.initialize, je.initialize],
      projectRoots: [projectRoot],
    },
  });
}

/** Fallback: recover the resolved version from the engine log line
 * "[resolveConfiguredVersion] … selecting version <id>". Prefer the formal
 * `project.ctx.loadedVersion` (set by the java-edition initializer) above this. */
function resolvedVersionOf(logger: RecordingLogger): string | null {
  let out: string | null = null;
  for (const l of logger.lines) {
    const m = l.match(/selecting version (\S+)/);
    if (m) out = m[1];
  }
  return out;
}

export function createInProcEngine(): CheckEngine {
  const engine: CheckEngine = {
    async check(opts: EngineCheckOptions): Promise<EngineCheckResult> {
      const { datapack, version, files, rels } = opts;
      const logger = new RecordingLogger();
      const service = makeService(datapack, version, logger, opts.noGotchas === true);

      const uriToRel = new Map<string, string>();
      for (let i = 0; i < files.length; i++) uriToRel.set(core.normalizeUri(pathToFileURL(files[i]).href), rels[i]);

      const diagnosticsByRel = new Map<string, RawDiagnostic[]>();
      const seen = new Set<string>();

      service.project.on('documentErrored', ({ errors, uri }) => {
        const rel = uriToRel.get(core.normalizeUri(uri));
        if (rel === undefined) return; // not part of the dpkit file set (pack.mcmeta, deps, …)
        seen.add(rel);
        diagnosticsByRel.set(rel, errors.map(e => ({
          // Spyglass severity (Error=3 … Hint=0) → LSP severity (Error=1 … Hint=4).
          severity: 4 - e.severity,
          message: e.message,
          range: {
            start: { line: e.posRange.start.line, character: e.posRange.start.character },
            end: { line: e.posRange.end.line, character: e.posRange.end.character },
          },
        })));
      });

      try {
        await service.project.init();
        const watcher = new InProcFileWatcher({
          externals: service.project.externals,
          locations: [service.project.projectRoots[0]],
          predicate: (uri) => !service.project.shouldExclude(uri),
        });
        await service.project.ready({ projectRootsWatcher: watcher });
        await service.project.analyzeProject();
      } finally {
        await service.project.close();
      }

      // Any dpkit-set file that never emitted documentErrored → the check failed for it.
      const failedRels = new Set<string>();
      for (const rel of rels) if (!seen.has(rel)) failedRels.add(rel);

      // Formal API first (java-edition's initialize returns { loadedVersion, errorSource } which
      // core merges into project.ctx); fall back to the log regex if it's somehow absent.
      const resolvedVersion = service.project.ctx.loadedVersion ?? resolvedVersionOf(logger);
      return { resolvedVersion, diagnosticsByRel, failedRels };
    },

    async complete(opts: EngineCompleteOptions): Promise<CompletionItemDTO[]> {
      const { datapack, version, file, rel, line, column } = opts;
      const logger = new RecordingLogger();
      const service = makeService(datapack, version, logger, false);
      const nUri = core.normalizeUri(pathToFileURL(file).href);
      const languageId = file.endsWith('.mcfunction') ? 'mcfunction' : 'json';
      try {
        await service.project.init();
        const watcher = new InProcFileWatcher({
          externals: service.project.externals,
          locations: [service.project.projectRoots[0]],
          predicate: (uri) => !service.project.shouldExclude(uri),
        });
        await service.project.ready({ projectRootsWatcher: watcher });
        // Mirrors the LSP onCompletion handler: open the file client-side, force a
        // bind+check, then ask the Service for completions at the offset.
        await service.project.onDidOpen(nUri, languageId, 1, opts.text ?? readFileSync(file, 'utf8'));
        const dand = await service.project.ensureClientManagedChecked(nUri);
        if (!dand) return [];
        const offset = dand.doc.offsetAt({ line: line - 1, character: column - 1 });
        const items = service.complete(dand.node, dand.doc, offset);
        return completionItemsOf(items);
      } finally {
        await service.project.close();
      }
    },

    async close(): Promise<void> { /* each op closes its own project */ },
  };

  return engine;
}

interface PoolEntry {
  service: core.Service;
  logger: RecordingLogger;
  /** URI → data/-relative path for the current check (swapped fresh per check). */
  uriToRel: Map<string, string>;
  /** Diagnostics collected for the current check (swapped fresh per check). */
  current: Map<string, RawDiagnostic[]>;
  /** Per-URI TextDocument version counter for onDidOpen (must increment monotonically). */
  docVersions: Map<string, number>;
  /** Serializes check/complete/updateFile ops on this entry. MCP's tools/call handler does
   * not serialize concurrent calls, so overlapping ops on one `datapack@@version` entry would
   * otherwise race on the shared uriToRel/current slots and the open documents. */
  opQueue: Promise<unknown>;
}

/** Chain `op` onto the entry's op queue so concurrent ops on one entry run one at a time.
 * The queue promise itself never rejects (a failed op still rejects the caller's returned
 * promise), so one failed call can't wedge every later call on the entry. */
function enqueue<T>(entry: PoolEntry, op: () => Promise<T>): Promise<T> {
  const run = entry.opQueue.then(op);
  entry.opQueue = run.then(() => undefined, () => undefined);
  return run;
}

/** A pooled in-process engine: reuses one Service per `datapack@@version` across calls,
 * avoiding the repeated init() (downloads + config + initializers) and ready() (symbol-table
 * population) of the one-shot engine. Intended for the long-lived MCP server. */
export function createInProcEnginePool(): CheckEngine {
  const entries = new Map<string, PoolEntry>();
  /** The entry most recently used by check() — updateFile/snapshot operate on it. */
  let last: PoolEntry | null = null;

  async function acquire(datapack: string, version: string, noGotchas: boolean): Promise<PoolEntry> {
    const key = `${datapack}@@${version}@@${noGotchas ? 'nogotchas' : 'gotchas'}`;
    const existing = entries.get(key);
    if (existing) return existing;

    const logger = new RecordingLogger();
    const service = makeService(datapack, version, logger, noGotchas);
    const entry: PoolEntry = { service, logger, uriToRel: new Map(), current: new Map(), docVersions: new Map(), opQueue: Promise.resolve() };

    // One persistent listener per entry — it always writes into `entry.current` (which the
    // caller swaps out per check), so listeners never accumulate across checks.
    service.project.on('documentErrored', ({ errors, uri }) => {
      const rel = entry.uriToRel.get(core.normalizeUri(uri));
      if (rel === undefined) return; // not part of the dpkit file set (pack.mcmeta, deps, …)
      entry.current.set(rel, errors.map(e => ({
        // Spyglass severity (Error=3 … Hint=0) → LSP severity (Error=1 … Hint=4).
        severity: 4 - e.severity,
        message: e.message,
        range: {
          start: { line: e.posRange.start.line, character: e.posRange.start.character },
          end: { line: e.posRange.end.line, character: e.posRange.end.character },
        },
      })));
    });

    try {
      await service.project.init();
      const watcher = new InProcFileWatcher({
        externals: service.project.externals,
        locations: [service.project.projectRoots[0]],
        predicate: (uri) => !service.project.shouldExclude(uri),
      });
      await service.project.ready({ projectRootsWatcher: watcher });
    } catch (err) {
      // A failed init/ready should not poison the pool — drop the entry and rethrow.
      try { await service.project.close(); } catch { /* ignore */ }
      throw err;
    }

    entries.set(key, entry);
    return entry;
  }

  const engine: CheckEngine = {
    async check(opts: EngineCheckOptions): Promise<EngineCheckResult> {
      const { datapack, version, files, rels } = opts;
      const entry = await acquire(datapack, version, opts.noGotchas === true);
      // Serialize against other concurrent ops on this entry: MCP does not serialize
      // tools/call, and two overlapping checks would otherwise swap uriToRel/current out
      // from under each other's documentErrored listener.
      return enqueue(entry, async () => {
        const uriToRel = new Map<string, string>();
        for (let i = 0; i < files.length; i++) uriToRel.set(core.normalizeUri(pathToFileURL(files[i]).href), rels[i]);
        const diagnosticsByRel = new Map<string, RawDiagnostic[]>();
        entry.uriToRel = uriToRel;
        entry.current = diagnosticsByRel;
        last = entry;

        await entry.service.project.analyzeProject();

        const failedRels = new Set<string>();
        for (const rel of rels) if (!diagnosticsByRel.has(rel)) failedRels.add(rel);

        const resolvedVersion = entry.service.project.ctx.loadedVersion ?? resolvedVersionOf(entry.logger);
        return { resolvedVersion, diagnosticsByRel, failedRels };
      });
    },

    async complete(opts: EngineCompleteOptions): Promise<CompletionItemDTO[]> {
      const { datapack, version, file, line, column } = opts;
      const entry = await acquire(datapack, version, false);
      return enqueue(entry, async () => {
        const nUri = core.normalizeUri(pathToFileURL(file).href);
        const languageId = file.endsWith('.mcfunction') ? 'mcfunction' : 'json';
        await entry.service.project.onDidOpen(nUri, languageId, 1, opts.text ?? readFileSync(file, 'utf8'));
        const dand = await entry.service.project.ensureClientManagedChecked(nUri);
        if (!dand) return [];
        const offset = dand.doc.offsetAt({ line: line - 1, character: column - 1 });
        return completionItemsOf(entry.service.complete(dand.node, dand.doc, offset));
      });
    },

    /** Incremental update: re-open ONE changed file with fresh text. onDidOpen re-parses,
     * re-binds and re-checks it in place; the documentErrored listener refreshes that rel's
     * diagnostics in `entry.current` (all other rels keep their previous entries). Only valid
     * after a check() call. */
    async updateFile(opts: { rel: string; file: string; text: string }): Promise<void> {
      if (!last) throw new Error('[dpkit] updateFile() before any check()');
      // Watch path only (CLI --watch): it runs check → updateFile → snapshot sequentially on a
      // single entry, so `last` is stable here. Still queue the update so the version counter
      // and re-bind stay serialized with any check() on the same entry.
      const entry = last;
      await enqueue(entry, async () => {
        const nUri = core.normalizeUri(pathToFileURL(opts.file).href);
        const languageId = opts.file.endsWith('.mcfunction') ? 'mcfunction' : 'json';
        const next = (entry.docVersions.get(nUri) ?? 0) + 1;
        entry.docVersions.set(nUri, next);
        await entry.service.project.onDidOpen(nUri, languageId, next, opts.text);
        // onDidOpen alone does NOT emit documentUpdated in the new core; ensureClientManagedChecked
        // does (which fans out to documentErrored and refreshes the entry's diagnostics).
        await entry.service.project.ensureClientManagedChecked(nUri);
      });
    },

    snapshot(): EngineSnapshot {
      // Called after a check/updateFile burst; returns the pool's live diagnostics map.
      // Synchronous and queue-free on purpose: the watch loop awaits each queued
      // check()/updateFile() before calling snapshot(), so `last.current` is already a
      // consistent snapshot — no concurrent op can be mid-swap here.
      if (!last) return { diagnosticsByRel: new Map(), resolvedVersion: null };
      return {
        diagnosticsByRel: last.current,
        resolvedVersion: last.service.project.ctx.loadedVersion ?? resolvedVersionOf(last.logger),
      };
    },

    async close(): Promise<void> {
      // Close each entry behind its op queue so a still-running check/complete/updateFile
      // finishes before we tear its Service down.
      const closers: Promise<void>[] = [];
      for (const entry of entries.values()) {
        closers.push(enqueue(entry, async () => {
          try { await entry.service.project.close(); } catch { /* ignore */ }
        }));
      }
      await Promise.all(closers);
      entries.clear();
    },
  };

  return engine;
}
