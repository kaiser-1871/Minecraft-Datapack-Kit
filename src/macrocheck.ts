// macrocheck.ts — validate literal registry IDs inside $ macro lines.
//
// Spyglass's parser treats a `$`-prefixed macro line as opaque (literal chunks + $(var)
// interpolations only): it does NOT walk the command structure, so a registry ID inside a
// macro line gets ZERO validation — `$execute run effect give @s minecraft:knockback` passes
// 0 errors while the same line without `$` reports `Cannot find mob_effect`. This scanner
// walks the SAME per-version command tree the engine uses, follows the SAME descent rules as
// Spyglass's resolveParentTreeNode (redirect → jump; dead-end non-executable → command root),
// and validates pure-literal tokens that land on a registry argument slot against the
// version's registry values (plus the pack's own data-driven declarations).
//
// Conservative by construction: on ANY ambiguity (desync, unknown token, multi-token
// interpolation) the walk stops and marks the rest unchecked — it NEVER warns unless the walk
// is in-sync and a literal token sits exactly on a registry slot. Messages are version-free
// (they feed issueSig/--delta and a version string would churn on every upgrade).

import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { listDataRoots } from './pack-mcmeta.js';
import type { CommandTree } from './syntax.js';
import { normalizeRegistryName } from './registry.js';
import type { RegistryData } from './registry.js';

export interface MacroIssue {
  /** 1-based line number. */
  line: number;
  key: string;
  msg: string;
}

export interface MacroStats {
  /** macro command lines scanned (those with at least one $( … )). */
  lines: number;
  /** registry slots resolved to a literal token and looked up (hit or miss). */
  checked: number;
  /** slots skipped: interpolation / tag / custom namespace / no data / desync / trailing. */
  unchecked: number;
  /** literal arguments validated with a conservative syntax validator (numeric/range/etc.). */
  syntaxChecked: number;
  /** literal arguments that have no conservative validator and remain unchecked. */
  syntaxUnchecked: number;
}

export interface MacroUncheckedPosition {
  /** 1-based line number. */
  line: number;
  reason: string;
  /** Which token/slot could not be judged, when known. */
  detail: string;
}

export interface MacroScanResult extends MacroStats {
  issues: MacroIssue[];
  /** File-locatable positions the scanner had to leave unresolved. */
  uncheckedPositions: MacroUncheckedPosition[];
}

/** Argument parsers whose token is a registry ID (validated against the registry). */
const RESOURCE_PARSERS = new Set([
  'minecraft:resource',
  'minecraft:resource_key',
  'minecraft:resource_or_tag',
  'minecraft:resource_or_tag_key',
]);

/** Tokens consumed by an argument of the given parser (registry slots are always 1). */
function argWidth(parser?: string): number {
  switch (parser) {
    case 'minecraft:vec3':
    case 'minecraft:block_pos':
    case 'minecraft:column_pos':
      return 3;
    case 'minecraft:vec2':
    case 'minecraft:rotation':
      return 2;
    default:
      return 1;
  }
}

/**
 * Build the set of data-driven registry entries the pack declares:
 * "registry/namespace/id" for every .json under data/<ns>/<registry>/…/<id>.json
 * (tags/ subtrees excluded — tag refs are never warned anyway). Namespace-qualified keys prevent
 * `data/x/advancement/foo.json` from making `minecraft:foo` look valid; only `x:foo` is allowed.
 * `dataRoots`, when supplied, replaces the default root data/ + all declared overlays (callers
 * that already filtered overlays by the target version pass their active roots).
 */
export function buildDeclaredRegistryIds(datapack: string, dataRoots?: string[]): Set<string> {
  const roots = dataRoots ?? listDataRoots(datapack);
  const out = new Set<string>();
  for (const dataDir of roots) {
    (function walk(dir: string, prefix: string[]): void {
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) walk(p, [...prefix, e.name]);
        else if (e.name.endsWith('.json')) {
          // skip data/<ns>/tags/<reg>/… — tag refs are never warned anyway
          if (prefix[1] === 'tags') continue;
          // prefix = [ns, ...registry path segments]
          if (prefix.length >= 2) {
            const ns = prefix[0];
            const id = e.name.slice(0, -'.json'.length);
            out.add(`${prefix.slice(1).join('/')}/${ns}/${id}`);
          }
        }
      }
    })(dataDir, []);
  }
  return out;
}

interface SlotResult {
  verdict: 'valid' | 'invalid' | 'skip';
  regName: string;
}

