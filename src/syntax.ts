// syntax.ts — Offline grammar dump of a Minecraft version's command tree.
//
// Reads the same per-version command data that the Spyglass language server downloads
// from api.spyglassmc.com and caches under %LOCALAPPDATA%\spyglassmc-nodejs\Cache.
// Renders a compact, human/AI-readable grammar for a command path (e.g. "execute on")
// or for the whole tree. No server, no network, no game needed — pure cache read.
//
// Port of the original syntax.mjs with TypeScript annotations.

import { DEFAULT_VERSION } from './config.js';
import { cacheIndexMtime, readCacheIndex, readCachedObject } from './cache.js';

/**
 * Read the cached version list (/mcje/versions) as an array, or null if not cached.
 * The array is sorted newest-first; each entry has { id, type: 'release'|'snapshot',
 * data_pack_version, resource_pack_version }.
 */
export function loadCachedVersions(): unknown[] | null {
  const d = readCachedObject('https://api.spyglassmc.com/mcje/versions');
  return Array.isArray(d) ? d : null;
}

/**
 * Resolve a version specifier to a concrete version id we have data for.
 * 'auto' / 'latest release' → the latest release; 'latest snapshot' → the latest
 * snapshot; a concrete id passes through unchanged. Falls back to the newest entry
 * only when the requested type isn't cached (so 'latest snapshot' never silently
 * resolves to a release). Throws a helpful error when nothing is cached yet.
 */
export function resolveConcreteVersion(version: string): string {
  if (!['auto', 'latest release', 'latest snapshot'].includes(version)) return version;
  const cached = loadCachedVersions();
  if (Array.isArray(cached) && cached.length) {
    const entries = cached as Array<{ type?: string; id?: string }>;
    const want = version === 'latest snapshot' ? 'snapshot' : 'release';
    const pick = entries.find(v => v.type === want) ?? entries[0];
    if (pick?.id) return pick.id;
  }
  throw new CommandDataNotCachedError(
    `[dpkit] version '${version}' needs a concrete version, but no version data is cached locally. Run node dpkit.mjs online once to download it, or pin --version=<concrete-version>.`,
  );
}

/** Thrown when the requested version's command data isn't in the local cache — an expected,
 * recoverable state (first use of a version), not an internal failure. CLI/MCP surface the
 * message cleanly instead of dumping a stack trace. */
export class CommandDataNotCachedError extends Error {}

/** Set of version ids whose command data is already cached locally. */
export function cachedCommandVersions(): Set<string> {
  const index = readCacheIndex() as { index?: Record<string, unknown> } | null;
  const out = new Set<string>();
  for (const k of Object.keys(index?.index ?? {})) {
    const m = k.match(/\/mcje\/versions\/([^/]+)\/commands$/);
    if (m) out.add(decodeURIComponent(m[1]));
  }
  return out;
}

// Memoized command tree, keyed by (concrete version, cache index mtime) so the engine's
// refresh invalidates it — the long-lived MCP server would otherwise re-parse the whole
// per-version tree on every query_syntax / check_datapack call.
let treeMemo: { key: string; tree: CommandNode } | null = null;

/**
 * Load the parsed command tree for a version from the local HTTP cache.
 * Returns the root node { type:'root', children } or throws a helpful Error.
 */
export function loadCommandTree(version: string = DEFAULT_VERSION): CommandNode {
  const concrete = resolveConcreteVersion(version);
  const key = `${concrete}:${cacheIndexMtime()}`;
  if (treeMemo?.key === key) return treeMemo.tree;
  const url = `https://api.spyglassmc.com/mcje/versions/${concrete}/commands`;
  const obj = readCachedObject(url);
  if (obj == null) {
    throw new CommandDataNotCachedError(`No command data cached for version ${concrete} (${url}). Run node dpkit.mjs --version=${concrete} once to download it.`);
  }
  const tree = obj as CommandNode;
  treeMemo = { key, tree };
  return tree;
}

// ---- command-tree node shapes ------------------------------------------------
export interface CommandNode {
  type?: string;
  children?: Record<string, CommandNode>;
  parser?: string;
  properties?: Record<string, unknown>;
  executable?: boolean;
  redirect?: string[];
}
export type CommandTree = CommandNode;

