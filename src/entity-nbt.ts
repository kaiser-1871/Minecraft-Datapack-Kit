// entity-nbt.ts — per-version entity NBT field schema + a summon/data NBT scanner.
//
// Ground truth is Spyglass's vanilla-mcdoc tarball (cached at
// https://api.spyglassmc.com/vanilla-mcdoc/tarball, the same schema the engine validates NBT
// against). The struct definitions under java/world/entity/** carry each serialized field with
// #[since=]/#[until=] game-version annotations, so ONE (latest) schema answers "is field X valid
// in version V" for any V. We parse the .mcdoc files with @spyglassmc/mcdoc's real parser — the
// same one the engine itself uses — and walk the AST for:
//   * `struct Name { … }` definitions (fields + `...Spread`s, with since/until/id annotations);
//   * `dispatch minecraft:entity[…] to …` statements, mapping each entity type to its struct.
// We resolve spreads by their last path segment (entity-relevant struct names are unique), then
// scan summon/data NBT for:
//   1. fields removed in / not yet available in the target version (HandItems → equipment, …);
//   2. registry IDs inside #[id(registry=…)]-annotated fields that no longer exist (e.g.
//      DeathLootTable:"minecraft:empty" in a version where it was removed).
//
// Conservative by construction (mirrors macrocheck.ts): an unknown entity type / custom
// namespace / parse desync / missing schema marks the position unchecked and NEVER warns.
// A .mcdoc file whose parse reports any error is skipped entirely (0 of 241 files as of the
// current tarball), so a future schema/parser mismatch degrades to fewer checks, never wrong ones.

import { readFileSync } from 'node:fs';
import { gunzipSync } from 'node:zlib';
import * as core from '@spyglassmc/core';
import * as mcdoc from '@spyglassmc/mcdoc';
import { TextDocument } from 'vscode-languageserver-textdocument';
import { cacheIndexMtime, readCachedBytes } from './cache.js';
import type { RegistryData } from './registry.js';
import { resolveConcreteVersion } from './syntax.js';
import { compareGameVersions } from './version.js';

const MCDOC_TARBALL = 'https://api.spyglassmc.com/vanilla-mcdoc/tarball';

export interface FieldInfo {
  /** Game version this field was introduced in (inclusive). */
  since?: string;
  /** Game version this field was removed in (exclusive). */
  until?: string;
  /** Bare registry name from #[id(registry=…)] — nested IDs are validated against it. */
  registry?: string;
}

export interface NbtIssue { line: number; key: string; msg: string; }

export interface NbtScanStats {
  /** summon/data-entity lines carrying an NBT compound. */
  lines: number;
  /** top-level field positions judged (name against schema, or ID against a registry). */
  checked: number;
  /** top-level field positions skipped (unknown entity/field, macro, desync, custom ns). */
  unchecked: number;
}

export interface NbtUncheckedPosition {
  /** 1-based line number. */
  line: number;
  reason: string;
  detail: string;
}

export interface NbtScanResult extends NbtScanStats {
  issues: NbtIssue[];
  /** File-locatable positions the scanner could not judge. */
  uncheckedPositions: NbtUncheckedPosition[];
}

export interface EntitySchemaData {
  /** entity type (bare, no minecraft:) → resolved top-level field map (any-version union). */
  entities: Map<string, Map<string, FieldInfo>>;
  /** global field name → registry, for `data merge entity` where the entity type is unknown. */
  registryFields: Map<string, string>;
}

// ---- low-level text helpers ----------------------------------------------------

/** Index of the closing " of the string that opens at i (handles \\ escapes), or text.length. */
function skipQuoted(text: string, i: number): number {
  const q = text[i];
  for (let j = i + 1; j < text.length; j++) {
    if (text[j] === '\\') { j++; continue; }
    if (text[j] === q) return j;
  }
  return text.length;
}

/** Index of the '}' matching the '{' at openIdx (handles " strings and nested braces). */
function braceMatch(text: string, openIdx: number): number {
  let depth = 0;
  for (let i = openIdx; i < text.length; i++) {
    const c = text[i];
    if (c === '"') { i = skipQuoted(text, i); continue; }
    if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) return i; }
  }
  return -1;
}

// ---- mcdoc parsing (real parser from @spyglassmc/mcdoc) ------------------------

