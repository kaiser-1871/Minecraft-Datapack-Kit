// cache.ts — shared access to Spyglass's local HTTP cache (envPaths('spyglassmc').cache;
// %LOCALAPPDATA%\spyglassmc-nodejs\Cache on Windows).
// One place for the cache dir, the index.json read (memoized by index mtime so the engine's
// refresh during a check invalidates it), and object/bytes reads keyed by URL→sha1. Previously
// this logic was copy-pasted across syntax.ts, registry.ts, and vanilla-tags.ts with the
// drift-prone "memo on the index mtime" invariant maintained in three places.
import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import envPaths from 'env-paths';

/** The engine's own cache root — identical to what makeService() in engine/inproc.ts
 * configures via envPaths('spyglassmc').cache, so post-scan cache reads (macro / entity-NBT /
 * vanilla-tags) never silently fall back to a relative path when %LOCALAPPDATA% is unset. */
export function cacheDir(): string {
  return envPaths('spyglassmc').cache;
}

export function cacheIndexPath(): string {
  return join(cacheDir(), 'http', 'index.json');
}

/** dpkit's own sidecar index. The engine rewrites index.json from its own in-memory state and
 * would drop entries dpkit downloaded on demand — so dpkit writes its additions here and the
 * reader merges both. The engine never touches this file. */
export function cacheIndexSidecarPath(): string {
  return join(cacheDir(), 'http', 'index.dpkit.json');
}

/** max(index.json, index.dpkit.json) mtime in ms (0 when absent). Used to key memos so a cache
 * refresh or an on-demand download invalidates them. */
export function cacheIndexMtime(): number {
  try { return Math.max(statSync(cacheIndexPath()).mtimeMs, statSync(cacheIndexSidecarPath()).mtimeMs); } catch { return 0; }
}

let indexMemo: { mtime: number; index: unknown } | null = null;

/** The parsed http/index.json merged with dpkit's sidecar (memoized by mtime), or null when
 * unreadable. Sidecar entries win — they are dpkit's own on-demand downloads, which the engine
 * may have dropped from its index.json in the meantime. */
export function readCacheIndex(): unknown {
  const mtime = cacheIndexMtime();
  if (indexMemo?.mtime === mtime) return indexMemo.index;
  let index: { index?: Record<string, Record<string, unknown>> } | null = null;
  try { index = JSON.parse(readFileSync(cacheIndexPath(), 'utf8')); } catch { /* unreadable */ }
  try {
    const sidecar = JSON.parse(readFileSync(cacheIndexSidecarPath(), 'utf8')) as { index?: Record<string, Record<string, unknown>> };
    if (sidecar?.index) {
      index ??= { index: {} };
      index.index ??= {};
      for (const [url, entry] of Object.entries(sidecar.index)) index.index[url] = entry;
    }
  } catch { /* no sidecar yet */ }
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
