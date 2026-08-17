import test from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { BASELINE_FILE } from '../../dist/paths.js';

test('default --delta baseline path lives in the current working directory', () => {
  assert.equal(BASELINE_FILE, join(process.cwd(), '.dpkit-baseline.json'));
});
