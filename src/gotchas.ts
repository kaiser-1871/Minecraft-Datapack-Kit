// gotchas.ts — known-gotcha scanner (heuristic, content-level: works for any datapack).
// The mcfunction-line gotchas (particle-bare-id / nbt-field-casing / attribute-multiplier)
// moved into the engine as linter rules (java-edition/src/mcfunction/linter.ts); the check
// path calls scanGotchas with mcfunction=false and gets those from the engine instead. The
// JSON gotchas (advancement structure) stay here as post-processing. The standalone MCP
// scan_gotchas tool uses the full scan (mcfunction defaults to true).
// Best-effort only: warnings never affect the exit code. Messages prefix the version that was
// actually checked, never hard-coded.
import { readFileSync } from 'node:fs';
import type { GotchaIssue } from './types.js';

const lineOf = (text: string, needle: string, from = 0): number | null => {
  const i = text.indexOf(needle, from);
  return i < 0 ? null : text.slice(0, i).split('\n').length;
};

/** Scan a single data/-relative file for known silent-failure patterns. `text`, when
 * supplied, avoids re-reading the file (the caller has often already read it). `mcfunction`
 * gates the mcfunction-line heuristics — the check path disables them (the engine's linters
 * cover those now), the standalone MCP scan keeps them. */
export function scanGotchas(filePath: string, rel: string, version: string, text?: string, mcfunction = true): GotchaIssue[] {
  if (text === undefined) {
    try { text = readFileSync(filePath, 'utf8'); } catch { return []; }
  }
  const out: GotchaIssue[] = [];
  if (filePath.endsWith('.json')) {
    // 1. source_entity/direct_entity attached directly to the damage object (should be under
    //    damage.type; the wrong level silently drops the whole advancement)
    const m1 = text.match(/"damage"\s*:\s*\{\s*[^{}]*?"(source_entity|direct_entity)"\s*:/);
    if (m1) out.push({ line: lineOf(text, `"${m1[1]}"`) ?? 1, key: 'damage-nesting', msg: `${version}: source_entity/direct_entity must go under damage.type (the damage object only has dealt/taken/blocked/type). Putting them at the damage level silently drops the whole advancement → use "damage": {"type": {"source_entity": {...}}}` });
    // 2. multiple criteria sharing one trigger + a requirements OR (does not fire in this version)
    try {
      const obj = JSON.parse(text) as unknown;
      const walk = (v: unknown): void => {
        if (Array.isArray(v)) { v.forEach(walk); return; }
        if (v && typeof v === 'object') {
          const rec = v as Record<string, unknown>;
          if ('criteria' in rec && typeof rec.criteria === 'object' && rec.criteria !== null && Array.isArray(rec.requirements) && rec.requirements.length >= 2) {
            const trig = Object.values(rec.criteria as Record<string, { trigger?: string }>).map(c => c?.trigger).filter(Boolean);
            const dup = trig.length !== new Set(trig).size;
            const or = (rec.requirements as unknown[]).some(g => Array.isArray(g) && g.length <= 1);
            if (dup && or) out.push({ line: lineOf(text, '"criteria"') ?? 1, key: 'multi-criteria-OR', msg: `${version}: multiple criteria sharing one trigger + a requirements OR does not fire (observed). Split multi-source listening into separate advancements, one criteria each, sharing the same reward callback.` });
          }
          Object.values(rec).forEach(walk);
        }
      };
      walk(obj);
    } catch { /* not valid JSON — the engine already reported a parse error, skip */ }
  } else if (filePath.endsWith('.mcfunction') && mcfunction) {
    const lines = text.split('\n');
    lines.forEach((L, i) => {
      const n = i + 1;
      // 3. parameterized particle with a bare ID (item/block args require map syntax, else the whole function fails to load)
      const pm = L.match(/\bparticle\s+minecraft:(item|block)\s+[a-z0-9_:]+/);
      if (pm) out.push({ line: n, key: 'particle-bare-id', msg: `${version}: the parameterized particle ${pm[1]} needs map syntax ({item:...}/{block_state:...}); a bare ID stops the whole function from loading` });
      // 4. summon entity NBT in snake_case/lowercase field names (silently ignored; must be PascalCase)
      if (/\bsummon\b/.test(L)) {
        const sk = L.match(/\b(tags|duration|wait_time|silent|radius|age|health|custom_name|invisible)\s*:/);
        if (sk) out.push({ line: n, key: 'nbt-field-casing', msg: `${version}: entity NBT fields are PascalCase (e.g. ${sk[1]} → ${sk[1][0].toUpperCase()}${sk[1].slice(1)}); lowercase/snake_case is silently ignored in summon` });
      }
      // 5. add_multiplied_* direction semantics: the value is a multiplier ×(1+v), not "add v".
      //    26.2 shape: attribute <target> <attribute> modifier add <id> <value> <operation>
      //    (operation literal comes after value; add_value has different semantics so it doesn't
      //    trigger; modifier remove/value get has no operation so it isn't a false positive)
      const am = L.match(/\battribute\s+(\S+)\s+(\S+)\s+modifier\s+add\s+\S+\s+(-?[\d.]+)\s+(add_multiplied_base|add_multiplied_total)\b/);
      if (am) {
        const attr = am[2].replace(/^minecraft:/, '');
        const value = Number(am[3]);
        const isSpeedFamily = /(speed|efficiency|jump_strength|scale|gravity|step_height|block_break|mining)/.test(attr);
        if (isSpeedFamily && value > 0 && value < 1) {
          out.push({
            line: n,
            key: 'attribute-multiplier-direction',
            msg: `${version}: attribute modifier ${am[4]} is a multiplier ×(1+v): v=${am[3]} → ×${(1 + value).toFixed(2)} (a boost, not a halving). Use a negative value to reduce (e.g. -0.5 → ×0.5); but negatives clamp to the attribute's minimum (e.g. movement_speed floor 0), so only small amounts behave like "halving".`,
          });
        }
      }
    });
  }
  return out;
}
