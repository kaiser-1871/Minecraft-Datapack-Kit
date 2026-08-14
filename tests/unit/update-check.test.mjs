// update-check.test.mjs — vendored-engine freshness check (pure parts only; the live GitHub
// fetch is exercised by the CLI command itself, not unit tests).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadEngineBuildInfo } from '../../dist/update-check.js';

test('BUILD.json in vendor/spyglass is readable and sane', () => {
  const info = loadEngineBuildInfo();
  assert.ok(info.builtAt, 'builtAt should be an ISO string');
  assert.ok(!Number.isNaN(Date.parse(info.builtAt)), 'builtAt should parse as a date');
  assert.ok(info.recorded, 'a main commit should be recorded at vendor time');
  assert.match(info.recorded.sha, /^[0-9a-f]{40}$/, 'recorded sha should be a full git sha');
  assert.equal(typeof info.sourceMatchesMainHead, 'boolean');
});
