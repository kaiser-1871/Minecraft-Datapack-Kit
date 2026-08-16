// datapack-discovery.ts — find a default datapack under a Minecraft install.
//
// Generic: scans every save's datapacks/ for any folder that looks like a datapack
// (contains a pack.mcmeta) — it does NOT assume any particular folder name. It prefers the
// pack under the version directory matching the check target, else the most recently
// modified one. Probe roots are the configured minecraftRoot (from .dpkit.json /
// --config), the standard %APPDATA%\.minecraft, and Prism/MultiMC instance roots.
// .zip entries in a datapacks folder are returned too (checkDatapack extracts + validates
// them). Returns null when nothing is found — callers should surface a helpful error and
// suggest --datapack / DPKIT_DATAPACK / a .dpkit.json entry.
import { existsSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

/** Instance minecraft roots of a MultiMC-style launcher (Prism / MultiMC / clones). */
function instanceRoots(launcherDir: string): string[] {
  const roots: string[] = [];
  let instances;
  try { instances = readdirSync(join(launcherDir, 'instances'), { withFileTypes: true }); } catch { return roots; }
  for (const inst of instances) {
    if (!inst.isDirectory()) continue;
    for (const sub of ['minecraft', '.minecraft']) {
      const p = join(launcherDir, 'instances', inst.name, sub);
      try {
        if (statSync(p).isDirectory()) { roots.push(p); break; }
      } catch { /* next sub */ }
    }
  }
  return roots;
}

/** Probe roots: configured root(s) first, then official / Prism / MultiMC locations. */
function detectRoots(extraRoot?: string): string[] {
  const roots: string[] = [];
  const push = (r: string | undefined): void => { if (r && roots.indexOf(r) === -1) roots.push(r); };
  push(extraRoot);
  push(join(process.env.APPDATA ?? '', '.minecraft'));
  for (const launcher of ['PrismLauncher', 'MultiMC']) {
    for (const r of instanceRoots(join(process.env.APPDATA ?? '', launcher))) push(r);
  }
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
          const p = join(root, 'versions', v.name, 'saves', s.name, 'datapacks', pk.name);
          if (pk.isDirectory()) {
            if (existsSync(join(p, 'pack.mcmeta'))) found.push({ p, version: v.name });
          } else if (pk.name.toLowerCase().endsWith('.zip')) {
            // A zip in a datapacks folder is expected to be a datapack; checkDatapack will
            // extract and validate it (or fail cleanly if it isn't one).
            found.push({ p, version: v.name });
          }
        }
      }
    }
  }
  if (!found.length) return null;
  // Prefer the pack under the directory matching the check version (avoids probing other
  // saves from older versions), else the most recently modified one.
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
