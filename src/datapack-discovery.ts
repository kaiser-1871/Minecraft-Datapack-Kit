// datapack-discovery.ts — find the default "pvp" datapack under a Minecraft install.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { LEGACY_DEFAULT_DATAPACK } from './paths.js';

/** True if the legacy relative default did not exist (i.e. the tool was moved). */
export const AUTO_DETECTED = !existsSync(LEGACY_DEFAULT_DATAPACK);

/**
 * Detect the pvp datapack: prefer a pack under the same version directory as the
 * check target; otherwise the most recently modified one. Falls back to the legacy
 * relative path when nothing is found.
 */
export function detectDefaultDatapack(wantVersion: string): string {
  if (existsSync(LEGACY_DEFAULT_DATAPACK)) return LEGACY_DEFAULT_DATAPACK;
  const roots = ['D:/Minecraft/.minecraft', join(process.env.APPDATA ?? '', '.minecraft')];
  const found: { p: string; version: string }[] = [];
  for (const root of roots) {
    let versions;
    try { versions = readdirSync(join(root, 'versions'), { withFileTypes: true }); } catch { continue; }
    for (const v of versions) {
      if (!v.isDirectory()) continue;
      let saves;
      try { saves = readdirSync(join(root, 'versions', v.name, 'saves'), { withFileTypes: true }); } catch { continue; }
      for (const s of saves) {
        if (!s.isDirectory()) continue;
        const p = join(root, 'versions', v.name, 'saves', s.name, 'datapacks', 'pvp');
        try { if (readdirSync(p).length) found.push({ p, version: v.name }); } catch { /* not this one */ }
      }
    }
  }
  if (!found.length) return LEGACY_DEFAULT_DATAPACK;
  // 优先与检查版本同目录的包(避免探到旧版本的其它存档),否则取最近改动的
  const byVer = found.filter(x => x.version === wantVersion || wantVersion.startsWith(x.version));
  const pool = byVer.length ? byVer : found;
  let best = pool[0], bestM = -1;
  for (const x of pool) {
    let m = 0;
    try { m = statSync(x.p).mtimeMs; } catch { /* stat failed — skip */ }
    if (m > bestM) { bestM = m; best = x; }
  }
  return best.p;
}
