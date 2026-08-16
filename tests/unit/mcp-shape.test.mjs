// mcp-shape.test.mjs — truncation + envelope helpers for the MCP layer (offline, pure functions).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { truncate, ok, jsonResult, errResult, DEFAULT_TRUNCATE_LIMIT } from '../../dist/mcp-shape.js';

test('truncate returns the whole array when under the limit', () => {
  const t = truncate([1, 2, 3], 5);
  assert.deepEqual(t.items, [1, 2, 3]);
  assert.equal(t.total, 3);
  assert.equal(t.truncated, false);
  assert.equal(t.hint, undefined);
});

test('truncate slices and reports the full total when over the limit', () => {
  const t = truncate(Array.from({ length: 250 }, (_, i) => i), 200, 'pass search=');
  assert.equal(t.items.length, 200);
  assert.equal(t.items[0], 0);
  assert.equal(t.items[199], 199);
  assert.equal(t.total, 250);
  assert.equal(t.truncated, true);
  assert.equal(t.hint, 'pass search=');
});

test('truncate defaults to DEFAULT_TRUNCATE_LIMIT=100 and tolerates null/undefined', () => {
  assert.equal(DEFAULT_TRUNCATE_LIMIT, 100);
  const t = truncate(Array.from({ length: 150 }, (_, i) => i));
  assert.equal(t.items.length, 100);
  assert.equal(t.total, 150);
  assert.equal(t.truncated, true);
  assert.equal(t.hint, undefined);

  const empty = truncate(undefined);
  assert.deepEqual(empty.items, []);
  assert.equal(empty.total, 0);
  assert.equal(empty.truncated, false);
});

test('hint is only attached when the array was actually truncated', () => {
  const small = truncate([1], 10, 'should not appear');
  assert.equal(small.hint, undefined);
  const big = truncate([1, 2, 3], 2, 'should appear');
  assert.equal(big.hint, 'should appear');
});

test('ok adds ok:true without removing any existing key', () => {
  const r = ok({ a: 1, b: 'x', nested: { c: true } });
  assert.deepEqual(r, { ok: true, a: 1, b: 'x', nested: { c: true } });
});

test('jsonResult wraps a value as a single text content block', () => {
  const r = jsonResult({ a: 1 });
  assert.equal(r.content.length, 1);
  assert.equal(r.content[0].type, 'text');
  assert.deepEqual(JSON.parse(r.content[0].text), { a: 1 });
  assert.equal(r.isError, undefined);
});

test('errResult keeps the legacy {error} JSON + isError:true and adds ok:false', () => {
  const r = errResult(new Error('boom'));
  assert.equal(r.isError, true);
  const parsed = JSON.parse(r.content[0].text);
  assert.equal(parsed.error, 'boom');
  assert.equal(parsed.ok, false);
});
