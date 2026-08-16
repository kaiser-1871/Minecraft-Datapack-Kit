// symbol-providers.ts — read-only symbol tables for auxiliary datapacks (--workspace /
// --additional-datapacks) and resource packs (--resource-pack / --resource-packs).
//
// Auxiliary packs are NEVER checked or validated here: they only answer "does another pack
// declare this function / tag / advancement / loot table / predicate / item modifier / recipe /
// sound event / font / translation key?". Resource packs are limited to sounds.json, font IDs,
// and lang keys — no textures/models/blockstates/atlas, no pack_format validation.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { listDataRoots } from './pack-mcmeta.js';
import { extractZipDatapack, isZipPath } from './zip-datapack.js';

export interface PackSymbols {
  functions: Set<string>;
  tags: Map<string, Set<string>>;
  advancements: Set<string>;
  lootTables: Set<string>;
  predicates: Set<string>;
  itemModifiers: Set<string>;
  recipes: Set<string>;
  soundEvents: Set<string>;
  fonts: Set<string>;
  translations: Set<string>;
}

export type AuxKind = 'current' | 'workspace' | 'resource-pack';

export interface AuxPack {
  kind: AuxKind;
  /** Original user-facing path (zip path stays the .zip). */
  display: string;
  /** Directory to scan (for zips: the temp extraction root). */
  root: string;
  symbols: PackSymbols;
  cleanup: () => void;
}

export function emptySymbols(): PackSymbols {
  return {
    functions: new Set(),
    tags: new Map(),
    advancements: new Set(),
    lootTables: new Set(),
    predicates: new Set(),
    itemModifiers: new Set(),
    recipes: new Set(),
    soundEvents: new Set(),
    fonts: new Set(),
    translations: new Set(),
  };
}

function walk(base: string, visit: (file: string, rel: string) => void): void {
  const rec = (dir: string): void => {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      if (e.name.startsWith('.')) continue;
      const p = join(dir, e.name);
      if (e.isDirectory()) rec(p);
      else if (e.isFile()) visit(p, p.slice(base.length + 1).replaceAll(String.fromCharCode(92), '/'));
    }
  };
  rec(base);
}

function jsonObjectKeys(file: string): string[] {
  try {
    const obj = JSON.parse(readFileSync(file, 'utf8'));
    return obj && typeof obj === 'object' && !Array.isArray(obj) ? Object.keys(obj) : [];
  } catch {
    return []; // read-only provider: malformed provider files are simply not symbols
  }
}

/** Scan a datapack/resource-pack root for symbols. `includeData` controls data/ symbol paths. */
export function scanPackSymbols(root: string, includeData: boolean): PackSymbols {
  const symbols = emptySymbols();

  if (includeData) {
    for (const dataDir of listDataRoots(root)) {
      walk(dataDir, (_file, rel) => {
        const segs = rel.split('/');
        if (segs.length < 3) return;
        const ns = segs[0];
        const kind = segs[1];
        const rest = segs.slice(2).join('/');

        if (kind === 'function' && rel.endsWith('.mcfunction')) {
          symbols.functions.add(`${ns}:${rest.slice(0, -'.mcfunction'.length)}`);
        } else if (kind === 'tags' && rest.endsWith('.json')) {
          const registry = segs[2];
          const id = segs.slice(3).join('/').slice(0, -'.json'.length);
          let set = symbols.tags.get(registry);
          if (!set) symbols.tags.set(registry, set = new Set());
          set.add(`${ns}:${id}`);
        } else if (kind === 'advancement' || kind === 'loot_table' || kind === 'predicate'
          || kind === 'item_modifier' || kind === 'recipe' || kind === 'sound_event') {
          if (!rest.endsWith('.json')) return;
          const id = rest.slice(0, -'.json'.length);
          const target = kind === 'advancement' ? symbols.advancements
            : kind === 'loot_table' ? symbols.lootTables
            : kind === 'predicate' ? symbols.predicates
            : kind === 'item_modifier' ? symbols.itemModifiers
            : kind === 'recipe' ? symbols.recipes
            : symbols.soundEvents;
          target.add(`${ns}:${id}`);
        }
      });
    }
  }

  // Resource-pack symbol surface (also accepted from datapack directories when present):
  walk(join(root, 'assets'), (_file, rel) => {
    const segs = rel.split('/');
    if (segs.length < 2) return;
    const ns = segs[0];
    if (segs.length === 2 && segs[1] === 'sounds.json') {
      for (const key of jsonObjectKeys(_file)) symbols.soundEvents.add(`${ns}:${key}`);
    } else if (segs.length === 3 && segs[1] === 'font' && segs[2].endsWith('.json')) {
      symbols.fonts.add(`${ns}:${segs[2].slice(0, -'.json'.length)}`);
    } else if (segs.length === 3 && segs[1] === 'lang' && segs[2].endsWith('.json')) {
      for (const key of jsonObjectKeys(_file)) symbols.translations.add(key);
    }
  });

  return symbols;
}

