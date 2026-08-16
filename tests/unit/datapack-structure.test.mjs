// datapack-structure.test.mjs — resource-path classification/validation helpers.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  dataRelOf, findDuplicateDataFiles, isRecognizedDataFile, isWrongFolderDiagnostic,
  parseDataRel, validateDataFilePaths,
} from '../../dist/datapack-structure.js';

test('parseDataRel splits overlay prefixes', () => {
  assert.deepEqual(parseDataRel('ns/function/a.mcfunction'), { overlay: null, dataRel: 'ns/function/a.mcfunction' });
  assert.deepEqual(parseDataRel('@overlay:ov/ns/function/a.mcfunction'), { overlay: 'ov', dataRel: 'ns/function/a.mcfunction' });
  assert.equal(dataRelOf('@overlay:ov/x/y.json'), 'x/y.json');
});

test('isRecognizedDataFile mirrors the engine resource table (version-independent)', () => {
  for (const rel of [
    'ns/function/a.mcfunction', 'ns/functions/a.mcfunction',
    'ns/advancement/a.json', 'ns/advancements/a.json',
    'ns/loot_table/a.json', 'ns/tags/item/a.json', 'ns/worldgen/biome/a.json',
    'ns/structure/a.nbt', 'ns/structures/a.nbt', '@overlay:ov/ns/function/a.mcfunction',
  ]) assert.equal(isRecognizedDataFile(rel), true, rel);
  for (const rel of ['ns/unknown/a.json', 'ns/foo.mcfunction', 'ns/a.nbt', 'pack.mcmeta']) {
    assert.equal(isRecognizedDataFile(rel), false, rel);
  }
});

test('validateDataFilePaths reports illegal resource-location segments and ids', () => {
  const out = validateDataFilePaths([
    'Bad-Name!/function/a.mcfunction',
    'ns/advancement/bad name.json',
    'ns/function/UPPER.mcfunction',
    'ns/function/ok.mcfunction',
  ]);
  assert.ok(out.get('Bad-Name!/function/a.mcfunction')?.[0].message.includes('illegal resource-location segment'));
  assert.ok(out.get('ns/advancement/bad name.json')?.[0].message.includes('illegal file id'));
  assert.ok(out.get('ns/function/UPPER.mcfunction')?.[0].message.includes('illegal file id'));
  assert.equal(out.has('ns/function/ok.mcfunction'), false);
});

test('findDuplicateDataFiles reports case-only collisions after the first file', () => {
  const out = findDuplicateDataFiles(['ns/function/A.mcfunction', 'ns/function/a.mcfunction']);
  assert.equal(out.has('ns/function/A.mcfunction'), false);
  assert.match(out.get('ns/function/a.mcfunction')?.[0].message ?? '', /differ only by case/);
});

test('isWrongFolderDiagnostic recognizes the engine binder hint', () => {
  assert.equal(isWrongFolderDiagnostic('Files in the “functions” folder are not recognized in loaded version 26.2, did you meant to use the “function” folder?'), true);
  assert.equal(isWrongFolderDiagnostic('Cannot find function “x”'), false);
});
