import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { addIssue, loadPluginModules, runAfterCheck } from '../../dist/plugins.js';

function fakeReport() {
  return {
    issues: [],
    summary: { errors: 0, warnings: 0 },
  };
}

test('addIssue appends and keeps summary counts in sync', () => {
  const report = fakeReport();
  addIssue(report, 'pack.mcmeta', 1, 0, 'E', 'boom');
  addIssue(report, 'data/a/f.mcfunction', 2, 3, 'W', 'careful');
  assert.equal(report.issues.length, 2);
  assert.equal(report.summary.errors, 1);
  assert.equal(report.summary.warnings, 1);
  assert.deepEqual(report.issues[0], { file: 'pack.mcmeta', line: 1, char: 0, severity: 'E', message: 'boom' });
});

test('runAfterCheck supports mutation and replacement', async () => {
  const mutator = {
    name: 'mutator',
    afterCheck({ report }) {
      addIssue(report, 'x', 1, 0, 'W', 'added');
    },
  };
  const replacer = {
    name: 'replacer',
    afterCheck() {
      return { issues: [{ file: 'y', line: 2, char: 0, severity: 'E', message: 'replaced' }], summary: { errors: 1, warnings: 0 } };
    },
  };
  const ctx = { datapack: 'p', workRoot: 'p', version: 'auto', resolvedVersion: null, files: [], rels: [], opts: {} };

  const mutated = await runAfterCheck([mutator], ctx, fakeReport());
  assert.equal(mutated.issues.length, 1);
  assert.equal(mutated.summary.warnings, 1);

  const replaced = await runAfterCheck([replacer], ctx, fakeReport());
  assert.equal(replaced.issues[0].message, 'replaced');
  assert.equal(replaced.summary.errors, 1);
});

test('loadPluginModules loads default-export plugin objects from disk', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-plugin-'));
  const file = join(dir, 'my-plugin.mjs');
  writeFileSync(file, `export default { name: 'disk-plugin', beforeCheck() {} };\n`);
  try {
    const [plugin] = await loadPluginModules([file], process.cwd());
    assert.equal(plugin.name, 'disk-plugin');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadPluginModules supports factory exports', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-plugin-'));
  const file = join(dir, 'factory.mjs');
  writeFileSync(file, `export default () => ({ name: 'factory-plugin' });\n`);
  try {
    const [plugin] = await loadPluginModules([file], process.cwd());
    assert.equal(plugin.name, 'factory-plugin');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('loadPluginModules rejects modules without a named plugin', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-plugin-'));
  const file = join(dir, 'bad.mjs');
  writeFileSync(file, `export default { notAName: true };\n`);
  try {
    await assert.rejects(() => loadPluginModules([file], process.cwd()), /string "name"/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
