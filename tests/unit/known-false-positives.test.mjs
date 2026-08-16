import { test } from 'node:test';
import assert from 'node:assert/strict';
import { enabledKnownFpRules, KNOWN_FP_RULES, matchKnownFalsePositive } from '../../dist/known-false-positives.js';

const diag = (message, line = 0) => ({ severity: 1, message, range: { start: { line, character: 0 }, end: { line, character: 1 } } });

test('known-fp rules are content-aware and version-aware', () => {
  const ctx = { version: '26.2', rel: 'test/function/a.mcfunction', fileText: 'summon minecraft:interaction ~ ~ ~ {response:3b}\ndata merge entity @s {text_opacity:-1b}\n' };
  const enabled = enabledKnownFpRules(undefined, true);
  assert.equal(matchKnownFalsePositive(diag('Expected a boolean'), ctx, enabled)?.name, 'interaction-response-byte');
  assert.equal(matchKnownFalsePositive(diag('Expected numeric value to be at least 0 and at most 255', 1), ctx, enabled)?.name, 'text-opacity-negative-one');
  assert.equal(matchKnownFalsePositive(diag('Expected a boolean', 1), ctx, enabled), null);
});

test('rule database is configurable and disableable', () => {
  assert.equal(enabledKnownFpRules(false, true).size, 0);
  assert.equal(enabledKnownFpRules(undefined, false).size, 0);
  assert.deepEqual([...enabledKnownFpRules(['interaction-response-byte'], true)], ['interaction-response-byte']);
  assert.ok(KNOWN_FP_RULES.length >= 6);
});


test('zero-variable macro line diagnostic is a known false positive', () => {
  const ctx = { version: '26.2', rel: 'test/function/a.mcfunction', fileText: '$execute run say hi\n' };
  const d = diag('Expected at least one macro argument');
  const hit = matchKnownFalsePositive(d, ctx, enabledKnownFpRules(undefined, true));
  assert.equal(hit?.name, 'macro-line-no-arguments');
  assert.equal(matchKnownFalsePositive(d, { ...ctx, fileText: '$execute run say $(msg)\n' }, enabledKnownFpRules(undefined, true)), null);
});
