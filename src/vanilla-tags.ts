// vanilla-tags.ts — the set of vanilla datapack tags per version, extracted from Spyglass's
// cached vanilla-data tarball. Used by the data-driven false-positive filter: a datapack that
// references "#minecraft:is_magic" without bundling the vanilla tags gets a spurious
// `Cannot find tag/damage_type "minecraft:is_magic"` — those are known false positives.
//
// The tarball is a gzipped tar (magic 1f 8b) whose entries live at data/<ns>/tags/<reg>/<id>.json.
// We only scan headers (name + size), so extraction is cheap and never materializes contents.
// Returns null when the tarball isn't cached for the version (filter degrades to no-op).

import { gunzipSync } from 'node:zlib';
import { cacheIndexMtime, readCachedBytes } from './cache.js';
import { resolveConcreteVersion } from './syntax.js';

let memo: { key: string; tags: Set<string> } | null = null;

/**
 * Set of "registry/tag" (e.g. "damage_type/is_projectile") for every vanilla tag of the
 * version, or null if the vanilla-data tarball isn't cached. Memoized by (version, index mtime).
 */
export function loadVanillaTags(version: string): Set<string> | null {
  let concrete: string;
  try { concrete = resolveConcreteVersion(version); } catch { return null; }
  const key = `${concrete}:${cacheIndexMtime()}`;
  if (memo?.key === key) return memo.tags;

  const raw = readCachedBytes(`https://api.spyglassmc.com/mcje/versions/${concrete}/vanilla-data/tarball`);
  if (!raw) return null;
  let tar: Buffer;
  try {
    tar = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw;
  } catch { return null; }

  const tags = new Set<string>();
  let off = 0;
  while (off + 512 <= tar.length) {
    const name = tar.subarray(off, off + 100).toString('utf8').replace(/\0.*$/, '');
    if (!name) break;
    const sizeStr = tar.subarray(off + 124, off + 136).toString('utf8').replace(/\0.*$/, '').trim();
    const size = parseInt(sizeStr, 8) || 0;
    const m = name.match(/^data\/minecraft\/tags\/([^/]+)\/([^/]+)\.json$/);
    if (m) tags.add(`${m[1]}/${m[2]}`);
    off += 512 + Math.ceil(size / 512) * 512;
  }
  memo = { key, tags };
  return tags;
}