interface SpreadRef { name: string; since?: string; until?: string; }
interface StructDef { fields: Map<string, FieldInfo>; spreads: SpreadRef[]; }

const NOOP_LOGGER = {
  error(): void {},
  info(): void {},
  log(): void {},
  warn(): void {},
} as core.Logger;

// The mcdoc parser only reports errors into `err` (it never touches doc/fs/project), so the
// other ParserContext fields are stubs. MetaRegistry and the dummy TextDocument are shared.
let parseMeta: core.MetaRegistry | null = null;
const PARSE_DOC = TextDocument.create('dpkit-internal:///schema.mcdoc', 'mcdoc', 1, '');

/** Parse one .mcdoc module; null when ANY parser error occurred (don't trust that file). */
function parseModule(text: string): mcdoc.ModuleNode | null {
  const src = new core.Source(text);
  const err = new core.ErrorReporter('dpkit-internal:///schema.mcdoc');
  const ctx = {
    doc: PARSE_DOC,
    err,
    meta: parseMeta ??= new core.MetaRegistry(),
    config: {},
    logger: NOOP_LOGGER,
    fs: undefined,
    isDebugging: false,
    profilers: undefined,
    project: {},
    roots: [],
  } as unknown as core.ParserContext;
  const node = mcdoc.module_(src, ctx);
  if (typeof node === 'symbol') return null; // parser Failure
  return err.errors.length === 0 ? node : null;
}

/** The literal string value of an attribute value node (string literal, or a tree's first string). */
function attrValueString(v: mcdoc.AttributeValueNode | undefined): string | undefined {
  if (!v) return undefined;
  if (mcdoc.LiteralTypeNode.is(v)) {
    const lit = mcdoc.LiteralTypeNode.destruct(v).value;
    return lit.type === 'string' ? lit.value : undefined;
  }
  if (mcdoc.ReferenceTypeNode.is(v)) {
    // Bare identifier/path value (e.g. #[foo(Bar)]) — join the path segments defensively.
    const { children } = mcdoc.PathNode.destruct(mcdoc.ReferenceTypeNode.destruct(v).path);
    return children.map(c => c.value).join('::') || undefined;
  }
  if (mcdoc.AttributeTreeNode.is(v)) {
    const t = mcdoc.AttributeTreeNode.destruct(v);
    if (t.named) {
      const named = mcdoc.AttributeTreeNamedValuesNode.destruct(t.named);
      for (const pair of named.values) {
        const s = attrValueString(pair.value);
        if (s !== undefined) return s;
      }
    }
    if (t.positional) {
      const pos = mcdoc.AttributeTreePosValuesNode.destruct(t.positional);
      return attrValueString(pos.values[0]);
    }
  }
  return undefined;
}

/** Registry name from a `#[id(…)]` attribute: `#[id("minecraft:loot_table")]`,
 * `#[id(registry="minecraft:loot_table")]`, or undefined (no value / no registry). */
function attrRegistry(attr: mcdoc.AttributeNode): string | undefined {
  const d = mcdoc.AttributeNode.destruct(attr);
  if (d.name.value !== 'id' || !d.value) return undefined;
  if (mcdoc.AttributeTreeNode.is(d.value)) {
    const t = mcdoc.AttributeTreeNode.destruct(d.value);
    if (t.named) {
      const named = mcdoc.AttributeTreeNamedValuesNode.destruct(t.named);
      const pair = named.values.find(p => p.key.value === 'registry');
      if (pair) return attrValueString(pair.value);
    }
    if (t.positional) {
      const pos = mcdoc.AttributeTreePosValuesNode.destruct(t.positional);
      return attrValueString(pos.values[0]);
    }
    return undefined;
  }
  return attrValueString(d.value);
}

/** since/until/registry from a list of attribute nodes (field/spread annotations). */
function attrsOf(attributes: mcdoc.AttributeNode[]): FieldInfo {
  const out: FieldInfo = {};
  for (const a of attributes) {
    const { name, value } = mcdoc.AttributeNode.destruct(a);
    if (name.value === 'since') out.since = attrValueString(value) ?? out.since;
    else if (name.value === 'until') out.until = attrValueString(value) ?? out.until;
    else if (name.value === 'id') out.registry = attrRegistry(a) ?? out.registry;
  }
  return out;
}

