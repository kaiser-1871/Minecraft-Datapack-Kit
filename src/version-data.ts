// version-data.ts — on-demand download of per-version data into Spyglass's local cache.
// The offline teach commands (--syntax/--registry/--dump) read the same cache the engine
// writes; when a version's data isn't cached yet they used to fail with "run a full check
// once to download it". Now they download the missing data themselves (command tree /
// registries / the version list) so one command just works; offline they still fail with
// the same clean, recoverable error.
import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { cacheDir, cacheIndexSidecarPath, readCachedBytes } from './cache.js';
import { CommandDataNotCachedError, resolveConcreteVersion } from './syntax.js';

export const VERSIONS_LIST_URL = 'https://api.spyglassmc.com/mcje/versions';
const FETCH_TIMEOUT_MS = 5000;

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
  let index: { index?: Record<string, Record<string, unknown>> } = {};
  try { index = JSON.parse(readFileSync(cacheIndexSidecarPath(), 'utf8')); } catch { index = {}; }
  index.index ??= {};
  index.index[url] = { '': { status: res.status, statusText: res.statusText, sha1 } };
  const tmp = `${cacheIndexSidecarPath()}.tmp`;
  writeFileSync(tmp, JSON.stringify(index));
  renameSync(tmp, cacheIndexSidecarPath());
  return { ok: true, error: '' };
}

/**
 * Make sure the version's data is cached, downloading it on demand. Returns the concrete
 * version id (resolving 'auto' / 'latest release' / 'latest snapshot'). Throws
 * CommandDataNotCachedError — a clean, recoverable state — when a download fails or the
 * version list cannot be resolved offline.
 */
export async function ensureVersionData(version: string, kinds: ('commands' | 'registries')[]): Promise<string> {
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
    const r = await downloadToCache(url);
    if (!r.ok) failures.push(`${k} (${r.error})`);
  }
  if (failures.length) {
    throw new CommandDataNotCachedError(
      `No command data cached for version ${concrete} — auto-download failed (${failures.join(', ')}); run node dpkit.mjs --version=${concrete} online once to retry.`,
    );
  }
  return concrete;
}
