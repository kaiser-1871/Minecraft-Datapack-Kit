// cli.ts — dpkit CLI entry. Thin shell over the typed API: parse args, call the API,
// render text/JSON, set exit codes. All engine/analysis logic lives in api.ts + engines.
//
// Defaults come from a .dpkit.json config file (cwd → home, or --config=<path>) and env
// vars, so the tool works for ANY datapack/version out of the box. Precedence per value:
//   CLI flag  >  env var (DPKIT_DATAPACK / DPKIT_VERSION / DPKIT_CONFIG)
//             >  .dpkit.json  >  built-in default
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ROOT_DIR, BASELINE_FILE } from './paths.js';
import { detectDefaultDatapack } from './datapack-discovery.js';
import { DEFAULT_VERSION, loadConfig } from './config.js';
import type { DpkitConfig } from './config.js';
import { BUILTIN_IGNORE_DESC } from './ignore.js';
import { loadCachedVersions } from './syntax.js';
import * as api from './api.js';

const arg = (name: string): string | undefined => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(`--${name}=`.length) : undefined;
};
const argOr = (name: string, fb: string): string => arg(name) ?? fb;
const has = (name: string): boolean => process.argv.includes(`--${name}`);

// ---- config (.dpkit.json) ----
let cfg: DpkitConfig = {};
try { cfg = loadConfig(arg('config')).config; }
catch (err) { console.error((err as Error).message); process.exit(2); }
const cfgVersion = process.env.DPKIT_VERSION ?? cfg.version;
const cfgDatapack = process.env.DPKIT_DATAPACK ?? cfg.datapack;

// ---- flags (CLI flag > env/config > default) ----
const GAME_VERSION = arg('version') ?? cfgVersion ?? DEFAULT_VERSION; // 'auto'(默认) | 'latest release' | '1.21.4' ...
const DATAPACK: string | null = arg('datapack') ?? cfgDatapack ?? detectDefaultDatapack(GAME_VERSION, cfg.minecraftRoot);
const AUTO_DETECTED = arg('datapack') === undefined && cfgDatapack === undefined;
const ONLY = argOr('files', '');                // optional data-relative glob filter
const MODE = argOr('mode', 'open');             // LSP engine only: 'open' | 'analyze'
const ENGINE = argOr('engine', 'inproc');       // in-process by default; 'lsp' keeps the legacy subprocess path
const BASELINE = arg('baseline') ?? cfg.baselineFile ?? BASELINE_FILE;
const VERBOSE = has('verbose');
const JSON_OUT = has('json');
const DELTA = has('delta');
const USE_IGNORE = !has('no-ignore');
const HELP = has('help') || process.argv.includes('-h');
const NO_GOTCHAS = has('no-gotchas') || cfg.gotchas === false;
const NO_MACRO = has('no-macro');
const LOGCHECK = !has('no-log') && cfg.logcheck !== false;

// ---- "teach AI to write" modes ----
const SYNTAX = argOr('syntax', '');             // offline: render grammar of a command path
const DUMP = argOr('dump', '');                 // offline: write full command reference to this file
const DUMP_ALL = has('dump-all');
const COMPLETE = argOr('complete', '');         // live: 'data相对路径:行:列' completion query at a cursor
const COMPLETE_INLINE = arg('complete-inline'); // live: complete a raw command string (no file)
const COMPLETE_INLINE_GIVEN = process.argv.some(a => a.startsWith('--complete-inline'));
const VERSIONS = has('versions');
const STRICT = has('strict');                   // warnings also fail the run (CI-friendly)
const REGISTRY = argOr('registry', '');         // offline: list a registry's values for the version
const SYNTAX_GIVEN = process.argv.some(a => a.startsWith('--syntax'));
const DUMP_GIVEN = process.argv.some(a => a === '--dump' || a.startsWith('--dump='));
const REGISTRY_GIVEN = process.argv.some(a => a.startsWith('--registry'));
const DEPTH = (() => {
  const v = Number(argOr('depth', '4'));
  return Number.isFinite(v) ? Math.max(0, Math.min(8, Math.floor(v))) : 4; // 0=不展开, 上限 8
})();
const OFFLINE = SYNTAX_GIVEN || DUMP_GIVEN || DUMP_ALL || VERSIONS || REGISTRY_GIVEN;

// ---- ignore extra patterns: config file first, then --ignore=<v> (each comma-separated) ----
// --no-ignore means "show everything raw": it also drops config/--ignore patterns, not just the
// built-in LastHurtMob filter (previously config patterns still applied, which surprised users).
const ignoreExtra = USE_IGNORE
  ? [
      ...(cfg.ignore ?? []),
      ...process.argv.filter(a => a.startsWith('--ignore=')).map(a => a.slice('--ignore='.length)),
    ]
  : [];

// Progress/startup lines must not pollute stdout in --json mode (stdout carries pure JSON).
const out = (msg: string): void => { if (JSON_OUT) console.error(msg); else console.log(msg); };

