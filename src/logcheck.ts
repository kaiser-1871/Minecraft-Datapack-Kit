// logcheck.ts — game-log self-check (best-effort): reload freshness + datapack load errors.
// Fully generic: the log path is derived from the datapack's own versions segment / the
// configured minecraftRoot / %APPDATA%, and error-line filtering matches namespaces under the
// datapack's own data/ — nothing machine- or pack-specific is hard-coded.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { GameLogReport } from './types.js';

/** Namespaces the datapack itself defines (data/<ns> dirs), for log-line relevance. */
function packNamespaces(datapack: string): string[] {
  try {
    return readdirSync(join(datapack, 'data'), { withFileTypes: true })
      .filter(e => e.isDirectory())
      .map(e => e.name);
  } catch { return []; }
}

function findGameLog(datapack: string, minecraftRoot?: string): string | null {
  const parts = datapack.split(/[\\/]+/);
  const cand: string[] = [];
  const vi = parts.findIndex(p => p === 'versions');
  if (vi >= 0) {
    cand.push(join(...parts.slice(0, vi + 2), 'logs', 'latest.log')); // <install>\versions\<ver>\logs
    cand.push(join(...parts.slice(0, vi), 'logs', 'latest.log'));     // <install>\logs
  }
  if (minecraftRoot) cand.push(join(minecraftRoot, 'logs', 'latest.log'));
  cand.push(join(process.env.APPDATA ?? '', '.minecraft', 'logs', 'latest.log'));
  return cand.find(c => { try { return statSync(c).isFile(); } catch { return false; } }) ?? null;
}

export function gameLogReport(datapack: string, files: string[], minecraftRoot?: string): GameLogReport {
  const log = findGameLog(datapack, minecraftRoot);
  if (!log) return { found: false };
  let text = '';
  try { text = readFileSync(log, 'utf8'); } catch { return { found: false }; }
  let packNewest = 0;
  for (const f of files) { try { const s = statSync(f); if (s.mtimeMs > packNewest) packNewest = s.mtimeMs; } catch { /* ignore */ } }
  let logMtime = 0;
  try { logMtime = statSync(log).mtimeMs; } catch { /* ignore */ }
  const stale = packNewest > logMtime;
  const lastLoaded = [...text.matchAll(/Loaded (\d+) advancements/g)].pop();
  const errRe = /(Failed to load|Couldn't parse|Unknown (function|advancement|tag|predicate|item|recipe)|Invalid|Unexpected|Failed to read|Parse error)/i;
  // Relevance: the pack's own namespaces + generic keywords (only generic words when no namespace)
  const nss = packNamespaces(datapack).map(n => n.replace(/[|\\^$+?.()[\]{}]/g, '\\$&')).join('|');
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
  return { found: true, log, stale, lastLoaded: lastLoaded ? lastLoaded[1] : null, hits: hits.reverse() };
}
