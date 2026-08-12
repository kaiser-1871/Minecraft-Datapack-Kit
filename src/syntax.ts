// syntax.ts — Offline grammar dump of a Minecraft version's command tree.
//
// Reads the same per-version command data that the Spyglass language server downloads
// from api.spyglassmc.com and caches under %LOCALAPPDATA%\spyglassmc-nodejs\Cache.
// Renders a compact, human/AI-readable grammar for a command path (e.g. "execute on")
// or for the whole tree. No server, no network, no game needed — pure cache read.
//
// Port of the original syntax.mjs with TypeScript annotations.

import { readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { DEFAULT_VERSION } from './config.js';

// ---- cache access -----------------------------------------------------------
function cacheDir(): string {
  return join(process.env.LOCALAPPDATA ?? '', 'spyglassmc-nodejs', 'Cache');
}

// Memoized cache index. Keyed by index.json mtime so the engine's cache refresh during a
// check invalidates it (an index read before the refresh would otherwise serve stale entries).
let indexMemo: { mtime: number; index: unknown } | null = null;
function readIndex(): unknown {
  const indexPath = join(cacheDir(), 'http', 'index.json');
  let mtime = 0;
  try { mtime = statSync(indexPath).mtimeMs; } catch { /* no index yet */ }
  if (indexMemo?.mtime === mtime) return indexMemo.index;
  let index: unknown = null;
  try { index = JSON.parse(readFileSync(indexPath, 'utf8')); } catch { /* unreadable */ }
  indexMemo = { mtime, index };
  return index;
}

/**
 * Read the cached version list (/mcje/versions) as an array, or null if not cached.
 * The array is sorted newest-first; each entry has { id, type: 'release'|'snapshot',
 * data_pack_version, resource_pack_version }.
 */
export function loadCachedVersions(): unknown[] | null {
  const base = cacheDir();
  const index = readIndex() as { index?: Record<string, unknown> } | null;
  const rec = (index?.index as Record<string, { ''?: { sha1?: string } }> | undefined)?.['https://api.spyglassmc.com/mcje/versions']?.[''];
  if (!rec) return null;
  try {
    const objPath = join(base, 'http', 'objects', rec.sha1!.slice(0, 2), rec.sha1!);
    const d = JSON.parse(readFileSync(objPath, 'utf8'));
    return Array.isArray(d) ? d : null;
  } catch { return null; }
}

/**
 * Resolve a version specifier to a concrete version id we have data for.
 * 'auto' / 'latest release' / 'latest snapshot' → the latest release (or, failing
 * that, the newest entry) in the local cache; a concrete id passes through unchanged.
 * Throws a helpful error when nothing is cached yet.
 */
export function resolveConcreteVersion(version: string): string {
  if (!['auto', 'latest release', 'latest snapshot'].includes(version)) return version;
  const cached = loadCachedVersions();
  if (Array.isArray(cached) && cached.length) {
    const entries = cached as Array<{ type?: string; id?: string }>;
    const release = entries.find(v => v.type === 'release');
    const pick = release ?? entries[0];
    if (pick?.id) return pick.id;
  }
  throw new Error(
    `[dpkit] 版本 '${version}' 需要解析成具体版本,但本地还没有版本缓存。请先在线跑一次 node dpkit.mjs 下载数据,或用 --version=<具体版本> 指定。`,
  );
}

/** Set of version ids whose command data is already cached locally. */
export function cachedCommandVersions(): Set<string> {
  const index = readIndex() as { index?: Record<string, unknown> } | null;
  const out = new Set<string>();
  for (const k of Object.keys(index?.index ?? {})) {
    const m = k.match(/\/mcje\/versions\/([^/]+)\/commands$/);
    if (m) out.add(decodeURIComponent(m[1]));
  }
  return out;
}

/**
 * Load the parsed command tree for a version from the local HTTP cache.
 * Returns the root node { type:'root', children } or throws a helpful Error.
 */
export function loadCommandTree(version: string = DEFAULT_VERSION): CommandNode {
  const concrete = resolveConcreteVersion(version);
  const base = cacheDir();
  const index = readIndex() as { index?: Record<string, { '': { sha1?: string } }> } | null;
  const url = `https://api.spyglassmc.com/mcje/versions/${concrete}/commands`;
  const rec = index?.index?.[url]?.[''];
  if (!rec?.sha1) {
    throw new Error(`缓存里没有版本 ${concrete} 的命令数据 (${url})。请先跑一次 node dpkit.mjs --version=${concrete} 下载。`);
  }
  const objPath = join(base, 'http', 'objects', rec.sha1.slice(0, 2), rec.sha1);
  return JSON.parse(readFileSync(objPath, 'utf8'));
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

// ---- parser → Chinese description map ---------------------------------------
// properties are appended where relevant (ranges, entity type/amount, registry).
const PARSER_DESC: Record<string, string> = {
  'brigadier:bool': '布尔值',
  'brigadier:double': '浮点数',
  'brigadier:float': '浮点数',
  'brigadier:integer': '整数',
  'brigadier:string': '字符串',
  'minecraft:block_pos': '方块坐标 x y z',
  'minecraft:block_predicate': '方块谓词(ID/标签,可带状态谓词)',
  'minecraft:block_state': '方块状态,如 minecraft:stone[axis=y]',
  'minecraft:column_pos': '列坐标',
  'minecraft:component': '数据组件 ID,如 minecraft:damage、minecraft:food',
  'minecraft:dialog': '对话框 ID',
  'minecraft:dimension': '维度 ID,如 minecraft:overworld',
  'minecraft:entity': '实体/玩家选择器',
  'minecraft:entity_anchor': '锚点: eyes | feet',
  'minecraft:float_range': '浮点区间,如 1.5..5',
  'minecraft:function': '函数 ID,如 minecraft:foo/bar',
  'minecraft:game_profile': '玩家名或玩家选择器',
  'minecraft:gamemode': '游戏模式: survival|creative|adventure|spectator',
  'minecraft:heightmap': '高度图: world_surface|motion_blocking|ocean_floor|motion_blocking_no_leaves|ocean_floor_wg|world_surface_wg',
  'minecraft:hex_color': '十六进制颜色 #rrggbb',
  'minecraft:int_range': '整数区间,如 1..5',
  'minecraft:item_predicate': '物品谓词(ID/标签,可带组件谓词)',
  'minecraft:item_slot': '物品栏槽位,如 armor.head、weapon.mainhand',
  'minecraft:item_slots': '槽位集合,用 , 分隔',
  'minecraft:item_stack': '物品堆,如 minecraft:diamond_sword 1',
  'minecraft:loot_modifier': '战利品修饰表 ID',
  'minecraft:loot_predicate': '战利品谓词表 ID',
  'minecraft:loot_table': '战利品表 ID',
  'minecraft:message': '消息文本(支持 @s 等选择器)',
  'minecraft:nbt_compound_tag': 'NBT 复合标签,如 {id:"minecraft:stone"}',
  'minecraft:nbt_path': 'NBT 路径,如 Items[0].tag',
  'minecraft:nbt_tag': 'NBT 任意标签',
  'minecraft:objective': '计分板目标 ID',
  'minecraft:objective_criteria': '计分板判据,如 minecraft:damage_taken',
  'minecraft:operation': '计分板操作: += -= *= /= %= = < > ><',
  'minecraft:particle': '粒子 ID,如 minecraft:crit',
  'minecraft:resource': '注册表条目',
  'minecraft:resource_key': '注册表键(可省略 minecraft:)',
  'minecraft:resource_location': '资源位置 ID,如 minecraft:diamond',
  'minecraft:resource_or_tag': 'ID 或 #标签',
  'minecraft:resource_or_tag_key': 'ID 或 #标签(键)',
  'minecraft:resource_selector': '资源选择器',
  'minecraft:rotation': '旋转 x y',
  'minecraft:score_holder': '计分板实体/名字(* 表示全部)',
  'minecraft:scoreboard_slot': '计分板槽位,如 sidebar、red.green',
  'minecraft:style': '文本样式',
  'minecraft:swizzle': '轴序,如 xyz、xz',
  'minecraft:team': '队伍 ID',
  'minecraft:team_color': '队伍颜色',
  'minecraft:template_mirror': '结构镜像: none|left_right|front_back',
  'minecraft:template_rotation': '结构旋转: none|clockwise_90|counterclockwise_90|180',
  'minecraft:time': '游戏刻数',
  'minecraft:uuid': 'UUID',
  'minecraft:vec2': '2D 坐标 x y',
  'minecraft:vec3': '3D 坐标 x y z',
};

function parserProps(parser: string, props?: Record<string, unknown> | null): string {
  const desc = PARSER_DESC[parser] ?? `(parser ${parser})`;
  const bits: string[] = [];
  if (props) {
    if (props.registry) bits.push(`注册表:${props.registry}`);
    if (props.type === 'players') bits.push('限玩家');
    if (props.type === 'entities') bits.push('实体');
    if (props.amount === 'multiple') bits.push('可多个');
    if (props.amount === 'single') bits.push('单个');
    if (props.type === 'greedy') bits.push('到行尾');
    if (props.type === 'word') bits.push('单词');
    if (props.type === 'phrase') bits.push('短语(可引号)');
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
    out.push(`下一项${all.length === 1 ? '' : `(${all.length}选1)`}: ${all.join(' | ')}`);
  }
  if (node?.executable) out.push('【命令可在此结束】');
  if (node?.redirect?.length) {
    out.push(`↻ 之后继续(redirect → ${node.redirect.join(' ')}): ${node.redirect.join(' ')}`);
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
        push(`${indent}└─ ${alt}   …(更深用 --depth=N)`);
      }
    }
  }
  if (node?.executable) push(`${indent}   ↳ 命令可在此结束`);
  if (node?.redirect?.length) {
    // dedupe: same redirect target from sibling literal branches (e.g. execute.on)
    const key = node.redirect.join(' ');
    if (!seen.has(key)) {
      seen.add(key);
      push(`${indent}   ↻ 链回: ${key} (可继续跟该命令的后续子命令)`);
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
        ? `“${seg}” 不在 ${walked.join(' ')} 之下。已知下一级: ${known.join(', ')}`
        : `“${seg}” 处没有更多子命令。`;
      return { found: false, path: walked, lines: [tip] };
    }
    walked.push(seg);
    node = next;
  }

  // node is guaranteed defined here: the loop above returns early whenever a segment is missing.
  const n = node!;
  const lines: string[] = [];
  lines.push(`命令路径: ${walked.join(' ')}`);
  if (isArgument(n)) {
    lines.push(`参数: <${walked[walked.length - 1]}>  ${parserProps(n.parser ?? '', n.properties)}`);
  }
  lines.push(...nextSummary(n));
  if (depth > 0 && Object.keys(n.children ?? {}).length) {
    lines.push('');
    lines.push(`— 展开 (depth=${depth},不跟随 redirect 以防循环) —`);
    const budget: Budget = { left: 500, truncated: false };
    lines.push(...renderSubtree(n, '', depth, new Set(), budget));
    if (budget.truncated) lines.push('…(行数超 500 上限, 输出被截断; 收窄路径如 --syntax="execute if block" 可看更多)');
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
