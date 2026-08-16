// datapack-discovery.test.mjs — default datapack auto-detection across launchers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, utimesSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { detectDefaultDatapack } from '../../dist/datapack-discovery.js';

test('detectDefaultDatapack scans official + Prism/MultiMC instance roots and prefers the matching version', () => {
  const appdata = mkdtempSync(join(tmpdir(), 'dpkit-discover-'));
  const old = process.env.APPDATA;
  process.env.APPDATA = appdata;
  try {
    const mk = (root, version, save, name, isZip = false) => {
      const p = join(root, 'versions', version, 'saves', save, 'datapacks', name);
      if (isZip) {
        mkdirSync(join(p, '..'), { recursive: true });
        writeFileSync(p, 'zip');
      } else {
        mkdirSync(p, { recursive: true });
        writeFileSync(join(p, 'pack.mcmeta'), '{"pack":{"pack_format":107,"description":"x"}}');
      }
      return p;
    };
    const official = mk(join(appdata, '.minecraft'), '26.2', 'world', 'official-pack');
    const prism = mk(join(appdata, 'PrismLauncher', 'instances', 'my-instance', 'minecraft'), '1.20.4', 'world', 'prism-pack');
    const future = new Date(Date.now() + 60_000);
    utimesSync(official, future, future);

    assert.equal(detectDefaultDatapack('1.20.4'), prism);
    assert.equal(detectDefaultDatapack('26.2'), official);

    const zip = mk(join(appdata, '.minecraft'), '26.2', 'world2', 'zipped-pack.zip', true);
    const zipFuture = new Date(Date.now() + 120_000);
    utimesSync(zip, zipFuture, zipFuture);
    assert.equal(detectDefaultDatapack('26.2'), zip);
  } finally {
    if (old === undefined) delete process.env.APPDATA;
    else process.env.APPDATA = old;
    rmSync(appdata, { recursive: true, force: true });
  }
});
