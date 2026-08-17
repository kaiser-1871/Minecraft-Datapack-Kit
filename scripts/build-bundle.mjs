// build-bundle.mjs — bundle the TypeScript sources + the vendored Spyglass engine into
// self-contained dist/*.js (zero runtime dependencies).
//
// Pipeline (see package.json "build"):
//   1. tsc --emitDeclarationOnly  -> dist/**/*.d.ts (+ .d.ts.map)
//   2. node scripts/build-bundle.mjs -> dist/**/*.js (+ .js.map)
//
// The vendored @spyglassmc/* packages are NOT bundled by the multi-entry src build (their
// module graph has a circular Offset<->Source cycle that esbuild reorders incorrectly when
// splitting across many entries). Instead each Spyglass package is pre-bundled here as its
// own single-entry, self-contained dist/spyglass-*.js file (single-entry ordering is correct),
// and the src build imports those files as externals. Every src/**/*.ts remains its own entry
// so the published package keeps the exact per-module dist/*.js set the tests import.
import { build } from 'esbuild';
import { existsSync, readdirSync, rmSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url)); // scripts/ -> repo root

// esbuild leaves `require("x")` of external builtins in bundled CJS deps as a runtime
// __require() shim that needs a real `require`. ESM output has none, so inject createRequire.
const requireShim = "import { createRequire as __esbcr } from 'module'; const require = __esbcr(import.meta.url);";

// Remove stale dist/**/*.js and dist/**/*.js.map recursively (keep the .d.ts from tsc).
function clearBundledJs(dir) {
  if (!existsSync(dir)) return;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) clearBundledJs(p);
    else if (entry.name.endsWith('.js') || entry.name.endsWith('.js.map')) rmSync(p, { force: true });
  }
}

// Recursively collect *.ts files (repo-relative, forward slashes).
function collectTs(dir, acc = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) collectTs(p, acc);
    else if (entry.name.endsWith('.ts')) acc.push(relative(root, p).replaceAll(sep, '/'));
  }
  return acc;
}

// The vendored java-edition does `await import('./versions.json')` as a last-resort offline
// fallback, but that file only exists upstream after fetch_bundled_meta_resources.ts runs.
// The import is wrapped in try/catch, so stub it with an empty JSON array to let the bundle
// build (the fallback is dead code: it only runs when two remote fetches fail AND no cache).
const stubMissingVersionsJson = {
  name: 'stub-missing-versions-json',
  setup(b) {
    b.onResolve({ filter: /versions[.]json$/ }, () => ({
      path: 'versions.json',
      namespace: 'stub-versions-json',
    }));
    b.onLoad({ filter: /.*/, namespace: 'stub-versions-json' }, () => ({
      contents: '[]',
      loader: 'json',
    }));
  },
};

// Rewrite @spyglassmc/* imports to the pre-built sibling bundles (external). Specifiers NOT
// present in `map` are left alone so esbuild bundles them (inline) — that is how the small
// leaf packages (locales / json / mcfunction / nbt) get folded into their dependents.
function spyglassExternal(map) {
  return {
    name: 'spyglass-external',
    setup(b) {
      b.onResolve({ filter: /^@spyglassmc\// }, (args) => {
        const target = map[args.path];
        if (target) return { path: target, external: true };
        return undefined;
      });
    },
  };
}

// Replace the vulnerable `decompress` package (zip-slip, GHSA-mp2f-45pm-3cg9) with a safe,
// in-memory tar extractor. Spyglass core only uses `decompress` for `decompressBall` on
// upstream tarballs; our replacement keeps that API (`(buffer, { strip }) => Promise<File[]>`)
// but rejects unsafe entry paths and does not write to the filesystem.
function safeDecompress() {
  return {
    name: 'safe-decompress',
    setup(b) {
      b.onResolve({ filter: /^decompress$/ }, () => ({
        path: join(root, 'scripts', 'safe-decompress.mjs'),
      }));
    },
  };
}

const base = {
  absWorkingDir: root,
  bundle: true,
  format: 'esm',
  platform: 'node',
  target: 'node20',
  sourcemap: true,
  logLevel: 'info',
  // The vendored locales package ships a leftover tsconfig.json whose `extends` target
  // no longer exists; esbuild warns while discovering it. It is harmless — silence it.
  logOverride: { 'tsconfig.json': 'silent' },
};

const dpkitSpyglassMap = {
  '@spyglassmc/core': './spyglass-core.js',
  '@spyglassmc/core/lib/nodejs.js': './spyglass-core.js',
  '@spyglassmc/java-edition': './spyglass-java-edition.js',
  '@spyglassmc/mcdoc': './spyglass-mcdoc.js',
};

async function bundleSpyglassFacade(outName, contents, externalMap) {
  await build({
    ...base,
    stdin: { contents, resolveDir: root, loader: 'js' },
    outfile: `dist/${outName}.js`,
    splitting: false,
    banner: { js: requireShim },
    plugins: [stubMissingVersionsJson, spyglassExternal(externalMap), safeDecompress()],
  });
}

async function main() {
  clearBundledJs(join(root, 'dist'));

  // Phase A — self-contained Spyglass bundles (single-entry => correct circular-import order).
  await bundleSpyglassFacade(
    'spyglass-core',
    "export * from '@spyglassmc/core';\nexport * from '@spyglassmc/core/lib/nodejs.js';\n",
    {});
  await bundleSpyglassFacade(
    'spyglass-mcdoc',
    "export * from '@spyglassmc/mcdoc';\n",
    { '@spyglassmc/core': './spyglass-core.js', '@spyglassmc/core/lib/nodejs.js': './spyglass-core.js' });
  await bundleSpyglassFacade(
    'spyglass-java-edition',
    "export * from '@spyglassmc/java-edition';\n",
    { '@spyglassmc/core': './spyglass-core.js', '@spyglassmc/core/lib/nodejs.js': './spyglass-core.js', '@spyglassmc/mcdoc': './spyglass-mcdoc.js' });

  // The --engine=lsp subprocess entry (self-contained single file).
  await build({
    ...base,
    entryPoints: ['vendor/spyglass/language-server/bin/server.js'],
    outfile: 'dist/spyglass-server.js',
    splitting: false,
    banner: { js: requireShim },
    plugins: [stubMissingVersionsJson, spyglassExternal({
      '@spyglassmc/core': './spyglass-core.js',
      '@spyglassmc/core/lib/nodejs.js': './spyglass-core.js',
      '@spyglassmc/java-edition': './spyglass-java-edition.js',
      '@spyglassmc/mcdoc': './spyglass-mcdoc.js',
    }), safeDecompress()],
  });

  // Phase B — the dpkit modules (per-module dist/*.js, shared chunks split out).
  const srcEntries = collectTs(join(root, 'src'));
  console.log('[build-bundle] entries:', srcEntries.length);
  await build({
    ...base,
    entryPoints: srcEntries,
    outbase: 'src',
    outdir: 'dist',
    splitting: true,
    banner: { js: requireShim },
    plugins: [stubMissingVersionsJson, spyglassExternal(dpkitSpyglassMap)],
  });

  console.log('[build-bundle] done');
}

main().catch((err) => {
  console.error('[build-bundle] failed:', err);
  process.exit(1);
});
