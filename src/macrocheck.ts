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
}

export interface MacroScanResult extends MacroStats {
  issues: MacroIssue[];
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
 * Build the set of data-driven registry entries the pack declares: "registry/bareId" for every
 * .json under data/<ns>/<registry>/…/<id>.json (tags/ subtrees excluded — tag refs are never
 * warned anyway). Used to suppress false "not in vanilla registry" warnings on custom entries
 * (damage_type, enchantment, worldgen/biome, …) that the pack itself declares.
 */
export function buildDeclaredRegistryIds(datapack: string): Set<string> {
  const out = new Set<string>();
  const dataDir = join(datapack, 'data');
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
          const id = e.name.slice(0, -'.json'.length);
          out.add(`${prefix.slice(1).join('/')}/${id}`);
        }
      }
    }
  })(dataDir, []);
  return out;
}

interface SlotResult {
  verdict: 'valid' | 'invalid' | 'skip';
  regName: string;
}

/**
 * Validate one literal token against a registry. 'skip' = cannot judge (tag, custom namespace,
 * registry has no cached data) — never warns, counts as unchecked.
 */
function classifyToken(tok: string, regName: string, regs: RegistryData, declared: Set<string>): SlotResult {
  const reg = normalizeRegistryName(regName);
  if (tok.startsWith('#')) return { verdict: 'skip', regName: reg };
  let bare = tok;
  if (tok.startsWith('minecraft:')) bare = tok.slice('minecraft:'.length);
  else if (tok.includes(':')) return { verdict: 'skip', regName: reg }; // custom namespace
  const values = regs[reg];
  if (!values) return { verdict: 'skip', regName: reg };
  if (declared.has(`${reg}/${bare}`)) return { verdict: 'valid', regName: reg };
  return values.includes(bare) ? { verdict: 'valid', regName: reg } : { verdict: 'invalid', regName: reg };
}

interface WalkOutcome {
  checked: number;
  unchecked: number;
  issues: MacroIssue[];
}

/** Walk one macro command line's tokens through the command tree (mirrors resolveParentTreeNode). */
function walkLine(tree: CommandTree, tokens: string[], regs: RegistryData, declared: Set<string>): WalkOutcome {
  const out: WalkOutcome = { checked: 0, unchecked: 0, issues: [] };

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
    if (!n) { out.unchecked += tokens.length - i; break; } // redirect unresolvable
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
        if (interp) { out.unchecked++; i++; continue; }
        out.checked++;
        const res = classifyToken(tok, argNode.properties.registry as string, regs, declared);
        if (res.verdict === 'invalid') {
          out.issues.push({
            line: 0, // filled by caller
            key: 'macro-registry',
            msg: `[macro] registry '${tok}' is not in the ${res.regName} registry (if it is custom pack data, declare it first; use --registry=${res.regName} to list valid values for this version)`,
          });
        } else if (res.verdict === 'skip') {
          out.unchecked++;
        }
        i++;
        continue;
      }
      const w = argWidth(parser);
      node = argNode;
      if (interp) {
        if (w === 1) { out.unchecked++; i++; continue; }
        out.unchecked += tokens.length - i; break; // can't resync a multi-token interpolation
      }
      i = Math.min(i + w, tokens.length);
      continue;
    }

    // no matching child, not an argument slot: if the command may end here, trailing tokens
    // are not registry positions (stop cleanly); otherwise we desynced.
    if (node.executable) break;
    out.unchecked += tokens.length - i;
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
    try { text = readFileSync(filePath, 'utf8'); } catch { return { issues: [], lines: 0, checked: 0, unchecked: 0 }; }
  }
  const result: MacroScanResult = { issues: [], lines: 0, checked: 0, unchecked: 0 };

  text.split('\n').forEach((rawLine, idx) => {
    const lineNo = idx + 1;
    const trimmed = rawLine.trimStart();
    if (!trimmed.startsWith('$')) return;
    if (!trimmed.includes('$(')) return;      // no interpolation → engine already flags it, skip
    if (/^\$\w+\s*=/.test(trimmed)) return;   // $name = value assignment — no command structure

    result.lines++;
    const rest = trimmed.slice(1).trimStart();
    const tokens = rest.split(/\s+/).filter(Boolean);
    // whole command is a macro ($(cmd)) — nothing literal to validate
    if (!tokens.length || tokens[0].startsWith('(')) { result.unchecked++; return; }

    const walked = walkLine(tree, tokens, regs, declared);
    result.checked += walked.checked;
    result.unchecked += walked.unchecked;
    for (const iss of walked.issues) result.issues.push({ ...iss, line: lineNo });
  });

  return result;
}
