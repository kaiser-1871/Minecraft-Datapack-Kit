// macro-expand.test.mjs — unit tests for $ macro-line expansion.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { expandMacroText, macroVariables, resolveFunctionPath } from '../../dist/macro-expand.js';
import { join } from 'node:path';

test('macroVariables extracts $(name) placeholders', () => {
  assert.deepEqual(macroVariables('summon arrow ~ ~ ~ {Motion:[$(yaw),$(pitch)]}'), ['yaw', 'pitch']);
  assert.deepEqual(macroVariables('say plain'), []);
});

test('expandMacroText substitutes all args and reports fullyChecked', () => {
  const text = '$summon minecraft:arrow ~ ~ ~ {Motion:[$(yaw),$(pitch)]}\n$say $(msg)\n';
  const r = expandMacroText(text, { yaw: 0.0, pitch: 0.5, msg: 'hi' });
  assert.equal(r.fullyChecked, true);
  assert.equal(r.macroLineCount, 2);
  assert.equal(r.lines[0].expanded, 'summon minecraft:arrow ~ ~ ~ {Motion:[0,0.5]}');
  assert.equal(r.lines[1].expanded, 'say hi');
});

test('expandMacroText marks missing args unverified, never errors', () => {
  const text = '$summon minecraft:arrow ~ ~ ~ {Motion:[$(yaw),$(pitch)]}\n';
  const r = expandMacroText(text, { yaw: 0 });
  assert.equal(r.fullyChecked, false);
  assert.equal(r.lines[0].checked, false);
  assert.match(r.lines[0].unverified_reason ?? '', /pitch/);
});

test('expandMacroText without args marks every macro line unverified', () => {
  const r = expandMacroText('$say $(x)\n');
  assert.equal(r.fullyChecked, false);
  assert.equal(r.lines[0].expanded, null);
});

test('resolveFunctionPath maps ns:path to data/ns/function/path.mcfunction', () => {
  assert.equal(resolveFunctionPath('C:/pack', 'battle:archer/pierce_summon'), join('C:/pack', 'data', 'battle', 'function', 'archer', 'pierce_summon.mcfunction'));
});