// ---- parser → description map ---------------------------------------
// properties are appended where relevant (ranges, entity type/amount, registry).
const PARSER_DESC: Record<string, string> = {
  'brigadier:bool': 'Boolean',
  'brigadier:double': 'Double (floating-point number)',
  'brigadier:float': 'Float (floating-point number)',
  'brigadier:integer': 'Integer',
  'brigadier:string': 'String',
  'minecraft:block_pos': 'Block position x y z',
  'minecraft:block_predicate': 'Block predicate (ID/tag, optional state predicate)',
  'minecraft:block_state': 'Block state, e.g. minecraft:stone[axis=y]',
  'minecraft:column_pos': 'Column position',
  'minecraft:component': 'Data component ID, e.g. minecraft:damage, minecraft:food',
  'minecraft:dialog': 'Dialog ID',
  'minecraft:dimension': 'Dimension ID, e.g. minecraft:overworld',
  'minecraft:entity': 'Entity / player selector',
  'minecraft:entity_anchor': 'Anchor: eyes | feet',
  'minecraft:float_range': 'Float range, e.g. 1.5..5',
  'minecraft:function': 'Function ID, e.g. minecraft:foo/bar',
  'minecraft:game_profile': 'Player name or player selector',
  'minecraft:gamemode': 'Game mode: survival|creative|adventure|spectator',
  'minecraft:heightmap': 'Heightmap: world_surface|motion_blocking|ocean_floor|motion_blocking_no_leaves|ocean_floor_wg|world_surface_wg',
  'minecraft:hex_color': 'Hex color #rrggbb',
  'minecraft:int_range': 'Integer range, e.g. 1..5',
  'minecraft:item_predicate': 'Item predicate (ID/tag, optional component predicate)',
  'minecraft:item_slot': 'Inventory slot, e.g. armor.head, weapon.mainhand',
  'minecraft:item_slots': 'Set of slots, comma-separated',
  'minecraft:item_stack': 'Item stack, e.g. minecraft:diamond_sword 1',
  'minecraft:loot_modifier': 'Loot modifier table ID',
  'minecraft:loot_predicate': 'Loot predicate table ID',
  'minecraft:loot_table': 'Loot table ID',
  'minecraft:message': 'Message text (supports @s etc. selectors)',
  'minecraft:nbt_compound_tag': 'NBT compound tag, e.g. {id:"minecraft:stone"}',
  'minecraft:nbt_path': 'NBT path, e.g. Items[0].tag',
  'minecraft:nbt_tag': 'NBT tag (any type)',
  'minecraft:objective': 'Scoreboard objective ID',
  'minecraft:objective_criteria': 'Scoreboard criteria, e.g. minecraft:damage_taken',
  'minecraft:operation': 'Scoreboard operation: += -= *= /= %= = < > ><',
  'minecraft:particle': 'Particle ID, e.g. minecraft:crit',
  'minecraft:resource': 'Registry entry',
  'minecraft:resource_key': 'Registry key (minecraft: prefix optional)',
  'minecraft:resource_location': 'Resource location ID, e.g. minecraft:diamond',
  'minecraft:resource_or_tag': 'ID or #tag',
  'minecraft:resource_or_tag_key': 'ID or #tag (key)',
  'minecraft:resource_selector': 'Resource selector',
  'minecraft:rotation': 'Rotation x y',
  'minecraft:score_holder': 'Scoreboard holder entity/name (* = all)',
  'minecraft:scoreboard_slot': 'Scoreboard slot, e.g. sidebar, red.green',
  'minecraft:style': 'Text style',
  'minecraft:swizzle': 'Axis swizzle, e.g. xyz, xz',
  'minecraft:team': 'Team ID',
  'minecraft:team_color': 'Team color',
  'minecraft:template_mirror': 'Structure mirror: none|left_right|front_back',
  'minecraft:template_rotation': 'Structure rotation: none|clockwise_90|counterclockwise_90|180',
  'minecraft:time': 'Game ticks',
  'minecraft:uuid': 'UUID',
  'minecraft:vec2': '2D coordinates x y',
  'minecraft:vec3': '3D coordinates x y z',
};

function parserProps(parser: string, props?: Record<string, unknown> | null): string {
  const desc = PARSER_DESC[parser] ?? `(parser ${parser})`;
  const bits: string[] = [];
  if (props) {
    if (props.registry) bits.push(`registry:${props.registry}`);
    if (props.type === 'players') bits.push('players only');
    if (props.type === 'entities') bits.push('entities');
    if (props.amount === 'multiple') bits.push('multiple allowed');
    if (props.amount === 'single') bits.push('single');
    if (props.type === 'greedy') bits.push('to end of line');
    if (props.type === 'word') bits.push('word');
    if (props.type === 'phrase') bits.push('phrase (quotable)');
    if (typeof props.min === 'number') bits.push(`≥${props.min}`);
    if (typeof props.max === 'number') bits.push(`≤${props.max}`);
  }
  const extra = bits.length ? ` · ${bits.join(' · ')}` : '';
  return `${desc}${extra}`;
}

// ---- node helpers ------------------------------------------------------------
const isLiteral = (n?: CommandNode): boolean => n?.type === 'literal';
const isArgument = (n?: CommandNode): boolean => n?.type === 'argument';