/** Resolve the datapack to actually operate on, or fail with a helpful message. */
function requireDatapack(): string {
  if (!DATAPACK) {
    throw new api.DpkitError(
      '[check] 找不到数据包目录(自动探测无结果)。用 --datapack=<绝对路径> 指定, 或设 DPKIT_DATAPACK 环境变量, 或在 .dpkit.json 里配置 datapack 字段。',
    );
  }
  return DATAPACK;
}

if (HELP) {
  console.log(`dpkit — Datapack Kit (Spyglass/DHP engine: check + teach syntax)

Usage:
  node dpkit.mjs [options]

Config: a .dpkit.json in the cwd or home dir sets your defaults (datapack / version /
ignore / minecraftRoot / baselineFile); see .dpkit.example.json. Precedence for every
value: CLI flag > env var (DPKIT_DATAPACK, DPKIT_VERSION, DPKIT_CONFIG) > .dpkit.json
> built-in default.

Options:
  --version=<v>    Game version to check as (default auto: reads the checked datapack's pack.mcmeta)
  --datapack=<p>   Datapack to check (default ${DATAPACK ?? 'auto-detected'})
  --config=<path>  Path to a .dpkit.json config file
  --baseline=<f>   Baseline file for --delta (default ${BASELINE})
  --files=<glob>   Only these files, relative to data/ (e.g. test/function/*.mcfunction)
  --engine=inproc|lsp   Engine to use (default ${ENGINE}; in-process or LSP subprocess)
  --mode=open      Open each file (LSP engine only, default)
  --mode=analyze   Use spyglassmc/analyzeProject (LSP engine only)
  --json           Emit a machine-readable JSON report instead of text
  --delta          Only re-report files whose issues changed since the last --delta run
  --no-ignore      Do not filter known false positives (${BUILTIN_IGNORE_DESC})
  --ignore=<p>     Extra ignore pattern: message substring, or /regex/ (repeatable, comma-separated)
  --verbose        Print the server's own log lines
  --no-gotchas     Disable the gotcha linter (heuristic; on by default)
  --no-macro       Disable the \$ macro-line registry-ID check (on by default)
  --strict         Warnings also make the run fail (exit 1) — for CI
  --no-log         Disable the game-log self-check (reload freshness + pack errors; on by default)

Teach-the-AI modes (ground-truth syntax from the ${GAME_VERSION} command tree):
  --syntax=<path>  Print readable grammar of a command path, e.g. 'execute on'
                   (accepts spaces or dots: 'execute.on'; offline, no datapack needed)
  --registry=<r>   List a registry's values for the version, e.g. --registry=mob_effect
                   (attribute / damage_type / entity_type / …; --registry=? lists all)
  --dump=<file>    Write the whole command reference (all commands) to <file> as Markdown
  --dump-all       Same, to command-reference-<version>.md in the tools dir
  --depth=<n>      Expand --syntax/--dump to this many levels (default 4)
  --complete=<rel>:<line>:<col>   Live completion at a cursor in a datapack file
                   e.g. --complete=test/function/x.mcfunction:1:24  (1-based)
  --complete-inline="<text>"      Complete a raw command string (no file needed; still needs a
                   datapack for project context), e.g. --complete-inline="effect give @s knock"
  --versions       List available game versions (server + local cache), show whether a
                   newer release exists and which have data cached
  --version=<v>    Version to check as (default: auto). 'auto' reads the pack's
                   pack.mcmeta (skews for min_format/max_format packs — pin with a
                   concrete id if that matters); 'latest release' / 'latest snapshot'
                   follow the newest release / snapshot

Exit codes: 0 = no errors, 1 = errors / internal failures (or warnings, with --strict),
2 = environment / network failure.`);
  process.exit(0);
}

