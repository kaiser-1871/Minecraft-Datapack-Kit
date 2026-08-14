// vendor-spyglass.mjs — rebuild + re-sync the vendored Spyglass engine from a source checkout.
//
// Usage:  npm run vendor -- --spyglass=D:\\Spyglass-main
// Steps:  1. npx tsgo -b packages   (rebuild the checkout)
//         2. copy lib/ (no source maps) + package.json of the 8 engine packages into vendor/spyglass/
//         3. refresh vendor/spyglass/BUILD.json (build time + GitHub main HEAD + match check)
// The checkout must carry the dpkit patches (see vendor/spyglass/VENDORED.md) BEFORE building.
import { spawnSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const PACKAGES = ['core', 'java-edition', 'json', 'locales', 'mcdoc', 'mcfunction', 'nbt', 'language-server'];
const REPO = resolve(fileURLToPath(new URL('..', import.meta.url)));
const VENDOR = join(REPO, 'vendor', 'spyglass');

const readSafe = (p) => { try { return readFileSync(p, 'utf8'); } catch { return undefined; } };

const arg = process.argv.find(a => a.startsWith('--spyglass='));
const spyglassRoot = resolve(arg ? arg.slice('--spyglass='.length) : process.env.SPYGLASS_SOURCE ?? 'D:\\Spyglass-main');

if (!existsSync(join(spyglassRoot, 'packages', 'core', 'src'))) {
  console.error(`[vendor] source checkout not found: ${spyglassRoot} (pass --spyglass=<path>)`);
  process.exit(1);
}

console.log(`[vendor] building ${spyglassRoot} with tsgo …`);
const build = spawnSync('npx', ['tsgo', '-b', 'packages'], { cwd: spyglassRoot, stdio: 'inherit', shell: true });
if (build.status !== 0) {
  console.error('[vendor] build failed — aborting (nothing copied)');
  process.exit(1);
}

const copyTree = (src, dst) => {
  mkdirSync(dst, { recursive: true });
  for (const e of readdirSync(src, { withFileTypes: true })) {
    const s = join(src, e.name);
    const d = join(dst, e.name);
    if (e.isDirectory()) copyTree(s, d);
    else if (!e.name.endsWith('.map')) copyFileSync(s, d);
  }
};

for (const p of PACKAGES) {
  const srcLib = join(spyglassRoot, 'packages', p, 'lib');
  if (!existsSync(srcLib)) {
    console.error(`[vendor] missing lib for ${p} — aborting`);
    process.exit(1);
  }
  const dst = join(VENDOR, p);
  rmSync(join(dst, 'lib'), { recursive: true, force: true });
  copyTree(srcLib, join(dst, 'lib'));
  copyFileSync(join(spyglassRoot, 'packages', p, 'package.json'), join(dst, 'package.json'));
  // language-server also ships a bin/ entry (the LSP stdio entrypoint used by --engine=lsp).
  if (p === 'language-server') {
    rmSync(join(dst, 'bin'), { recursive: true, force: true });
    copyTree(join(spyglassRoot, 'packages', p, 'bin'), join(dst, 'bin'));
  }
  console.log(`[vendor] copied ${p}`);
}
copyFileSync(join(spyglassRoot, 'LICENSE'), join(VENDOR, 'LICENSE'));

// Refresh build metadata: fetch GitHub main HEAD, and check whether the checkout matches it
// (compare one representative un-patched file against the raw file at that commit).
const BUILD = join(VENDOR, 'BUILD.json');
let main = null;
let matchesMain = false;
try {
  const res = await fetch('https://api.github.com/repos/SpyglassMC/Spyglass/commits/main', {
    headers: { 'User-Agent': 'dpkit-vendor' },
    signal: AbortSignal.timeout(15000),
  });
  if (res.ok) {
    const j = await res.json();
    main = { sha: j.sha, date: j.commit?.committer?.date ?? null, message: (j.commit?.message ?? '').split('\n')[0] };
    const probe = 'packages/core/src/common/Dev.ts';
    const raw = await fetch(`https://raw.githubusercontent.com/SpyglassMC/Spyglass/${j.sha}/${probe}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (raw.ok) {
      const remote = (await raw.text()).replace(/\r\n/g, '\n');
      const local = readSafe(join(spyglassRoot, probe))?.replace(/\r\n/g, '\n');
      matchesMain = local === remote;
    }
  }
} catch {
  main = null; // offline — keep the previous BUILD.json value below
}

const previous = JSON.parse(readSafe(BUILD) ?? '{}');
const meta = {
  builtAt: new Date().toISOString(),
  source: spyglassRoot,
  sourceMatchesMainHead: matchesMain,
  spyglassMainAtVendor: main ?? previous.spyglassMainAtVendor ?? null,
  buildTool: 'tsgo (npx tsgo -b packages)',
  packages: PACKAGES,
};
writeFileSync(BUILD, JSON.stringify(meta, null, 2) + '\n');
console.log('[vendor] BUILD.json refreshed:', matchesMain ? 'source matches GitHub main HEAD' : 'source does NOT byte-match main HEAD');
console.log('[vendor] done — run "npm install" in the dpkit repo to re-link if paths changed');
