// block-states.ts — per-version block state definitions from Spyglass's per-version data
// (https://api.spyglassmc.com/mcje/versions/{concrete}/block_states), read out of the same local
// HTTP cache the engine uses. Shape (verified against the live API): { [blockId]: [
//   { propertyName: [legalValues...] }, { propertyName: defaultValue } ] } — block ids are BARE
// (no "minecraft:" prefix), and values are JSON strings even for bool/int-backed properties
// ("true"/"false", "0"/"15"). Simple blocks with no states are [{},{}].
// Consumers: the get_block_states MCP tool (registered in a later task), and any future
// minecraft:block_state completion hints. Mirrors registry.ts's memo pattern; the read functions
// take an optional injected loader so unit tests cover the happy path with zero network.
import { DEFAULT_VERSION } from './config.js';
import { cacheIndexMtime, readCachedObject } from './cache.js';
import { resolveConcreteVersion } from './syntax.js';
import { ensureVersionData } from './version-data.js';

/** One block's state definition. */
export interface BlockStatesEntry {
  /** property name → legal values (as strings). */
  properties: Record<string, string[]>;
  /** property name → default value (as a string). */
  defaults: Record<string, string>;
}

/** Full per-version map: bare block id → its states entry. */
export interface BlockStatesData {
  [blockId: string]: BlockStatesEntry;
}

/** Injectable cache reader (unit tests pass a fixture; default reads the real cache). */
export type BlockStatesLoader = (url: string) => unknown | null;

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return v != null && typeof v === 'object' && !Array.isArray(v);
}

/** Validate/coerce one raw entry from the cached block_states object into
 * { properties, defaults }, or null when the shape is malformed. Values are coerced to
 * strings because the API emits "true"/"false"/"1" as JSON strings for bool/int properties.
 * Property-less blocks ([{},{}]) are valid and yield empty maps. */
export function parseBlockStatesEntry(val: unknown): BlockStatesEntry | null {
  if (!Array.isArray(val) || val.length < 2) return null;
  const propsRaw = val[0];
  const defaultsRaw = val[1];
  if (!isPlainObject(propsRaw) || !isPlainObject(defaultsRaw)) return null;
  const properties: Record<string, string[]> = {};
  const defaults: Record<string, string> = {};
  for (const [name, values] of Object.entries(propsRaw)) {
    if (!Array.isArray(values)) return null;
    properties[name] = values.map(String);
  }
  for (const [name, value] of Object.entries(defaultsRaw)) {
    defaults[name] = String(value);
  }
  return { properties, defaults };
}

/** Parse the whole cached block_states object into the validated map (malformed entries are
 * skipped, matching registry.ts's lenient per-entry handling). */
export function parseBlockStates(raw: unknown): BlockStatesData {
  const data: BlockStatesData = {};
  if (isPlainObject(raw)) {
    for (const [id, val] of Object.entries(raw)) {
      const entry = parseBlockStatesEntry(val);
      if (entry) data[id] = entry;
    }
  }
  return data;
}

let memo: { key: string; data: BlockStatesData } | null = null;

/** Load all block states for a version. Returns {} (not throws) when the version can't be
 * resolved or the data isn't cached — callers treat the empty result as a degrade-to-no-op,
 * same as loadRegistries. Memoized by (concrete version, cache index mtime) for the default
 * cache reader only. */
export function loadBlockStates(version: string = DEFAULT_VERSION, load: BlockStatesLoader = readCachedObject): BlockStatesData {
  let concrete: string;
  try { concrete = resolveConcreteVersion(version); } catch { return {}; }
  const url = `https://api.spyglassmc.com/mcje/versions/${concrete}/block_states`;
  if (load === readCachedObject) {
    const key = `${concrete}:${cacheIndexMtime()}`;
    if (memo?.key === key) return memo.data;
    const data = parseBlockStates(load(url));
    memo = { key, data };
    return data;
  }
  return parseBlockStates(load(url));
}

/** Ensure the version's block_states data is cached, downloading it on demand. Resolves
 * 'auto'/'latest release'/'latest snapshot' to a concrete version. Throws
 * CommandDataNotCachedError when a download fails or the version list isn't cached offline. */
export function ensureBlockStates(version: string): Promise<string> {
  return ensureVersionData(version, ['block_states']);
}

/** All block ids (bare) for a version, sorted. Empty when the data isn't cached. */
export function listBlockStates(version: string = DEFAULT_VERSION, load: BlockStatesLoader = readCachedObject): string[] {
  return Object.keys(loadBlockStates(version, load)).sort();
}

/** A block's { properties, defaults }, or undefined when the block isn't in this version (or
 * the data isn't cached). Accepts a "minecraft:"-prefixed id. */
export function getBlockStates(version: string, blockId: string, load: BlockStatesLoader = readCachedObject): BlockStatesEntry | undefined {
  const id = blockId.startsWith('minecraft:') ? blockId.slice('minecraft:'.length) : blockId;
  return loadBlockStates(version, load)[id];
}
