// datapack-coverage.test.mjs — P0/P1/P2 datapack-file coverage regressions that used to be
// silent: pack.mcmeta deep validation, overlays, empty packs, unrecognized files, wrong-folder
// promotion, structure NBT, invalid ids, and .zip datapacks.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { TextReader, Uint8ArrayWriter, ZipWriter } from '@zip.js/zip.js';
import { checkDatapack } from '../../dist/api.js';

function pack(files, mcmeta = '{"pack":{"pack_format":107,"description":"x"}}') {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-cov-'));
  writeFileSync(join(dir, 'pack.mcmeta'), mcmeta);
  for (const [rel, text] of Object.entries(files)) {
    const p = join(dir, 'data', rel);
    mkdirSync(join(p, '..'), { recursive: true });
    writeFileSync(p, text);
  }
  return { dir, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

const base = (dir, extra = {}) => checkDatapack({
  datapack: dir, version: '26.2', engine: 'inproc', noLog: true, noGotchas: true,
  ignore: { useIgnore: true, extra: [] }, ...extra,
});

test('wrong-version folders are Warnings (so --strict can catch them), not silent hints', async () => {
  const f = pack({
    'test/functions/a.mcfunction': 'say hi\n',
    'test/recipes/a.json': '{"type":"minecraft:crafting_shapeless","ingredients":[],"result":{"id":"minecraft:stone","count":1}}',
  });
  try {
    const { report } = await base(f.dir);
    assert.equal(report.summary.internalFailures, 0);
    assert.ok(report.summary.warnings >= 2);
    for (const i of report.issues.filter(i => i.file.includes('a.'))) {
      assert.equal(i.severity, 'W');
      assert.match(i.message, /folder are not recognized in loaded version/);
    }
  } finally { f.cleanup(); }
});

test('pack.mcmeta missing format / wrong type / too-new format / old format are diagnosed', async () => {
  const cases = [
    ['{"pack":{"description":"x"}}', 1, /no usable pack format/],
    ['{"pack":{"pack_format":"abc","description":"x"}}', 1, /pack\.pack_format must be an integer/],
    ['{"pack":{"pack_format":999999,"description":"x"}}', 1, /newer than 26\.2/],
    ['{"pack":{"pack_format":26,"description":"x"}}', 2, /predates 26\.2/],
  ];
  for (const [mcmeta, sev, re] of cases) {
    const f = pack({ 'test/function/a.mcfunction': 'say hi\n' }, mcmeta);
    try {
      const { report } = await base(f.dir);
      const d = report.issues.find(i => i.file === 'pack.mcmeta' && re.test(i.message));
      assert.ok(d, `${mcmeta} → ${re}`);
      assert.equal(d.severity, sev === 1 ? 'E' : 'W');
    } finally { f.cleanup(); }
  }
});

test('a data-less pack (only pack.mcmeta) checks successfully', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-empty-'));
  writeFileSync(join(dir, 'pack.mcmeta'), '{"pack":{"pack_format":107,"description":"x"}}');
  try {
    const { report } = await base(dir);
    assert.equal(report.files.checked, 1);
    assert.equal(report.summary.errors, 0);
    assert.equal(report.summary.internalFailures, 0);
    assert.equal(report.resolvedVersion, '26.2');
    assert.equal(report.coverage.engineUsed, false);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('overlay data files are collected and checked under @overlay:<dir>/ rels', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-overlay-'));
  mkdirSync(join(dir, 'data', 'base', 'function'), { recursive: true });
  mkdirSync(join(dir, 'ov', 'data', 'base', 'function'), { recursive: true });
  writeFileSync(join(dir, 'pack.mcmeta'), '{"pack":{"pack_format":107,"description":"x"},"overlays":{"entries":[{"directory":"ov","formats":[26,107]}]}}');
  writeFileSync(join(dir, 'data', 'base', 'function', 'a.mcfunction'), 'say base\n');
  writeFileSync(join(dir, 'ov', 'data', 'base', 'function', 'a.mcfunction'), 'function base:missing_overlay_fn\n');
  try {
    const { report } = await base(dir);
    assert.equal(report.files.checked, 3); // root fn + overlay fn + pack.mcmeta
    const issue = report.scopeHints.find(i => i.file.startsWith('@overlay:ov/'));
    assert.ok(issue, JSON.stringify(report.issues));
    assert.match(issue.message, /missing_overlay_fn/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('inactive overlays (formats outside the target version) are skipped, not checked', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-overlay-inactive-'));
  mkdirSync(join(dir, 'data', 'base', 'function'), { recursive: true });
  mkdirSync(join(dir, 'ov', 'data', 'base', 'function'), { recursive: true });
  writeFileSync(join(dir, 'pack.mcmeta'), '{"pack":{"pack_format":107,"description":"x"},"overlays":{"entries":[{"directory":"ov","formats":[500,600]}]}}');
  writeFileSync(join(dir, 'data', 'base', 'function', 'a.mcfunction'), 'say base\n');
  writeFileSync(join(dir, 'ov', 'data', 'base', 'function', 'a.mcfunction'), 'function base:missing_overlay_fn\n');
  try {
    const { report } = await base(dir);
    assert.equal(report.files.checked, 2); // root fn + pack.mcmeta; the overlay fn is skipped
    assert.equal(report.coverage.overlayFilesSkipped, 1);
    assert.equal(report.scopeHints.length, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('unrecognized JSON is a dpkit warning, not an internal engine failure', async () => {
  const f = pack({ 'test/unknown_dir/a.json': '{"hello":1}' });
  try {
    const { report } = await base(f.dir);
    assert.equal(report.summary.internalFailures, 0);
    assert.equal(report.summary.warnings, 1);
    assert.match(report.issues[0].message, /unrecognized data file path/);
  } finally { f.cleanup(); }
});

test('corrupted structure NBT files are collected and reported', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-struct-'));
  mkdirSync(join(dir, 'data', 'test', 'structure'), { recursive: true });
  writeFileSync(join(dir, 'pack.mcmeta'), '{"pack":{"pack_format":107,"description":"x"}}');
  writeFileSync(join(dir, 'data', 'test', 'structure', 'bad.nbt'), Buffer.from([0x0a, 0, 1, 2, 3]));
  try {
    const { report } = await base(dir);
    assert.equal(report.files.checked, 2); // .nbt + pack.mcmeta
    assert.ok(report.issues.some(i => i.message.startsWith('[structure-nbt]')));
    assert.equal(report.summary.internalFailures, 0);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('illegal namespace/path ids are reported even when never referenced', async () => {
  const f = pack({ 'Bad-Name!/function/a.mcfunction': 'say hi\n' });
  try {
    const { report } = await base(f.dir);
    assert.ok(report.issues.some(i => i.message.includes('illegal resource-location segment')));
  } finally { f.cleanup(); }
});

test('a .zip with exact or case-only duplicate entries fails cleanly', async () => {
  const zipPath = join(tmpdir(), `dpkit-dup-${Date.now()}.zip`);
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await writer.add('pack.mcmeta', new TextReader('{"pack":{"pack_format":107,"description":"x"}}'));
  await writer.add('data/z/function/a.mcfunction', new TextReader('say one'));
  await writer.add('data/z/function/A.mcfunction', new TextReader('say two'));
  const zipBytes = await writer.close();
  writeFileSync(zipPath, zipBytes);
  try {
    await assert.rejects(() => base(zipPath), /colliding entries/);
  } finally {
    rmSync(zipPath, { force: true });
  }
});

test('a .zip datapack is extracted and checked, keeping the original path in the report', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-zipsrc-'));
  mkdirSync(join(dir, 'data', 'z', 'function'), { recursive: true });
  writeFileSync(join(dir, 'pack.mcmeta'), '{"pack":{"pack_format":107,"description":"x"}}');
  writeFileSync(join(dir, 'data', 'z', 'function', 'a.mcfunction'), 'function z:missing_zip_fn\n');
  const zipPath = `${dir}.zip`;
  const writer = new ZipWriter(new Uint8ArrayWriter());
  await writer.add('pack.mcmeta', new TextReader('{"pack":{"pack_format":107,"description":"x"}}'));
  await writer.add('data/z/function/a.mcfunction', new TextReader('function z:missing_zip_fn\n'));
  const zipBytes = await writer.close();
  writeFileSync(zipPath, zipBytes);
  try {
    const { report } = await base(zipPath);
    assert.equal(report.datapack, zipPath);
    assert.equal(report.summary.errors, 0);
    assert.equal(report.summary.warnings, 0);
    assert.ok(report.scopeHints.some(i => i.message.includes('missing_zip_fn')));
  } finally {
    rmSync(dir, { recursive: true, force: true });
    rmSync(zipPath, { force: true });
  }
});
