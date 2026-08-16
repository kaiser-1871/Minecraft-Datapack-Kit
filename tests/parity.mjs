// parity.mjs — compare the in-process engine against the LSP subprocess engine on the
// same datapack. This is the correctness gate for the M3 refactor: per-file issue
// signatures (and the full report) must match exactly. Run with `npm run parity`.
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { checkDatapack, DpkitError } from '../dist/api.js';

// Default to the self-contained fixture so parity runs on any machine; point
// DPKIT_PARITY_DATAPACK at your own pack to gate against a bigger surface.
const FIXTURE = join(dirname(fileURLToPath(import.meta.url)), 'fixtures', 'pack');
// 'latest release' keeps the gate moving with Minecraft instead of pinning a single version.
const version = process.env.DPKIT_PARITY_VERSION ?? 'latest release';
const datapack = process.env.DPKIT_PARITY_DATAPACK ?? FIXTURE;

const started = Date.now();
let lsp, inproc;
try {
  console.log(`[parity] datapack=${datapack} version=${version}`);
  console.log('[parity] running LSP engine…');
  lsp = await checkDatapack({ datapack, version, engine: 'lsp', noLog: true });
  console.log(`[parity]   LSP done in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  const t1 = Date.now();
  console.log('[parity] running in-process engine…');
  inproc = await checkDatapack({ datapack, version, engine: 'inproc', noLog: true });
  console.log(`[parity]   inproc done in ${((Date.now() - t1) / 1000).toFixed(1)}s`);
} catch (e) {
  console.error(`[parity] engine run failed: ${e instanceof DpkitError ? e.message : (e.stack ?? e)}`);
  process.exit(2);
}

const norm = (r) => {
  const { engine, ...rest } = r.report;
  void engine;
  return rest;
};

let failures = 0;
const check = (name, a, b) => {
  const ja = JSON.stringify(a), jb = JSON.stringify(b);
  if (ja !== jb) {
    failures++;
    console.log(`✗ ${name}`);
    const la = ja.split('\n'), lb = jb.split('\n');
    let shown = 0;
    for (let i = 0; i < Math.max(la.length, lb.length) && shown < 6; i++) {
      if (la[i] !== lb[i]) { console.log(`  LSP   : ${la[i]}`); console.log(`  inproc: ${lb[i]}`); shown++; }
    }
  } else {
    console.log(`✓ ${name}`);
  }
};

const na = norm(lsp), nb = norm(inproc);
check('report (minus engine)', na, nb);
check('summary', lsp.report.summary, inproc.report.summary);
check('files', lsp.report.files, inproc.report.files);
check('resolvedVersion', lsp.report.resolvedVersion, inproc.report.resolvedVersion);
check('issues', lsp.report.issues, inproc.report.issues);
check('ignored', lsp.report.ignored, inproc.report.ignored);
check('gotchas', lsp.report.gotchas, inproc.report.gotchas);
check('byMessage', lsp.report.byMessage, inproc.report.byMessage);

// Per-file issue signature map — the byte-identical baseline contract.
const sigOf = (r) => {
  const m = {};
  for (const [rel, { sig }] of Object.entries(r.newBaseline.files)) m[rel] = sig;
  return m;
};
const sa = sigOf(lsp), sb = sigOf(inproc);
const allRels = new Set([...Object.keys(sa), ...Object.keys(sb)]);
let sigDiff = 0;
for (const rel of allRels) {
  if ((sa[rel] ?? '') !== (sb[rel] ?? '')) {
    if (sigDiff === 0) console.log('✗ per-file issueSig');
    console.log(`  ${rel}:\n    LSP   = ${JSON.stringify(sa[rel] ?? null)}\n    inproc= ${JSON.stringify(sb[rel] ?? null)}`);
    sigDiff++;
  }
}
if (sigDiff === 0) console.log('✓ per-file issueSig (all files match)');
else failures++;

console.log(failures === 0 && sigDiff === 0
  ? '\n[parity] PASS — in-process engine matches LSP engine.'
  : `\n[parity] FAIL — ${failures + (sigDiff > 0 ? 1 : 0)} difference(s).`);
process.exit(failures === 0 && sigDiff === 0 ? 0 : 1);
