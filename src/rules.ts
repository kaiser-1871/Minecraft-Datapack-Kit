// rules.ts — project-level consistency lint (not syntax errors).
//
// The engine answers "is this file valid for this version"; rules answer "is the project
// internally consistent". They are intentionally heuristic and default OFF: a rule alert is a
// warning with evidence + confidence, never an unqualified "you must fix this".
//
// Rules implemented:
//   cleanup-id-coverage          — IDs seen by a class's files but missing from cleanup_strays
//   on-eat-completeness          — on_eat_* callbacks should call give_*, set *_eaten, have a
//                                  passive safety net, and revoke the advancement
//   advancement-revoke-coverage  — advancements with rewards.function should be revoked somewhere
//   attribute-modifier-cleanup   — attribute modifier add should have a matching remove
//   schedule-cleanup             — schedule function should have a matching schedule clear

import { readFileSync } from 'node:fs';
import { basename, dirname, join } from 'node:path';
import { collectFiles } from './collect.js';
import { overlayDirsOf } from './pack-mcmeta.js';
import type { RuleAlert, RuleReport } from './types.js';

export const BUILTIN_RULES = [
  'cleanup-id-coverage',
  'on-eat-completeness',
  'advancement-revoke-coverage',
  'attribute-modifier-cleanup',
  'schedule-cleanup',
] as const;

export type BuiltinRuleName = typeof BUILTIN_RULES[number];

export interface RuleOptions {
  /** Rule names to run. Empty/undefined = no rules. */
  rules?: string[];
  /** Whether suggestions may be emitted (default false). */
  suggestions?: boolean;
}

interface FileEntry {
  file: string;
  rel: string;
  text: string;
}

function loadFiles(datapack: string): FileEntry[] {
  const overlays = overlayDirsOf(datapack);
  const { files, rels } = collectFiles(datapack, '', overlays);
  const out: FileEntry[] = [];
  for (let i = 0; i < files.length; i++) {
    try {
      out.push({ file: files[i], rel: rels[i], text: readFileSync(files[i], 'utf8') });
    } catch {
      // Unreadable files are reported by the main check; rules skip them conservatively.
    }
  }
  return out;
}

/** Extract plausible item IDs from a line. Conservative: only `ns:path` tokens in item-ish commands. */
const ITEM_COMMAND_RE = /\b(?:give|clear|replaceitem|item|loot)\b[^\n]*?\b((?:minecraft|[a-z0-9_.-]+):[a-z0-9_./-]+)/g;

function itemIdsInText(text: string): { id: string; line: number }[] {
  const out: { id: string; line: number }[] = [];
  text.split('\n').forEach((line, idx) => {
    if (!/\b(?:give|clear|replaceitem|item|loot)\b/.test(line)) return;
    const re = /\b((?:minecraft|[a-z0-9_.-]+):[a-z0-9_./-]+)/g;
    let m: RegExpExecArray | null;
    while ((m = re.exec(line)) !== null) {
      const id = m[1];
      if (id.startsWith('#') || id.startsWith('minecraft:air')) continue;
      out.push({ id, line: idx + 1 });
    }
  });
  return out;
}

function evidence(entry: FileEntry, line: number, detail?: string): string {
  const loc = `${entry.rel}:${line}`;
  return detail ? `${loc}  (${detail})` : loc;
}

function ruleCleanupIdCoverage(files: FileEntry[]): RuleAlert[] {
  const alerts: RuleAlert[] = [];
  // Group by "class" = parent directory of the function file, e.g. data/battle/function/archer.
  const groups = new Map<string, FileEntry[]>();
  for (const f of files) {
    if (!f.rel.includes('/function/') || !f.file.endsWith('.mcfunction')) continue;
    const dir = dirname(f.rel);
    if (!groups.has(dir)) groups.set(dir, []);
    groups.get(dir)!.push(f);
  }

  for (const [dir, entries] of groups) {
    const cleanupStrays = entries.find(e => basename(e.file).startsWith('cleanup_strays'));
    if (!cleanupStrays) continue;
    const strays = new Set(itemIdsInText(cleanupStrays.text).map(x => x.id));
    const seen = new Map<string, { file: string; line: number }[]>();
    for (const e of entries) {
      const name = basename(e.file);
      const relevant = name.startsWith('cleanup_drops') || name.startsWith('class_strip_') || name.startsWith('give_') || name === 'load.mcfunction';
      if (!relevant) continue;
      for (const hit of itemIdsInText(e.text)) {
        if (strays.has(hit.id)) continue;
        const list = seen.get(hit.id) ?? [];
        list.push({ file: e.rel, line: hit.line });
        seen.set(hit.id, list);
      }
    }
    for (const [id, locs] of seen) {
      alerts.push({
        rule: 'cleanup-id-coverage',
        severity: 'warning',
        confidence: 0.8,
        message: `${dir}/cleanup_strays 未识别 ${id}，但同职业其他文件识别了`,
        evidence: locs.map(l => `${l.file}:${l.line}`),
        suggestion: null,
        suggestion_confidence: null,
      });
    }
  }
  return alerts;
}

