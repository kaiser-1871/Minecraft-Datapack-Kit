// structure-nbt.test.mjs — binary NBT wire-format validation for structure files.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdirSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { gzipSync } from 'node:zlib';
import { scanStructureNbt } from '../../dist/structure-nbt.js';

// Minimal NBT encoders.
const i16 = n => { const b = Buffer.alloc(2); b.writeInt16BE(n); return b; };
const u16 = n => { const b = Buffer.alloc(2); b.writeUInt16BE(n); return b; };
const i32 = n => { const b = Buffer.alloc(4); b.writeInt32BE(n); return b; };
const named = (type, name, payload = Buffer.alloc(0)) => Buffer.concat([Buffer.from([type]), u16(Buffer.byteLength(name)), Buffer.from(name), payload]);
const intPayload = n => i32(n);
const list = (type, entries) => Buffer.concat([Buffer.from([type]), i32(entries.length), ...entries]);
const compoundPayload = entries => Buffer.concat([...entries, Buffer.from([0])]);
const compound = entries => Buffer.concat([Buffer.from([10]), u16(0), Buffer.alloc(0), compoundPayload(entries)]);

function structureNbt({ palette = true, trailing = false } = {}) {
  const size = list(3, [intPayload(1), intPayload(1), intPayload(1)]);
  const blocks = list(10, [compoundPayload([])]);
  const entities = list(10, []);
  const pal = palette ? list(10, [compoundPayload([])]) : null;
  const children = [named(3, 'DataVersion', i32(3953)), named(9, 'size', size), named(9, 'blocks', blocks), named(9, 'entities', entities)];
  if (pal) children.push(named(9, 'palette', pal));
  const payload = compound(children);
  return trailing ? Buffer.concat([payload, Buffer.from([0, 0])]) : payload;
}

function tempPack(file, bytes) {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-nbt-'));
  const p = join(dir, 'data', 'test', 'structure', file);
  mkdirSync(join(p, '..'), { recursive: true });
  writeFileSync(p, bytes);
  return { dir, p, cleanup: () => rmSync(dir, { recursive: true, force: true }) };
}

test('valid raw and gzipped structure NBT pass with no diagnostics', () => {
  for (const bytes of [structureNbt(), gzipSync(structureNbt())]) {
    const { p, cleanup } = tempPack('a.nbt', bytes);
    try {
      assert.deepEqual(scanStructureNbt(p, 'test/structure/a.nbt', '26.2'), []);
    } finally { cleanup(); }
  }
});

test('missing required top-level keys are reported as warnings', () => {
  const { p, cleanup } = tempPack('a.nbt', structureNbt({ palette: false }));
  try {
    const ds = scanStructureNbt(p, 'test/structure/a.nbt', '26.2');
    assert.equal(ds.length, 1);
    assert.equal(ds[0].severity, 2);
    assert.match(ds[0].message, /missing required top-level key "palette"/);
  } finally { cleanup(); }
});

test('truncated/corrupt NBT is an error; trailing bytes are a warning', () => {
  const truncated = tempPack('bad.nbt', structureNbt().subarray(0, 10));
  try {
    const ds = scanStructureNbt(truncated.p, 'test/structure/bad.nbt', '26.2');
    assert.equal(ds[0].severity, 1);
    assert.match(ds[0].message, /is not valid NBT/);
  } finally { truncated.cleanup(); }

  const trailing = tempPack('t.nbt', structureNbt({ trailing: true }));
  try {
    const ds = scanStructureNbt(trailing.p, 'test/structure/t.nbt', '26.2');
    assert.equal(ds.length, 1);
    assert.match(ds[0].message, /trailing byte/);
  } finally { trailing.cleanup(); }
});

test('files outside structure folders are skipped', () => {
  const dir = mkdtempSync(join(tmpdir(), 'dpkit-nbt-skip-'));
  writeFileSync(join(dir, 'other.nbt'), Buffer.from([1, 2, 3]));
  try {
    assert.deepEqual(scanStructureNbt(join(dir, 'other.nbt'), 'other.nbt', '26.2'), []);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});
