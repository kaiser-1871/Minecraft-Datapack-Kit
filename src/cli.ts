// cli.ts — dpkit CLI: drive the Spyglass/DHP engine to check a datapack AND teach
// its exact per-version command syntax to humans or AIs.
//
// Faithful TS port of dpkit.mjs (which spawned the LSP server over stdio). The module
// split happens in a later step; this keeps the original single-file behavior intact.
//
// Usage (same as before):
//   node dpkit.mjs                                             # check the pvp datapack as version 26.2
//   node dpkit.mjs --syntax="execute on"                       # offline: grammar of a command path
//   node dpkit.mjs --complete=battle/function/x.mcfunction:5:12   # live completion at a cursor
//
// Exit code 0 = no errors, 1 = errors/internal failures, 2 = environment/network failure.

import { spawn } from 'node:child_process';
import { readFileSync, readdirSync, statSync, existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadCommandTree, loadCachedVersions, cachedCommandVersions, renderPath, renderAll } from './syntax.js';
import { ROOT_DIR, SERVER, BASELINE_FILE, LEGACY_DEFAULT_DATAPACK } from './paths.js';

const arg = (name: string, fallback: string): string => {
  const hit = process.argv.find(a => a.startsWith(`--${name}=`));
  return hit ? hit.slice(`--${name}=`.length) : fallback;
};

// ---- flags ----
const AUTO_DETECTED = !existsSync(LEGACY_DEFAULT_DATAPACK);
// 自动探测 Minecraft 安装下的 pvp 包(versions/*/saves/*/datapacks/pvp),工具挪位后仍能找到
const DEFAULT_DATAPACK = (() => {
  if (existsSync(LEGACY_DEFAULT_DATAPACK)) return LEGACY_DEFAULT_DATAPACK;
  const wantVer = process.argv.find(a => a.startsWith('--version='))?.slice('--version='.length) ?? '26.2';
  const roots = ['D:/Minecraft/.minecraft', join(process.env.APPDATA ?? '', '.minecraft')];
  const found: { p: string; version: string }[] = [];
  for (const root of roots) {
    let versions;
    try { versions = readdirSync(join(root, 'versions'), { withFileTypes: true }); } catch { continue; }
    for (const v of versions) {
      if (!v.isDirectory()) continue;
      let saves;
      try { saves = readdirSync(join(root, 'versions', v.name, 'saves'), { withFileTypes: true }); } catch { continue; }
      for (const s of saves) {
        if (!s.isDirectory()) continue;
        const p = join(root, 'versions', v.name, 'saves', s.name, 'datapacks', 'pvp');
        try { if (readdirSync(p).length) found.push({ p, version: v.name }); } catch { /* not this one */ }
      }
    }
  }
  if (!found.length) return LEGACY_DEFAULT_DATAPACK;
  // 优先与检查版本同目录的包(避免探到旧版本的其它存档),否则取最近改动的
  const byVer = found.filter(x => x.version === wantVer || (typeof wantVer === 'string' && wantVer.startsWith(x.version)));
  const pool = byVer.length ? byVer : found;
  let best = pool[0], bestM = -1;
  for (const x of pool) {
    let m = 0;
    try { m = statSync(x.p).mtimeMs; } catch {}
    if (m > bestM) { bestM = m; best = x; }
  }
  return best.p;
})();

const DATAPACK = arg('datapack', DEFAULT_DATAPACK);
const GAME_VERSION = arg('version', '26.2'); // '26.2' (this pack's 107.1) | 'auto' | '1.21.4' ...
const ONLY = arg('files', '');                // optional data-relative glob filter
const MODE = arg('mode', 'open');             // 'open' = didOpen each file, 'analyze' = spyglassmc/analyzeProject
const VERBOSE = process.argv.includes('--verbose');
const JSON_OUT = process.argv.includes('--json');
const DELTA = process.argv.includes('--delta');
const USE_IGNORE = !process.argv.includes('--no-ignore');
const HELP = process.argv.includes('--help') || process.argv.includes('-h');
const NO_GOTCHAS = process.argv.includes('--no-gotchas');
const LOGCHECK = !process.argv.includes('--no-log');

// ---- "teach AI to write" modes ----
const SYNTAX = arg('syntax', '');             // offline: render grammar of a command path, e.g. 'execute on'
const DUMP = arg('dump', '');                 // offline: write full command reference to this file
const DUMP_ALL = process.argv.includes('--dump-all'); // offline: dump to command-reference-<version>.md
const COMPLETE = arg('complete', '');         // live: 'data相对路径:行:列' completion query at a cursor
const VERSIONS = process.argv.includes('--versions'); // offline: list available game versions
// "given" flags distinguish `--syntax=` (empty but explicitly given → error) from not given at all
const SYNTAX_GIVEN = process.argv.some(a => a.startsWith('--syntax'));
const DUMP_GIVEN = process.argv.some(a => a === '--dump' || a.startsWith('--dump='));
const DEPTH = (() => {
  const v = Number(arg('depth', '4'));
  return Number.isFinite(v) ? Math.max(0, Math.min(8, Math.floor(v))) : 4; // 0=不展开, 上限 8
})();
// Offline modes exit before the server ever starts; the main flow is guarded on this.
const OFFLINE = SYNTAX_GIVEN || DUMP_GIVEN || DUMP_ALL || VERSIONS;

