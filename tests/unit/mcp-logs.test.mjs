// mcp-logs.test.mjs — cursor log tail for MCP read_logs / wait_for_log (offline, temp dirs).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, appendFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { McpLogTail } from '../../dist/mcp-logs.js';

function makeLogDir(lines) {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-mcp-logs-'));
  const logsDir = join(dir, 'logs');
  mkdirSync(logsDir, { recursive: true });
  writeFileSync(join(logsDir, 'latest.log'), lines.join('\n') + '\n');
  return dir;
}

test('McpLogTail assigns monotonic ids and supports cursor reads', () => {
  const dir = makeLogDir(['line1', 'line2', 'line3']);
  const tail = new McpLogTail();
  try {
    tail.refresh({ launcher: 'default', minecraftRoot: dir });
    const q1 = tail.query({ sinceId: 0 });
    assert.equal(q1.entries.length, 3);
    assert.deepEqual(q1.entries.map(e => e.message), ['line1', 'line2', 'line3']);
    assert.equal(q1.nextId, 4);
    assert.equal(q1.missed, 0);

    appendFileSync(join(dir, 'logs', 'latest.log'), 'line4\n');
    tail.refresh({ launcher: 'default', minecraftRoot: dir });
    const q2 = tail.query({ sinceId: q1.nextId });
    assert.equal(q2.entries.length, 1);
    assert.equal(q2.entries[0].message, 'line4');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('McpLogTail reports missed when the caller cursor is older than the retained buffer', () => {
  const dir = makeLogDir(['a', 'b', 'c']);
  const tail = new McpLogTail(2); // tiny capacity forces eviction
  try {
    tail.refresh({ launcher: 'default', minecraftRoot: dir });
    const q = tail.query({ sinceId: 1 });
    assert.equal(q.missed, 1); // id 1 was evicted; oldest retained id is 2
    assert.deepEqual(q.entries.map(e => e.message), ['b', 'c']);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('McpLogTail waitFor matches an already-buffered line and returns context', async () => {
  const dir = makeLogDir(['start', 'error: boom', 'end']);
  const tail = new McpLogTail();
  try {
    tail.refresh({ launcher: 'default', minecraftRoot: dir });
    const res = await tail.waitFor({ launcher: 'default', minecraftRoot: dir }, 'error', 1000);
    assert.equal(res.matched, true);
    assert.equal(res.entry.message, 'error: boom');
    assert.ok(Array.isArray(res.context));
    assert.ok(res.context.some(e => e.message === 'start'));
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('McpLogTail waitFor times out with matched:false when no line matches', async () => {
  const dir = makeLogDir(['nothing', 'here']);
  const tail = new McpLogTail();
  try {
    const t0 = Date.now();
    const res = await tail.waitFor({ launcher: 'default', minecraftRoot: dir }, 'missing-pattern', 150);
    assert.equal(res.matched, false);
    assert.ok(Date.now() - t0 >= 100);
    assert.equal(typeof res.hint, 'string');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
