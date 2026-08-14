// cache.ts — shared access to Spyglass's local HTTP cache (%LOCALAPPDATA%\spyglassmc-nodejs\Cache).
// One place for the cache dir, the index.json read (memoized by index mtime so the engine's
// refresh during a check invalidates it), and object/bytes reads keyed by URL→sha1. Previously
// this logic was copy-pasted across syntax.ts, registry.ts, and vanilla-tags.ts with the
// drift-prone "memo on the index mtime" invariant maintained in three places.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

export function cacheDir(): string {
  return join(process.env.LOCALAPPDATA ?? '', 'spyglassmc-nodejs', 'Cache');
}

export function cacheIndexPath(): string {
  return join(cacheDir(), 'http', 'index.json');
}

/** index.json mtime in ms (0 when absent). Used to key memos so a cache refresh invalidates them. */
export function cacheIndexMtime(): number {
  try { return statSync(cacheIndexPath()).mtimeMs; } catch { return 0; }
}

let indexMemo: { mtime: number; index: unknown } | null = null;

/** The parsed http/index.json (memoized by mtime), or null when unreadable. */
export function readCacheIndex(): unknown {
  const mtime = cacheIndexMtime();
  if (indexMemo?.mtime === mtime) return indexMemo.index;
  let index: unknown = null;
  try { index = JSON.parse(readFileSync(cacheIndexPath(), 'utf8')); } catch { /* unreadable */ }
  indexMemo = { mtime, index };
  return index;
}

function resolveSha1(url: string): string | null {
  const index = readCacheIndex() as { index?: Record<string, Record<string, { sha1?: string }>> } | null;
  return index?.index?.[url]?.['']?.sha1 ?? null;
}

function objectPath(sha1: string): string {
  return join(cacheDir(), 'http', 'objects', sha1.slice(0, 2), sha1);
}

/** Read + JSON.parse a cached object by URL, or null when not cached. */
export function readCachedObject(url: string): unknown {
  const sha1 = resolveSha1(url);
  if (!sha1) return null;
  try { return JSON.parse(readFileSync(objectPath(sha1), 'utf8')); } catch { return null; }
}

/** Read a cached object's raw bytes by URL, or null when not cached. */
export function readCachedBytes(url: string): Buffer | null {
  const sha1 = resolveSha1(url);
  if (!sha1) return null;
  try { return readFileSync(objectPath(sha1)); } catch { return null; }
}