/** First `#[id(…)]` registry anywhere in a field's type subtree (left-to-right order). */
function typeRegistry(typeNode: mcdoc.TypeNode): string | undefined {
  const stack: { type?: string; children?: unknown[] }[] = [typeNode];
  while (stack.length) {
    const n = stack.pop();
    if (!n) continue;
    if (n.type === 'mcdoc:attribute') {
      const reg = attrRegistry(n as unknown as mcdoc.AttributeNode);
      if (reg) return reg;
    }
    const kids = n.children ?? [];
    for (let i = kids.length - 1; i >= 0; i--) stack.push(kids[i] as { type?: string; children?: unknown[] });
  }
  return undefined;
}

/** Own fields + spreads of a `{ … }` struct block. */
function structFromBlock(block: mcdoc.StructBlockNode): StructDef {
  const fields = new Map<string, FieldInfo>();
  const spreads: SpreadRef[] = [];
  for (const f of mcdoc.StructBlockNode.destruct(block).fields) {
    if (mcdoc.StructPairFieldNode.is(f)) {
      const d = mcdoc.StructPairFieldNode.destruct(f);
      const ann = attrsOf(d.attributes);
      const name = (d.key.type === 'string' || d.key.type === 'mcdoc:identifier') ? d.key.value : undefined;
      if (!name || !d.type) continue; // map key / unparseable — skip conservatively
      const info: FieldInfo = { since: ann.since, until: ann.until, registry: ann.registry ?? typeRegistry(d.type) };
      fields.set(name, mergeField(fields.get(name), info));
    } else if (mcdoc.StructSpreadFieldNode.is(f)) {
      const d = mcdoc.StructSpreadFieldNode.destruct(f);
      const ann = attrsOf(d.attributes);
      if (mcdoc.StructNode.is(d.type)) {
        // inline `...struct { … }` — merge sub-fields with the spread's own range
        const sub = structFromBlock(mcdoc.StructNode.destruct(d.type).block);
        for (const [n2, info] of sub.fields) fields.set(n2, mergeField(fields.get(n2), mergeField(info, { since: ann.since, until: ann.until })));
        for (const sp of sub.spreads) spreads.push({ name: sp.name, since: mergeSince(sp.since, ann.since), until: mergeUntil(sp.until, ann.until) });
      } else if (mcdoc.ReferenceTypeNode.is(d.type)) {
        const { children } = mcdoc.PathNode.destruct(mcdoc.ReferenceTypeNode.destruct(d.type).path);
        const name = children.map(c => c.value).join('::');
        if (name) spreads.push({ name, since: ann.since, until: ann.until });
      }
    }
  }
  return { fields, spreads };
}

/**
 * Collect struct definitions + `dispatch minecraft:entity[…] to …` mappings across the tarball's
 * .mcdoc files, using @spyglassmc/mcdoc's real parser. A file whose parse reports ANY error is
 * skipped (conservative; currently 0 of 241 files).
 */
function collectMcDoc(files: { name: string; text: string }[]): { structs: Map<string, StructDef>; entities: Map<string, string> } {
  const structs = new Map<string, StructDef>();
  const entities = new Map<string, string>();
  let synthetic = 0;
  for (const f of files) {
    if (!f.name.endsWith('.mcdoc')) continue;
    const module = parseModule(f.text);
    if (!module) continue;
    for (const top of module.children) {
      if (mcdoc.StructNode.is(top)) {
        const d = mcdoc.StructNode.destruct(top);
        if (d.identifier) structs.set(d.identifier.value, structFromBlock(d.block));
      } else if (mcdoc.DispatchStatementNode.is(top)) {
        const d = mcdoc.DispatchStatementNode.destruct(top);
        const location = d.location ? core.ResourceLocationNode.toString(d.location, 'full') : null;
        if (location !== 'minecraft:entity' || !d.index || !d.target) continue;
        let target: string | undefined;
        if (mcdoc.StructNode.is(d.target)) {
          const td = mcdoc.StructNode.destruct(d.target);
          if (td.identifier) {
            structs.set(td.identifier.value, structFromBlock(td.block));
            target = td.identifier.value;
          } else {
            // anonymous `to struct { … }` — resolve it inline under a synthetic name
            target = `%anonymous-${synthetic++}`;
            structs.set(target, structFromBlock(td.block));
          }
        } else if (mcdoc.ReferenceTypeNode.is(d.target)) {
          const { children } = mcdoc.PathNode.destruct(mcdoc.ReferenceTypeNode.destruct(d.target).path);
          target = children.map(c => c.value).join('::') || undefined;
        }
        if (!target) continue;
        const { parallelIndices } = mcdoc.IndexBodyNode.destruct(d.index);
        for (const idx of parallelIndices) {
          if (mcdoc.DynamicIndexNode.is(idx)) {
            // `%key`-style dynamic index: never matches a real entity id, but its target struct
            // still feeds the global registryFields union (parity with the previous regex parser).
            const { keys } = mcdoc.DynamicIndexNode.destruct(idx);
            entities.set(`%${keys.map(k => k.value).join('.')}`, target);
          } else if (core.ResourceLocationNode.is(idx)) {
            entities.set(core.ResourceLocationNode.toString(idx, 'full'), target);
          } else {
            entities.set(idx.value, target);
          }
        }
      }
    }
  }
  return { structs, entities };
}

