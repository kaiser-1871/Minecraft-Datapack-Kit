// datapack-discovery.ts — find a default datapack under a Minecraft install.
//
// Generic: scans every save's datapacks/ for any folder that looks like a datapack
// (contains a pack.mcmeta) — it does NOT assume any particular folder name. It prefers the
// pack under the version directory matching the check target, else the most recently
// modified one. Probe roots are the configured minecraftRoot (from .dpkit.json /
// --config) plus the standard %APPDATA%\.minecraft. Returns null when nothing is
// found — callers should surface a helpful error and suggest --datapack / DPKIT_DATAPACK
// / a .dpkit.json entry.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Probe roots: configured root(s) first, then the standard %APPDATA% location. */
function detectRoots(extraRoot?: string): string[] {
  const roots: string[] = [];
  const push = (r: string | undefined): void => { if (r && roots.indexOf(r) === -1) roots.push(r); };
  push(extraRoot);
  push(join(process.env.APPDATA ?? '', '.minecraft'));
  return roots;
}

export function detectDefaultDatapack(wantVersion: string, extraRoot?: string): string | null {
  const found: { p: string; version: string }[] = [];
  for (const root of detectRoots(extraRoot)) {
    let versions;
    try { versions = readdirSync(join(root, 'versions'), { withFileTypes: true }); } catch { continue; }
    for (const v of versions) {
      if (!v.isDirectory()) continue;
      let saves;
      try { saves = readdirSync(join(root, 'versions', v.name, 'saves'), { withFileTypes: true }); } catch { continue; }
      for (const s of saves) {
        if (!s.isDirectory()) continue;
        let packs;
        try { packs = readdirSync(join(root, 'versions', v.name, 'saves', s.name, 'datapacks'), { withFileTypes: true }); } catch { continue; }
        for (const pk of packs) {
          if (!pk.isDirectory()) continue;
          const p = join(root, 'versions', v.name, 'saves', s.name, 'datapacks', pk.name);
          if (existsSync(join(p, 'pack.mcmeta'))) found.push({ p, version: v.name });
        }
      }
    }
  }
  if (!found.length) return null;
  // 优先与检查版本同目录的包(避免探到旧版本的其它存档),否则取最近改动的
  const byVer = found.filter(x => x.version === wantVersion || wantVersion.startsWith(x.version));
  const pool = byVer.length ? byVer : found;
  let best: string | null = null, bestM = -1;
  for (const x of pool) {
    let m = 0;
    try { m = statSync(x.p).mtimeMs; } catch { /* stat failed — skip */ }
    if (m > bestM) { bestM = m; best = x.p; }
  }
  return best;
}
