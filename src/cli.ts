// cli.ts — dpkit CLI entry. Thin shell over the typed API: parse args, call the API,
// render text/JSON, set exit codes. All engine/analysis logic lives in api.ts + engines.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT_DIR } from './paths.js';
import { AUTO_DETECTED, detectDefaultDatapack } from './datapack-discovery.js';
import { BUILTIN_IGNORE_DESC } from './ignore.js';
import { loadCachedVersions } from './syntax.js';
import * as api from './api.js';

const arg = (name: string, fallback: string): string => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(`--${name}=`.length) : fallback;
};

// ---- flags ----
const GAME_VERSION = arg('version', '26.2'); // '26.2' (this pack's 107.1) | 'auto' | '1.21.4' ...
const DATAPACK = arg('datapack', detectDefaultDatapack(GAME_VERSION));
const ONLY = arg('files', '');                // optional data-relative glob filter
const MODE = arg('mode', 'open');             // LSP engine only: 'open' | 'analyze'
const ENGINE = arg('engine', 'lsp');          // 'lsp' during M2; flips to 'inproc' when the in-process engine lands
const VERBOSE = process.argv.includes('--verbose');
const JSON_OUT = process.argv.includes('--json');
const DELTA = process.argv.includes('--delta');
const USE_IGNORE = !process.argv.includes('--no-ignore');
const HELP = process.argv.includes('--help') || process.argv.includes('-h');
const NO_GOTCHAS = process.argv.includes('--no-gotchas');
const LOGCHECK = !process.argv.includes('--no-log');

// ---- "teach AI to write" modes ----
const SYNTAX = arg('syntax', '');             // offline: render grammar of a command path
const DUMP = arg('dump', '');                 // offline: write full command reference to this file
const DUMP_ALL = process.argv.includes('--dump-all');
const COMPLETE = arg('complete', '');         // live: 'data相对路径:行:列' completion query at a cursor
const VERSIONS = process.argv.includes('--versions');
const SYNTAX_GIVEN = process.argv.some(a => a.startsWith('--syntax'));
const DUMP_GIVEN = process.argv.some(a => a === '--dump' || a.startsWith('--dump='));
const DEPTH = (() => {
  const v = Number(arg('depth', '4'));
  return Number.isFinite(v) ? Math.max(0, Math.min(8, Math.floor(v))) : 4; // 0=不展开, 上限 8
})();
const OFFLINE = SYNTAX_GIVEN || DUMP_GIVEN || DUMP_ALL || VERSIONS;

// ---- ignore extra patterns from --ignore=<v> (each comma-separated) ----
const ignoreExtra = process.argv
  .filter(a => a.startsWith('--ignore='))
  .map(a => a.slice('--ignore='.length));

// Progress/startup lines must not pollute stdout in --json mode (stdout carries pure JSON).
const out = (msg: string): void => { if (JSON_OUT) console.error(msg); else console.log(msg); };

