// datapack-structure.ts — file-set level validation that the Spyglass engine does not do:
// resource-location legality of every data file path, duplicate/case-collision detection, and
// "is this path a folder Minecraft recognizes at all" classification (used to turn files the
// engine silently excludes into an honest dpkit warning instead of a fake internal failure).
//
// The recognized-path list is NOT hand-maintained: it is derived at module load from the
// vendored java-edition binder's resource table (the same table the engine uses), so new data
// pack folders added by Spyglass are automatically known here.
import { binder } from '@spyglassmc/java-edition';
import type { RawDiagnostic } from './types.js';

/** Prefix for data files found under a pack.mcmeta overlay directory. */
export const OVERLAY_REL_PREFIX = '@overlay:';

/** resource path segments are lowercase a-z, digits, _ - . (namespace uses the same alphabet). */
interface ResourceShape {
  path: string;
  ext: `.${string}`;
  pack: 'data' | 'assets';
}

/** Data-pack resources known to the vendored engine (any version). */
const DATA_RESOURCES: ResourceShape[] = (() => {
  const out: ResourceShape[] = [];
  try {
    for (const r of binder.getResources()) {
      if (r.pack === 'data') out.push({ path: r.path, ext: r.ext, pack: 'data' });
    }
  } catch {
    // getResources is a pure generator over a static table; this guard is just paranoia.
  }
  return out;
})();

/** Extract the overlay dir + data-relative path from a collectFiles rel. */
export function parseDataRel(rel: string): { overlay: string | null; dataRel: string } {
  if (rel.startsWith(OVERLAY_REL_PREFIX)) {
    const rest = rel.slice(OVERLAY_REL_PREFIX.length);
    const slash = rest.indexOf('/');
    if (slash < 0) return { overlay: rest, dataRel: '' };
    return { overlay: rest.slice(0, slash), dataRel: rest.slice(slash + 1) };
  }
  return { overlay: null, dataRel: rel };
}

/** rel without the overlay prefix (used by --files glob matching). */
export function dataRelOf(rel: string): string {
  return parseDataRel(rel).dataRel;
}

function resourceMatches(dataRel: string, res: ResourceShape): boolean {
  const parts = dataRel.split('/');
  if (parts.length < 2) return false;
  // parts = [namespace, ...res.path segments, ...identifier segments(with ext)]
  const dirSegs = res.path === '' ? [] : res.path.split('/');
  if (parts.length < dirSegs.length + 2) return false;
  for (let i = 0; i < dirSegs.length; i++) {
    if (parts[i + 1] !== dirSegs[i]) return false;
  }
  const file = parts[parts.length - 1];
  return file.endsWith(res.ext);
}

/**
 * True when the engine has a resource definition for this path in at least one game version.
 * Files that fail this test are ignored by Minecraft as well as by Spyglass; dpkit reports them
 * itself instead of passing them to the engine (where the LSP path would otherwise wait for
 * diagnostics that never come).
 */
export function isRecognizedDataFile(rel: string): boolean {
  const { dataRel } = parseDataRel(rel);
  return DATA_RESOURCES.some(r => resourceMatches(dataRel, r));
}

/** First illegal character of a path segment, or null when the segment is legal. */
function illegalCharOf(segment: string): string | null {
  for (const ch of segment) {
    if (!/[a-z0-9_.-]/.test(ch)) return ch;
  }
  return null;
}

/** dpkit-side diagnostics for illegal resource-location paths / namespaces. */
export function validateDataFilePaths(rels: string[]): Map<string, RawDiagnostic[]> {
  const out = new Map<string, RawDiagnostic[]>();
  for (const rel of rels) {
    const { dataRel } = parseDataRel(rel);
    const parts = dataRel.split('/');
    if (parts.length < 2) {
      out.set(rel, [{
        severity: 2,
        message: `[path] data file path "${dataRel}" is not under a namespace directory (expected data/<namespace>/…)`,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      }]);
      continue;
    }
    const diags: RawDiagnostic[] = [];
    for (const seg of parts.slice(0, -1)) {
      const bad = seg === '' ? '/' : illegalCharOf(seg);
      if (bad) {
        diags.push({
          severity: 2,
          message: `[path] illegal resource-location segment "${seg}" (character "${bad}" is not allowed; use a-z, 0-9, _ . -)`,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
        });
        break;
      }
    }
    const file = parts[parts.length - 1];
    for (const ext of ['.json', '.mcfunction', '.nbt'] as const) {
      if (file.endsWith(ext)) {
        const id = file.slice(0, -ext.length);
        const bad = illegalCharOf(id);
        if (bad) {
          diags.push({
            severity: 2,
            message: `[path] illegal file id "${id}" (character "${bad}" is not allowed; use a-z, 0-9, _ . -)`,
            range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
          });
        }
        break;
      }
    }
    if (diags.length) out.set(rel, diags);
  }
  return out;
}

/**
 * Case-insensitive resource-location collisions. Root files and overlay files are kept distinct
 * (an overlay intentionally overrides the same id), but two files inside the same scope that
 * differ only by case are reported on every member after the first.
 */
export function findDuplicateDataFiles(rels: string[]): Map<string, RawDiagnostic[]> {
  const groups = new Map<string, string[]>();
  for (const rel of rels) {
    const key = rel.toLowerCase();
    const list = groups.get(key);
    if (list) list.push(rel);
    else groups.set(key, [rel]);
  }
  const out = new Map<string, RawDiagnostic[]>();
  for (const group of groups.values()) {
    if (group.length < 2) continue;
    const first = group[0];
    for (const rel of group.slice(1)) {
      out.set(rel, [{
        severity: 2,
        message: `[path] resource-location collision: "${rel}" and "${first}" differ only by case (Minecraft ids are case-insensitive)`,
        range: { start: { line: 0, character: 0 }, end: { line: 0, character: 1 } },
      }]);
    }
  }
  return out;
}

/** The engine's "wrong folder for this version" diagnostics are only Hints; CLI/CI need warnings. */
export function isWrongFolderDiagnostic(message: string): boolean {
  return /folder are not recognized in loaded version/.test(message);
}