/**
 * Validate one literal token against a registry. 'skip' = cannot judge (tag, undeclared custom
 * namespace, registry has no cached data) — never warns, counts as unchecked.
 *
 * Declared pack entries are namespace-qualified (`registry/ns/id`): `data/x/…/foo.json` may
 * satisfy `x:foo`, but never `minecraft:foo` or a bare `foo` (bare IDs mean minecraft).
 */
function classifyToken(tok: string, regName: string, regs: RegistryData, declared: Set<string>): SlotResult {
  const reg = normalizeRegistryName(regName);
  if (tok.startsWith('#')) return { verdict: 'skip', regName: reg };
  const values = regs[reg];
  if (!values) return { verdict: 'skip', regName: reg };

  const colon = tok.indexOf(':');
  if (colon < 0) {
    return values.includes(tok) ? { verdict: 'valid', regName: reg } : { verdict: 'invalid', regName: reg };
  }
  const ns = tok.slice(0, colon);
  const id = tok.slice(colon + 1);
  if (!ns || !id) return { verdict: 'skip', regName: reg };
  if (ns === 'minecraft') {
    const declaredMinecraft = declared.has(`${reg}/minecraft/${id}`);
    return values.includes(id) || declaredMinecraft ? { verdict: 'valid', regName: reg } : { verdict: 'invalid', regName: reg };
  }
  // Custom namespace: validate when the pack itself declares it, otherwise stay conservative.
  return declared.has(`${reg}/${ns}/${id}`) ? { verdict: 'valid', regName: reg } : { verdict: 'skip', regName: reg };
}

interface WalkOutcome {
  checked: number;
  unchecked: number;
  syntaxChecked: number;
  syntaxUnchecked: number;
  issues: MacroIssue[];
  uncheckedReasons: { reason: string; detail: string }[];
}

function unresolved(out: WalkOutcome, reason: string, detail: string, count: number): void {
  out.unchecked += count;
  out.uncheckedReasons.push({ reason, detail });
}

function unresolvedSyntax(out: WalkOutcome, reason: string, detail: string, count: number): void {
  out.syntaxUnchecked += count;
  out.uncheckedReasons.push({ reason, detail });
}

// ---- conservative literal-argument validation ---------------------------------
// The engine parses macro lines as opaque text, so a bad literal can hide in any non-registry
// argument. These validators only fire when the token is clearly invalid for a parser whose
// syntax is stable (numbers, ranges, booleans, coordinates, small enums). Unknown parsers are
// counted as syntax-unchecked, never warned.

