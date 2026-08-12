// gotchas.ts — 已知坑扫描器(heuristic,内容级:适用于任何数据包)。引擎的宽松 schema 对
// "未知键/错层级"保持沉默、对运行时行为一无所知——这些正则捕获包内已知的静默失败写法。
// 纯尽力而为:只报警告,绝不影响退出码。消息里的版本前缀用实际检查版本,而非写死 26.2。
import { readFileSync } from 'node:fs';
import type { GotchaIssue } from './types.js';

const lineOf = (text: string, needle: string, from = 0): number | null => {
  const i = text.indexOf(needle, from);
  return i < 0 ? null : text.slice(0, i).split('\n').length;
};

/** Scan a single data/-relative file for known silent-failure patterns. */
export function scanGotchas(filePath: string, rel: string, version: string): GotchaIssue[] {
  let text: string;
  try { text = readFileSync(filePath, 'utf8'); } catch { return []; }
  const out: GotchaIssue[] = [];
  if (filePath.endsWith('.json')) {
    // 1. damage 层直接挂 source_entity/direct_entity(应在 damage.type 下,写错层整条成就被静默丢弃)
    const m1 = text.match(/"damage"\s*:\s*\{\s*[^{}]*?"(source_entity|direct_entity)"\s*:/);
    if (m1) out.push({ line: lineOf(text, `"${m1[1]}"`) ?? 1, key: 'damage层级', msg: `${version}: source_entity/direct_entity 应放在 damage.type 下(damage 层只有 dealt/taken/blocked/type)。写在 damage 直接子级游戏会静默丢弃整条成就 → 改成 "damage": {"type": {"source_entity": {...}}}` });
    // 2. 同触发器多 criteria + requirements OR(该版本不触发)
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
            if (dup && or) out.push({ line: lineOf(text, '"criteria"') ?? 1, key: '多criteria+OR', msg: `${version}: 同触发器多 criteria + requirements OR 不触发(实测)。多来源监听要拆成多个独立成就,各一个 criteria、共用同一回调。` });
          }
          Object.values(rec).forEach(walk);
        }
      };
      walk(obj);
    } catch { /* 非合法 JSON —— 引擎已报解析错,跳过 */ }
  } else if (filePath.endsWith('.mcfunction')) {
    const lines = text.split('\n');
    lines.forEach((L, i) => {
      const n = i + 1;
      // 3. 带参粒子裸 ID(item/block 参数必须 map 语法,否则整函数不加载)
      const pm = L.match(/\bparticle\s+minecraft:(item|block)\s+[a-z0-9_:]+/);
      if (pm) out.push({ line: n, key: '带参粒子裸ID', msg: `${version}: 带参粒子 ${pm[1]} 参数要用 map 语法({item:...}/{block_state:...}),裸 ID 让整函数不加载` });
      // 4. summon 实体 NBT 用蛇形/小写字段名(被静默忽略,须 PascalCase)
      if (/\bsummon\b/.test(L)) {
        const sk = L.match(/\b(tags|duration|wait_time|silent|radius|age|health|custom_name|invisible)\s*:/);
        if (sk) out.push({ line: n, key: 'NBT字段名', msg: `${version}: 实体 NBT 字段是 PascalCase(如 ${sk[1]} → ${sk[1][0].toUpperCase()}${sk[1].slice(1)}),小写/蛇形 summon 时被静默忽略` });
      }
      // 5. attribute 修改器 add_multiplied_* 的方向语义:值是乘数 ×(1+v),不是"加 v"。
      //    26.2 形状: attribute <target> <attribute> modifier add <id> <value> <operation>
      //    (操作字面量在 value 之后;add_value 语义不同,不触发;modifier remove/value get 无 operation,不误伤)
      const am = L.match(/\battribute\s+(\S+)\s+(\S+)\s+modifier\s+add\s+\S+\s+(-?[\d.]+)\s+(add_multiplied_base|add_multiplied_total)\b/);
      if (am) {
        const attr = am[2].replace(/^minecraft:/, '');
        const value = Number(am[3]);
        const isSpeedFamily = /(speed|efficiency|jump_strength|scale|gravity|step_height|block_break|mining)/.test(attr);
        if (isSpeedFamily && value > 0 && value < 1) {
          out.push({
            line: n,
            key: '乘数方向',
            msg: `${version}: attribute 修改器 ${am[4]} 的值是乘数 ×(1+v):v=${am[3]} → ×${(1 + value).toFixed(2)}(提升,不是减半)。想降低请用负值(如 -0.5 → ×0.5);但负值会被钳制到该属性的最小值(如 movement_speed 下限 0),只有小幅度才算"减半"。`,
          });
        }
      }
    });
  }
  return out;
}
