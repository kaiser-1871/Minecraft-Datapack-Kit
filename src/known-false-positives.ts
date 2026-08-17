// known-false-positives.ts — version-aware, data-driven rules for diagnostics that Minecraft
// accepts but Spyglass's schema rejects. Rules are independent from --ignore (they are applied
// before user patterns), can be enabled/disabled as a set via config/CLI, and may have
// since/until game-version bounds.
import { compareGameVersions } from './version.js';
import type { RawDiagnostic } from './types.js';

export interface KnownFpContext {
  /** Effective concrete version when known (may be 'auto' or a raw alias otherwise). */
  version: string;
  /** data/-relative file (pack.mcmeta for the root metadata file). */
  rel: string;
  /** Full file text, when available, for content-aware rules. */
  fileText?: string;
}

export interface KnownFpRule {
  name: string;
  description: string;
  since?: string;
  until?: string;
  matches: (d: RawDiagnostic, ctx: KnownFpContext) => boolean;
}

function lineText(ctx: KnownFpContext, d: RawDiagnostic): string {
  if (!ctx.fileText) return '';
  const line = d.range.start.line;
  return ctx.fileText.split('\n')[line] ?? '';
}

function versionAllows(rule: KnownFpRule, version: string): boolean {
  if (rule.since && compareGameVersions(version, rule.since) < 0) return false;
  if (rule.until && compareGameVersions(version, rule.until) >= 0) return false;
  return true;
}

export const KNOWN_FP_RULES: KnownFpRule[] = [
  {
    name: 'overlay-formats-single-int',
    description: 'overlays.entries[].formats written as a single integer (Minecraft accepts [n,n] shorthand)',
    matches: (d, ctx) => {
      if (ctx.rel !== 'pack.mcmeta') return false;
      if (!/supported_formats must be an array or an object/.test(d.message)) return false;
      return /"formats"\s*:\s*\d+\s*[,}]/.test(ctx.fileText ?? '');
    },
  },
  {
    name: 'text-opacity-negative-one',
    description: 'text_opacity:-1b (valid "inherit opacity" byte; schema expects a 0..255 number)',
    since: '1.21.4',
    matches: (d, ctx) => /Expected numeric value to be at least 0 and at most 255/.test(d.message)
      && /text_opacity\s*:\s*-1b\b/.test(lineText(ctx, d)),
  },
  {
    name: 'glow-color-override-negative-one',
    description: 'glow_color_override:-1 (valid "no override" sentinel; schema expects a non-negative number)',
    since: '1.21.4',
    matches: (d, ctx) => /Expected numeric value to be at least 0/.test(d.message)
      && /glow_color_override\s*:\s*-1\b/.test(lineText(ctx, d)),
  },
  {
    name: 'interaction-response-byte',
    description: 'interaction response:3b — a byte-valued response that schema misreads as boolean',
    matches: (d, ctx) => /Expected a boolean/.test(d.message)
      && /response\s*:\s*\d+b\b/.test(lineText(ctx, d)),
  },
  {
    name: 'custom-model-data-predicate',
    description: 'minecraft:custom_model_data as a data_component_predicate_type accepts scalar/list forms',
    since: '1.21.4',
    matches: (d, ctx) => /Expected a map-like|Expected a list/.test(d.message)
      && /"minecraft:custom_model_data"\s*:/.test(lineText(ctx, d)),
  },
  {
    name: 'macro-line-no-arguments',
    description: 'a $ macro line with no $(...) is valid in-game (empty macro variable list); Spyglass requires at least one',
    since: '1.20.2',
    matches: (d, ctx) => /Expected at least one macro argument/.test(d.message)
      && /^\s*\$/.test(lineText(ctx, d))
      && !lineText(ctx, d).includes('$('),
  },
  {
    name: 'max-format-unbounded',
    description: 'max_format:9999999 is the unbounded sentinel, not a real 26.x pack format',
    matches: (d, ctx) => /pack format 9999999|9999999 is newer/.test(d.message)
      && /"max_format"\s*:\s*9999999/.test(ctx.fileText ?? ''),
  },
  {
    name: 'nbt-rotation-list-length',
    description: 'Rotation:[0f] etc. — Minecraft accepts a one-element Rotation list (and tolerates wrong lengths); Spyglass requires exactly 2',
    matches: (d, ctx) => /Expected collection length to be at least 2 and at most 2/.test(d.message)
      && /Rotation\s*:\s*\[/.test(lineText(ctx, d)),
  },
  {
    name: 'nbt-int-for-boolean',
    description: 'NBT boolean fields written as 0/1 integers — Minecraft accepts byte booleans without the b suffix',
    matches: (d, ctx) => /Expected a boolean/.test(d.message)
      && (/\{\s*[^}]*:\s*[01]\s*[,}]/.test(lineText(ctx, d))
        || /data\s+modify\s+entity\s+\S+\s+\S+\s+set\s+value\s+[01]\b/.test(lineText(ctx, d))),
  },
  {
    name: 'nbt-int-for-short',
    description: 'NBT short fields written as plain integers — Minecraft accepts unsuffixed integers for short/byte fields',
    matches: (d, ctx) => /Expected a short/.test(d.message)
      && ( /:\s*-?\d+\s*[,}]/.test(lineText(ctx, d))
        || /data\s+modify\s+entity\s+\S+\s+\S+\s+set\s+value\s+-?\d+\b/.test(lineText(ctx, d)) ),
  },
  {
    name: 'tp-trailing-whitespace-rotation',
    description: 'tp ... ~ <trailing space> — Minecraft ignores trailing whitespace; Spyglass treats it as a missing rotation/facing argument',
    matches: (d, ctx) => /Expected facing\|<rotation: rotation>/.test(d.message)
      && /\btp\b/.test(lineText(ctx, d))
      && /\s$/.test(lineText(ctx, d)),
  },
  {
    name: 'trailing-whitespace-optional-argument',
    description: 'Trailing whitespace after a complete command makes Spyglass expect an optional next argument; Minecraft ignores trailing whitespace',
    matches: (d, ctx) => /\s$/.test(lineText(ctx, d))
      && /^Expected (?:<viewers: entity>|<hideParticles: bool>|force\|normal|append\|replace|<minVolume: float>|<delta: vec3>|<scale: double>|<facingAnchor: entity_anchor>|facing\|<rotation: rotation>)/.test(d.message),
  },
  {
    name: 'loot-table-none-empty-sentinel',
    description: 'DeathLootTable:"none"/"empty" (also resolved as minecraft:none/minecraft:empty) — Minecraft accepts these no-loot sentinels',
    matches: (d, ctx) => /Cannot find loot_table “minecraft:(none|empty)”/.test(d.message),
  },
  {
    name: 'text-component-empty-color',
    description: 'Text component "color":"" — Minecraft treats an empty color as default; Spyglass expects a color name or #hex',
    matches: (d, ctx) => /Expected “#”/.test(d.message)
      && /"color"\s*:\s*""/.test(lineText(ctx, d)),
  },
];

