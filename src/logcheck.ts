// logcheck.ts — 游戏日志自检(best-effort):reload 新鲜度 + 数据包加载错误。
// 完全通用:日志路径从数据包自身的 versions 段 / 配置的 minecraftRoot / %APPDATA% 推导,
// 错误行过滤按数据包自己 data/ 下的命名空间匹配,不再写死任何机器或包名。
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
    cand.push(join(parts.slice(0, vi + 2).join('\\'), 'logs', 'latest.log')); // <install>\versions\<ver>\logs
    cand.push(join(parts.slice(0, vi).join('\\'), 'logs', 'latest.log'));     // <install>\logs
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
  // 相关性:该包自己的命名空间 + 通用关键词(无命名空间时只留通用词)
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