if (HELP) {
  console.log(`dpkit — Datapack Kit (Spyglass/DHP engine: check + teach syntax)

Usage:
  node dpkit.mjs [options]

Options:
  --version=<v>    Game version to check as (default ${GAME_VERSION}; 'auto' reads pack.mcmeta)
  --datapack=<p>   Datapack to check (default ${DATAPACK})
  --files=<glob>   Only these files, relative to data/ (e.g. battle/function/snowman/*.mcfunction)
  --engine=inproc|lsp   Engine to use (default ${ENGINE}; in-process or LSP subprocess)
  --mode=open      Open each file (LSP engine only, default)
  --mode=analyze   Use spyglassmc/analyzeProject (LSP engine only)
  --json           Emit a machine-readable JSON report instead of text
  --delta          Only re-report files whose issues changed since the last --delta run
  --no-ignore      Do not filter known false positives (${BUILTIN_IGNORE_DESC})
  --ignore=<p>     Extra ignore pattern: message substring, or /regex/ (repeatable, comma-separated)
  --verbose        Print the server's own log lines
  --no-gotchas     Disable the 26.2 gotcha linter (heuristic; on by default)
  --no-log         Disable the game-log self-check (reload freshness + pack errors; on by default)

Teach-the-AI modes (ground-truth syntax from the ${GAME_VERSION} command tree):
  --syntax=<path>  Print readable grammar of a command path, e.g. 'execute on'
                   (accepts spaces or dots: 'execute.on'; offline, no datapack needed)
  --dump=<file>    Write the whole command reference (all commands) to <file> as Markdown
  --dump-all       Same, to command-reference-<version>.md in the tools dir
  --depth=<n>      Expand --syntax/--dump to this many levels (default 4)
  --complete=<rel>:<line>:<col>   Live completion at a cursor in a datapack file
                   e.g. --complete=battle/function/snowman/x.mcfunction:5:12  (1-based)
  --versions       List available game versions (server + local cache), show whether a
                   newer release exists and which have data cached
  --version=<v>    'latest release' / 'latest snapshot' follow the newest; 'auto' reads
                   pack.mcmeta (skews for min_format/max_format packs — prefer pinning)

Exit codes: 0 = no errors, 1 = errors / internal failures, 2 = environment / network failure.`);
  process.exit(0);
}

export async function main(): Promise<void> {
  try {
    if (OFFLINE) { await runOffline(); return; }
    if (COMPLETE) { await runComplete(); return; }
    await runCheck();
  } catch (err) {
    if (err instanceof api.DpkitError) {
      console.error(err.message);
      process.exit(err.exitCode);
    } else {
      console.error(`[check] internal failure: ${(err as Error)?.stack ?? err}`);
      process.exit(2);
    }
  }
}

// ---------- offline syntax / dump / versions (no server, no datapack needed) ----------
async function runOffline(): Promise<void> {
  if (SYNTAX_GIVEN && !SYNTAX.trim()) throw new api.DpkitError('[check] --syntax 需要命令路径, 例如 --syntax="execute on"');
  if (DUMP_GIVEN && !DUMP) throw new api.DpkitError('[check] --dump 需要输出文件路径, 例如 --dump=ref.md');
  if (SYNTAX_GIVEN && (DUMP_GIVEN || DUMP_ALL)) throw new api.DpkitError('[check] --syntax 与 --dump/--dump-all 互斥, 请分开使用');

  if (VERSIONS) { await printVersions(); return; }

  if (DUMP_GIVEN || DUMP_ALL) {
    const target = DUMP || join(ROOT_DIR, `command-reference-${GAME_VERSION}.md`);
    const { count, text } = api.dumpSyntax(GAME_VERSION, DEPTH);
    writeFileSync(target, `# ${GAME_VERSION} 命令参考(由 dpkit 离线生成)\n\n> 语法来自 Spyglass 缓存的 ${GAME_VERSION} 命令树(${count} 条顶层命令)。\n> 重新生成: node dpkit.mjs --dump-all [--depth=N] [--version=<v>]\n\n${text}\n`);
    out(`[check] 已生成 ${count} 条命令的参考 → ${target}`);
    return;
  }

  const result = api.querySyntax(SYNTAX, GAME_VERSION, DEPTH);
  if (JSON_OUT) {
    console.log(JSON.stringify({ syntax: { path: result.path, version: result.version, found: result.found, lines: result.lines } }, null, 2));
  } else {
    out(result.lines.join('\n'));
  }
  if (!result.found) process.exit(1);
}

