// vanilla-data.ts — offline access to Misode's "mcmeta" summary data: the vanilla game's own
// data files (loot tables, recipes, advancements, predicates, item modifiers, worldgen, …) per
// version, cached in Spyglass's local HTTP cache via downloadToCache (which accepts any URL).
//
// Data sources (VERIFIED live against github.com/misode/mcmeta, 2026-08):
//   • version list: https://raw.githubusercontent.com/misode/mcmeta/summary/versions/data.min.json
//       (the "summary" BRANCH; a JSON array of { id, type, stable, data_version, ... })
//   • per category: https://raw.githubusercontent.com/misode/mcmeta/{version}-summary/data/{category}/data.min.json
//       ({version}-summary is a git TAG, e.g. "26.2-summary"; {category} is a slash path like
//       "loot_table" or "worldgen/biome"). Each file is a JSON object { [path]: <json> }.
// The misode.py GENERATORS list is a good vocabulary source but its hyphenated site paths are
// WRONG for the data URL (the real dirs are underscore: worldgen/configured_feature, not
// worldgen/configured-feature), and two of its entries — item_modifier and text_component —
// have no summary data at all (both 404). This module therefore keeps its own verified catalog.
import { cacheIndexMtime, readCachedBytes, readCachedObject } from './cache.js';
import { DEFAULT_VERSION } from './config.js';
import { resolveConcreteVersion } from './syntax.js';
import { downloadToCache } from './version-data.js';

/** mcmeta summary version list (the "summary" branch, not a {version}-summary tag). */
export const VANILLA_VERSIONS_URL = 'https://raw.githubusercontent.com/misode/mcmeta/summary/versions/data.min.json';

/**
 * Canonical category paths verified to exist in misode/mcmeta summary data (each has
 * data/{category}/data.min.json). 57 categories; some entries are snapshot-only (26.3+) or
 * release-only, so an uncached category still returns a clean per-version 404 envelope. Names are the actual
 * data-path segments (underscore, and slash for worldgen), NOT the hyphenated misode site paths.
 */
export const VANILLA_CATEGORIES: readonly string[] = [
  // flat data types
  'advancement', 'banner_pattern', 'cat_sound_variant', 'cat_variant', 'chat_type',
  'chicken_sound_variant', 'chicken_variant', 'cow_sound_variant', 'cow_variant',
  'damage_type', 'decorated_pot_pattern', 'dialog', 'dimension', 'dimension_type',
  'enchantment', 'enchantment_provider', 'frog_variant', 'instrument', 'jukebox_song',
  'loot_table', 'number_provider', 'painting_variant', 'pig_sound_variant', 'pig_variant',
  'predicate', 'recipe', 'structure', 'sulfur_cube_archetype', 'test_environment',
  'test_instance', 'timeline', 'trade_set', 'trial_spawner', 'trim_material',
  'trim_pattern', 'villager_trade', 'wolf_variant', 'world_clock', 'zombie_nautilus_variant',
  // worldgen (slash-prefixed)
  'worldgen/biome', 'worldgen/carver', 'worldgen/configured_carver',
  'worldgen/configured_feature', 'worldgen/configured_structure_feature',
  'worldgen/density_function', 'worldgen/feature', 'worldgen/flat_level_generator_preset',
  'worldgen/material_condition', 'worldgen/material_rule', 'worldgen/noise',
  'worldgen/noise_settings', 'worldgen/placed_feature', 'worldgen/processor_list',
  'worldgen/structure', 'worldgen/structure_set', 'worldgen/template_pool',
  'worldgen/world_preset',
];

// Accept the common alternate spellings (misode.py GENERATORS keys + hyphenated site paths) and
// map them back to the canonical path. Built from the canonical list so it can't drift.
const CATEGORY_ALIASES: ReadonlyMap<string, string> = (() => {
  const m = new Map<string, string>();
  for (const p of VANILLA_CATEGORIES) {
    m.set(p, p);                                                   // canonical
    m.set(p.replaceAll('/', '_'), p);                              // worldgen_biome
    m.set(p.replaceAll('/', '-'), p);                              // worldgen-biome
    m.set(p.replaceAll('_', '-'), p);                              // damage-type
    m.set(p.replaceAll('/', '_').replaceAll('_', '-'), p);         // worldgen-configured-carver
  }
  return m;
})();

/** Map a user-supplied category name (any common spelling) to a canonical category path, or
 * undefined when it isn't a known category. */
export function normalizeVanillaCategory(category: string): string | undefined {
  const c = category.trim().toLowerCase();
  if (!c) return undefined;
  return CATEGORY_ALIASES.get(c);
}

/** All supported category paths (the canonical names), in catalog order. */
export function listVanillaCategories(): string[] {
  return [...VANILLA_CATEGORIES];
}

/** Build the raw.githubusercontent.com URL for one (version, category) summary file. */
export function vanillaDataUrl(concreteVersion: string, categoryPath: string): string {
  return `https://raw.githubusercontent.com/misode/mcmeta/${concreteVersion}-summary/data/${categoryPath}/data.min.json`;
}

/** Validate the cached summary payload shape ({ [path]: json }). */
export function parseVanillaFiles(raw: unknown): Record<string, unknown> | null {
  if (raw != null && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>;
  }
  return null;
}

/** Case-insensitive substring search over file keys (sorted); empty query returns all keys. */
export function searchVanillaKeys(files: Record<string, unknown>, query: string): string[] {
  const q = query.trim().toLowerCase();
  const keys = Object.keys(files);
  if (!q) return keys.sort();
  return keys.filter(k => k.toLowerCase().includes(q)).sort();
}

