// structure-nbt.ts — minimal binary-NBT validator for data/<ns>/structure(s)/*.nbt files.
// The Spyglass engine registers the folder (so cross-references work) but has no binary NBT
// parser, so a corrupted structure file would otherwise be silently counted as "clean". This
// module validates the container (raw / gzip / zlib), the NBT wire format, and the top-level
// keys Minecraft expects in a structure file. It never allocates array payloads — arrays are
// bounds-checked element by element.
import { readFileSync } from 'node:fs';
import { gunzipSync, inflateSync } from 'node:zlib';
import { isRecognizedDataFile, parseDataRel } from './datapack-structure.js';
import type { RawDiagnostic } from './types.js';

const MAX_DEPTH = 128;

class NbtReader {
  private offset = 0;
  constructor(private buf: Buffer) {}

  get remaining(): number { return this.buf.length - this.offset; }
  get position(): number { return this.offset; }

  fail(msg: string): Error {
    return new Error(`${msg} (at byte ${this.offset})`);
  }

  u8(): number {
    if (this.remaining < 1) throw this.fail('unexpected end of NBT');
    return this.buf[this.offset++];
  }

  i16(): number {
    if (this.remaining < 2) throw this.fail('unexpected end of NBT');
    const v = this.buf.readInt16BE(this.offset);
    this.offset += 2;
    return v;
  }

  u16(): number {
    if (this.remaining < 2) throw this.fail('unexpected end of NBT');
    const v = this.buf.readUInt16BE(this.offset);
    this.offset += 2;
    return v;
  }

  i32(): number {
    if (this.remaining < 4) throw this.fail('unexpected end of NBT');
    const v = this.buf.readInt32BE(this.offset);
    this.offset += 4;
    return v;
  }

  i64(): bigint {
    if (this.remaining < 8) throw this.fail('unexpected end of NBT');
    const v = this.buf.readBigInt64BE(this.offset);
    this.offset += 8;
    return v;
  }

  f32(): number {
    if (this.remaining < 4) throw this.fail('unexpected end of NBT');
    const v = this.buf.readFloatBE(this.offset);
    this.offset += 4;
    return v;
  }

  f64(): number {
    if (this.remaining < 8) throw this.fail('unexpected end of NBT');
    const v = this.buf.readDoubleBE(this.offset);
    this.offset += 8;
    return v;
  }

  bytes(n: number): void {
    if (n < 0 || this.remaining < n) throw this.fail('unexpected end of NBT');
    this.offset += n;
  }

  name(): string {
    const len = this.u16();
    const bytes = this.buf.subarray(this.offset, this.offset + len);
    if (bytes.length < len) throw this.fail('unexpected end of NBT');
    this.offset += len;
    return bytes.toString('utf8');
  }

  /** Number of elements in a list/array, with a sanity check against remaining bytes. */
  length(maxBytesPerElement: number, what: string): number {
    const n = this.i32();
    if (n < 0) throw this.fail(`negative ${what} length`);
    if (maxBytesPerElement > 0 && n * maxBytesPerElement > this.remaining) throw this.fail(`${what} length ${n} exceeds remaining data`);
    return n;
  }
}

/** Validate one NBT payload. Returns { type, listElem, listLen } for root-key bookkeeping. */
function parsePayload(r: NbtReader, type: number, depth: number): { listElem: number | null; listLen: number | null } {
  if (depth > MAX_DEPTH) throw r.fail(`NBT nesting exceeds ${MAX_DEPTH} levels`);
  switch (type) {
    case 1: r.u8(); return { listElem: null, listLen: null };
    case 2: r.i16(); return { listElem: null, listLen: null };
    case 3: r.i32(); return { listElem: null, listLen: null };
    case 4: r.i64(); return { listElem: null, listLen: null };
    case 5: r.f32(); return { listElem: null, listLen: null };
    case 6: r.f64(); return { listElem: null, listLen: null };
    case 7: {
      const n = r.length(1, 'byte array');
      r.bytes(n);
      return { listElem: null, listLen: n };
    }
    case 8: {
      const n = r.u16();
      r.bytes(n);
      return { listElem: null, listLen: null };
    }
    case 9: {
      const elem = r.u8();
      const n = r.length(0, 'list');
      if (elem === 0) {
        if (n !== 0) throw r.fail('TAG_End cannot be a list element type for a non-empty list');
      } else if (elem < 1 || elem > 12) {
        throw r.fail(`invalid list element type ${elem}`);
      } else {
        for (let i = 0; i < n; i++) parsePayload(r, elem, depth + 1);
      }
      return { listElem: elem, listLen: n };
    }
    case 10: {
      let count = 0;
      while (true) {
        const childType = r.u8();
        if (childType === 0) return { listElem: null, listLen: null };
        if (childType < 1 || childType > 12) throw r.fail(`invalid compound child type ${childType}`);
        r.name();
        parsePayload(r, childType, depth + 1);
        count++;
        if (count > 1_000_000) throw r.fail('compound has too many children');
      }
    }
    case 11: {
      const n = r.length(4, 'int array');
      r.bytes(n * 4);
      return { listElem: null, listLen: n };
    }
    case 12: {
      const n = r.length(8, 'long array');
      r.bytes(n * 8);
      return { listElem: null, listLen: n };
    }
    default:
      throw r.fail(`invalid NBT tag type ${type}`);
  }
}