/** List .mcdoc entries of a gzipped/plain tar buffer as { name, text }. */
function listTar(tar: Buffer): { name: string; text: string }[] {
  const out: { name: string; text: string }[] = [];
  let off = 0;
  while (off + 512 <= tar.length) {
    const name = tar.subarray(off, off + 100).toString('utf8').replace(/\u0000.*$/, '');
    if (!name) break;
    const sizeStr = tar.subarray(off + 124, off + 136).toString('utf8').replace(/\u0000.*$/, '').trim();
    const size = parseInt(sizeStr, 8) || 0;
    if (name.endsWith('.mcdoc')) out.push({ name, text: tar.subarray(off + 512, off + 512 + size).toString('utf8') });
    off += 512 + Math.ceil(size / 512) * 512;
  }
  return out;
}

function mergeSince(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return compareGameVersions(a, b) >= 0 ? a : b;
}

function mergeUntil(a?: string, b?: string): string | undefined {
  if (!a) return b;
  if (!b) return a;
  return compareGameVersions(a, b) <= 0 ? a : b;
}

function mergeField(a: FieldInfo | undefined, b: FieldInfo): FieldInfo {
  return {
    since: mergeSince(a?.since, b.since),
    until: mergeUntil(a?.until, b.until),
    registry: a?.registry ?? b.registry,
  };
}

function lastSegment(name: string): string {
  const segs = name.split('::');
  return segs[segs.length - 1];
}

/** Resolve a struct (and its spreads) into a merged field map, or null on a cycle/miss. */
function resolveStruct(name: string, structs: Map<string, StructDef>, seen: Set<string>): Map<string, FieldInfo> | null {
  if (seen.has(name)) return null;
  seen.add(name);
  const def = structs.get(name);
  if (!def) return null;
  const out = new Map<string, FieldInfo>();
  for (const [fn, info] of def.fields) out.set(fn, mergeField(out.get(fn), info));
  for (const sp of def.spreads) {
    const sub = resolveStruct(lastSegment(sp.name), structs, new Set(seen));
    if (sub) {
      const range: FieldInfo = { since: sp.since, until: sp.until };
      for (const [fn, info] of sub) out.set(fn, mergeField(out.get(fn), mergeField(info, range)));
    }
  }
  return out;
}

// ---- schema loading (memoized) -------------------------------------------------

let schemaMemo: { key: string; data: EntitySchemaData | null } | null = null;

/**
 * Load the per-entity field schema from the cached vanilla-mcdoc tarball. Returns null when the
 * tarball isn't cached yet (first use downloads it) — the caller degrades to a no-op, exactly like
 * vanilla-tags.ts. Memoized by (concrete version, cache index mtime).
 */
export function loadEntitySchemas(version: string): EntitySchemaData | null {
  let concrete: string;
  try { concrete = resolveConcreteVersion(version); } catch { return null; }
  const key = `${concrete}:${cacheIndexMtime()}`;
  if (schemaMemo?.key === key) return schemaMemo.data;
  const raw = readCachedBytes(MCDOC_TARBALL);
  let data: EntitySchemaData | null = null;
  if (raw) {
    try {
      const tar = raw[0] === 0x1f && raw[1] === 0x8b ? gunzipSync(raw) : raw;
      const { structs, entities } = collectMcDoc(listTar(tar));
      const resolved = new Map<string, Map<string, FieldInfo>>();
      const registryFields = new Map<string, string>();
      for (const [etype, target] of entities) {
        const fields = resolveStruct(target, structs, new Set());
        if (fields && fields.size) {
          resolved.set(etype, fields);
          for (const [fn, info] of fields) if (info.registry) registryFields.set(fn, info.registry);
        }
      }
      data = { entities: resolved, registryFields };
    } catch { data = null; }
  }
  schemaMemo = { key, data };
  return data;
}

