// cache.test.mjs — cacheDir() must be the engine's own envPaths('spyglassmc').cache,
// not a hand-rolled %LOCALAPPDATA% concat. When %LOCALAPPDATA% is unset the old hand-rolled
// path degraded to a RELATIVE path, silently breaking the macro / entity-NBT / vanilla-tags
// post-scan cache reads. envPaths gives an absolute path on every platform.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isAbsolute } from 'node:path';
import envPaths from 'env-paths';
import { cacheDir } from '../../dist/cache.js';

test('cacheDir() equals envPaths("spyglassmc").cache', () => {
  assert.equal(cacheDir(), envPaths('spyglassmc').cache);
});

test('cacheDir() is an absolute path under spyglassmc-nodejs', () => {
  const dir = cacheDir();
  assert.ok(isAbsolute(dir), `expected an absolute cache dir, got "${dir}"`);
  assert.ok(dir.includes('spyglassmc-nodejs'), `expected "spyglassmc-nodejs" in "${dir}"`);
});