/** Type name for diagnostics. */
function tagName(type: number): string {
  return ['TAG_End', 'TAG_Byte', 'TAG_Short', 'TAG_Int', 'TAG_Long', 'TAG_Float', 'TAG_Double', 'TAG_Byte_Array', 'TAG_String', 'TAG_List', 'TAG_Compound', 'TAG_Int_Array', 'TAG_Long_Array'][type] ?? `TAG_${type}`;
}

interface RootInfo { keys: Map<string, { type: number; listLen: number | null; listElem: number | null }>; trailing: number }

function parseStructureBytes(raw: Buffer): RootInfo {
  let buf: Buffer;
  if (raw.length >= 2 && raw[0] === 0x1f && raw[1] === 0x8b) {
    buf = gunzipSync(raw);
  } else if (raw.length >= 2 && raw[0] === 0x78) {
    buf = inflateSync(raw);
  } else {
    buf = raw;
  }
  const r = new NbtReader(buf);
  const rootType = r.u8();
  if (rootType !== 10) throw r.fail(`structure root must be a TAG_Compound (got ${tagName(rootType)})`);
  r.name();
  const keys = new Map<string, { type: number; listLen: number | null; listElem: number | null }>();

  // Root compound: parse one level manually so top-level keys can be recorded.
  while (true) {
    const childType = r.u8();
    if (childType === 0) break;
    if (childType < 1 || childType > 12) throw r.fail(`invalid compound child type ${childType}`);
    const childName = r.name();
    const info = parsePayload(r, childType, 1);
    keys.set(childName, { type: childType, listLen: info.listLen, listElem: info.listElem });
  }
  return { keys, trailing: r.remaining };
}

function expectKey(root: RootInfo, key: string, expectedType: number, listElementType: number | null, diags: RawDiagnostic[], version: string): void {
  const info = root.keys.get(key);
  if (!info) {
    diags.push({
      severity: 2,
      message: `[structure-nbt] structure file is missing required top-level key "${key}" (${version})`,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    });
    return;
  }
  if (info.type !== expectedType) {
    diags.push({
      severity: 2,
      message: `[structure-nbt] structure key "${key}" must be ${tagName(expectedType)} (got ${tagName(info.type)})`,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    });
  } else if (listElementType !== null && info.listLen !== null && info.listLen > 0 && info.listElem !== listElementType) {
    diags.push({
      severity: 2,
      message: `[structure-nbt] structure key "${key}" list elements must be ${tagName(listElementType)} (got ${tagName(info.listElem ?? 0)})`,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    });
  }
}

/**
 * Validate a data/<ns>/structure(s)/*.nbt file. Returns [] for files outside those folders or
 * for non-NBT files; a recognized structure file gets wire-format + required-key diagnostics.
 */
export function scanStructureNbt(filePath: string, rel: string, version: string): RawDiagnostic[] {
  if (!rel.endsWith('.nbt') || !isRecognizedDataFile(rel)) return [];
  const { dataRel } = parseDataRel(rel);
  const parts = dataRel.split('/');
  const folder = parts[1] ?? '';
  if (folder !== 'structure' && folder !== 'structures') return [];

  let raw: Buffer;
  try {
    raw = readFileSync(filePath);
  } catch (err) {
    return [{
      severity: 2,
      message: `[structure-nbt] could not read structure file: ${(err as Error).message}`,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    }];
  }
  const diags: RawDiagnostic[] = [];
  try {
    const root = parseStructureBytes(raw);
    expectKey(root, 'DataVersion', 3, null, diags, version);
    expectKey(root, 'size', 9, 3, diags, version);
    expectKey(root, 'blocks', 9, 10, diags, version);
    expectKey(root, 'entities', 9, 10, diags, version);
    expectKey(root, 'palette', 9, 10, diags, version);
    if (root.trailing > 0) {
      diags.push({
        severity: 2,
        message: `[structure-nbt] structure file has ${root.trailing} trailing byte(s) after the root tag`,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      });
    }
  } catch (err) {
    diags.push({
      severity: 1,
      message: `[structure-nbt] structure file is not valid NBT: ${(err as Error).message}`,
      range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
    });
  }
  return diags;
}