// ---- NBT scanning --------------------------------------------------------------

type Verdict = 'valid' | 'removed' | 'future';

function fieldVerdict(info: FieldInfo, version: string): Verdict {
  if (info.until && compareGameVersions(version, info.until) >= 0) return 'removed';
  if (info.since && compareGameVersions(version, info.since) < 0) return 'future';
  return 'valid';
}

/**
 * Some vanilla-mcdoc annotations are degenerate: `since` and `until` are the same version, which
 * would mean the field exists only in that single version. In practice these are schema artifacts
 * (e.g. `Team` on many entity types is annotated as since=until=26.3 although it has existed for
 * years). Treat them as unchecked instead of emitting a false positive.
 */
function isAmbiguousRange(info: FieldInfo): boolean {
  return !!info.since && !!info.until && compareGameVersions(info.since, info.until) === 0;
}

/** Strip a trailing mcfunction `#` comment (quote-aware). */
function stripLineComment(line: string): string {
  let q: string | null = null;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === '"' || c === "'") q = c;
    else if (c === '#' && (i === 0 || /\s/.test(line[i - 1]))) return line.slice(0, i);
  }
  return line;
}

/** Split a top-level NBT compound body into key/value entries (string/brace aware). */
function parseNbtTopLevel(body: string): { name: string; value?: string }[] | null {
  const out: { name: string; value?: string }[] = [];
  let depth = 0;
  let cur = '';
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (c === '"' || c === "'") { const e = skipQuoted(body, i); cur += body.slice(i, e + 1); i = e; continue; }
    if (c === '{' || c === '[') { depth++; cur += c; continue; }
    if (c === '}' || c === ']') { if (depth === 0) return null; depth--; cur += c; continue; }
    if (c === ',' && depth === 0) {
      const entry = cur.trim();
      if (entry) { const p = splitEntry(entry); if (p) out.push(p); }
      cur = '';
      continue;
    }
    cur += c;
  }
  if (depth !== 0) return null;
  const entry = cur.trim();
  if (entry) { const p = splitEntry(entry); if (p) out.push(p); }
  return out;
}

function splitEntry(entry: string): { name: string; value?: string } | null {
  for (let i = 0; i < entry.length; i++) {
    const c = entry[i];
    if (c === '"' || c === "'") { i = skipQuoted(entry, i); continue; }
    if (c === ':') {
      const name = entry.slice(0, i).trim();
      if (!name) return null;
      const value = entry.slice(i + 1).trim();
      return value ? { name, value } : { name };
    }
  }
  return null;
}

function stripQuotes(s: string): string {
  if (s.length >= 2 && ((s[0] === '"' && s[s.length - 1] === '"') || (s[0] === "'" && s[s.length - 1] === "'"))) {
    return s.slice(1, -1);
  }
  return s;
}

/**
 * Classify a literal registry-ID value inside NBT: valid | invalid | skip (cannot judge).
 * Pack-declared IDs are namespace-qualified (`registry/ns/id`) so a custom `x:foo` declaration
 * never validates `minecraft:foo`.
 */
