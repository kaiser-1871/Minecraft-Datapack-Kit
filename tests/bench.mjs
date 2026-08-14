// bench.mjs — dpkit 性能基准(受 Spyglass packages/benchmarks 的相位计时启发)。
// 合成一个中等规模的 datapack,分别计时引擎检查与后处理扫描,给出总耗时分解。
// 用法: node tests/bench.mjs [files=120]
// 环境: 需要 1.21.4 的命令/registry 数据已缓存(首次在线检查会下载)。
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { performance } from 'node:perf_hooks';
import { checkDatapack } from '../dist/api.js';

const N = Number(process.argv.find(a => a.startsWith('files='))?.slice('files='.length) ?? 120);

// 合成 datapack:每个文件覆盖所有检查层(引擎解析、undeclared symbol、entity-NBT、
// 宏行、gotcha 正则),与真实包的负载构成接近。
const root = mkdtempSync(join(tmpdir(), 'dpkit-bench-'));
const fnDir = join(root, 'data', 'bench', 'function');
mkdirSync(fnDir, { recursive: true });
writeFileSync(join(root, 'pack.mcmeta'), JSON.stringify({ pack: { pack_format: 61, description: 'dpkit bench' } }));
for (let i = 0; i < N; i++) {
  const n = String(i).padStart(3, '0');
  const lines = [
    'say bench ' + i,
    'function bench:missing_' + i,
    'summon minecraft:zombie ~ ~ ~ {DeathLootTable:"minecraft:empty",HandItems:[{},{}]}',
    'data merge entity @s {DeathLootTable:"minecraft:chests/abandoned_mineshaft"}',
    '$execute if entity @s $(sel) run say macro_' + i,
    '$summon minecraft:zombie ~ ~ ~ {$(nbt)}',
    'particle minecraft:item dirt ~ ~ ~ 0 0 0 0 1',
  ];
  writeFileSync(join(fnDir, 'f' + n + '.mcfunction'), lines.map(l => l + '\n').join(''));
}

const base = {
  datapack: root,
  version: '1.21.4',
  noLog: true,
  ignore: { useIgnore: true, extra: [] },
  onLog: () => {},
};

async function time(label, opts) {
  const t0 = performance.now();
  await checkDatapack(opts);
  const ms = performance.now() - t0;
  console.log(`${label.padEnd(34)} ${ms.toFixed(0).padStart(6)} ms`);
  return ms;
}

try {
  // 预热:引擎会初始化项目 + 载入/校验符号缓存,首个调用不代表稳定性能。
  await checkDatapack(base);
  await checkDatapack(base);
  console.log(`bench datapack: ${N} .mcfunction files @ ${root}`);
  const tEngine = await time('engine only (scans off)', { ...base, noMacro: true, noEntityNbt: true, noGotchas: true });
  const tFull = await time('full check', base);
  await time('full check (2nd run)', base);
  await time('full check, version=auto', { ...base, version: 'auto' });
  console.log(`post-scans (macro+nbt+gotchas): ${(tFull - tEngine).toFixed(0)} ms`);
} finally {
  rmSync(root, { recursive: true, force: true });
}
