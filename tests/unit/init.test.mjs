import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initCommand } from '../../dist/init.js';

test('init scaffolds .dpkit.json in a target directory (--no-ci)', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-init-'));
  try {
    await initCommand([`--dir=${dir}`, '--no-ci']);
    const cfg = JSON.parse(readFileSync(join(dir, '.dpkit.json'), 'utf8'));
    assert.equal(cfg.version, 'auto');
    assert.equal(cfg.datapack, 'path/to/your/datapack');
    assert.equal(existsSync(join(dir, '.github', 'workflows', 'dpkit.yml')), false);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('init uses "." as datapack when the target contains pack.mcmeta', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-init-'));
  try {
    writeFileSync(join(dir, 'pack.mcmeta'), JSON.stringify({ pack: { pack_format: 107, description: 'x' } }));
    await initCommand([`--dir=${dir}`, '--no-ci']);
    const cfg = JSON.parse(readFileSync(join(dir, '.dpkit.json'), 'utf8'));
    assert.equal(cfg.datapack, '.');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('init refuses to overwrite without --force and succeeds with it', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-init-'));
  try {
    writeFileSync(join(dir, '.dpkit.json'), JSON.stringify({ version: 'old' }));
    await assert.rejects(() => initCommand([`--dir=${dir}`, '--no-ci']), /already exists/);
    await initCommand([`--dir=${dir}`, '--no-ci', '--force']);
    const cfg = JSON.parse(readFileSync(join(dir, '.dpkit.json'), 'utf8'));
    assert.equal(cfg.version, 'auto');
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('init writes a CI workflow by default', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-init-'));
  try {
    await initCommand([`--dir=${dir}`]);
    const wf = readFileSync(join(dir, '.github', 'workflows', 'dpkit.yml'), 'utf8');
    assert.match(wf, /dpkit-mc check/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
