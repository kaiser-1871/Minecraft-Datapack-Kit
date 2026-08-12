// registry.ts — per-version registry values (mob_effect, attribute, damage_type, …) from
// Spyglass's local HTTP cache. Same cache layout as syntax.ts. Consumers:
//   * --registry=<name>     list a registry's values for a version
//   * the data-driven false-positive filter (src/ignore.ts) — a "Cannot find <reg> X" on a
//     *vanilla* ID is a false positive (the datapack just doesn't declare vanilla registry);
//   * the macro-line registry checker (src/macrocheck.ts) — validate literal IDs in $ lines.
//
// The cached values are BARE ids (e.g. "attack_speed", not "minecraft:attack_speed"), and
// registry keys are bare too (e.g. "attribute", "worldgen/biome"). The command tree's
// `properties.registry` is namespaced ("minecraft:mob_effect") — strip the prefix to index.

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_VERSION } from './config.js';
import { resolveConcreteVersion } from './syntax.js';

function cacheDir(): string {
  return join(process.env.LOCALAPPDATA ?? '', 'spyglassmc-nodejs', 'Cache');
}

function readCachedObject(url: string): unknown {
  const base = cacheDir();
  const indexPath = join(base, 'http', 'index.json');
  let index;
  try { index = JSON.parse(readFileSync(indexPath, 'utf8')); } catch { return null; }
  const rec = index.index?.[url]?.[''];
  if (!rec?.sha1) return null;
  try {
    const objPath = join(base, 'http', 'objects', rec.sha1.slice(0, 2), rec.sha1);
    return JSON.parse(readFileSync(objPath, 'utf8'));
  } catch { return null; }
}

export interface RegistryData {
  /** registry name (bare, e.g. "mob_effect") → array of bare ids. */
  [registry: string]: string[];
}

let memo: { key: string; data: RegistryData } | null = null;

/**
 * Load all registry values for a version. Memoized by (concrete version, cache index mtime)
 * because the engine refreshes the same cache directory during a check — a memo keyed on
 * version alone would serve stale data. Returns {} (not throws) when the data isn't cached.
 */
export function loadRegistries(version: string = DEFAULT_VERSION): RegistryData {
  let concrete: string;
  try { concrete = resolveConcreteVersion(version); } catch { return {}; }
  const base = cacheDir();
  const indexPath = join(base, 'http', 'index.json');
  let mtime = 0;
  try { mtime = statSync(indexPath).mtimeMs; } catch { /* no index yet */ }
  const key = `${concrete}:${mtime}`;
  if (memo?.key === key) return memo.data;
  const url = `https://api.spyglassmc.com/mcje/versions/${concrete}/registries`;
  const raw = readCachedObject(url);
  const data: RegistryData = {};
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    for (const [name, values] of Object.entries(raw as Record<string, unknown>)) {
      if (Array.isArray(values) && values.every(v => typeof v === 'string')) data[name] = values as string[];
    }
  }
  memo = { key, data };
  return data;
}

/** Normalize a registry name from the command tree ("minecraft:mob_effect") to the bare cache key. */
export function normalizeRegistryName(name: string): string {
  return name.startsWith('minecraft:') ? name.slice('minecraft:'.length) : name;
}

/** The list of registry names we have data for (sorted), with value counts. */
export function registryIndex(version: string = DEFAULT_VERSION): { name: string; count: number }[] {
  const data = loadRegistries(version);
  return Object.keys(data).sort().map(name => ({ name, count: data[name].length }));
}

/** Values of one registry (bare ids), or undefined if that registry isn't cached. */
export function listRegistryValues(version: string, name: string): string[] | undefined {
  return loadRegistries(version)[normalizeRegistryName(name)];
}