export async function main(): Promise<void> {
  try {
    if (OFFLINE) { await runOffline(); return; }
    if (COMPLETE) { await runComplete(); return; }
    if (COMPLETE_INLINE_GIVEN) { await runCompleteInline(); return; }
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

  if (REGISTRY_GIVEN) {
    if (!REGISTRY.trim()) throw new api.DpkitError('[check] --registry 需要注册表名, 例如 --registry=mob_effect (用 --registry=? 列出全部可用注册表)');
    const r = api.queryRegistry(REGISTRY, GAME_VERSION);
    if (JSON_OUT) {
      console.log(JSON.stringify(r, null, 2));
      return;
    }
    if (!r.found) {
      out(`注册表 '${r.name}' 不在该版本(${r.version})的注册表数据里。可用注册表(共 ${r.index?.length ?? 0} 个):`);
      for (const x of r.index ?? []) out(`  ${String(x.name).padEnd(40)} ${x.count} 项`);
      return;
    }
    out(`注册表 ${r.name} (${r.version}, ${r.count} 项):`);
    for (const v of r.values ?? []) out(`  ${v}`);
    return;
  }

  if (VERSIONS) { await printVersions(); return; }

  if (DUMP_GIVEN || DUMP_ALL) {
    const refVersion = api.resolveConcreteVersion(GAME_VERSION);
    const target = DUMP || join(ROOT_DIR, `command-reference-${refVersion}.md`);
    const { count, text } = api.dumpSyntax(refVersion, DEPTH);
    writeFileSync(target, `# ${refVersion} 命令参考(由 dpkit 离线生成)\n\n> 语法来自 Spyglass 缓存的 ${refVersion} 命令树(${count} 条顶层命令)。\n> 重新生成: node dpkit.mjs --dump-all [--depth=N] [--version=<v>]\n\n${text}\n`);
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
  if (!v.isPinned) {
    out(`  ⚠ 未钉版本(${v.configured}): 检查时按每个包自己的 pack.mcmeta 自动识别;要固定请用 --version=<具体版本> 或改配置。`);
  }
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
    datapack: requireDatapack(),
    version: GAME_VERSION,
    only: ONLY,
    mode: MODE as 'open' | 'analyze',
    engine: ENGINE === 'inproc' ? 'inproc' : 'lsp',
    ignore: { useIgnore: USE_IGNORE, extra: ignoreExtra },
    delta: DELTA,
    baselineFile: BASELINE,
    noGotchas: NO_GOTCHAS,
    noMacro: NO_MACRO,
    noLog: !LOGCHECK,
    verbose: VERBOSE,
    autoDetected: AUTO_DETECTED,
    minecraftRoot: cfg.minecraftRoot,
    onLog: out,
  });
  const { report } = result;
  versionHint(report.resolvedVersion);

  if (JSON_OUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    renderText(result);
  }
  const failed = report.summary.errors > 0 || report.summary.internalFailures > 0 || (STRICT && report.summary.warnings > 0);
  process.exit(failed ? 1 : 0);
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
  const verLabel = report.resolvedVersion ?? report.version;
  console.log(`\n———— CHECK REPORT ————`);
  console.log(`datapack : ${report.datapack}`);
  console.log(`version  : ${report.version}  (server resolved: ${report.resolvedVersion ?? '?'})`);
  console.log(`files    : ${report.files.checked} checked, ${report.files.clean} clean${report.delta ? ` · delta: ${report.delta.changedFiles} changed, ${report.delta.resolvedFiles} resolved` : ''}`);
  console.log(`summary  : ${report.summary.errors} error(s) · ${report.summary.warnings} warning(s) · ${report.summary.ignored} ignored · ${report.summary.internalFailures} internal-failure · gotchas ${report.summary.gotchas}`);
  const cov = report.coverage;
  const covParts: string[] = [];
  if (cov.filesSkipped > 0) covParts.push(`跳过(引擎失败) ${cov.filesSkipped}`);
  if (cov.macroLines > 0) covParts.push(`宏行 ${cov.macroLines} · 注册表ID校验 ${cov.macroChecked} · 未校验 ${cov.macroUnchecked}`);
  if (cov.autoFiltered > 0) covParts.push(`自动误报过滤 ${cov.autoFiltered}`);
  if (covParts.length) console.log(`coverage : ${covParts.join(' · ')}`);
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
    console.log(`\n== ${verLabel} 已知坑扫描(heuristic,不计入错误;--no-gotchas 关闭) ==`);
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
  if (!m) throw new api.DpkitError('[check] --complete 格式应为 <data相对路径>:<行>:<列> (1-based), 例如 test/function/x.mcfunction:1:24');
  const rel = m[1], ln = +m[2], col = +m[3];
  const items = await api.completeAt({
    datapack: requireDatapack(),
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

// ---------- complete-inline ----------
async function runCompleteInline(): Promise<void> {
  const text = COMPLETE_INLINE ?? '';
  const ln = text.split('\n').length;
  const col = (text.split('\n').pop() ?? '').length + 1;
  const label = `inline:${ln}:${col}`;
  const items = await api.completeAt({
    datapack: requireDatapack(),
    version: GAME_VERSION,
    rel: '__inline__.mcfunction',
    line: ln,
    column: col,
    text,
    engine: ENGINE === 'inproc' ? 'inproc' : 'lsp',
    verbose: VERBOSE,
    onLog: out,
  });
  if (JSON_OUT) {
    console.log(JSON.stringify({
      complete: { file: label, line: ln, column: col, version: GAME_VERSION, inline: text },
      count: items.length,
      items: items.slice(0, 200),
      truncated: items.length > 200,
    }, null, 2));
    return;
  }
  if (!items.length) { out(`[complete] ${label} — 没有补全项(文本: "${text}")`); return; }
  out(`[complete] ${label} — ${items.length} 项补全 (version ${GAME_VERSION}) — 文本: "${text}"`);
  for (const it of items.slice(0, 60)) {
    const detail = it.detail ? ` — ${it.detail}` : '';
    const d = it.documentation ? `  |  ${it.documentation.replace(/\s*\n\s*/g, ' ').slice(0, 140)}` : '';
    out(`  ${it.label}  [${it.kind}]${detail}${d}`);
  }
  if (items.length > 60) out(`  …(还有 ${items.length - 60} 项,已截断)`);
}
