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

test('lenient NBT forms are known false positives', () => {
  const enabled = enabledKnownFpRules(undefined, true);
  const rotation = matchKnownFalsePositive(
    diag('Expected collection length to be at least 2 and at most 2'),
    { version: '1.16.5', rel: 'a.mcfunction', fileText: 'summon armor_stand ~ ~ ~ {Rotation:[0f]}\n' },
    enabled,
  );
  assert.equal(rotation?.name, 'nbt-rotation-list-length');

  const boolCompound = matchKnownFalsePositive(
    diag('Expected a boolean'),
    { version: '1.16.5', rel: 'a.mcfunction', fileText: 'summon zombie ~ ~ ~ {NoAI:0}\n' },
    enabled,
  );
  assert.equal(boolCompound?.name, 'nbt-int-for-boolean');

  const boolData = matchKnownFalsePositive(
    diag('Expected a boolean'),
    { version: '1.16.5', rel: 'a.mcfunction', fileText: 'data modify entity @s NoAI set value 0\n' },
    enabled,
  );
  assert.equal(boolData?.name, 'nbt-int-for-boolean');

  const shortCompound = matchKnownFalsePositive(
    diag('Expected a short'),
    { version: '1.16.5', rel: 'a.mcfunction', fileText: 'summon tropical_fish ~ ~ ~ {Amplifier:255}\n' },
    enabled,
  );
  assert.equal(shortCompound?.name, 'nbt-int-for-short');

  const tpTrailing = matchKnownFalsePositive(
    diag('Expected facing|<rotation: rotation>'),
    { version: '1.16.5', rel: 'a.mcfunction', fileText: 'tp @s ~ ~0.6 ~ \n' },
    enabled,
  );
  assert.equal(tpTrailing?.name, 'tp-trailing-whitespace-rotation');

  const optionalTrailing = matchKnownFalsePositive(
    diag('Expected <viewers: entity>'),
    { version: '1.16.5', rel: 'a.mcfunction', fileText: 'particle end_rod ~ ~ ~ 0 0 0 0 0 force \n' },
    enabled,
  );
  assert.equal(optionalTrailing?.name, 'trailing-whitespace-optional-argument');

  const lootSentinel = matchKnownFalsePositive(
    diag('Cannot find loot_table “minecraft:none” (rule: undeclaredSymbol)'),
    { version: '1.16.5', rel: 'a.mcfunction', fileText: 'summon zombie ~ ~ ~ {DeathLootTable:"none"}\n' },
    enabled,
  );
  assert.equal(lootSentinel?.name, 'loot-table-none-empty-sentinel');

  const emptyColor = matchKnownFalsePositive(
    diag('Expected “#”'),
    { version: '1.16.5', rel: 'a.mcfunction', fileText: 'title @s title [{"translate":"x","color":""}]\n' },
    enabled,
  );
  assert.equal(emptyColor?.name, 'text-component-empty-color');
});
