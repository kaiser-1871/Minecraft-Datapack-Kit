// mcp-smoke.mjs — MCP stdio client exercising every dpkit tool AND asserting on the results
// (not just "didn't crash"). Spawns dist/mcp.js, does the initialize handshake, lists tools,
// calls each one, and checks the returned JSON has the expected shape/content.
// MCP stdio transport is NEWLINE-delimited JSON (unlike LSP's Content-Length framing).
// Usage: npm run build && node tests/mcp-smoke.mjs [tool]
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const MCP = process.env.DPKIT_MCP ?? 'dist/mcp.js';
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

const TOOLS = ['check_datapack', 'query_syntax', 'complete_at', 'list_registry', 'list_versions', 'scan_gotchas'];

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

  const which = process.argv[2];
  const targets = which ? [which] : TOOLS;
  const results = {};
  for (const name of targets) {
    if (!names.includes(name)) { assert(false, `tools/list includes ${name}`); continue; }
    const args = {
      query_syntax: { path: 'execute on', version: '26.2' },
      list_versions: { configured: '26.2' },
      scan_gotchas: { datapack: FIXTURE, files: 'test/function/gotcha.mcfunction' },
      list_registry: { registry: 'mob_effect', version: '26.2' },
      complete_at: { datapack: FIXTURE, file: 'test/function/gotcha.mcfunction', line: 1, column: 24 },
      check_datapack: { datapack: FIXTURE },
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
  }
} catch (e) {
  failures++;
  console.error('[mcp] smoke failed:', e.message);
} finally {
  setTimeout(() => child.kill(), 200);
}

process.on('beforeExit', () => {
  if (failures) { console.error(`\n[mcp] smoke FAIL — ${failures} assertion(s) failed`); process.exitCode = 1; }
  else console.log('\n[mcp] smoke PASS');
});