/**
 * Prepare one or more auxiliary paths (directories or .zip archives) as read-only providers.
 * Zip providers are extracted into temp dirs and cleaned up by the caller.
 */
export async function prepareAuxPacks(paths: string[], kind: AuxKind): Promise<AuxPack[]> {
  const out: AuxPack[] = [];
  for (const raw of splitPathList(paths)) {
    const display = raw.trim();
    if (!display) continue;
    let st;
    try { st = statSync(display); } catch {
      throw new Error(`auxiliary pack path not found: ${display}`);
    }
    let root = display;
    let cleanup = (): void => {};
    if (st.isFile()) {
      if (!isZipPath(display)) throw new Error(`auxiliary pack path is not a .zip archive: ${display}`);
      const extracted = await extractZipDatapack(display);
      root = extracted.root;
      cleanup = extracted.cleanup;
    } else if (!st.isDirectory()) {
      throw new Error(`auxiliary pack path is neither a directory nor a .zip file: ${display}`);
    }
    out.push({ kind, display, root, symbols: scanPackSymbols(root, kind !== 'resource-pack'), cleanup });
  }
  return out;
}

/** Split a comma-separated CLI list into non-empty entries (also accepts repeated flags). */
export function splitPathList(values: string[] | undefined): string[] {
  return (values ?? []).flatMap(v => v.split(',')).map(s => s.trim()).filter(Boolean);
}

export interface ResolvedAuxSymbol {
  source: AuxKind;
  pack: string;
  symbol: string;
  note: string;
}

/**
 * Match a "Cannot find <category> “<id>”" diagnostic against the providers in order.
 * Provider order encodes precedence (current pack, then workspaces, then resource packs).
 */
export function resolveAuxSymbol(msg: string, providers: AuxPack[]): ResolvedAuxSymbol | null {
  const m = msg.match(/^Cannot find ([\w/.-]+) [“"]([^”"]+)[”"]/);
  if (!m) return null;
  const category = m[1];
  let id = m[2];
  if (id.startsWith('#')) id = id.slice(1);

  const tag = category.startsWith('tag/');
  const tagRegistry = tag ? category.slice('tag/'.length) : null;

  const setHas = (set: Set<string>): boolean => {
    if (set.has(id)) return true;
    if (id.endsWith(':*')) {
      const ns = id.slice(0, -2);
      for (const v of set) if (v.startsWith(`${ns}:`)) return true;
    }
    return false;
  };

  for (const provider of providers) {
    const s = provider.symbols;
    let hit = false;
    if (tag && tagRegistry) {
      const set = s.tags.get(tagRegistry);
      hit = set ? setHas(set) : false;
    } else {
      switch (category) {
        case 'function': hit = setHas(s.functions); break;
        case 'advancement': hit = setHas(s.advancements); break;
        case 'loot_table': hit = setHas(s.lootTables); break;
        case 'predicate': hit = setHas(s.predicates); break;
        case 'item_modifier': hit = setHas(s.itemModifiers); break;
        case 'recipe': hit = setHas(s.recipes); break;
        case 'sound_event': hit = setHas(s.soundEvents); break;
        case 'font': hit = setHas(s.fonts); break;
        case 'translate':
        case 'translation':
          hit = s.translations.has(id);
          break;
        default:
          hit = false;
      }
    }
    if (hit) {
      const symbol = `${category} ${m[2]}`;
      if (provider.kind === 'resource-pack') {
        return { source: 'resource-pack', pack: provider.display, symbol, note: 'resolved from resource pack (auxiliary symbol only, not validated)' };
      }
      if (provider.kind === 'current') {
        return { source: 'current', pack: provider.display, symbol, note: 'resolved from the current datapack (engine missed a declared symbol)' };
      }
      return { source: 'workspace', pack: provider.display, symbol, note: `resolved from workspace datapack ${provider.display} (symbol provider only, not checked)` };
    }
  }
  return null;
}
