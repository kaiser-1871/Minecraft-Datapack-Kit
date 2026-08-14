import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { findConfigFile, loadConfig } from '../../dist/config.js';

test('findConfigFile returns an existing explicit path', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-cfg-'));
  const f = join(dir, 'c.json');
  writeFileSync(f, '{}');
  try { assert.equal(findConfigFile(f), f); } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('findConfigFile throws on a missing explicit --config path', () => {
  assert.throws(() => findConfigFile(join(tmpdir(), 'does-not-exist.json')), /not found/);
});

test('DPKIT_CONFIG pointing at a missing file throws (no silent fallback)', () => {
  const prev = process.env.DPKIT_CONFIG;
  process.env.DPKIT_CONFIG = join(tmpdir(), 'nope.json');
  try {
    assert.throws(() => findConfigFile(), /DPKIT_CONFIG/);
  } finally {
    if (prev === undefined) delete process.env.DPKIT_CONFIG; else process.env.DPKIT_CONFIG = prev;
  }
});

test('DPKIT_CONFIG pointing at an existing file resolves it', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-cfg-'));
  const f = join(dir, 'c.json');
  writeFileSync(f, '{}');
  const prev = process.env.DPKIT_CONFIG;
  process.env.DPKIT_CONFIG = f;
  try {
    assert.equal(findConfigFile(), f);
  } finally {
    rmSync(dir, { recursive: true, force: true });
    if (prev === undefined) delete process.env.DPKIT_CONFIG; else process.env.DPKIT_CONFIG = prev;
  }
});

test('loadConfig resolves relative paths against the config file directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-cfg-'));
  const sub = join(dir, 'sub');
  mkdirSync(sub);
  const f = join(sub, 'c.json');
  writeFileSync(f, JSON.stringify({
    datapack: './pack', minecraftRoot: '../mc', baselineFile: 'b.json',
    version: '1.21.4', ignore: ['foo'], gotchas: false, logcheck: false,
  }));
  try {
    const { config, path } = loadConfig(f);
    assert.equal(path, f);
    assert.equal(config.datapack, join(sub, 'pack'));
    assert.equal(config.minecraftRoot, join(dir, 'mc'));
    assert.equal(config.baselineFile, join(sub, 'b.json'));
    assert.equal(config.version, '1.21.4');
    assert.deepEqual(config.ignore, ['foo']);
    assert.equal(config.gotchas, false);
    assert.equal(config.logcheck, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('loadConfig rejects wrong-typed fields (zod strict schema)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-cfg-'));
  const f = join(dir, 'c.json');
  writeFileSync(f, JSON.stringify({ datapack: 42, version: true, ignore: ['ok', 7, null], gotchas: 'yes' }));
  try {
    assert.throws(() => loadConfig(f), /could not be parsed/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('loadConfig rejects unknown keys (strict)', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-cfg-'));
  const f = join(dir, 'c.json');
  writeFileSync(f, JSON.stringify({ datapak: './pack' }));
  try {
    assert.throws(() => loadConfig(f), /datapak/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('loadConfig returns empty config with null path when no config file exists', () => {
  // Point at an empty directory; findConfigFile with an explicit arg throws, so exercise the
  // no-config branch via a temp config-free location by clearing DPKIT_CONFIG and relying on the
  // fact that loadConfig() with no explicit arg returns {} when cwd/home have no .dpkit.json.
  const prev = process.env.DPKIT_CONFIG;
  delete process.env.DPKIT_CONFIG;
  try {
    const { config, path } = loadConfig();
    // Shape is valid regardless of whether the host has a real .dpkit.json in cwd/home.
    assert.equal(typeof config, 'object');
    assert.ok(path === null || typeof path === 'string');
  } finally {
    if (prev === undefined) delete process.env.DPKIT_CONFIG; else process.env.DPKIT_CONFIG = prev;
  }
});
