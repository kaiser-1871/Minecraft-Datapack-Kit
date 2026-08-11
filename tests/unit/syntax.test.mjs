import { test } from 'node:test';
import assert from 'node:assert/strict';
import { cachedCommandVersions, loadCommandTree, renderPath, renderAll } from '../../dist/syntax.js';

test('26.2 command data is cached locally', () => {
  assert.ok(cachedCommandVersions().has('26.2'));
});

test('loadCommandTree returns a root with children', () => {
  const tree = loadCommandTree('26.2');
  assert.ok(tree.children);
  assert.ok(tree.children.execute);
});

test('renderPath finds "execute on" and lists the 8 values', () => {
  const tree = loadCommandTree('26.2');
  const r = renderPath(tree, ['execute', 'on']);
  assert.equal(r.found, true);
  assert.ok(r.lines.some(l => l.includes('attacker')));
  assert.ok(r.lines.some(l => l.includes('vehicle')));
});

test('renderPath on an unknown segment gives a helpful tip', () => {
  const tree = loadCommandTree('26.2');
  const r = renderPath(tree, ['execute', 'banana']);
  assert.equal(r.found, false);
  assert.ok(r.lines[0].includes('banana'));
});

test('renderAll counts top-level commands', () => {
  const tree = loadCommandTree('26.2');
  const { count } = renderAll(tree);
  assert.ok(count > 50);
});
