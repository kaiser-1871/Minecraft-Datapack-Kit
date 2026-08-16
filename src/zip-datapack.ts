// zip-datapack.ts — check a datapack shipped as a .zip archive by extracting it into a temp
// directory once, then running the normal directory check. Extraction is read-only and guarded
// against zip-slip (absolute paths, drive letters, and .. segments are rejected).
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { Uint8ArrayReader, Uint8ArrayWriter, ZipReader } from '@zip.js/zip.js';

export interface ExtractedDatapack { root: string; cleanup: () => void }

const MAX_ENTRIES = 20_000;
const MAX_TOTAL_BYTES = 512 * 1024 * 1024; // 512 MiB uncompressed

/** Sanitize one zip entry path and return it relative to the extraction root. */
function safeEntryPath(name: string): string {
  const slashName = name.replace(/\\/g, '/');
  if (slashName.startsWith('/') || /^[a-zA-Z]:/.test(slashName)) {
    throw new Error(`unsafe zip entry path: ${name}`);
  }
  const segments = slashName.split('/');
  for (const seg of segments) {
    if (seg === '..') throw new Error(`unsafe zip entry path: ${name}`);
  }
  const p = join(...segments);
  const rel = relative(resolve('.'), resolve(p));
  if (rel === '' || rel.startsWith('..')) throw new Error(`unsafe zip entry path: ${name}`);
  return slashName;
}

/** True when `datapack` is a .zip file on disk. */
export function isZipPath(datapack: string): boolean {
  return /\.zip$/i.test(datapack);
}

/**
 * Extract `data/`, `pack.mcmeta`, and overlay directories from a datapack zip into a fresh temp
 * directory. Only regular-file entries are extracted; symlinks and special entries are ignored.
 */
export async function extractZipDatapack(zipPath: string): Promise<ExtractedDatapack> {
  const raw = readFileSync(zipPath);
  const reader = new ZipReader(new Uint8ArrayReader(new Uint8Array(raw.buffer, raw.byteOffset, raw.byteLength)));
  const root = mkdtempSync(join(tmpdir(), 'dpkit-zip-'));
  let total = 0;
  let count = 0;
  // Case-insensitive entry map: Minecraft resource locations are case-insensitive, and on
  // case-insensitive filesystems (Windows) a later write would silently overwrite the earlier
  // entry before the post-extraction collision check could ever see both.
  const seenFiles = new Map<string, string>();
  try {
    const entries = await reader.getEntries();
    for (const entry of entries) {
      if (count++ >= MAX_ENTRIES) throw new Error(`zip has more than ${MAX_ENTRIES} entries`);
      if (entry.directory) continue;
      const rel = safeEntryPath(entry.filename);
      if (!rel) throw new Error('zip contains an empty entry path');
      const key = rel.toLowerCase();
      const previous = seenFiles.get(key);
      if (previous !== undefined) {
        throw new Error(`zip contains colliding entries: "${previous}" and "${rel}" (exact/case-only duplicates)`);
      }
      seenFiles.set(key, rel);
      // Extract every regular file. Overlay directories are only known after pack.mcmeta is
      // parsed, and collecting from the extracted root later keeps the selection rules in one
      // place (collectFiles); MAX_TOTAL_BYTES bounds the extraction.
      const data = await entry.getData(new Uint8ArrayWriter());
      total += data.length;
      if (total > MAX_TOTAL_BYTES) throw new Error(`zip expands beyond ${MAX_TOTAL_BYTES / 1024 / 1024} MiB`);
      const target = join(root, ...rel.split('/'));
      mkdirSync(dirname(target), { recursive: true });
      writeFileSync(target, data);
    }
  } catch (err) {
    reader.close();
    try { cleanupRoot(root); } catch { /* ignore */ }
    throw err;
  } finally {
    reader.close();
  }
  return { root, cleanup: () => cleanupRoot(root) };
}

function cleanupRoot(root: string): void {
  rmSync(root, { recursive: true, force: true });
}
