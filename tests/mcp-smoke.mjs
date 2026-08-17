// mcp-smoke.mjs — MCP stdio client exercising every dpkit tool AND asserting on the results
// (not just "didn't crash"). Spawns dist/mcp.js, does the initialize handshake, lists tools,
// calls each one, and checks the returned JSON has the expected shape/content.
// MCP stdio transport is NEWLINE-delimited JSON (unlike LSP's Content-Length framing).
// Usage: npm run build && node tests/mcp-smoke.mjs [tool]
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';

const MCP = process.env.DPKIT_MCP ?? 'dist/mcp.js';
// Version the smoke test exercises. 'latest release' keeps the suite from being pinned to one
// release; set DPKIT_TEST_VERSION to a concrete id for a focused run.
const TEST_VERSION = process.env.DPKIT_TEST_VERSION ?? 'latest release';
// Self-contained fixture datapack, so the smoke test runs on any machine (no external datapack needed).
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'pack');
const child = spawn(process.execPath, [MCP], { stdio: ['pipe', 'pipe', 'pipe'] });
let buf = Buffer.alloc(0);
let nextId = 1;
const pending = new Map();

function send(obj) {
  child.stdin.write(JSON.stringify(obj) + '\n');
}
function request(method, params) {
  const id = nextId++;
  send({ jsonrpc: '2.0', id, method, params });
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

child.stdout.on('data', (d) => {
  buf = Buffer.concat([buf, d]);
  let nl;
  while ((nl = buf.indexOf('\n')) !== -1) {
    const line = buf.slice(0, nl).toString('utf8').trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    const msg = JSON.parse(line);
    if (msg.id !== undefined && msg.id !== null) {
      const p = pending.get(msg.id);
      if (p) { pending.delete(msg.id); msg.error ? p.reject(new Error(JSON.stringify(msg.error))) : p.resolve(msg.result); }
    }
  }
});
child.stderr.on('data', (d) => process.stderr.write(d));
child.on('exit', (code) => { console.error(`[mcp] server exited ${code}`); });

let failures = 0;
const assert = (cond, msg) => {
  if (cond) console.log(`✓ ${msg}`);
  else { failures++; console.error(`✗ ${msg}`); }
};

async function call(name, args) {
  const t0 = Date.now();
  const res = await request('tools/call', { name, arguments: args ?? {} });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const text = res?.content?.[0]?.text ?? '';
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  const isErr = res?.isError ?? false;
  if (isErr) { failures++; console.error(`✗ ${name}: isError — ${text.slice(0, 300)}`); }
  console.log(`--- ${name} (${dt}s) ok`);
  return { parsed, isErr };
}

const TOOLS = ['check_datapack', 'check_command', 'check_macro', 'lint_rules', 'write_report', 'diff_reports', 'query_syntax', 'complete_at', 'list_registry', 'list_versions', 'scan_gotchas', 'read_logs', 'wait_for_log', 'get_block_states', 'get_vanilla_data', 'get_pack_meta'];

let logRoot;
let macroRoot;

try {
  const init = await request('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'dpkit-smoke', version: '1.0.0' },
  });
  assert(init?.serverInfo?.name === 'dpkit', `initialize → serverInfo.name = ${init?.serverInfo?.name}`);
  send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });

  const tools = await request('tools/list', {});
  const names = (tools?.tools ?? []).map(t => t.name);
  for (const t of TOOLS) assert(names.includes(t), `tools/list includes ${t}`);

  const prompts = await request('prompts/list', {});
  const promptNames = (prompts?.prompts ?? []).map(p => p.name);
  assert(promptNames.includes('dpkit-workflow'), 'prompts/list includes dpkit-workflow');
  const prompt = await request('prompts/get', { name: 'dpkit-workflow' });
  const promptText = (prompt?.messages ?? []).map(m => (m?.content?.type === 'text' ? m.content.text : '')).join('\n');
  assert(promptText.includes('query_syntax') && promptText.includes('list_registry') && promptText.includes('check_datapack'),
    'dpkit-workflow names the dpkit tools');

  // A fake default-launcher logs dir so read_logs can be exercised deterministically (offline).
  logRoot = mkdtempSync(join(tmpdir(), 'dpkit-mcp-smoke-'));
  mkdirSync(join(logRoot, 'logs'), { recursive: true });
  writeFileSync(join(logRoot, 'logs', 'latest.log'), 'smoke line 1\nsmoke line 2\nsmoke line 3\n');

  // A tiny datapack with one macro line so check_macro can be exercised.
  macroRoot = mkdtempSync(join(tmpdir(), 'dpkit-mcp-macro-'));
  mkdirSync(join(macroRoot, 'data', 'battle', 'function', 'archer'), { recursive: true });
  writeFileSync(join(macroRoot, 'data', 'battle', 'function', 'archer', 'pierce_summon.mcfunction'),
    '$summon minecraft:arrow ~ ~ ~ {Motion:[$(yaw),$(pitch),0.0]}\n');

  const which = process.argv[2];
  const targets = which ? [which] : TOOLS;
  const results = {};
  for (const name of targets) {
    if (!names.includes(name)) { assert(false, `tools/list includes ${name}`); continue; }
    const args = {
      query_syntax: { path: 'execute on', version: TEST_VERSION },
      list_versions: { configured: TEST_VERSION },
      scan_gotchas: { datapack: FIXTURE, files: 'test/function/gotcha.mcfunction', version: TEST_VERSION },
      list_registry: { registry: 'mob_effect', version: TEST_VERSION },
      complete_at: { datapack: FIXTURE, file: 'test/function/gotcha.mcfunction', line: 1, column: 24, version: TEST_VERSION },
      check_datapack: { datapack: FIXTURE, version: TEST_VERSION },
      check_command: { command: 'say hello', version: TEST_VERSION, datapack: '' },
      check_macro: { macro: 'battle:archer/pierce_summon', version: TEST_VERSION, datapack: macroRoot, macro_args: { yaw: 0, pitch: 0 } },
      lint_rules: { datapack: FIXTURE, rules: [] },
      write_report: { report: { issues: [], summary: { errors: 0, warnings: 0 }, version: TEST_VERSION }, path: join(tmpdir(), 'dpkit-mcp-report.json') },
      diff_reports: { old: null, current: { issues: [] } },
      read_logs: { launcher: 'default', minecraftRoot: logRoot, lines: 5 },
      wait_for_log: { pattern: 'smoke line', timeout_ms: 2000, launcher: 'default', minecraftRoot: logRoot },
      get_block_states: { version: TEST_VERSION },
      get_vanilla_data: { version: TEST_VERSION, category: 'loot_table', search: 'ancient_city' },
      get_pack_meta: { version: TEST_VERSION },
    }[name];
    results[name] = await call(name, args);
  }

  if (results.query_syntax) {
    const r = results.query_syntax.parsed;
    assert(r?.found === true, 'query_syntax "execute on" → found');
    assert(Array.isArray(r?.lines) && r.lines.length > 0, 'query_syntax returns non-empty lines');
  }
  if (results.list_registry) {
    const r = results.list_registry.parsed;
    assert(r?.found === true, 'list_registry mob_effect → found');
    assert(Array.isArray(r?.values) && r.values.includes('speed'), 'list_registry values include "speed"');
    assert(r?.ok === true, 'list_registry returns the ok:true envelope');
    const page = await call('list_registry', { registry: 'mob_effect', version: TEST_VERSION, offset: 0, limit: 1 });
    const pr = page.parsed;
    assert(pr?.values?.length === 1, 'list_registry limit=1 returns one value');
    assert(typeof pr?.offset === 'number' && typeof pr?.total === 'number', 'list_registry returns offset and total');
    assert(pr?.truncated === true && typeof pr?.nextOffset === 'number', 'list_registry reports nextOffset when more pages remain');
  }
  if (results.list_versions) {
    const r = results.list_versions.parsed;
    assert(typeof r?.latestRelease?.id === 'string' && r.latestRelease.id.length > 0, 'list_versions has latestRelease.id');
  }
  if (results.scan_gotchas) {
    const r = results.scan_gotchas.parsed;
    assert(Array.isArray(r?.gotchas) && r.gotchas.length > 0, 'scan_gotchas found gotchas in the fixture');
  }
  if (results.complete_at) {
    const r = results.complete_at.parsed;
    assert(Array.isArray(r?.items), 'complete_at returns an items array');
  }
  if (results.check_datapack) {
    const r = results.check_datapack.parsed;
    assert(r && typeof r.summary?.errors === 'number' && typeof r.summary?.warnings === 'number',
      'check_datapack returns summary with error/warning counts');
    assert(r?.ok === true, 'check_datapack returns the ok:true envelope');
  }
  if (results.check_command) {
    const r = results.check_command.parsed;
    assert(r?.valid === true, 'check_command say hello → valid:true');
    assert(r?.ok === true, 'check_command returns the ok:true envelope');
    const bad = await call('check_command', { command: 'setblock', version: TEST_VERSION, datapack: '' });
    const br = bad.parsed;
    assert(br?.valid === false, 'check_command missing args → valid:false');
    assert(typeof br?.cursor === 'number' && br.cursor >= 0, 'check_command missing args → cursor position');
    assert(typeof br?.parsedUpTo === 'string', 'check_command missing args → parsedUpTo string');
    assert(typeof br?.hint === 'string' && br.hint.length > 0, 'check_command missing args → hint string');
  }
  if (results.check_macro) {
    const r = results.check_macro.parsed;
    assert(r?.macro_fully_checked === true, 'check_macro fully expands with args');
    assert(r?.ok === true, 'check_macro returns the ok:true envelope');
  }
  if (results.lint_rules) {
    const r = results.lint_rules.parsed;
    assert(Array.isArray(r?.items), 'lint_rules returns an items array');
    assert(r?.ok === true, 'lint_rules returns the ok:true envelope');
  }
  if (results.write_report) {
    const r = results.write_report.parsed;
    assert(r?.written === true, 'write_report writes the report');
    assert(r?.ok === true, 'write_report returns the ok:true envelope');
  }
  if (results.diff_reports) {
    const r = results.diff_reports.parsed;
    assert(r?.diff === null, 'diff_reports with null old → null diff');
    assert(r?.ok === true, 'diff_reports returns the ok:true envelope');
  }
  if (results.read_logs) {
    const r = results.read_logs.parsed;
    assert(typeof r?.success === 'boolean', 'read_logs returns a success boolean');
    assert(r?.ok === true, 'read_logs returns the ok:true envelope');
    assert(r?.success === true, 'read_logs finds the fake latest.log (success:true)');
    assert(Array.isArray(r?.logs) && r.logs.length > 0, 'read_logs success → non-empty logs array');
    const first = r?.logs?.[0];
    assert(first && typeof first.file === 'string' && typeof first.path === 'string' &&
      typeof first.size === 'number' && typeof first.linesShown === 'number' && typeof first.content === 'string',
      'read_logs log entries carry file/path/size/linesShown/content');
    assert(typeof r?.nextId === 'number' && r.nextId > 0, 'read_logs returns nextId cursor');
    assert(Array.isArray(r?.entries), 'read_logs returns cursor entries array');
    assert(typeof r?.missed === 'number', 'read_logs returns missed counter');
    assert(typeof r?.droppedTotal === 'number', 'read_logs returns droppedTotal counter');
    // failure branch: a minecraftRoot with no logs → success:false + error string (shape only).
    const emptyRoot = mkdtempSync(join(tmpdir(), 'dpkit-mcp-smoke-empty-'));
    const emptyRes = await call('read_logs', { launcher: 'default', minecraftRoot: emptyRoot });
    const er = emptyRes.parsed;
    assert(er?.success === false, 'read_logs on an empty root → success:false');
    assert(typeof er?.error === 'string' && er.error.length > 0, 'read_logs on an empty root → error string');
    rmSync(emptyRoot, { recursive: true, force: true });
  }
  if (results.wait_for_log) {
    const r = results.wait_for_log.parsed;
    assert(r?.ok === true, 'wait_for_log returns the ok:true envelope');
    assert(r?.matched === true, 'wait_for_log matches an already-buffered smoke line');
    assert(r?.entry && typeof r.entry.message === 'string' && r.entry.message.includes('smoke line'),
      'wait_for_log returns the matching entry');
    assert(Array.isArray(r?.context), 'wait_for_log returns context around the match');
  }
  if (results.get_pack_meta) {
    const r = results.get_pack_meta.parsed;
    assert(r?.ok === true, 'get_pack_meta returns the ok:true envelope');
    assert(typeof r?.data_pack_version === 'number' || r?.data_pack_version === null,
      'get_pack_meta returns a data_pack_version (or null)');
    assert(typeof r?.pack_format === 'number' || r?.pack_format === null,
      'get_pack_meta returns pack_format');
    assert(typeof r?.pack_mcmeta_example === 'string' && r.pack_mcmeta_example.includes('pack_format'),
      'get_pack_meta returns a pack.mcmeta example with pack_format');
  }
  if (results.get_block_states) {
    const r = results.get_block_states.parsed;
    assert(r && typeof r.ok === 'boolean', 'get_block_states returns an ok boolean');
    if (r?.ok === true) {
      assert(Array.isArray(r.blocks) && typeof r.total === 'number', 'get_block_states list → blocks array + total');
      const single = await call('get_block_states', { version: TEST_VERSION, block: 'stone' });
      const sr = single.parsed;
      if (sr?.ok === true && sr?.found === true) {
        assert(typeof sr.example === 'string' && sr.example.startsWith('setblock ~ ~ ~ stone'),
          'get_block_states single block returns a setblock example');
      }
    } else {
      assert(typeof r?.error === 'string' && r.error.length > 0, 'get_block_states uncached → structured error');
    }
  }
  if (results.get_vanilla_data) {
    const r = results.get_vanilla_data.parsed;
    assert(r && typeof r.ok === 'boolean', 'get_vanilla_data returns an ok boolean');
    if (r?.ok === true) {
      assert(Array.isArray(r.matches) && typeof r.total === 'number', 'get_vanilla_data search → matches array + total');
    } else {
      assert(typeof r?.error === 'string' && r.error.length > 0, 'get_vanilla_data uncached → structured error');
    }
  }
} catch (e) {
  failures++;
  console.error('[mcp] smoke failed:', e.message);
} finally {
  if (logRoot) rmSync(logRoot, { recursive: true, force: true });
  try { rmSync(macroRoot, { recursive: true, force: true }); } catch {}
  setTimeout(() => child.kill(), 200);
}

process.on('beforeExit', () => {
  if (failures) { console.error(`\n[mcp] smoke FAIL — ${failures} assertion(s) failed`); process.exitCode = 1; }
  else console.log('\n[mcp] smoke PASS');
});