/** Short "what comes next" for a node: one line listing alternatives. */
function nextSummary(node: CommandNode): string[] {
  const out: string[] = [];
  const kids = node?.children ?? {};
  const literals = Object.entries(kids).filter(([, v]) => isLiteral(v)).map(([k]) => k);
  const args = Object.entries(kids).filter(([, v]) => isArgument(v)).map(([k]) => `<${k}>`);
  if (literals.length || args.length) {
    const all = [...literals, ...args];
    out.push(`Next${all.length === 1 ? '' : ` (${all.length} alternatives)`}: ${all.join(' | ')}`);
  }
  if (node?.executable) out.push('[command may end here]');
  if (node?.redirect?.length) {
    out.push(`↻ then continue (redirect → ${node.redirect.join(' ')}): ${node.redirect.join(' ')}`);
  }
  return out;
}

// ---- renderers ---------------------------------------------------------------
interface Budget { left: number; truncated: boolean }

/**
 * Render the grammar reachable from `node` starting at indent depth, WITHOUT
 * following redirects (they're shown as ↻ markers, so cycles terminate).
 */
function renderSubtree(node: CommandNode | undefined, indent: string, depth: number, seen: Set<string>, budget: Budget): string[] {
  if (!node) return [];
  if (budget.left <= 0) { budget.truncated = true; return []; }
  const lines: string[] = [];
  const truncated = depth < 0;
  const push = (line: string): boolean => {
    if (budget.left <= 0) { budget.truncated = true; return false; }
    lines.push(line);
    budget.left--;
    return true;
  };
  if (isArgument(node)) {
    push(`${indent}<...>  ${parserProps(node.parser ?? '', node.properties)}`);
  }
  const kids = node?.children ?? {};
  const entries = Object.entries(kids);
  if (entries.length) {
    const lit = entries.filter(([, v]) => isLiteral(v)).map(([k]) => k);
    const arg = entries.filter(([, v]) => isArgument(v)).map(([k]) => `<${k}>`);
    const alt = [...lit, ...arg].join(' | ');
    if (alt) {
      if (!truncated) {
        push(`${indent}└─ ${alt}`);
        for (const [k, v] of entries) {
          if (budget.left <= 0) { budget.truncated = true; break; }
          lines.push(...renderSubtree(v, `${indent}    `, depth - 1, seen, budget));
        }
      } else {
        push(`${indent}└─ ${alt}   …(deeper: use --depth=N)`);
      }
    }
  }
  if (node?.executable) push(`${indent}   ↳ command may end here`);
  if (node?.redirect?.length) {
    // dedupe: same redirect target from sibling literal branches (e.g. execute.on)
    const key = node.redirect.join(' ');
    if (!seen.has(key)) {
      seen.add(key);
      push(`${indent}   ↻ chains to: ${key} (can continue with that command's subcommands)`);
    }
  }
  return lines;
}

/**
 * Render a command path from the root, e.g. ["execute","on"].
 * Returns { path, found, lines, tip } where found=false means a segment was unknown.
 */
export function renderPath(tree: CommandTree, segs: string[], depth = 4): { found: boolean; path: string[]; lines: string[] } {
  let node: CommandNode | undefined = tree;
  const walked: string[] = [];
  for (const seg of segs) {
    const next: CommandNode | undefined = node?.children?.[seg];
    if (!next) {
      const known = Object.keys(node?.children ?? {}).sort();
      const tip = known.length
        ? `"${seg}" is not under ${walked.join(' ')}. Known next level: ${known.join(', ')}`
        : `"${seg}" has no further subcommands.`;
      return { found: false, path: walked, lines: [tip] };
    }
    walked.push(seg);
    node = next;
  }

  // node is guaranteed defined here: the loop above returns early whenever a segment is missing.
  const n = node!;
  const lines: string[] = [];
  lines.push(`Command path: ${walked.join(' ')}`);
  if (isArgument(n)) {
    lines.push(`Argument: <${walked[walked.length - 1]}>  ${parserProps(n.parser ?? '', n.properties)}`);
  }
  lines.push(...nextSummary(n));
  if (depth > 0 && Object.keys(n.children ?? {}).length) {
    lines.push('');
    lines.push(`— expansion (depth=${depth}, redirects not followed to avoid cycles) —`);
    const budget: Budget = { left: 500, truncated: false };
    lines.push(...renderSubtree(n, '', depth, new Set(), budget));
    if (budget.truncated) lines.push('…(line count over 500 limit, output truncated; narrow the path like --syntax="execute if block" to see more)');
  }
  return { found: true, path: walked, lines };
}

/** Render grammar for every top-level command (for --dump / --dump-all). */
export function renderAll(tree: CommandTree, depth = 2): { count: number; text: string } {
  const names = Object.keys(tree.children ?? {}).sort();
  const blocks: string[] = [];
  for (const name of names) {
    const { lines } = renderPath(tree, [name], depth);
    blocks.push(`## ${name}\n\n\`\`\`\n${lines.join('\n')}\n\`\`\``);
  }
  return { count: names.length, text: blocks.join('\n\n') };
}
