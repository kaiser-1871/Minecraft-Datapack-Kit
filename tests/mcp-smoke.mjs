// mcp-smoke.mjs — minimal MCP stdio client exercising every dpkit tool.
// Spawns dist/mcp.js, does the initialize handshake, lists tools, calls each one.
// MCP stdio transport is NEWLINE-delimited JSON (unlike LSP's Content-Length framing).
// Usage: npm run build && node tests/mcp-smoke.mjs [tool]
import { spawn } from 'node:child_process';

const MCP = process.env.DPKIT_MCP ?? 'dist/mcp.js';
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

async function call(name, args) {
  const t0 = Date.now();
  const res = await request('tools/call', { name, arguments: args ?? {} });
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  const text = res?.content?.[0]?.text ?? '';
  let parsed;
  try { parsed = JSON.parse(text); } catch { parsed = text; }
  const isErr = res?.isError ?? false;
  console.log(`\n--- ${name} (${dt}s${isErr ? ', ERROR' : ''}) ---`);
  if (isErr) {
    console.log(text.slice(0, 300));
  } else if (Array.isArray(parsed?.items)) {
    console.log(`${parsed.items.length} items (first 5):`, parsed.items.slice(0, 5).map(i => i.label ?? i).join(', '));
  } else if (parsed?.issues) {
    console.log(`issues=${parsed.issues.length} ignored=${parsed.ignored.length} summary=${JSON.stringify(parsed.summary)}`);
  } else if (parsed?.found !== undefined) {
    console.log(`found=${parsed.found} lines=${parsed.lines?.length ?? 0}`);
  } else if (parsed?.latestRelease) {
    console.log(`latest=${parsed.latestRelease.id} configured=${parsed.configured}`);
  } else if (parsed?.count !== undefined && Array.isArray(parsed?.gotchas)) {
    console.log(`gotcha groups=${parsed.count}`);
  } else {
    console.log(text.slice(0, 300));
  }
}

try {
  const init = await request('initialize', {
    protocolVersion: '2025-03-26',
    capabilities: {},
    clientInfo: { name: 'dpkit-smoke', version: '1.0.0' },
  });
  console.log('[mcp] server:', init?.serverInfo?.name, init?.serverInfo?.version);
  send({ jsonrpc: '2.0', method: 'notifications/initialized', params: {} });
  const tools = await request('tools/list', {});
  const names = (tools?.tools ?? []).map(t => t.name);
  console.log('[mcp] tools:', names.join(', '));

  const which = process.argv[2];
  const targets = which
    ? [which]
    : ['query_syntax', 'list_versions', 'scan_gotchas', 'complete_at', 'check_datapack'];

  for (const name of targets) {
    if (!names.includes(name)) { console.log(`[mcp] unknown tool ${name}`); process.exitCode = 1; continue; }
    const args = {
      query_syntax: { path: 'execute on', version: '26.2' },
      list_versions: { configured: '26.2' },
      scan_gotchas: { files: 'battle/function/snowman/*.mcfunction' },
      complete_at: { file: 'battle/function/snowman/break_out_start.mcfunction', line: 7, column: 26 },
      check_datapack: {},
    }[name];
    await call(name, args);
  }
} catch (e) {
  console.error('[mcp] smoke failed:', e.message);
  process.exitCode = 1;
} finally {
  setTimeout(() => child.kill(), 200);
}