function ruleOnEatCompleteness(files: FileEntry[]): RuleAlert[] {
  const alerts: RuleAlert[] = [];
  const onEat = files.filter(e => basename(e.file).startsWith('on_eat_') && e.file.endsWith('.mcfunction'));
  for (const e of onEat) {
    const dir = dirname(e.rel);
    const passive = files.find(x => dirname(x.rel) === dir && basename(x.file).startsWith('passive') && x.file.endsWith('.mcfunction'));
    const missing: string[] = [];
    const evidenceList: string[] = [];
    if (!/give_[A-Za-z0-9_]+/.test(e.text)) missing.push('调用 give_*');
    if (!/_eaten/.test(e.text)) missing.push('设置 *_eaten');
    if (!passive || !/_eaten/.test(passive.text)) {
      missing.push('passive 中存在对应 *_eaten 安全网');
      if (passive) evidenceList.push(`${passive.rel}:1`);
    }
    if (!/advancement\s+revoke/.test(e.text)) missing.push('advancement revoke');
    if (missing.length) {
      evidenceList.unshift(`${e.rel}:1`);
      alerts.push({
        rule: 'on-eat-completeness',
        severity: 'warning',
        confidence: 0.7,
        message: `${e.rel} 可能不完整：缺少 ${missing.join('、')}`,
        evidence: evidenceList,
        suggestion: null,
        suggestion_confidence: null,
      });
    }
  }
  return alerts;
}

function ruleAdvancementRevokeCoverage(files: FileEntry[]): RuleAlert[] {
  const alerts: RuleAlert[] = [];
  const advancements = files.filter(e => e.rel.includes('/advancement/') && e.file.endsWith('.json'));
  const allText = new Map(files.filter(f => f.file.endsWith('.mcfunction')).map(f => [f.rel, f.text]));

  for (const adv of advancements) {
    let json: unknown;
    try { json = JSON.parse(adv.text); } catch { continue; }
    const obj = json as { rewards?: { function?: string } };
    const rewardFn = obj.rewards?.function;
    if (typeof rewardFn !== 'string' || !rewardFn) continue;

    // advancement id = rel path without data/<ns>/advancement/ and .json, as ns:path.
    const m = adv.rel.match(/^([^/]+)\/advancement\/(.+)\.json$/);
    if (!m) continue;
    const advId = `${m[1]}:${m[2]}`;
    const rewardNs = rewardFn.includes(':') ? rewardFn.slice(0, rewardFn.indexOf(':')) : m[1];
    const rewardPath = rewardFn.includes(':') ? rewardFn.slice(rewardFn.indexOf(':') + 1) : rewardFn;
    const rewardText = allText.get(`${rewardNs}/function/${rewardPath}.mcfunction`) ?? '';
    const loadText = allText.get(`${m[1]}/function/load.mcfunction`) ?? '';
    const haystack = `${rewardText}\n${loadText}`;
    const revoked = new RegExp(`advancement\\s+revoke[^\\n]*?${escapeRegExp(advId)}`, 'i').test(haystack)
      || new RegExp(`advancement\\s+revoke[^\\n]*?${escapeRegExp(advId.split(':')[1])}`, 'i').test(haystack);
    if (!revoked) {
      alerts.push({
        rule: 'advancement-revoke-coverage',
        severity: 'warning',
        confidence: 0.7,
        message: `advancement ${advId} 带 rewards.function，但未在 reward 函数或 load 中找到对应 revoke`,
        evidence: [`${adv.rel}:1`],
        suggestion: null,
        suggestion_confidence: null,
      });
    }
  }
  return alerts;
}