// ---- known false positives (valid in-game but missing from Spyglass's mcdoc schema) ----
const BUILTIN_IGNORE_PATTERNS = [new RegExp('Unknown key ["“]LastHurtMob["”]')];
const BUILTIN_IGNORE_DESC = 'Unknown key "LastHurtMob" (missing from Spyglass mcdoc, valid in-game)';
const parsePattern = (p: string): string | RegExp => {
  if (p.length > 2 && p.startsWith('/') && p.endsWith('/')) {
    try { return new RegExp(p.slice(1, -1)); } catch { return p; }
  }
  return p;
};
const extraIgnores = process.argv
  .filter(a => a.startsWith('--ignore='))
  .flatMap(a => a.slice('--ignore='.length).split(',').filter(Boolean))
  .map(parsePattern);
const ignorePatterns: (string | RegExp)[] = USE_IGNORE ? [...BUILTIN_IGNORE_PATTERNS, ...extraIgnores] : extraIgnores;
const matchesIgnore = (msg: string): boolean =>
  ignorePatterns.some(p => p instanceof RegExp ? p.test(msg) : msg.includes(p));

// Progress/startup lines must not pollute stdout in --json mode (stdout carries pure JSON).
const out = (msg: string): void => { if (JSON_OUT) console.error(msg); else console.log(msg); };

