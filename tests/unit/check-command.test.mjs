// check-command.test.mjs — API-level smoke for full command validation.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { checkCommand } from '../../dist/api.js';

test('checkCommand validates a known command as full/full', async () => {
  const r = await checkCommand({ command: 'say hello', version: '26.2' });
  assert.equal(r.valid, true);
  assert.equal(r.verification, 'full');
  assert.equal(r.version_profile, 'full');
  assert.deepEqual(r.errors, []);
  assert.ok(Array.isArray(r.suggestions));
});

test('checkCommand returns errors for an invalid command', async () => {
  const r = await checkCommand({ command: 'definitely_not_a_command foo', version: '26.2' });
  assert.equal(r.valid, false);
  assert.ok(r.errors.length > 0);
});