async function printVersions(): Promise<void> {
  const v = await api.listVersions(GAME_VERSION);
  if (JSON_OUT) {
    console.log(JSON.stringify({
      versions: { source: v.source, count: v.count, configured: v.configured },
      latestRelease: v.latestRelease ? { id: v.latestRelease.id, data_pack_version: v.latestRelease.data_pack_version, hasData: v.latestRelease.hasData } : null,
      latestSnapshot: v.latestSnapshot ? { id: v.latestSnapshot.id, data_pack_version: v.latestSnapshot.data_pack_version } : null,
      newerThanConfigured: v.newerThanConfigured,
      recent: v.recent,
    }, null, 2));
    return;
  }
  out(`可用版本(来自 ${v.source}, 共 ${v.count} 个):`);
  out(`  最新正式版: ${v.latestRelease?.id}  (data_pack_version ${v.latestRelease?.data_pack_version})${v.latestRelease?.hasData ? '  ✓数据已缓存' : '  数据未缓存,首次用需下载'}`);
  out(`  最新快照  : ${v.latestSnapshot?.id}  (data_pack_version ${v.latestSnapshot?.data_pack_version})`);
  if (v.newerThanConfigured) {
    out(`\n  ⚠ 你配置的版本是 ${v.configured}, 最新正式版已是 ${v.newerThanConfigured.id}。`);
    out(`    切到新版本:   node dpkit.mjs --version="${v.newerThanConfigured.id}"`);
    out(`    总跟随最新:   node dpkit.mjs --version="latest release"`);
  } else if (v.isPinned) {
    out(`\n  ✓ 你配置的版本 ${v.configured} 就是最新正式版。`);
  }
  out(`\n  最近版本(前 ${v.recent.length} 个, ✓=该版本命令数据已缓存):`);
  for (const r of v.recent) out(`    ${String(r.id).padEnd(18)} ${String(r.type).padEnd(8)} dpv ${String(r.dpv).padEnd(4)} ${r.hasData ? '✓' : '—'}`);
  if (v.count > v.recent.length) out(`    …(共 ${v.count} 个, 只显示最近 ${v.recent.length} 个)`);
  out(`\n  提示: 新命令/新子命令/新注册表值/新 NBT 字段都是数据驱动, 在线跑一次 --version=<新版> 会自动下载识别;`);
  out(`        仅全新参数类型或命令格式大改才需先 npm update @spyglassmc/language-server。`);
}

// ---------- check ----------
async function runCheck(): Promise<void> {
  const result = await api.checkDatapack({
    datapack: DATAPACK,
    version: GAME_VERSION,
    only: ONLY,
    mode: MODE as 'open' | 'analyze',
    engine: ENGINE === 'inproc' ? 'inproc' : 'lsp',
    ignore: { useIgnore: USE_IGNORE, extra: ignoreExtra },
    delta: DELTA,
    noGotchas: NO_GOTCHAS,
    noLog: !LOGCHECK,
    verbose: VERBOSE,
    autoDetected: AUTO_DETECTED,
    onLog: out,
  });
  const { report } = result;
  versionHint(report.resolvedVersion);

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    renderText(result);
  }
  process.exit(report.summary.errors > 0 || report.summary.internalFailures > 0 ? 1 : 0);
}

/** Version freshness hint (cache was refreshed this run by the engine's own fetch). */
function versionHint(resolvedVersion: string | null): void {
  try {
    const vl = loadCachedVersions();
    if (vl?.length) {
      const versions = vl as { type?: string; id: string; data_pack_version: number }[];
      const latest = versions.filter(v => v.type === 'release')[0];
      const effective = resolvedVersion ?? GAME_VERSION;
      const eff = versions.find(v => v.id === effective);
      const pinned = !['auto', 'latest release', 'latest snapshot'].includes(GAME_VERSION);
      if (latest && eff && pinned && eff.data_pack_version < latest.data_pack_version) {
        out(`\n[check] 提示: 最新正式版已是 ${latest.id} (data_pack_version ${latest.data_pack_version}), 当前按 ${effective} (dpv ${eff.data_pack_version}) 检查。`);
        out(`       切到新版本: node dpkit.mjs --version="${latest.id}"  ·  总跟随最新: --version="latest release"  ·  查可用版本: --versions`);
      }
    }
  } catch { /* hint is best-effort */ }
}