const INT_RE = /^[+-]?\d+$/;
const FLOAT_RE = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;
const TIME_RE = /^[+-]?\d+[dDsS]?$/;
const COORD_INT_RE = /^[~^]?[+-]?\d+$/;
const COORD_FLOAT_RE = /^[~^]?[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function numInRange(tok: string, props: Record<string, unknown> | undefined, integer: boolean): boolean {
  if (!(integer ? INT_RE : FLOAT_RE).test(tok)) return false;
  const n = Number(tok);
  const min = typeof props?.min === 'number' ? props.min : null;
  const max = typeof props?.max === 'number' ? props.max : null;
  if (min !== null && n < min) return false;
  if (max !== null && n > max) return false;
  return true;
}

function rangeOk(tok: string, integer: boolean): boolean {
  const re = integer ? INT_RE : FLOAT_RE;
  const dot = tok.indexOf('..');
  if (dot < 0) return re.test(tok);
  const left = tok.slice(0, dot);
  const right = tok.slice(dot + 2);
  if (left === '' && right === '') return false;
  if (left !== '' && !re.test(left)) return false;
  if (right !== '' && !re.test(right)) return false;
  return true;
}

function coordOk(tok: string, integer: boolean): boolean {
  if (tok === '~' || tok === '^') return true;
  return (integer ? COORD_INT_RE : COORD_FLOAT_RE).test(tok);
}

function multiTokenOk(tokens: string[], start: number, width: number, integer: boolean): boolean {
  const end = Math.min(start + width, tokens.length);
  if (end - start !== width) return false; // truncated by tokenization — desync, not a token error
  for (let j = start; j < end; j++) if (!coordOk(tokens[j], integer)) return false;
  return true;
}

const SIMPLE_PARSERS = new Set([
  'brigadier:integer', 'brigadier:double', 'brigadier:float', 'brigadier:bool',
  'minecraft:time', 'minecraft:int_range', 'minecraft:float_range',
  'minecraft:hex_color', 'minecraft:vec2', 'minecraft:vec3',
  'minecraft:block_pos', 'minecraft:column_pos', 'minecraft:rotation', 'minecraft:swizzle',
]);

function rangeSuffix(props: Record<string, unknown> | undefined): string {
  const min = typeof props?.min === 'number' ? props.min : null;
  const max = typeof props?.max === 'number' ? props.max : null;
  if (min === null && max === null) return '';
  if (min === null) return ` (at most ${max})`;
  if (max === null) return ` (at least ${min})`;
  return ` (${min}..${max})`;
}

function validateSimpleArg(tokens: string[], start: number, width: number, parser: string | undefined, props: Record<string, unknown> | undefined): string | null {
  const tok = tokens[start];
  if (!parser || !tok || tok.includes('$(')) return null;
  switch (parser) {
    case 'brigadier:integer':
      if (!numInRange(tok, props, true)) return `'${tok}' is not a valid integer${rangeSuffix(props)}`;
      return null;
    case 'brigadier:double':
    case 'brigadier:float':
      if (!numInRange(tok, props, false)) return `'${tok}' is not a valid number${rangeSuffix(props)}`;
      return null;
    case 'minecraft:time':
      if (!TIME_RE.test(tok) || !numInRange(tok.replace(/[dDsS]$/, ''), props, true)) return `'${tok}' is not a valid time value${rangeSuffix(props)}`;
      return null;
    case 'minecraft:int_range':
      if (!rangeOk(tok, true)) return `'${tok}' is not a valid integer range (e.g. 5, ..5, 5..10)`;
      return null;
    case 'minecraft:float_range':
      if (!rangeOk(tok, false)) return `'${tok}' is not a valid float range (e.g. 1.5..5)`;
      return null;
    case 'brigadier:bool':
      if (!['true', 'false'].includes(tok)) return `'${tok}' is not a boolean (expected true or false)`;
      return null;
    case 'minecraft:hex_color':
      if (!/^#[0-9a-fA-F]{6}$/.test(tok)) return `'${tok}' is not a #rrggbb color`;
      return null;
    case 'minecraft:vec2':
    case 'minecraft:rotation':
      if (!multiTokenOk(tokens, start, width, false)) return `'${tokens.slice(start, Math.min(start + width, tokens.length)).join(' ')}' is not a valid ${parser.endsWith('vec2') ? 'vec2' : 'rotation'}`;
      return null;
    case 'minecraft:vec3':
      if (!multiTokenOk(tokens, start, width, false)) return `'${tokens.slice(start, Math.min(start + width, tokens.length)).join(' ')}' is not a valid vec3`;
      return null;
    case 'minecraft:block_pos':
      if (!multiTokenOk(tokens, start, width, true)) return `'${tokens.slice(start, Math.min(start + width, tokens.length)).join(' ')}' is not a valid block position`;
      return null;
    case 'minecraft:column_pos':
      if (!multiTokenOk(tokens, start, width, true)) return `'${tokens.slice(start, Math.min(start + width, tokens.length)).join(' ')}' is not a valid column position`;
      return null;
    case 'minecraft:swizzle':
      if (!/^[xyz]{1,3}$/.test(tok)) return `'${tok}' is not a valid swizzle`;
      return null;
    default:
      return null;
  }
}

/** Walk one macro command line's tokens through the command tree (mirrors resolveParentTreeNode). */
function walkLine(tree: CommandTree, tokens: string[], regs: RegistryData, declared: Set<string>): WalkOutcome {
  const out: WalkOutcome = { checked: 0, unchecked: 0, syntaxChecked: 0, syntaxUnchecked: 0, issues: [], uncheckedReasons: [] };

  const step = (node: CommandTree): CommandTree | null => {
    if (node.redirect?.length) {
      let cur: CommandTree | undefined = tree;
      for (const seg of node.redirect) {
        cur = cur?.children?.[seg];
        if (!cur) return null;
      }
      return cur;
    }
    // dead-end non-executable (execute.run, return.run, …) → jump to the command root
    if (!node.children && !node.executable) return tree;
    return node;
  };

  const firstArg = (node: CommandTree): { name: string; node: CommandTree } | null => {
    if (!node.children) return null;
    const args = Object.entries(node.children).filter(([, c]) => c.type === 'argument');
    if (args.length !== 1) return null; // 0 → none; >1 → ambiguous, desync
    return { name: args[0][0], node: args[0][1] };
  };

  let node: CommandTree | undefined = tree;
  let i = 0;

  while (i < tokens.length) {
    const tok = tokens[i];
    const interp = tok.includes('$(');

    const n = step(node);
    if (!n) { unresolved(out, 'unable to follow command tree', 'redirect target is not in the cached command tree', tokens.length - i); break; } // redirect unresolvable
    node = n;

    // literal child (only a pure-literal token can match)
    const lit = !interp ? node.children?.[tok] : undefined;
    if (lit) { node = lit; i++; continue; }

    const arg = firstArg(node);
    if (arg) {
      const argNode = arg.node;
      const parser = argNode.parser;
      if (parser !== undefined && RESOURCE_PARSERS.has(parser) && argNode.properties?.registry) {
        // registry slot — width is always 1
        node = argNode;
        if (interp) { unresolved(out, 'unresolved due to macro', 'registry slot is filled by $(…)', 1); i++; continue; }
        out.checked++;
        const res = classifyToken(tok, argNode.properties.registry as string, regs, declared);
        if (res.verdict === 'invalid') {
          out.issues.push({
            line: 0, // filled by caller
            key: 'macro-registry',
            msg: `[macro] registry '${tok}' is not in the ${res.regName} registry (if it is custom pack data, declare it first; use --registry=${res.regName} to list valid values for this version)`,
          });
        } else if (res.verdict === 'skip') {
          unresolved(out, 'unresolved due to macro/unknown field', `'${tok}' is a tag, custom-namespace id, or the registry data is missing`, 1);
        }
        i++;
        continue;
      }
      const w = argWidth(parser);
      node = argNode;
      if (interp) {
        if (w === 1) { unresolved(out, 'unresolved due to macro', 'argument slot is filled by $(…)', 1); i++; continue; }
        unresolved(out, 'unresolved due to macro', 'multi-token argument slot is filled by $(…) and cannot be resynced', tokens.length - i);
        break; // can't resync a multi-token interpolation
      }
      if (i + w > tokens.length) {
        unresolved(out, 'unable to follow command tree', 'not enough tokens for a multi-token argument slot', tokens.length - i);
        break;
      }
      const simpleError = validateSimpleArg(tokens, i, w, parser, argNode.properties);
      if (simpleError !== null) {
        out.syntaxChecked++;
        out.issues.push({
          line: 0, // filled by caller
          key: 'macro-syntax',
          msg: `[macro] ${simpleError} (macro lines are not parsed by the engine; this literal was validated by dpkit)`,
        });
      } else if (parser && SIMPLE_PARSERS.has(parser)) {
        out.syntaxChecked++;
      } else {
        unresolvedSyntax(out, 'macro literal not validated', `parser '${parser ?? 'unknown'}' has no conservative macro validator`, w);
      }
      i = Math.min(i + w, tokens.length);
      continue;
    }

    // no matching child, not an argument slot: if the command may end here, trailing tokens
    // are not registry positions (stop cleanly); otherwise we desynced.
    if (node.executable) break;
    unresolved(out, 'unable to follow command tree', 'tokens do not match the cached grammar (macro/ambiguous)', tokens.length - i);
    break;
  }

  return out;
}

/**
 * Scan one .mcfunction file for registry IDs inside $ macro lines. tree/regs/declared are
 * loaded once per check by the caller. Returns per-line issues + coverage stats.
 * `text`, when supplied, is used instead of re-reading the file from disk (the caller has
 * often already read it to test for "$(").
 */
export function scanMacroRegistry(
  filePath: string,
  tree: CommandTree,
  regs: RegistryData,
  declared: Set<string>,
  text?: string,
): MacroScanResult {
  if (text === undefined) {
    try { text = readFileSync(filePath, 'utf8'); } catch { return { issues: [], uncheckedPositions: [], lines: 0, checked: 0, unchecked: 0, syntaxChecked: 0, syntaxUnchecked: 0 }; }
  }
  const result: MacroScanResult = { issues: [], uncheckedPositions: [], lines: 0, checked: 0, unchecked: 0, syntaxChecked: 0, syntaxUnchecked: 0 };

  text.split('\n').forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const trimmed = rawLine.trimStart();
    if (!trimmed.startsWith('$')) return;
    if (/^\$\w+\s*=/.test(trimmed)) return;   // $name = value assignment — no command structure

    result.lines++;
    const rest = trimmed.slice(1).trimStart();
    const tokens = rest.split(/\s+/).filter(Boolean);
    // whole command is a macro ($(cmd)) — nothing literal to validate
    if (!tokens.length || tokens[0].startsWith('(')) { result.unchecked++; result.uncheckedPositions.push({ line: lineNo, reason: 'unresolved due to macro', detail: 'the whole command is a macro variable' }); return; }

    const walked = walkLine(tree, tokens, regs, declared);
    result.checked += walked.checked;
    result.unchecked += walked.unchecked;
    result.syntaxChecked += walked.syntaxChecked;
    result.syntaxUnchecked += walked.syntaxUnchecked;
    for (const pos of walked.uncheckedReasons) result.uncheckedPositions.push({ line: lineNo, reason: pos.reason, detail: pos.detail });
    for (const iss of walked.issues) result.issues.push({ ...iss, line: lineNo });
  });

  return result;
}
