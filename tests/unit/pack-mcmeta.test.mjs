// pack-mcmeta.test.mjs — deep pack.mcmeta validation (format fields, overlays, version match).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { resolveVersionForFormatRange, scanPackMcmeta } from '../../dist/pack-mcmeta.js';

const VALID = '{"pack":{"pack_format":107,"description":"x"}}';

test('valid pack.mcmeta passes and reports max/min format', () => {
  const r = scanPackMcmeta(VALID, undefined, { version: '26.2', dataPackVersion: 107 });
  assert.deepEqual(r.diagnostics, []);
  assert.equal(r.maxFormat, 107);
  assert.equal(r.minFormat, 107);
});

test('missing pack_format, wrong pack_format type, missing description, and null pack are errors', () => {
  const cases = [
    ['{"pack":{"description":"x"}}', /no usable pack format/],
    ['{"pack":{"pack_format":"abc","description":"x"}}', /pack\.pack_format must be an integer/],
    ['{"pack":{"pack_format":107}}', /pack\.description is missing/],
    ['{"pack":null}', /missing a valid "pack" object/],
  ];
  for (const [text, re] of cases) {
    const r = scanPackMcmeta(text);
    assert.ok(r.diagnostics.some(d => re.test(d.message)), `${text} → ${re}`);
  }
});

test('pack format newer than the target version is an error; older is a warning', () => {
  const newer = scanPackMcmeta('{"pack":{"pack_format":999999,"description":"x"}}', undefined, { version: '26.2', dataPackVersion: 107 });
  assert.equal(newer.diagnostics[0].severity, 1);
  assert.match(newer.diagnostics[0].message, /newer than 26\.2/);

  const older = scanPackMcmeta('{"pack":{"pack_format":26,"description":"x"}}', undefined, { version: '26.2', dataPackVersion: 107 });
  assert.equal(older.diagnostics[0].severity, 2);
  assert.match(older.diagnostics[0].message, /predates 26\.2/);
});

test('supported_formats and max_format are parsed like the engine does', () => {
  const supported = scanPackMcmeta('{"pack":{"supported_formats":[26,107],"description":"x"}}');
  assert.deepEqual(supported.diagnostics, []);
  assert.equal(supported.minFormat, 26);
  assert.equal(supported.maxFormat, 107);

  const object = scanPackMcmeta('{"pack":{"supported_formats":{"min_inclusive":26,"max_inclusive":107},"description":"x"}}');
  assert.deepEqual(object.diagnostics, []);
  assert.equal(object.maxFormat, 107);

  const maxArray = scanPackMcmeta('{"pack":{"max_format":[107,0],"description":"x"}}');
  assert.deepEqual(maxArray.diagnostics, []);
  assert.equal(maxArray.maxFormat, 107);
});

test('overlays: valid top-level entries are returned; invalid shapes and missing dirs are diagnosed', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-mcmeta-'));
  mkdirSync(join(dir, 'ov', 'data'), { recursive: true });
  try {
    const good = scanPackMcmeta('{"pack":{"pack_format":107,"description":"x"},"overlays":{"entries":[{"directory":"ov","formats":[26,107]}]}}', dir);
    assert.deepEqual(good.diagnostics, []);
    assert.deepEqual(good.overlays, [{ directory: 'ov', minFormat: 26, maxFormat: 107 }]);

    const missing = scanPackMcmeta('{"pack":{"pack_format":107,"description":"x"},"overlays":{"entries":[{"directory":"nope","formats":[26,107]}]}}', dir);
    assert.equal(missing.diagnostics.length, 1);
    assert.equal(missing.diagnostics[0].severity, 2);
    assert.match(missing.diagnostics[0].message, /overlay directory "nope" does not exist/);

    const badDir = scanPackMcmeta('{"pack":{"pack_format":107,"description":"x"},"overlays":{"entries":[{"directory":"..","formats":[26,107]}]}}');
    assert.ok(badDir.diagnostics.some(d => /directory must be a relative directory name/.test(d.message)));
    const singleInt = scanPackMcmeta('{"pack":{"pack_format":107,"description":"x"},"overlays":{"entries":[{"directory":"ov","formats":1}]}}');
    assert.deepEqual(singleInt.diagnostics, []);
    assert.deepEqual(singleInt.overlays, [{ directory: 'ov', minFormat: 1, maxFormat: 1 }]);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('overlays nested under pack is a common mistake and is diagnosed', () => {
  const r = scanPackMcmeta('{"pack":{"pack_format":107,"description":"x","overlays":{"entries":[]}}}');
  assert.equal(r.diagnostics.length, 1);
  assert.match(r.diagnostics[0].message, /overlays must be a top-level key/);
});

test('auto version resolution prefers pack_format when it is inside the declared range', () => {
  const r = scanPackMcmeta('{"pack":{"pack_format":94,"min_format":88,"max_format":9999999,"description":"x"}}');
  assert.equal(resolveVersionForFormatRange(r.minFormat, r.maxFormat, r.packFormat), '1.21.11');
  // without the pack_format preference, a broad range still resolves to the newest in-range release
  assert.equal(resolveVersionForFormatRange(r.minFormat, r.maxFormat), '26.2');
});

test('max_format:9999999 is the unbounded sentinel, and ranges are judged by containment', () => {
  const inside = scanPackMcmeta('{"pack":{"pack_format":88,"min_format":88,"max_format":9999999,"description":"x"}}', undefined, { version: '1.21.11', dataPackVersion: 94 });
  assert.deepEqual(inside.diagnostics, []);
  assert.match(inside.formatHint ?? '', /pack supports dpv 88\.\.unbounded; target 1\.21\.11 \(dpv 94\) is inside range/);
  assert.equal(inside.maxFormat, 9999999);
  assert.equal(inside.minFormat, 88);

  const outside = scanPackMcmeta('{"pack":{"supported_formats":[88,94],"description":"x"}}', undefined, { version: '26.2', dataPackVersion: 107 });
  assert.ok(outside.diagnostics.some(d => d.severity === 1 && /does not contain 26\.2/.test(d.message)));

  const tooNew = scanPackMcmeta('{"pack":{"supported_formats":[120,130],"description":"x"}}', undefined, { version: '26.2', dataPackVersion: 107 });
  assert.ok(tooNew.diagnostics.some(d => /minimum supported format 120 is newer/.test(d.message)));
});

test('supported_formats accepts a single integer shorthand', () => {
  const r = scanPackMcmeta('{"pack":{"supported_formats":57,"description":"x"}}');
  assert.deepEqual(r.diagnostics, []);
  assert.equal(r.minFormat, 57);
  assert.equal(r.maxFormat, 57);
});