/** Injectable cache reader so unit tests can exercise the happy path with zero network. */
export type VanillaLoader = (url: string) => unknown | null;

export interface VanillaFilesResult {
  ok: boolean;
  version: string;   // concrete
  category: string;  // canonical path
  url: string;
  files: Record<string, unknown>;
  error?: string;
}

export interface VanillaSearchResult {
  ok: boolean;
  version: string;
  category: string;
  url: string;
  matches: string[];
  total: number;
  error?: string;
}

export interface VanillaFileResult {
  ok: boolean;
  version: string;
  category: string;
  path: string;
  file: unknown;
  error?: string;
}

type Resolved = { ok: true; concrete: string; categoryPath: string; url: string } | { ok: false; error: string };

function resolve(version: string, category: string): Resolved {
  const categoryPath = normalizeVanillaCategory(category);
  if (!categoryPath) {
    return { ok: false, error: `Unknown vanilla-data category "${category}". Available: ${VANILLA_CATEGORIES.join(', ')}` };
  }
  let concrete: string;
  try { concrete = resolveConcreteVersion(version); }
  catch (err) { return { ok: false, error: err instanceof Error ? err.message : String(err) }; }
  return { ok: true, concrete, categoryPath, url: vanillaDataUrl(concrete, categoryPath) };
}

let memo: { key: string; files: Record<string, unknown> | null } | null = null;

function readFiles(concrete: string, categoryPath: string, load: VanillaLoader): Record<string, unknown> | null {
  return parseVanillaFiles(load(vanillaDataUrl(concrete, categoryPath)));
}

/** Read a category's full { path: json } map for a version from the local cache. Returns
 * { ok:false, error } when the category is unknown, the version can't be resolved, or the data
 * isn't cached (error names the URL, "run online once to download it"). Memoized by
 * (concrete version, category, cache index mtime) only when using the default cache reader. */
export function getVanillaFiles(version: string = DEFAULT_VERSION, category: string, load: VanillaLoader = readCachedObject): VanillaFilesResult {
  const r = resolve(version, category);
  if (!r.ok) return { ok: false, version, category, url: '', files: {}, error: r.error };
  let files: Record<string, unknown> | null;
  if (load === readCachedObject) {
    const key = `${r.concrete}:${r.categoryPath}:${cacheIndexMtime()}`;
    if (memo?.key === key) {
      files = memo.files;
    } else {
      files = readFiles(r.concrete, r.categoryPath, load);
      memo = { key, files };
    }
  } else {
    files = readFiles(r.concrete, r.categoryPath, load);
  }
  if (files == null) {
    return { ok: false, version: r.concrete, category: r.categoryPath, url: r.url, files: {},
      error: `No vanilla ${r.categoryPath} data cached for version ${r.concrete} (${r.url}). Run online once to download it.` };
  }
  return { ok: true, version: r.concrete, category: r.categoryPath, url: r.url, files };
}

/** Search a category's file keys (case-insensitive substring; empty query = all). */
export function searchVanillaFiles(version: string = DEFAULT_VERSION, category: string, query: string, load: VanillaLoader = readCachedObject): VanillaSearchResult {
  const r = getVanillaFiles(version, category, load);
  if (!r.ok) return { ok: false, version: r.version, category: r.category, url: r.url, matches: [], total: 0, error: r.error };
  const matches = searchVanillaKeys(r.files, query);
  return { ok: true, version: r.version, category: r.category, url: r.url, matches, total: matches.length };
}

/** Read one vanilla file by its key (e.g. "chests/ancient_city" for loot_table). */
export function getVanillaFile(version: string = DEFAULT_VERSION, category: string, path: string, load: VanillaLoader = readCachedObject): VanillaFileResult {
  const r = getVanillaFiles(version, category, load);
  if (!r.ok) return { ok: false, version: r.version, category: r.category, path, file: undefined, error: r.error };
  if (!Object.prototype.hasOwnProperty.call(r.files, path)) {
    return { ok: false, version: r.version, category: r.category, path, file: undefined,
      error: `No "${path}" in ${r.category} for version ${r.version}.` };
  }
  return { ok: true, version: r.version, category: r.category, path, file: r.files[path] };
}

/** Ensure the (version, category) summary file is cached, downloading on demand. Resolves
 * 'auto'/'latest release'/'latest snapshot' via the same concrete-version resolver the rest of
 * dpkit uses. Returns { ok:false, error } (never throws) so MCP callers can surface a clean
 * envelope error for unknown categories, offline cache misses, and 404s (e.g. a version/category
 * mcmeta doesn't have). */
export async function ensureVanillaData(version: string, category: string): Promise<{ ok: boolean; version: string; category: string; url: string; error?: string }> {
  const r = resolve(version, category);
  if (!r.ok) return { ok: false, version, category, url: '', error: r.error };
  if (readCachedBytes(r.url) != null) return { ok: true, version: r.concrete, category: r.categoryPath, url: r.url };
  const dl = await downloadToCache(r.url);
  if (!dl.ok) {
    const notFound = dl.error === 'HTTP 404';
    return { ok: false, version: r.concrete, category: r.categoryPath, url: r.url,
      error: notFound
        ? `No vanilla ${r.categoryPath} data for version ${r.concrete} (${r.url}) — this version/category isn't in misode/mcmeta.`
        : `Failed to download vanilla ${r.categoryPath} data for version ${r.concrete} (${dl.error}); run online once to cache it.` };
  }
  return { ok: true, version: r.concrete, category: r.categoryPath, url: r.url };
}
