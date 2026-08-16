// rules.test.mjs — unit tests for project-consistency lint rules.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runRules } from '../../dist/rules.js';

function makePack(files) {
  const root = mkdtempSync(join(tmpdir(), 'dpkit-rules-'));
  mkdirSync(join(root, 'data'), { recursive: true });
  writeFileSync(join(root, 'pack.mcmeta'), JSON.stringify({ pack: { pack_format: 94, description: 'test' } }));
  for (const [rel, text] of Object.entries(files)) {
    const p = join(root, 'data', rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, text);
  }
  return root;
}

test('cleanup-id-coverage warns when cleanup_strays misses an ID seen by cleanup_drops', () => {
  const root = makePack({
    'battle/function/archer/cleanup_drops.mcfunction': 'give @p minecraft:spectral_arrow 1\n',
    'battle/function/archer/cleanup_strays.mcfunction': 'clear @p minecraft:arrow\n',
  });
  try {
    const r = runRules(root, { rules: ['cleanup-id-coverage'] });
    assert.equal(r.checked, 1);
    assert.equal(r.alerts, 1);
    assert.equal(r.items[0].rule, 'cleanup-id-coverage');
    assert.match(r.items[0].message, /spectral_arrow/);
    assert.deepEqual(r.items[0].evidence, ['battle/function/archer/cleanup_drops.mcfunction:1']);
    assert.equal(r.items[0].suggestion, null);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('rules are off by default', () => {
  const root = makePack({
    'battle/function/archer/cleanup_drops.mcfunction': 'give @p minecraft:spectral_arrow 1\n',
    'battle/function/archer/cleanup_strays.mcfunction': 'clear @p minecraft:arrow\n',
  });
  try {
    const r = runRules(root);
    assert.equal(r.checked, 0);
    assert.equal(r.alerts, 0);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test('on-eat-completeness warns when passive safety net is missing', () => {
  const root = makePack({
    'battle/function/on_eat_apple.mcfunction': 'give @s minecraft:apple\ngive @s battle:item\nscoreboard players set @s apple_eaten 1\nadvancement revoke @s only battle:eat_apple\n',
  });
  try {
    const r = runRules(root, { rules: ['on-eat-completeness'] });
    assert.equal(r.alerts, 1);
    assert.match(r.items[0].message, /passive/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
