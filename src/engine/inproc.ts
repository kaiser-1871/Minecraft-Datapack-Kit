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
import { completionItemsOf } from '../lsp-legacy.js';
import type { Logger } from '@spyglassmc/core';
import type { CompletionItemDTO, RawDiagnostic } from '../types.js';
import type { CheckEngine, EngineCheckOptions, EngineCheckResult, EngineCompleteOptions } from './types.js';

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

function makeService(datapack: string, version: string, logger: core.Logger): core.Service {
  const cacheRoot = core.fileUtil.ensureEndingSlash(pathToFileURL(envPaths('spyglassmc').cache).toString());
  const externals = getNodeJsExternals({ cacheRoot, logger });
  // Normalize the project root (lowercases the Windows drive letter) so that
  // `isSubUriOf(watchedUri, root)` matches the URIs the watcher stores — the check in
  // analyzeProject() is case-sensitive (fileUtil.getRelativeUriFromBase).
  const projectRoot = core.normalizeUri(core.fileUtil.ensureEndingSlash(pathToFileURL(datapack).href)) as core.RootUriString;
  return new core.Service({
    isDebugging: false,
    logger,
    profilers: core.ProfilerFactory.noop(),
    project: {
      defaultConfig: core.ConfigService.merge(core.VanillaConfig, { env: { gameVersion: version } }),
      cacheRoot,
      externals,
      initializers: [mcdoc.initialize, je.initialize],
      projectRoots: [projectRoot],
    },
  });
}

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
      const service = makeService(datapack, version, logger);

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

      return { resolvedVersion: resolvedVersionOf(logger), diagnosticsByRel, failedRels };
    },

    async complete(opts: EngineCompleteOptions): Promise<CompletionItemDTO[]> {
      const { datapack, version, file, rel, line, column } = opts;
      const logger = new RecordingLogger();
      const service = makeService(datapack, version, logger);
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
        await service.project.onDidOpen(nUri, languageId, 1, readFileSync(file, 'utf8'));
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
