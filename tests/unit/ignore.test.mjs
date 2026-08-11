import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parsePattern, createIgnoreFilter } from '../../dist/ignore.js';

test('parsePattern: substring vs /regex/', () => {
  assert.equal(typeof parsePattern('foo'), 'string');
  assert.ok(parsePattern('/foo/') instanceof RegExp);
  assert.equal(parsePattern('/unclosed'), '/unclosed'); // invalid regex degrades to substring
});

test('built-in LastHurtMob matches both quote forms', () => {
  const f = createIgnoreFilter({ useIgnore: true, extra: [] });
  assert.ok(f('Unknown key “LastHurtMob”'));
  assert.ok(f('Unknown key "LastHurtMob"'));
  assert.ok(!f('Unknown key “Foo”'));
});

test('--no-ignore disables the built-in', () => {
  const f = createIgnoreFilter({ useIgnore: false, extra: [] });
  assert.ok(!f('Unknown key “LastHurtMob”'));
});

test('extra substring and regex patterns', () => {
  const f = createIgnoreFilter({ useIgnore: false, extra: ['foo', '/bar\\d+/'] });
  assert.ok(f('a foo b'));
  assert.ok(f('bar123'));
  assert.ok(!f('barabc'));
});

test('comma-separated extra patterns', () => {
  const f = createIgnoreFilter({ useIgnore: false, extra: ['a,b'] });
  assert.ok(f('a'));
  assert.ok(f('b'));
});
