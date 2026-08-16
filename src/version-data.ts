// version-data.ts — on-demand download of per-version data into Spyglass's local cache.
// The offline teach commands (--syntax/--registry/--dump) read the same cache the engine
// writes; when a version's data isn't cached yet they used to fail with "run a full check
// once to download it". Now they download the missing data themselves (command tree /
// registries / the version list) so one command just works; offline they still fail with
// the same clean, recoverable error.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cacheDir, cacheIndexPath, cacheIndexSidecarPath, readCachedBytes } from './cache.js';
import { CommandDataNotCachedError, resolveConcreteVersion } from './syntax.js';

export const VERSIONS_LIST_URL = 'https://api.spyglassmc.com/mcje/versions';
// Old-version command data can take 10s+ to generate server-side; 5s was too tight and made
// 1.15/1.17/1.18 look unsupported. Keep a generous ceiling but still bounded for offline UX.
const FETCH_TIMEOUT_MS = 30000;

/** Spyglass's HttpCache.match() requires every index entry to be shaped like this
 * (CacheIndex.assert in NodeJsExternals.js). dpkit mirrors it so the engine's own index.json
 * can carry entries dpkit downloaded. */
interface EngineIndexEntry {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  sha1: string;
  cacheTime: number;
}

/**
 * Merge one URL entry into an http index file (engine index.json or dpkit's sidecar),
 * preserving all other entries. Read-modify-write with a temp-file rename so no reader
 * ever sees a half-written file (same discipline the engine itself uses).
 */
function mergeIndexEntry(file: string, url: string, entry: EngineIndexEntry): void {
  let index: { index?: Record<string, Record<string, unknown>> } = {};
  try { index = JSON.parse(readFileSync(file, 'utf8')); } catch { index = {}; }
  index.index ??= {};
  index.index[url] ??= {};
  index.index[url][''] = entry;
  const tmp = `${file}.tmp`;
  writeFileSync(tmp, JSON.stringify(index));
  renameSync(tmp, file);
}

/** Fetch a URL and store it in Spyglass's cache layout (http/objects + an index.json
 * entry), so both the offline readers and the engine see it on their next read. The
 * index entry is minimal (status/sha1) — the engine's own conditional fetch will refresh
 * it with full headers the next time it runs. */
export async function downloadToCache(url: string): Promise<{ ok: boolean; error: string }> {
  let res: Response;
  try {
    res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS), headers: { accept: 'application/json' } });
  } catch (err) {
    return { ok: false, error: (err as Error).message || 'network error' };
  }
  if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
  const body = Buffer.from(await res.arrayBuffer());
  const sha1 = createHash('sha1').update(body).digest('hex');
  const dir = join(cacheDir(), 'http', 'objects', sha1.slice(0, 2));
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, sha1), body);
  // Merge into dpkit's SIDECAR index, not the engine's index.json: the engine rewrites
  // index.json from its own in-memory state (dropping entries it didn't download), and two
  // concurrent writers on one file lose each other's entries. The sidecar is dpkit-only, so
  // neither race exists. Write-then-rename so no reader sees a half-written file.
  const headers: Record<string, string> = {};
  res.headers.forEach((v, k) => { headers[k] = v; });
  const entry: EngineIndexEntry = {
    status: res.status,
    statusText: res.statusText,
    headers,
    sha1,
    cacheTime: Date.now(),
  };
  mergeIndexEntry(cacheIndexSidecarPath(), url, entry);
  // ALSO merge into the engine's own index.json: the Spyglass HttpCache only reads that
  // file (never the sidecar), so without this a freshly pre-warmed version is invisible to
  // the engine and it re-fetches on init — which times out for old versions whose data
  // takes >10s to generate server-side (the engine's own fetch budget is ~15s total). With
  // an entry present, the engine's fetchWithCache falls back to this cached response when
  // the network attempt fails (stale-cache fallback), so pre-warmed data actually protects
  // engine init. Best-effort: a concurrent engine write could drop the entry, which only
  // means a re-fetch (no corruption — same read-modify-write discipline as the engine).
  try { mergeIndexEntry(cacheIndexPath(), url, entry); } catch { /* best-effort */ }
  return { ok: true, error: '' };
}

/** Kinds of per-version data that ensureVersionData can fetch from api.spyglassmc.com —
 * the URL suffix after /mcje/versions/{concrete}/. */
export type VersionDataKind =
  | 'commands'
  | 'registries'
  | 'block_states'
  | 'vanilla-data/tarball'
  | 'vanilla-assets-tiny/tarball';

/** Everything the Spyglass engine fetches for a version. Old releases only work when all of
 * these are cached, because the engine's own fetch timeout is much shorter than the 10s+ the
 * API can take to generate 1.14/1.15-era data. */
export const ENGINE_DATA_KINDS: VersionDataKind[] = [
  'commands',
  'registries',
  'block_states',
  'vanilla-data/tarball',
  'vanilla-assets-tiny/tarball',
];

/**
 * Make sure the version's data is cached, downloading it on demand. Returns the concrete
 * version id (resolving 'auto' / 'latest release' / 'latest snapshot'). Throws
 * CommandDataNotCachedError — a clean, recoverable state — when a download fails or the
 * version list cannot be resolved offline.
 */
export async function ensureVersionData(version: string, kinds: VersionDataKind[]): Promise<string> {
  let concrete = version;
  if (['auto', 'latest release', 'latest snapshot'].includes(version)) {
    if (readCachedBytes(VERSIONS_LIST_URL) == null) {
      const r = await downloadToCache(VERSIONS_LIST_URL);
      if (!r.ok) {
        throw new CommandDataNotCachedError(
          `No version data cached locally and the version list download failed (${r.error}) — run node dpkit.mjs --versions online once, or pin --version=<concrete-version>.`,
        );
      }
    }
    concrete = resolveConcreteVersion(version);
  }
  const base = `https://api.spyglassmc.com/mcje/versions/${concrete}`;
  const failures: string[] = [];
  for (const k of kinds) {
    const url = `${base}/${k}`;
    if (readCachedBytes(url) != null) continue;
    // Some old-version endpoints 502/timeout on first request but succeed on retry.
    let r = await downloadToCache(url);
    for (let attempt = 0; !r.ok && attempt < 2 && (/HTTP 5\d\d/.test(r.error) || /timeout|aborted/i.test(r.error)); attempt++) {
      await new Promise(resolve => setTimeout(resolve, 750 * (attempt + 1)));
      r = await downloadToCache(url);
    }
    if (!r.ok) failures.push(`${k} (${r.error})`);
  }
  if (failures.length) {
    throw new CommandDataNotCachedError(
      `No command data cached for version ${concrete} — auto-download failed (${failures.join(', ')}); run node dpkit.mjs --version=${concrete} online once to retry.`,
    );
  }
  return concrete;
}
