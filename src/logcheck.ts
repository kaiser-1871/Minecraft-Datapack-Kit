// logcheck.ts — game-log self-check (best-effort): reload freshness + datapack load errors.
// Fully generic: the log path is derived from the datapack's own versions segment / the
// configured minecraftRoot / %APPDATA%, and error-line filtering matches namespaces under the
// datapack's own data/ — nothing machine- or pack-specific is hard-coded. Log discovery and
// reading (official / Prism / TLauncher, rotated .log.gz) is delegated to logreader.ts so the
// CLI self-check and the MCP read_logs tool share one implementation.
import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { MAX_LOG_LINES, readGameLogs } from './logreader.js';
import { listDataRoots } from './pack-mcmeta.js';
import type { GameLogReport } from './types.js';

/** Namespaces the datapack itself defines (data/<ns> dirs), for log-line relevance. */
function packNamespaces(datapackRoot: string): string[] {
  const out = new Set<string>();
  for (const dataDir of listDataRoots(datapackRoot)) {
    try {
      for (const e of readdirSync(dataDir, { withFileTypes: true })) {
        if (e.isDirectory()) out.add(e.name);
      }
    } catch { /* no data dir */ }
  }
  return [...out];
}

/** <install> directory when the datapack path sits under <install>/versions/<ver>/saves/… */
function deriveMinecraftRoot(datapack: string): string | null {
  const parts = datapack.split(/[\/]+/);
  const vi = parts.findIndex(p => p === 'versions');
  if (vi > 0) return parts.slice(0, vi).join('/');
  return null;
}

export function gameLogReport(
  datapack: string,
  files: string[],
  minecraftRoot?: string,
  namespacesRoot: string = datapack,
): GameLogReport {
  const derived = deriveMinecraftRoot(datapack);
  let result = derived
    ? readGameLogs({ launcher: 'default', minecraftRoot: derived, lines: MAX_LOG_LINES, tail: true })
    : { success: false as const, launcher: 'default', logs: [] };
  if (!result.success && minecraftRoot) {
    result = readGameLogs({ launcher: 'default', minecraftRoot, lines: MAX_LOG_LINES, tail: true });
  }
  if (!result.success) {
    // Fall back to auto-detection (Prism → default → TLauncher) only when nothing else worked.
    const auto = readGameLogs({ lines: MAX_LOG_LINES, tail: true });
    if (auto.success) result = auto;
  }

  if (!result.success || result.logs.length === 0) return { found: false };

  let text = '';
  let logMtime = 0;
  for (const entry of result.logs) {
    text += entry.content + '\n';
    try { logMtime = Math.max(logMtime, statSync(entry.path).mtimeMs); } catch { /* ignore */ }
  }
  let packNewest = 0;
  for (const f of files) {
    try { packNewest = Math.max(packNewest, statSync(f).mtimeMs); } catch { /* ignore */ }
  }
  const stale = packNewest > logMtime;
  const lastLoaded = [...text.matchAll(/Loaded (\d+) advancements/g)].pop();

  // Include the load-failure summary line and the most common per-file error phrases.
  const errRe = /(Errors in currently selected datapacks|Failed to load|Couldn't parse|Unknown (function|advancement|tag|predicate|item|recipe)|Invalid|Unexpected|Failed to read|Parse error|prevented loading)/i;
  // Relevance: the pack's own namespaces + generic keywords (only generic words when no namespace)
  const nss = packNamespaces(namespacesRoot).map(n => n.replace(/[|\^$+?.()[\]{}]/g, '\$&')).join('|');
  const alternatives = [];
  if (nss) alternatives.push(`(?:${nss}):`);
  alternatives.push('datapack', 'function', 'advancement', 'minecraft:');
  const relevant = new RegExp(`(?:${alternatives.join('|')})`, 'i');

  const hits: string[] = [];
  const ls = text.split('\n');
  for (let i = ls.length - 1; i >= 0 && hits.length < 8; i--) {
    const L = ls[i];
    if (!errRe.test(L)) continue;
    if (/(ReShade|dynamic library)/i.test(L)) continue;
    if (!relevant.test(L)) continue;
    hits.push(L.trim().replace(/\s+/g, ' ').slice(0, 200));
  }

  return {
    found: true,
    log: result.logs[0].path,
    stale,
    lastLoaded: lastLoaded ? lastLoaded[1] : null,
    hits: hits.reverse(),
  };
}