function renderText(result: api.CheckResult): void {
  const { report, lines, agg, ignoredAgg } = result;
  console.log(`\n———— CHECK REPORT ————`);
  console.log(`datapack : ${report.datapack}`);
  console.log(`version  : ${report.version}  (server resolved: ${report.resolvedVersion ?? '?'})`);
  console.log(`files    : ${report.files.checked} checked, ${report.files.clean} clean${report.delta ? ` · delta: ${report.delta.changedFiles} changed, ${report.delta.resolvedFiles} resolved` : ''}`);
  console.log(`summary  : ${report.summary.errors} error(s) · ${report.summary.warnings} warning(s) · ${report.summary.ignored} ignored · ${report.summary.internalFailures} internal-failure · gotchas ${report.summary.gotchas}`);
  if (lines.length) console.log(lines.join('\n'));
  if (agg.length) {
    console.log(`\n== 按消息聚合 (top ${agg.length}) ==`);
    for (const [m, c] of agg) console.log(`  ${c}× ${m}`);
  }
  if (ignoredAgg.length) {
    console.log(`\n== 忽略(已知误报, 不计入结果) ==`);
    for (const [m, c] of ignoredAgg) console.log(`  ${c}× ${m}`);
  }
  if (report.gotchas.length) {
    console.log(`\n== 26.2 已知坑扫描(heuristic,不计入错误;--no-gotchas 关闭) ==`);
    for (const { file, items } of report.gotchas) {
      console.log(`\n  ${file} (${items.length})`);
      for (const g of items) console.log(`  [坑:${g.line}] (${g.key}) ${g.msg}`);
    }
  }
  if (report.log.found) {
    const glog = report.log;
    console.log(`\n== 游戏日志(自检) ==`);
    console.log(`  日志  : ${glog.path}`);
    if (glog.stale) console.log(`  ⚠ 数据包文件比日志新 —— 可能还没 /reload,报错/成就计数是旧的`);
    else console.log(`  ✓ 日志与数据包同步(最近一次 /reload 后无新改动)`);
    console.log(`  成就  : ${glog.lastLoaded ? `最近一次 Loaded ${glog.lastLoaded} advancements` : '(日志无成就计数行)'}`);
    if (glog.errors.length) {
      console.log(`  错误  : 疑似数据包加载错误 ${glog.errors.length} 条:`);
      for (const h of glog.errors) console.log(`    ✗ ${h}`);
    } else {
      console.log(`  错误  : 未发现疑似数据包加载错误`);
    }
  } else if (LOGCHECK) {
    console.log(`\n== 游戏日志(自检) ==`);
    console.log(`  未找到 latest.log,跳过(--no-log 关闭)`);
  }
}

// ---------- complete ----------
async function runComplete(): Promise<void> {
  const m = COMPLETE.match(/^(.*):(\d+):(\d+)$/);
  if (!m) throw new api.DpkitError('[check] --complete 格式应为 <data相对路径>:<行>:<列> (1-based), 例如 battle/function/snowman/x.mcfunction:5:12');
  const rel = m[1], ln = +m[2], col = +m[3];
  const items = await api.completeAt({
    datapack: DATAPACK,
    version: GAME_VERSION,
    rel,
    line: ln,
    column: col,
    engine: ENGINE === 'inproc' ? 'inproc' : 'lsp',
    verbose: VERBOSE,
    onLog: out,
  });
  if (JSON_OUT) {
    console.log(JSON.stringify({
      complete: { file: rel, line: ln, column: col, version: GAME_VERSION },
      count: items.length,
      items: items.slice(0, 200),
      truncated: items.length > 200,
    }, null, 2));
    return;
  }
  if (!items.length) { out(`[complete] ${rel}:${ln}:${col} — 没有补全项(这里可能还没到可补全位置)`); return; }
  out(`[complete] ${rel}:${ln}:${col} — ${items.length} 项补全 (version ${GAME_VERSION}):`);
  for (const it of items.slice(0, 60)) {
    const detail = it.detail ? ` — ${it.detail}` : '';
    const d = it.documentation ? `  |  ${it.documentation.replace(/\s*\n\s*/g, ' ').slice(0, 140)}` : '';
    out(`  ${it.label}  [${it.kind}]${detail}${d}`);
  }
  if (items.length > 60) out(`  …(还有 ${items.length - 60} 项,已截断)`);
}