if (HELP) {
  console.log(`dpkit — Datapack Kit (Spyglass/DHP engine: check + teach syntax)

Usage:
  node dpkit.mjs [options]

Options:
  --version=<v>    Game version to check as (default ${GAME_VERSION}; 'auto' reads pack.mcmeta)
  --datapack=<p>   Datapack to check (default ${DEFAULT_DATAPACK})
  --files=<glob>   Only these files, relative to data/ (e.g. battle/function/snowman/*.mcfunction)
  --mode=open      Open each file (default)
  --mode=analyze   Use spyglassmc/analyzeProject
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

// ---------- offline syntax / dump / versions modes (no server, no datapack needed) ----------
interface McmetaVersion { id: string; name?: string; type?: string; data_pack_version?: number; resource_pack_version?: number }
async function printVersions(): Promise<void> {
  let list: unknown[] | null = null, src = '本地缓存';
  try {
    const res = await fetch('https://api.spyglassmc.com/mcje/versions', { signal: AbortSignal.timeout(6000) });
    if (res.ok) { list = await res.json() as unknown[]; src = '服务器(在线)'; }
  } catch { /* offline → fall back to cache below */ }
  const cached = cachedCommandVersions();
  if (!list) list = loadCachedVersions();
  if (!Array.isArray(list) || list.length === 0) {
    console.error('[check] 无法获取版本列表(在线请求失败且本地无缓存)');
    process.exit(2);
  }
  const versions = list as McmetaVersion[];
  const releases = versions.filter(v => v.type === 'release');
  const latestRelease: McmetaVersion | null = releases[0] ?? null;
  const latestSnap: McmetaVersion | null = versions[0] ?? null;
  const configured = GAME_VERSION;
  const isPinned = !['auto', 'latest release', 'latest snapshot'].includes(configured);
  const newer = (isPinned && latestRelease && latestRelease.id !== configured)
    ? { id: latestRelease.id, data_pack_version: latestRelease.data_pack_version }
    : null;
  const rows = versions.slice(0, 14).map(v => ({
    id: v.id, type: v.type ?? '?', dpv: v.data_pack_version, hasData: cached.has(String(v.id)),
  }));

  if (JSON_OUT) {
    console.log(JSON.stringify({
      versions: { source: src, count: list.length, configured },
      latestRelease: latestRelease ? { id: latestRelease.id, data_pack_version: latestRelease.data_pack_version, hasData: cached.has(String(latestRelease.id)) } : null,
      latestSnapshot: latestSnap ? { id: latestSnap.id, data_pack_version: (latestSnap as { data_pack_version?: number }).data_pack_version } : null,
      newerThanConfigured: newer,
      recent: rows,
    }, null, 2));
    return;
  }

  out(`可用版本(来自 ${src}, 共 ${versions.length} 个):`);
  out(`  最新正式版: ${latestRelease?.id}  (data_pack_version ${latestRelease?.data_pack_version})${cached.has(String(latestRelease?.id)) ? '  ✓数据已缓存' : '  数据未缓存,首次用需下载'}`);
  out(`  最新快照  : ${latestSnap?.id}  (data_pack_version ${latestSnap?.data_pack_version})`);
  if (newer) {
    out(`\n  ⚠ 你配置的版本是 ${configured}, 最新正式版已是 ${newer.id}。`);
    out(`    切到新版本:   node dpkit.mjs --version="${newer.id}"`);
    out(`    总跟随最新:   node dpkit.mjs --version="latest release"`);
  } else if (isPinned) {
    out(`\n  ✓ 你配置的版本 ${configured} 就是最新正式版。`);
  }
  out(`\n  最近版本(前 ${rows.length} 个, ✓=该版本命令数据已缓存):`);
  for (const r of rows) out(`    ${String(r.id).padEnd(18)} ${String(r.type).padEnd(8)} dpv ${String(r.dpv).padEnd(4)} ${r.hasData ? '✓' : '—'}`);
  if (versions.length > rows.length) out(`    …(共 ${versions.length} 个, 只显示最近 ${rows.length} 个)`);
  out(`\n  提示: 新命令/新子命令/新注册表值/新 NBT 字段都是数据驱动, 在线跑一次 --version=<新版> 会自动下载识别;`);
  out(`        仅全新参数类型或命令格式大改才需先 npm update @spyglassmc/language-server。`);
}

export async function main(): Promise<void> {
  if (OFFLINE) {
    await (async () => {
      try {
        if (SYNTAX_GIVEN && !SYNTAX.trim()) {
          console.error('[check] --syntax 需要命令路径, 例如 --syntax="execute on"');
          process.exit(2);
        }
        if (DUMP_GIVEN && !DUMP) {
          console.error('[check] --dump 需要输出文件路径, 例如 --dump=ref.md');
          process.exit(2);
        }
        if (SYNTAX_GIVEN && (DUMP_GIVEN || DUMP_ALL)) {
          console.error('[check] --syntax 与 --dump/--dump-all 互斥, 请分开使用');
          process.exit(2);
        }
        if (VERSIONS) { await printVersions(); process.exit(0); }
        const tree = loadCommandTree(GAME_VERSION);
        if (DUMP_GIVEN || DUMP_ALL) {
          const target = DUMP || join(ROOT_DIR, `command-reference-${GAME_VERSION}.md`);
          const { count, text } = renderAll(tree, DEPTH);
          writeFileSync(target, `# ${GAME_VERSION} 命令参考(由 dpkit 离线生成)\n\n> 语法来自 Spyglass 缓存的 ${GAME_VERSION} 命令树(${count} 条顶层命令)。\n> 重新生成: node dpkit.mjs --dump-all [--depth=N] [--version=<v>]\n\n${text}\n`);
          out(`[check] 已生成 ${count} 条命令的参考 → ${target}`);
          process.exit(0);
        }
        const segs = SYNTAX.trim().split(/[.\s]+/).filter(Boolean);
        if (!segs.length) {
          console.error('[check] --syntax 需要命令路径, 例如 --syntax="execute on"');
          process.exit(2);
        }
        const { found, lines } = renderPath(tree, segs, DEPTH);
        if (JSON_OUT) {
          console.log(JSON.stringify({ syntax: { path: segs.join(' '), version: GAME_VERSION, found, lines } }, null, 2));
        } else {
          out(lines.join('\n'));
        }
        process.exit(found ? 0 : 1);
      } catch (err) {
        console.error(`[check] --syntax/--dump 失败: ${(err as Error).message}`);
        process.exit(2);
      }
    })();
  }

  // ---------- online check / complete flow (not OFFLINE) ----------
  await (async () => {
    // Mirror @spyglassmc/core's normalizeUriPathname: lowercase Windows drive letters.
    const normUri = (uri: string): string => uri.replace(/^file:\/\/\/[A-Z]:\//, m => m.toLowerCase());

    // ---- collect files ----
    const DATA_DIR = join(DATAPACK, 'data');
    const fileList: string[] = [];
    (function walk(dir: string) {
      let entries;
      try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
      for (const e of entries) {
        const p = join(dir, e.name);
        if (e.isDirectory()) { walk(p); continue; }
        if (e.name.endsWith('.mcfunction') || (e.name.endsWith('.json') && !e.name.startsWith('.'))) fileList.push(p);
      }
    })(DATA_DIR);

    let rels = fileList.map(p => p.slice(DATA_DIR.length + 1).replace(/\\/g, '/'));
    if (ONLY) {
      const re = new RegExp('^' + ONLY.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
      rels = rels.filter(r => re.test(r));
    }
    if (rels.length === 0) {
      console.error(`[check] No files matched (datapack=${DATAPACK}, filter=${ONLY || '(all)'})`);
      console.error(`[check] --files is matched relative to data/ — try e.g. battle/function/*.mcfunction`);
      process.exit(2);
    }
    const files = rels.map(r => join(DATA_DIR, r));

    // ---- minimal JSON-RPC over stdio ----
    const child = spawn(process.execPath, [SERVER, '--stdio'], { stdio: ['pipe', 'pipe', 'pipe'] });
    let buf = Buffer.alloc(0);
    let nextId = 1000; // client ids start high, server-initiated request ids start at 1
    const pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: unknown) => void }>(); // id -> { resolve, reject }
    const diagnostics = new Map<string, Diagnostic[]>(); // normUri -> array of diagnostic (last wins)
    const checkFailed = new Set<string>(); // normUri -> server threw during check (no diagnostics emitted)
    const opened = new Set<string>(); // normUri
    let ready = false;
    let done = false;
    let settled = false;
    const serverLog: string[] = [];

    function send(obj: unknown): void {
      const body = JSON.stringify(obj);
      child.stdin.write(`Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`);
    }
    function request(method: string, params: unknown): Promise<unknown> {
      const id = ++nextId;
      send({ jsonrpc: '2.0', id, method, params });
      return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
    }
    function notify(method: string, params: unknown): void { send({ jsonrpc: '2.0', method, params }); }

    child.stdout.on('data', (d: Buffer) => {
      buf = Buffer.concat([buf, d]);
      let headerEnd;
      while ((headerEnd = buf.indexOf('\r\n\r\n')) !== -1) {
        const header = buf.slice(0, headerEnd).toString('utf8');
        const m = /Content-Length: (\d+)/i.exec(header);
        if (!m) { buf = buf.slice(headerEnd + 4); continue; }
        const len = +m[1], total = headerEnd + 4;
        if (buf.length < total + len) break;
        const body = buf.slice(total, total + len).toString('utf8');
        buf = buf.slice(total + len);
        handleMessage(JSON.parse(body));
      }
    });
    child.stderr.on('data', (d: Buffer) => process.stderr.write(d));
    child.on('error', err => {
      console.error(`[check] failed to start Spyglass server: ${err.message}`);
      console.error(`[check] is node_modules installed? (run: npm install)  server=${SERVER}`);
      finish(2);
    });
    child.on('exit', (code, sig) => {
      if (!done) {
        console.error(`[check] server exited early code=${code} sig=${sig}`);
        if (!ready) finish(2); // died before initialize settled — don't hang silently
      }
    });

    function finish(code: number): void {
      if (done) return;
      done = true;
      process.exitCode = code;
      child.kill();
      // Let stdout/stderr drain naturally; hard-exit after a short grace if the child's stdio lingers.
      setTimeout(() => process.exit(process.exitCode), 250).unref();
    }

    function log(msg: string): void {
      if (VERBOSE || /Error|error|resolveConfiguredVersion|check] Failed|Cannot create|does not exist|expected|unknown/i.test(msg)) {
        out(msg);
      }
    }

    function handleMessage(msg: { id?: unknown; method?: string; error?: unknown; result?: unknown; params?: any }): void {
      if (msg.id !== undefined && msg.id !== null) {
        const entry = pending.get(msg.id as number);
        if (entry) {
          pending.delete(msg.id as number);
          if (msg.error) entry.reject(new Error(JSON.stringify(msg.error)));
          else entry.resolve(msg.result);
          return;
        }
        // server-initiated request
        if (msg.method === 'workspace/configuration') {
          send({ jsonrpc: '2.0', id: msg.id, result: null }); // we pass config via initOptions
        } else if (msg.method === 'workspace/workspaceFolders') {
          send({ jsonrpc: '2.0', id: msg.id, result: null });
        } else if (msg.method === 'client/registerCapability' || msg.method === 'client/unregisterCapability'
            || msg.method === 'window/workDoneProgress/create') {
          send({ jsonrpc: '2.0', id: msg.id, result: null });
        } else {
          console.error(`[check] unhandled server request: ${msg.method}`);
          send({ jsonrpc: '2.0', id: msg.id, result: null });
        }
        return;
      }
      // notifications
      switch (msg.method) {
        case 'textDocument/publishDiagnostics': {
          const uri = normUri(msg.params.uri);
          if (!opened.has(uri)) return; // ignore diagnostics for non-client-managed files
          diagnostics.set(uri, msg.params.diagnostics ?? []);
          if (diagnostics.size + checkFailed.size >= opened.size) maybeReport();
          break;
        }
        case 'window/logMessage': {
          serverLog.push(msg.params.message);
          const m = msg.params.message.match(/\[Project\] \[check\] Failed for (file:\/\/\S+)/);
          if (m) {
            checkFailed.add(normUri(m[1]));
            if (diagnostics.size + checkFailed.size >= opened.size) maybeReport();
          }
          log(`[server] ${msg.params.message}`);
          break;
        }
        case 'window/showMessage': log(`[server-msg] ${msg.params.message}`); break;
        case '$/progress': {
          if (msg.params.token === 'initialize' && msg.params.value?.kind === 'end') { ready = true; openFiles(); }
          break;
        }
      }
    }

    function openFiles(): void {
      if (opened.size > 0) return;
      for (const f of files) {
        const uri = normUri(pathToFileURL(f).href);
        opened.add(uri);
        if (MODE !== 'analyze') {
          const languageId = f.endsWith('.mcfunction') ? 'mcfunction' : 'json';
          notify('textDocument/didOpen', {
            textDocument: { uri, languageId, version: 1, text: readFileSync(f, 'utf8') },
          });
        }
      }
      if (MODE === 'analyze') return;
      // didOpen alone parses/binds/checks but never emits documentUpdated → the server only pushes
      // publishDiagnostics when a client request touches ensureClientManagedChecked(). Fire one
      // lightweight request per file (documentSymbol) to force the diagnostics out.
      for (const uri of opened) {
        request('textDocument/documentSymbol', { textDocument: { uri } }).catch(() => {});
      }
    }

    function maybeReport(): void {
      if (settled || diagnostics.size + checkFailed.size < opened.size) return;
      settled = true;
      setTimeout(report, 1500); // let a second pass refine diagnostics
    }

    function issueSig(ds: Diagnostic[]): string {
      // Stable signature of a file's non-ignored issues, for --delta comparison.
      return [...ds]
        .sort((a, b) => (a.range.start.line - b.range.start.line) || (a.range.start.character - b.range.start.character))
        .map(d => `${d.severity}:${d.message}`).join('\n');
    }

    // ---- 26.2 已知坑扫描器(heuristic) ----
    interface GotchaIssue { line: number; key: string; msg: string }
    const lineOf = (text: string, needle: string, from = 0): number | null => {
      const i = text.indexOf(needle, from);
      return i < 0 ? null : text.slice(0, i).split('\n').length;
    };

    function gotchaScan(f: string): GotchaIssue[] {
      const rel = f.slice(DATA_DIR.length + 1).replace(/\\/g, '/');
      let text: string;
      try { text = readFileSync(f, 'utf8'); } catch { return []; }
      const out: GotchaIssue[] = [];
      if (f.endsWith('.json')) {
        const m1 = text.match(/"damage"\s*:\s*\{\s*[^{}]*?"(source_entity|direct_entity)"\s*:/);
        if (m1) out.push({ line: lineOf(text, `"${m1[1]}"`) ?? 1, key: 'damage层级', msg: `26.2: source_entity/direct_entity 应放在 damage.type 下(damage 层只有 dealt/taken/blocked/type)。写在 damage 直接子级游戏会静默丢弃整条成就 → 改成 "damage": {"type": {"source_entity": {...}}}` });
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
                if (dup && or) out.push({ line: lineOf(text, '"criteria"') ?? 1, key: '多criteria+OR', msg: '26.2: 同触发器多 criteria + requirements OR 不触发(实测)。多来源监听要拆成多个独立成就,各一个 criteria、共用同一回调。' });
              }
              Object.values(rec).forEach(walk);
            }
          };
          walk(obj);
        } catch { /* 非合法 JSON —— 引擎已报解析错,跳过 */ }
      } else if (f.endsWith('.mcfunction')) {
        const lines = text.split('\n');
        lines.forEach((L, i) => {
          const n = i + 1;
          const pm = L.match(/\bparticle\s+minecraft:(item|block)\s+[a-z0-9_:]+/);
          if (pm) out.push({ line: n, key: '带参粒子裸ID', msg: `26.2: 带参粒子 ${pm[1]} 参数要用 map 语法({item:...}/{block_state:...}),裸 ID 让整函数不加载` });
          if (/\bsummon\b/.test(L)) {
            const sk = L.match(/\b(tags|duration|wait_time|silent|radius|age|health|custom_name|invisible)\s*:/);
            if (sk) out.push({ line: n, key: 'NBT字段名', msg: `26.2: 实体 NBT 字段是 PascalCase(如 ${sk[1]} → ${sk[1][0].toUpperCase()}${sk[1].slice(1)}),小写/蛇形 summon 时被静默忽略` });
          }
        });
      }
      return out;
    }

    // ---- 游戏日志自检(best-effort):reload 新鲜度 + 数据包加载错误 ----
    function findGameLog(): string | null {
      const parts = DATAPACK.split(/[\\/]+/);
      const cand: string[] = [];
      const vi = parts.findIndex(p => p === 'versions');
      if (vi >= 0) {
        cand.push(join(parts.slice(0, vi + 2).join('\\'), 'logs', 'latest.log')); // <install>\versions\<ver>\logs
        cand.push(join(parts.slice(0, vi).join('\\'), 'logs', 'latest.log'));     // <install>\logs
      }
      cand.push('D:\\Minecraft\\.minecraft\\logs\\latest.log');
      cand.push(join(process.env.APPDATA ?? '', '.minecraft', 'logs', 'latest.log'));
      return cand.find(c => { try { return statSync(c).isFile(); } catch { return false; } }) ?? null;
    }

    interface GameLogReport {
      found: boolean;
      log?: string;
      stale?: boolean;
      lastLoaded?: string | null;
      hits?: string[];
    }
    function gameLogReport(): GameLogReport {
      const log = findGameLog();
      if (!log) return { found: false };
      let text = '';
      try { text = readFileSync(log, 'utf8'); } catch { return { found: false }; }
      let packNewest = 0;
      for (const f of files) { try { const s = statSync(f); if (s.mtimeMs > packNewest) packNewest = s.mtimeMs; } catch {} }
      let logMtime = 0;
      try { logMtime = statSync(log).mtimeMs; } catch {}
      const stale = packNewest > logMtime;
      const lastLoaded = [...text.matchAll(/Loaded (\d+) advancements/g)].pop();
      const errRe = /(Failed to load|Couldn't parse|Unknown (function|advancement|tag|predicate|item|recipe)|Invalid|Unexpected|Failed to read|Parse error)/i;
      const hits: string[] = [];
      const ls = text.split('\n');
      for (let i = ls.length - 1; i >= 0 && hits.length < 8; i--) {
        const L = ls[i];
        if (!errRe.test(L)) continue;
        if (/(ReShade|dynamic library)/i.test(L)) continue;
        if (!/(battle:|datapack|function|advancement|minecraft:)/i.test(L)) continue;
        hits.push(L.trim().replace(/\s+/g, ' ').slice(0, 200));
      }
      return { found: true, log, stale, lastLoaded: lastLoaded ? lastLoaded[1] : null, hits: hits.reverse() };
    }

    function report(): void {
      let errorCount = 0, warnCount = 0, ignoredCount = 0, internalErr = 0, issueFiles = 0;
      let deltaChangedFiles = 0, deltaResolvedFiles = 0;
      const lines: string[] = [];
      const byMessage = new Map<string, number>(); // message -> count (non-ignored only)
      const ignoredByMessage = new Map<string, number>(); // message -> count
      const issues: ReportIssue[] = []; // for --json
      const ignoredList: ReportIssue[] = []; // for --json

      // 26.2 已知坑扫描(heuristic):引擎宽松 schema 漏掉、游戏里却静默失败的写法
      const gotchaByFile = new Map<string, GotchaIssue[]>(); // rel -> [{line,key,msg}]
      let gotchaCount = 0;
      if (!NO_GOTCHAS) {
        for (const f of files) {
          const g = gotchaScan(f);
          if (g.length) { gotchaByFile.set(f.slice(DATA_DIR.length + 1).replace(/\\/g, '/'), g); gotchaCount += g.length; }
        }
      }
      const glog = LOGCHECK ? gameLogReport() : { found: false } as GameLogReport;

      let baseline: Record<string, { sig: string }> = {};
      const newBaseline: { datapack: string; version: string; files: Record<string, { sig: string }> } = { datapack: DATAPACK, version: GAME_VERSION, files: {} };
      if (DELTA) {
        try {
          const b = JSON.parse(readFileSync(BASELINE_FILE, 'utf8')) as { datapack?: string; version?: string; files?: Record<string, { sig: string }> };
          if (b.datapack === DATAPACK && b.version === GAME_VERSION) baseline = b.files ?? {};
        } catch { /* no usable baseline yet */ }
      }

      for (const f of files) {
        const uri = normUri(pathToFileURL(f).href);
        const rel = f.slice(DATA_DIR.length + 1).replace(/\\/g, '/');
        const ds = diagnostics.get(uri);
        const prev = baseline[rel];

        if (!ds) {
          internalErr++; issueFiles++;
          if (checkFailed.has(uri)) {
            lines.push(`\n== ${rel} ==  ⚠ server threw during check — no diagnostics (see server log)`);
          } else {
            lines.push(`\n== ${rel} ==  ⚠ no diagnostics received — check blocked or server error`);
          }
          if (DELTA) deltaChangedFiles++; // surface blocked files so they aren't silently hidden
          continue;
        }
        const nonIgnored: Diagnostic[] = [];
        for (const d of ds) {
          const sev = d.severity === 1 ? 'E' : d.severity === 2 ? 'W' : '·';
          if (matchesIgnore(d.message)) {
            ignoredCount++;
            ignoredByMessage.set(d.message, (ignoredByMessage.get(d.message) ?? 0) + 1);
            ignoredList.push({ file: rel, line: d.range.start.line + 1, char: d.range.start.character, severity: sev, message: d.message });
            continue;
          }
          nonIgnored.push(d);
          byMessage.set(d.message, (byMessage.get(d.message) ?? 0) + 1);
          issues.push({ file: rel, line: d.range.start.line + 1, char: d.range.start.character, severity: sev, message: d.message });
          if (d.severity === 1) errorCount++;
          else if (d.severity === 2) warnCount++;
        }

        const sig = issueSig(nonIgnored);
        newBaseline.files[rel] = { sig };

        if (DELTA) {
          const changed = !prev || prev.sig !== sig;
          if (changed && prev?.sig && sig === '') {
            deltaResolvedFiles++;
            lines.push(`\n== ${rel} ==  ✓ resolved (previously ${prev.sig.split('\n').length} issue(s))`);
            continue;
          }
          if (!changed) continue; // same issues as last run — nothing new to report
        }

        if (nonIgnored.length === 0) continue; // only ignored diagnostics → effectively clean
        issueFiles++;
        if (DELTA) deltaChangedFiles++;

        lines.push(`\n== ${rel} (${nonIgnored.length}) ==`);
        for (const d of nonIgnored.sort((a, b) => (a.range.start.line - b.range.start.line) || (a.range.start.character - b.range.start.character))) {
          const line = d.range.start.line + 1, ch = d.range.start.character;
          const sev = d.severity === 1 ? 'E' : d.severity === 2 ? 'W' : '·';
          lines.push(`  [${sev}:${line}:${ch}] ${d.message}`);
        }
      }

      // aggregation sections
      const agg = [...byMessage.entries()].filter(([, c]) => c > 1).sort((a, b) => b[1] - a[1]).slice(0, 20);
      const ignoredAgg = [...ignoredByMessage.entries()].sort((a, b) => b[1] - a[1]);

      if (DELTA) {
        try { writeFileSync(BASELINE_FILE, JSON.stringify(newBaseline, null, 2)); }
        catch (err) { console.error(`[check] could not write baseline ${BASELINE_FILE}: ${(err as Error).message}`); }
      }

      const clean = files.length - issueFiles;
      if (JSON_OUT) {
        const obj: Record<string, unknown> = {
          datapack: DATAPACK,
          version: GAME_VERSION,
          resolvedVersion: resolvedVersion ?? null,
          files: { checked: files.length, clean },
          summary: { errors: errorCount, warnings: warnCount, ignored: ignoredCount, internalFailures: internalErr, gotchas: gotchaCount },
          issues,
          ignored: ignoredList,
          gotchas: [...gotchaByFile.entries()].map(([file, gs]) => ({ file, items: gs })),
          log: glog.found ? { found: true, path: glog.log, stale: glog.stale, lastLoaded: glog.lastLoaded, errors: glog.hits } : { found: false },
          byMessage: agg.map(([message, count]) => ({ message, count })),
        };
        if (DELTA) obj.delta = { changedFiles: deltaChangedFiles, resolvedFiles: deltaResolvedFiles };
        console.log(JSON.stringify(obj, null, 2));
      } else {
        console.log(`\n———— CHECK REPORT ————`);
        console.log(`datapack : ${DATAPACK}`);
        console.log(`version  : ${GAME_VERSION}  (server resolved: ${resolvedVersion ?? '?'})`);
        console.log(`files    : ${files.length} checked, ${clean} clean${DELTA ? ` · delta: ${deltaChangedFiles} changed, ${deltaResolvedFiles} resolved` : ''}`);
        console.log(`summary  : ${errorCount} error(s) · ${warnCount} warning(s) · ${ignoredCount} ignored · ${internalErr} internal-failure · gotchas ${gotchaCount}`);
        if (lines.length) console.log(lines.join('\n'));
        if (agg.length) {
          console.log(`\n== 按消息聚合 (top ${agg.length}) ==`);
          for (const [m, c] of agg) console.log(`  ${c}× ${m}`);
        }
        if (ignoredAgg.length) {
          console.log(`\n== 忽略(已知误报, 不计入结果) ==`);
          for (const [m, c] of ignoredAgg) console.log(`  ${c}× ${m}`);
        }
        if (gotchaByFile.size) {
          console.log(`\n== 26.2 已知坑扫描(heuristic,不计入错误;--no-gotchas 关闭) ==`);
          for (const [rel, gs] of gotchaByFile) {
            console.log(`\n  ${rel} (${gs.length})`);
            for (const g of gs) console.log(`  [坑:${g.line}] (${g.key}) ${g.msg}`);
          }
        }
        if (glog.found) {
          console.log(`\n== 游戏日志(自检) ==`);
          console.log(`  日志  : ${glog.log}`);
          if (glog.stale) console.log(`  ⚠ 数据包文件比日志新 —— 可能还没 /reload,报错/成就计数是旧的`);
          else console.log(`  ✓ 日志与数据包同步(最近一次 /reload 后无新改动)`);
          console.log(`  成就  : ${glog.lastLoaded ? `最近一次 Loaded ${glog.lastLoaded} advancements` : '(日志无成就计数行)'}`);
          if (glog.hits && glog.hits.length) {
            console.log(`  错误  : 疑似数据包加载错误 ${glog.hits.length} 条:`);
            for (const h of glog.hits) console.log(`    ✗ ${h}`);
          } else {
            console.log(`  错误  : 未发现疑似数据包加载错误`);
          }
        } else if (LOGCHECK) {
          console.log(`\n== 游戏日志(自检) ==`);
          console.log(`  未找到 latest.log,跳过(--no-log 关闭)`);
        }
      }

      // ---- version freshness hint (cache was refreshed this run by the engine's own fetch) ----
      try {
        const vl = loadCachedVersions();
        if (vl?.length) {
          const latest = (vl as { type?: string; id?: string; data_pack_version?: number }[]).filter(v => v.type === 'release')[0];
          const effective = resolvedVersion ?? GAME_VERSION;
          const eff = (vl as { id: string; data_pack_version: number }[]).find(v => v.id === effective);
          const pinned = !['auto', 'latest release', 'latest snapshot'].includes(GAME_VERSION);
          if (latest && eff && pinned && eff.data_pack_version < (latest.data_pack_version ?? 0)) {
            out(`\n[check] 提示: 最新正式版已是 ${latest.id} (data_pack_version ${latest.data_pack_version}), 当前按 ${effective} (dpv ${eff.data_pack_version}) 检查。`);
            out(`       切到新版本: node dpkit.mjs --version="${latest.id}"  ·  总跟随最新: --version="latest release"  ·  查可用版本: --versions`);
          }
        }
      } catch { /* hint is best-effort */ }

      finish(errorCount > 0 || internalErr > 0 ? 1 : 0);
    }

    const KIND_NAMES: Record<number, string> = { 1:'文本',2:'方法',3:'函数',4:'构造',5:'字段',6:'变量',7:'类',8:'接口',9:'模块',10:'属性',11:'单位',12:'值',13:'枚举',14:'关键字',15:'片段',16:'颜色',17:'文件',18:'引用',19:'文件夹',20:'枚举成员',21:'常量',22:'结构',23:'事件',24:'操作符',25:'类型参数' };
    interface CompletionItemDTO { label: string; kind: string | null; detail: string | null; documentation: string | null }
    function completionItemsOf(res: unknown): CompletionItemDTO[] {
      return (Array.isArray(res) ? res : ((res as { items?: unknown[] })?.items ?? [])).map(it => {
        const item = it as { label?: string; kind?: number; detail?: string | null; documentation?: unknown };
        let documentation: string | null = null;
        if (item.documentation != null) {
          if (typeof item.documentation === 'object') {
            const v = (item.documentation as { value?: unknown })?.value;
            documentation = v == null ? '' : String(v);
          } else {
            documentation = String(item.documentation);
          }
        }
        return {
          label: item.label ?? '',
          kind: KIND_NAMES[item.kind ?? 0] ?? null,
          detail: item.detail ?? null,
          documentation,
        };
      });
    }
    function printCompletion(rel: string, ln: number, col: number, res: unknown): void {
      const items = completionItemsOf(res);
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

    interface Diagnostic { severity?: number; message: string; range: { start: { line: number; character: number }; end: { line: number; character: number } } }
    interface ReportIssue { file: string; line: number; char: number; severity: string; message: string }

    let resolvedVersion: string | undefined;
    try {
      const wpUri = pathToFileURL(DATAPACK).href;
      out(`[check] datapack=${DATAPACK}${AUTO_DETECTED ? '  (自动探测)' : ''}  version=${GAME_VERSION}  files=${files.length}`);
      if (!existsSync(DATAPACK)) {
        console.error(`[check] 找不到数据包目录: ${DATAPACK}`);
        console.error(`[check] 用 --datapack= 指定, 例如 --datapack="D:\\Minecraft\\.minecraft\\versions\\26.2\\saves\\111\\datapacks\\pvp"`);
        finish(2);
        return;
      }
      const initResult = await request('initialize', {
        processId: null,
        rootUri: wpUri,
        workspaceFolders: [{ uri: wpUri, name: 'datapack' }],
        capabilities: { window: { workDoneProgress: true }, textDocument: {}, workspace: { workspaceFolders: true, didChangeConfiguration: { dynamicRegistration: true }, didChangeWatchedFiles: { dynamicRegistration: true } } },
        initializationOptions: { defaultConfig: { env: { gameVersion: GAME_VERSION } } },
        locale: 'en',
      }) as { serverInfo?: { name?: string; version?: string } } | undefined;
      out(`[check] server: ${initResult?.serverInfo?.name ?? '?'} ${initResult?.serverInfo?.version ?? ''}`.trim());
      notify('initialized', {});

      const deadline = Date.now() + 180000;
      while (!ready && Date.now() < deadline) {
        if (done) return;
        await new Promise(r => setTimeout(r, 250));
      }
      if (!ready) {
        console.error(`[check] project never became ready within 180s. Server log:\n${serverLog.join('\n')}`);
        finish(2);
        return;
      }
      // remember which version the server actually picked
      for (const l of serverLog) {
        const m = l.match(/selecting version (\S+)/);
        if (m) resolvedVersion = m[1];
      }

      if (COMPLETE) {
        const m = COMPLETE.match(/^(.*):(\d+):(\d+)$/);
        if (!m) {
          console.error('[check] --complete 格式应为 <data相对路径>:<行>:<列> (1-based), 例如 battle/function/snowman/x.mcfunction:5:12');
          finish(2); return;
        }
        const rel = m[1], ln = +m[2], col = +m[3];
        const file = join(DATA_DIR, rel);
        let text: string;
        try { text = readFileSync(file, 'utf8'); }
        catch { console.error(`[check] 找不到文件: ${file} (相对 datapack 的 data/ 目录)`); finish(2); return; }
        const lineCount = text.split('\n').length;
        if (ln < 1 || col < 1) {
          console.error(`[check] --complete 行/列必须 ≥1 (1-based); 收到 行=${ln} 列=${col}`);
          finish(2); return;
        }
        if (ln > lineCount) {
          console.error(`[check] --complete 行号 ${ln} 超出文件行数 ${lineCount}`);
          finish(2); return;
        }
        const uri = normUri(pathToFileURL(file).href);
        opened.add(uri);
        const languageId = file.endsWith('.mcfunction') ? 'mcfunction' : 'json';
        notify('textDocument/didOpen', { textDocument: { uri, languageId, version: 1, text } });
        // Force the engine to parse + bind the file (completions need it checked first), then
        // wait for its diagnostics to land so a big project doesn't return empty lists.
        request('textDocument/documentSymbol', { textDocument: { uri } }).catch(() => {});
        const dl = Date.now() + 6000;
        while (!diagnostics.has(uri) && Date.now() < dl) await new Promise(r => setTimeout(r, 100));
        try {
          const res = await request('textDocument/completion', {
            textDocument: { uri },
            position: { line: ln - 1, character: col - 1 },
            context: { triggerKind: 1 },
          });
          printCompletion(rel, ln, col, res);
          finish(0);
        } catch (err) {
          console.error(`[check] completion 查询失败: ${(err as Error)?.message ?? err}`);
          finish(2);
        }
        return;
      }

      openFiles();
      if (MODE === 'analyze') {
        // The custom analyzeProject request processes every tracked file in the proper order and
        // emits documentErrored for each — the engine's intended "check everything" path.
        const dummyToken = { isCancellationRequested: false, onCancellationRequested: () => {}, };
        request('spyglassmc/analyzeProject', dummyToken).catch(() => {});
      }
      const dl2 = Date.now() + 150000;
      while (!settled && Date.now() < dl2 && !done) {
        await new Promise(r => setTimeout(r, 250));
      }
      if (!settled) {
        console.error(`[check] timed out waiting for diagnostics (received ${diagnostics.size}/${opened.size}). Server log:\n${serverLog.join('\n')}`);
        finish(2);
      }
    } catch (err) {
      console.error(`[check] internal failure: ${(err as Error)?.stack ?? err}`);
      finish(2);
    }
  })();
}
