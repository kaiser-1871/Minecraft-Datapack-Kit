// completion-map.test.mjs — completionItemsOf DTO normalization (offline, pure function).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { completionItemsOf } from '../../dist/completion-map.js';

test('maps a bare array of completion items to DTOs', () => {
  const out = completionItemsOf([
    { label: 'execute', kind: 3, detail: 'command' },
    { label: 'effect', kind: 3 },
  ]);
  assert.deepEqual(out, [
    { label: 'execute', kind: 'Function', detail: 'command', documentation: null },
    { label: 'effect', kind: 'Function', detail: null, documentation: null },
  ]);
});

test('unwraps an { items } envelope', () => {
  const out = completionItemsOf({ items: [{ label: 'say' }] });
  assert.deepEqual(out, [
    { label: 'say', kind: null, detail: null, documentation: null },
  ]);
});

test('tolerates null/undefined/empty input without throwing', () => {
  assert.deepEqual(completionItemsOf(null), []);
  assert.deepEqual(completionItemsOf(undefined), []);
  assert.deepEqual(completionItemsOf({ items: undefined }), []);
});

test('maps kind codes via the LSP kind table and null for unknown/missing kinds', () => {
  const out = completionItemsOf([
    { label: 'a', kind: 1 },
    { label: 'b', kind: 999 },
    { label: 'c' },
  ]);
  assert.equal(out[0].kind, 'Text');
  assert.equal(out[1].kind, null);
  assert.equal(out[2].kind, null);
});

test('normalizes documentation: string passthrough, { value }, empty object, null', () => {
  const out = completionItemsOf([
    { label: 'a', documentation: 'doc' },
    { label: 'b', documentation: { value: 'obj-doc' } },
    { label: 'c', documentation: {} },
    { label: 'd', documentation: null },
  ]);
  assert.equal(out[0].documentation, 'doc');
  assert.equal(out[1].documentation, 'obj-doc');
  assert.equal(out[2].documentation, '');
  assert.equal(out[3].documentation, null);
});

test('missing label becomes empty string', () => {
  const out = completionItemsOf([{ kind: 3 }]);
  assert.equal(out[0].label, '');
  assert.equal(out[0].kind, 'Function');
});