/** Categories where a missing symbol may simply live in another datapack (--workspace). */
export const SCOPE_HINT_CATEGORIES = new Set([
  'function', 'tag/function', 'tag/advancement', 'tag/loot_table', 'tag/predicate',
  'tag/item_modifier', 'tag/recipe', 'advancement', 'loot_table', 'predicate',
  'item_modifier', 'recipe', 'sound_event',
  'objective', 'team', 'structure',
]);

/**
 * The set of enabled rule names. `null` = all rules disabled, `undefined`-ish config = all
 * enabled. `useIgnore` follows the existing --no-ignore semantics: raw mode disables built-ins.
 */
export function enabledKnownFpRules(
  config: boolean | string[] | undefined,
  useIgnore: boolean,
): Set<string> {
  if (!useIgnore || config === false) return new Set();
  if (Array.isArray(config)) return new Set(config);
  return new Set([...KNOWN_FP_RULES.map(r => r.name), 'cross-pack-scope-hint']);
}

/** Test a diagnostic against the enabled known-false-positive rules. */
export function matchKnownFalsePositive(
  d: RawDiagnostic,
  ctx: KnownFpContext,
  enabled: Set<string>,
): KnownFpRule | null {
  for (const rule of KNOWN_FP_RULES) {
    if (!enabled.has(rule.name)) continue;
    if (!versionAllows(rule, ctx.version)) continue;
    if (rule.matches(d, ctx)) return rule;
  }
  return null;
}
