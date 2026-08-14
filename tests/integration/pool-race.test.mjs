// pool-race.test.mjs — regression for the pooled engine's shared-slot race. Two concurrent
// check() calls on the same datapack@@version entry used to swap entry.uriToRel / entry.current
// out from under each other (MCP's tools/call is not serialized), so one call's diagnostics
// landed in the other call's map. The per-entry opQueue fix serializes them; this test fires
// two disjoint --files subsets at the SAME pooled entry and asserts each result matches its
// sequential baseline exactly, with no cross-talk.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createInProcEnginePool } from '../../dist/api.js';

const fixture = join(dirname(fileURLToPath(import.meta.url)), '..', 'fixtures', 'pack');

const relsA = ['test/function/ref.mcfunction'];
const relsB = ['test/function/gotcha.mcfunction'];

function checkOpts(rels) {
  return {
    datapack: fixture,
    version: '26.2',
    files: rels.map(rel => join(fixture, 'data', ...rel.split('/'))),
    rels,
    mode: 'analyze',
  };
}

/** Stable, comparable form of an EngineCheckResult: every diagnostics-map key (plus the
 * requested rels) is emitted with its diagnostics sorted, so both missing AND extra keys
 * (cross-talk) surface in the comparison. */
function norm(result, rels) {
  const allRels = new Set([...result.diagnosticsByRel.keys(), ...rels]);
  const byRel = {};
  for (const rel of [...allRels].sort()) {
    byRel[rel] = (result.diagnosticsByRel.get(rel) ?? [])
      .map(d => ({ s: d.severity ?? null, m: d.message, l: d.range.start.line, c: d.range.start.character }))
      .sort((a, b) => (a.l - b.l) || (a.c - b.c) || (a.m < b.m ? -1 : a.m > b.m ? 1 : 0));
  }
  return { resolvedVersion: result.resolvedVersion, failedRels: [...result.failedRels].sort(), byRel };
}

test('concurrent pool checks on disjoint --files subsets match sequential, no cross-talk', async () => {
  const engine = createInProcEnginePool();
  try {
    // Warm-up builds the shared entry so the two concurrent checks below reuse it — that is
    // the exact entry whose shared slots the race lived on.
    await engine.check(checkOpts(relsA));

    // Sequential baseline.
    const seqA = norm(await engine.check(checkOpts(relsA)), relsA);
    const seqB = norm(await engine.check(checkOpts(relsB)), relsB);

    // Concurrent: fired back-to-back without awaiting in between, so both land on one entry.
    const [concA, concB] = await Promise.all([
      engine.check(checkOpts(relsA)).then(r => norm(r, relsA)),
      engine.check(checkOpts(relsB)).then(r => norm(r, relsB)),
    ]);

    // Same results as running one at a time — no cross-talk, no dropped diagnostics.
    assert.deepEqual(concA, seqA);
    assert.deepEqual(concB, seqB);

    // Explicit invariants (clearer failure messages than a bare deepEqual).
    const refDiags = concA.byRel['test/function/ref.mcfunction'];
    assert.ok(refDiags.some(d => d.m.includes('no_such_func')),
      `ref diagnostic missing from subset A: ${JSON.stringify(refDiags)}`);
    const gotchaDiags = concB.byRel['test/function/gotcha.mcfunction'];
    assert.ok(gotchaDiags.length >= 1, 'gotcha diagnostics missing from subset B');
    assert.deepEqual(concA.failedRels, [], 'subset A must have no engine failures');
    assert.deepEqual(concB.failedRels, [], 'subset B must have no engine failures');
  } finally {
    await engine.close();
  }
});
