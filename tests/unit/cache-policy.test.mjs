import { test } from 'node:test';
import assert from 'node:assert/strict';
import { nearestCachedVersion, planConcreteVersion } from '../../dist/cache-policy.js';

test('nearestCachedVersion picks the requested release when it is cached', () => {
  const v = nearestCachedVersion('1.21.11');
  assert.ok(v);
  assert.equal(v.id, '1.21.11');
  assert.equal(v.dpv, 94);
});

test('planConcreteVersion serves cached versions from local cache', async () => {
  const plan = await planConcreteVersion('1.21.11', 'download');
  assert.equal(plan.engineVersion, '1.21.11');
  assert.equal(plan.actualVersion, '1.21.11');
  assert.equal(plan.cacheSource, 'local cache');
  assert.equal(plan.fallback, false);
});

test('planConcreteVersion fail policy rejects missing versions quickly', async () => {
  await assert.rejects(
    () => planConcreteVersion('9.99', 'fail'),
    /not cached locally and --cache-miss=fail/,
  );
});

test('pre-1.14 versions are rejected with the support-boundary error', async () => {
  for (const version of ['1.13', '1.13.2', '1.12.2']) {
    await assert.rejects(
      () => planConcreteVersion(version, 'fail'),
      /no version data before 1\.14/,
      version,
    );
  }
});