function ruleAttributeModifierCleanup(files: FileEntry[]): RuleAlert[] {
  const alerts: RuleAlert[] = [];
  const mc = files.filter(f => f.file.endsWith('.mcfunction'));
  const stripLoadText = mc
    .filter(f => basename(f.file).startsWith('class_strip_') || basename(f.file) === 'load.mcfunction')
    .map(f => f.text)
    .join('\n');

  for (const e of mc) {
    e.text.split('\n').forEach((line, idx) => {
      const m = /\battribute\s+[^\n]*?\bmodifier\s+add\b[^\n]*?\s([^\s]+)\s*$/.exec(line);
      if (!m) return;
      const modifier = m[1].replace(/[",]/g, '');
      if (!modifier) return;
      const removeRe = new RegExp(`\\bmodifier\\s+remove\\b[^\\n]*?${escapeRegExp(modifier)}`, 'i');
      if (!removeRe.test(stripLoadText)) {
        alerts.push({
          rule: 'attribute-modifier-cleanup',
          severity: 'warning',
          confidence: 0.7,
          message: `${e.rel}:${idx + 1} 添加了 attribute modifier ${modifier}，但 class_strip_*/load 中未找到对应 remove`,
          evidence: [`${e.rel}:${idx + 1}`],
          suggestion: null,
          suggestion_confidence: null,
        });
      }
    });
  }
  return alerts;
}

function ruleScheduleCleanup(files: FileEntry[]): RuleAlert[] {
  const alerts: RuleAlert[] = [];
  const mc = files.filter(f => f.file.endsWith('.mcfunction'));
  const resetLoadText = mc
    .filter(f => basename(f.file).startsWith('reset') || basename(f.file) === 'load.mcfunction')
    .map(f => f.text)
    .join('\n');

  for (const e of mc) {
    e.text.split('\n').forEach((line, idx) => {
      const m = /\bschedule\s+function\s+([^\s]+)/.exec(line);
      if (!m) return;
      const fn = m[1].replace(/[",]/g, '');
      const clearRe = new RegExp(`\\bschedule\\s+clear\\b[^\\n]*?${escapeRegExp(fn)}`, 'i');
      if (!clearRe.test(resetLoadText)) {
        alerts.push({
          rule: 'schedule-cleanup',
          severity: 'warning',
          confidence: 0.7,
          message: `${e.rel}:${idx + 1} 调度了 ${fn}，但 reset/load 中未找到对应 schedule clear`,
          evidence: [`${e.rel}:${idx + 1}`],
          suggestion: null,
          suggestion_confidence: null,
        });
      }
    });
  }
  return alerts;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Run the selected built-in project rules against a datapack. */
export function runRules(datapack: string, opts: RuleOptions = {}): RuleReport {
  const enabled = new Set(opts.rules ?? []);
  if (enabled.size === 0) return { checked: 0, alerts: 0, items: [] };

  const files = loadFiles(datapack);
  const items: RuleAlert[] = [];
  let checked = 0;

  const run = (name: BuiltinRuleName, fn: (files: FileEntry[]) => RuleAlert[]): void => {
    if (!enabled.has(name)) return;
    checked++;
    items.push(...fn(files));
  };

  run('cleanup-id-coverage', ruleCleanupIdCoverage);
  run('on-eat-completeness', ruleOnEatCompleteness);
  run('advancement-revoke-coverage', ruleAdvancementRevokeCoverage);
  run('attribute-modifier-cleanup', ruleAttributeModifierCleanup);
  run('schedule-cleanup', ruleScheduleCleanup);

  // Suggestions are only added when explicitly enabled; built-in rules currently do not emit
  // suggestions, but the field is always present and null.
  if (opts.suggestions) {
    // Reserved: future rule suggestions can be attached here when confidence >= 0.9.
  }

  return { checked, alerts: items.length, items };
}

/** Resolve a comma-separated rule list into enabled rule names (unknown names are ignored). */
export function parseRuleList(value: string | undefined): string[] {
  if (!value) return [];
  return value.split(',').map(s => s.trim()).filter(Boolean);
}
