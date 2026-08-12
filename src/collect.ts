// collect.ts — walk a datapack's data/ directory for checkable files and apply the
// --files glob filter. Paths are made relative to data/ so --files=<ns>/... reads
// naturally (matches README).
import { readdirSync } from 'node:fs';
import { join } from 'node:path';

export const FILES_EMPTY_HINT = '[check] --files is matched relative to data/ — try e.g. test/function/*.mcfunction';

/** Normalize an absolute file path to a data/-relative path with forward slashes. */
export function toRel(filePath: string, dataDir: string): string {
  return filePath.slice(dataDir.length + 1).replace(/\\/g, '/');
}

/**
 * Collect all checkable files (data/**\/*.mcfunction + data/**\/*.json, non-dotfile)
 * under a datapack, optionally filtered by `only` (a data/-relative glob where `*`
 * matches any run of characters).
 */
export function collectFiles(datapack: string, only: string): { files: string[]; rels: string[] } {
  const DATA_DIR = join(datapack, 'data');
  const fileList: string[] = [];
  (function walk(dir: string): void {
    let entries;
    try { entries = readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) { walk(p); continue; }
      if (e.name.endsWith('.mcfunction') || (e.name.endsWith('.json') && !e.name.startsWith('.'))) fileList.push(p);
    }
  })(DATA_DIR);

  let rels = fileList.map(p => toRel(p, DATA_DIR));
  if (only) {
    const re = new RegExp('^' + only.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*') + '$');
    rels = rels.filter(r => re.test(r));
  }
  const files = rels.map(r => join(DATA_DIR, r));
  return { files, rels };
}