function classifyNbtRegistryValue(value: string, registry: string, regs: RegistryData, declared: Set<string>): 'valid' | 'invalid' | 'skip' {
  const tok = stripQuotes(value);
  if (tok.startsWith('#')) return 'skip';
  if (tok.includes('$(')) return 'skip';
  if (/^[{\[]/.test(tok)) return 'skip'; // not a scalar id (nested/array) — can't judge
  // `DeathLootTable:"none"` / `"empty"` are long-standing sentinels Minecraft accepts for
  // “no loot table”; they are not listed in the vanilla loot_table registry, so don't flag them.
  if (registry === 'loot_table') {
    if (tok === 'none' || tok === 'empty') return 'valid';
    if (tok === '') return 'skip';
  }
  const values = regs[registry];
  if (!values) return 'skip';

  const colon = tok.indexOf(':');
  if (colon < 0) {
    return values.includes(tok) ? 'valid' : 'invalid';
  }
  const ns = tok.slice(0, colon);
  const id = tok.slice(colon + 1);
  if (!ns || !id) return 'skip';
  if (ns === 'minecraft') {
    return values.includes(id) || declared.has(`${registry}/minecraft/${id}`) ? 'valid' : 'invalid';
  }
  return declared.has(`${registry}/${ns}/${id}`) ? 'valid' : 'skip';
}

interface UnresolvedEntry { reason: string; detail: string }
interface LineOutcome { found: boolean; checked: number; unchecked: number; issues: NbtIssue[]; unresolved: UnresolvedEntry[]; }
const NONE: LineOutcome = { found: false, checked: 0, unchecked: 0, issues: [], unresolved: [] };

function nbtUnresolved(out: LineOutcome, reason: string, detail: string, count: number): void {
  out.unchecked += count;
  out.unresolved.push({ reason, detail });
}

function scanSummon(line: string, start: number, lineNo: number, schema: EntitySchemaData, regs: RegistryData, declared: Set<string>, version: string): LineOutcome {
  let i = start;
  while (i < line.length && /\s/.test(line[i])) i++;
  let j = i;
  while (j < line.length && !/\s/.test(line[j]) && line[j] !== '{') j++;
  const typeTok = line.slice(i, j);
  if (!typeTok || typeTok.includes('$(')) return NONE;
  let bare = typeTok;
  if (bare.startsWith('minecraft:')) bare = bare.slice('minecraft:'.length);
  const fields = bare.includes(':') ? undefined : schema.entities.get(bare);
  // NBT is the first '{' after the entity type (position args ~ ~ ~ / coords have no braces).
  let k = j;
  while (k < line.length && line[k] !== '{') k++;
  if (line[k] !== '{') return NONE;
  const close = braceMatch(line, k);
  if (close < 0) return { found: true, checked: 0, unchecked: 1, issues: [], unresolved: [{ reason: 'unable to parse NBT', detail: 'unclosed compound' }] };
  const entries = parseNbtTopLevel(line.slice(k + 1, close));
  if (!entries) return { found: true, checked: 0, unchecked: 1, issues: [], unresolved: [{ reason: 'unable to parse NBT', detail: 'compound structure could not be split into top-level fields' }] };
  const out: LineOutcome = { found: true, checked: 0, unchecked: 0, issues: [], unresolved: [] };
  for (const e of entries) {
    if (!fields) {
      // Custom/unknown entity types have no entity-specific schema, but globally registry-bearing
      // NBT fields (e.g. DeathLootTable) still mean the same thing in every entity compound.
      const globalReg = schema.registryFields.get(e.name);
      if (globalReg && e.value !== undefined) {
        out.checked++;
        const verdict = classifyNbtRegistryValue(e.value, globalReg, regs, declared);
        if (verdict === 'invalid') out.issues.push({ line: lineNo, key: 'nbt-registry', msg: `[nbt] ${globalReg} '${stripQuotes(e.value)}' is not in the ${globalReg} registry for ${version} (if custom, declare it in the pack first)` });
        else if (verdict === 'skip') nbtUnresolved(out, 'unresolved due to macro/unknown field', `'${e.value}' is a tag, custom-namespace id, or the registry data is missing`, 1);
      } else {
        nbtUnresolved(out, 'unresolved due to unknown field', `unknown entity type '${bare}' — no schema for its fields`, 1);
      }
      continue;
    }
    const info = fields.get(e.name);
    if (!info) { nbtUnresolved(out, 'unresolved due to unknown field', `field '${e.name}' is not in the cached entity schema for '${bare}'`, 1); continue; }
    if (isAmbiguousRange(info)) {
      nbtUnresolved(out, 'unresolved due to ambiguous schema annotation', `field '${e.name}' has since==until (${info.since}) in the cached schema`, 1);
      continue;
    }
    out.checked++;
    const v = fieldVerdict(info, version);
    if (v === 'removed') {
      out.issues.push({ line: lineNo, key: 'nbt-field-removed', msg: `[nbt] entity ${bare} field '${e.name}' was removed in ${info.until} (not valid in ${version})` });
    } else if (v === 'future') {
      out.issues.push({ line: lineNo, key: 'nbt-field-future', msg: `[nbt] entity ${bare} field '${e.name}' was added in ${info.since} (not valid in ${version})` });
    } else if (info.registry && e.value !== undefined) {
      const verdict = classifyNbtRegistryValue(e.value, info.registry, regs, declared);
      if (verdict === 'invalid') out.issues.push({ line: lineNo, key: 'nbt-registry', msg: `[nbt] ${info.registry} '${stripQuotes(e.value)}' is not in the ${info.registry} registry for ${version} (if custom, declare it in the pack first)` });
    }
  }
  return out;
}

function scanDataMerge(line: string, start: number, lineNo: number, schema: EntitySchemaData, regs: RegistryData, declared: Set<string>, version: string): LineOutcome {
  let i = start;
  while (i < line.length && /\s/.test(line[i])) i++;
  if (!line.startsWith('merge', i)) return NONE;
  i += 5;
  while (i < line.length && /\s/.test(line[i])) i++;
  if (!line.startsWith('entity', i)) return NONE;
  i += 6;
  while (i < line.length && /\s/.test(line[i])) i++;
  let j = i;
  while (j < line.length && !/\s/.test(line[j]) && line[j] !== '{') j++;
  if (j === i) return NONE;
  let k = j;
  while (k < line.length && /\s/.test(line[k])) k++;
  if (line[k] !== '{') return NONE;
  const close = braceMatch(line, k);
  if (close < 0) return { found: true, checked: 0, unchecked: 1, issues: [], unresolved: [{ reason: 'unable to parse NBT', detail: 'unclosed compound' }] };
  const entries = parseNbtTopLevel(line.slice(k + 1, close));
  if (!entries) return { found: true, checked: 0, unchecked: 1, issues: [], unresolved: [{ reason: 'unable to parse NBT', detail: 'compound structure could not be split into top-level fields' }] };
  const out: LineOutcome = { found: true, checked: 0, unchecked: 0, issues: [], unresolved: [] };
  for (const e of entries) {
    const regName = schema.registryFields.get(e.name);
    if (!regName) { out.unchecked++; continue; }
    out.checked++;
    if (e.value !== undefined) {
      const verdict = classifyNbtRegistryValue(e.value, regName, regs, declared);
      if (verdict === 'invalid') out.issues.push({ line: lineNo, key: 'nbt-registry', msg: `[nbt] ${regName} '${stripQuotes(e.value)}' is not in the ${regName} registry for ${version} (if custom, declare it in the pack first)` });
    }
  }
  return out;
}

/**
 * Scan one .mcfunction file's summon / `data merge entity` NBT. `text`, when supplied, avoids
 * re-reading the file (the caller has often already read it).
 */
export function scanEntityNbt(
  filePath: string,
  schema: EntitySchemaData,
  regs: RegistryData,
  declared: Set<string>,
  version: string,
  text?: string,
): NbtScanResult {
  if (text === undefined) {
    try { text = readFileSync(filePath, 'utf8'); } catch { return { issues: [], uncheckedPositions: [], lines: 0, checked: 0, unchecked: 0 }; }
  }
  const out: NbtScanResult = { issues: [], uncheckedPositions: [], lines: 0, checked: 0, unchecked: 0 };
  const lines = text.split('\n');
  for (let idx = 0; idx < lines.length; idx++) {
    const line = stripLineComment(lines[idx]);
    let found = false;
    for (const m of line.matchAll(/\bsummon\b/g)) {
      const r = scanSummon(line, (m.index ?? 0) + 6, idx + 1, schema, regs, declared, version);
      if (r.found) {
        found = true;
        out.checked += r.checked;
        out.unchecked += r.unchecked;
        for (const u of r.unresolved) out.uncheckedPositions.push({ line: idx + 1, reason: u.reason, detail: u.detail });
        out.issues.push(...r.issues);
      }
    }
    for (const m of line.matchAll(/\bdata\b/g)) {
      const r = scanDataMerge(line, (m.index ?? 0) + 4, idx + 1, schema, regs, declared, version);
      if (r.found) {
        found = true;
        out.checked += r.checked;
        out.unchecked += r.unchecked;
        for (const u of r.unresolved) out.uncheckedPositions.push({ line: idx + 1, reason: u.reason, detail: u.detail });
        out.issues.push(...r.issues);
      }
    }
    if (found) out.lines++;
  }
  return out;
}
