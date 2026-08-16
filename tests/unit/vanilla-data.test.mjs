// vanilla-data.test.mjs — category normalization, URL building, parse/search, and the
// injectable-loader read path for Misode vanilla summary data. Zero network: the loader is a
// fixture; ensureVanillaData (which would download) is deliberately not exercised here.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  VANILLA_CATEGORIES, listVanillaCategories, normalizeVanillaCategory, vanillaDataUrl,
  parseVanillaFiles, searchVanillaKeys, getVanillaFiles, searchVanillaFiles, getVanillaFile,
} from '../../dist/vanilla-data.js';

const fixture = {
  'chests/ancient_city': { type: 'minecraft:chest' },
  'chests/desert_pyramid': { type: 'minecraft:chest' },
  'blocks/diamond_ore': { type: 'minecraft:block' },
};
const loader = (url) => {
  assert.match(url, /\/data\/loot_table\/data\.min\.json$/);
  return fixture;
};

test('VANILLA_CATEGORIES covers current data registries and worldgen categories', () => {
  assert.equal(VANILLA_CATEGORIES.length, 57);
  assert.ok(VANILLA_CATEGORIES.includes('loot_table'));
  assert.ok(VANILLA_CATEGORIES.includes('recipe'));
  assert.ok(VANILLA_CATEGORIES.includes('advancement'));
  assert.ok(VANILLA_CATEGORIES.includes('predicate'));
  assert.ok(VANILLA_CATEGORIES.includes('worldgen/biome'));
  assert.ok(VANILLA_CATEGORIES.includes('worldgen/configured_feature'));
  for (const c of ['cat_variant', 'trade_set', 'test_instance', 'world_clock', 'worldgen/feature']) {
    assert.ok(VANILLA_CATEGORIES.includes(c), c);
  }
  assert.equal(listVanillaCategories().length, 57);
});

test('normalizeVanillaCategory accepts canonical and alternate spellings', () => {
  assert.equal(normalizeVanillaCategory('loot_table'), 'loot_table');
  assert.equal(normalizeVanillaCategory('Loot_Table'), 'loot_table'); // lowercased
  assert.equal(normalizeVanillaCategory('worldgen/biome'), 'worldgen/biome');
  assert.equal(normalizeVanillaCategory('worldgen_biome'), 'worldgen/biome');
  assert.equal(normalizeVanillaCategory('worldgen-configured-carver'), 'worldgen/configured_carver');
  assert.equal(normalizeVanillaCategory('damage-type'), 'damage_type');
  assert.equal(normalizeVanillaCategory('  recipe  '), 'recipe'); // trimmed
});

test('normalizeVanillaCategory returns undefined for unknown/unsupported categories', () => {
  assert.equal(normalizeVanillaCategory('item_modifier'), undefined);
  assert.equal(normalizeVanillaCategory('text_component'), undefined);
  assert.equal(normalizeVanillaCategory(''), undefined);
  assert.equal(normalizeVanillaCategory('nope'), undefined);
});

test('vanillaDataUrl builds the verified per-version summary URL', () => {
  assert.equal(
    vanillaDataUrl('26.2', 'worldgen/biome'),
    'https://raw.githubusercontent.com/misode/mcmeta/26.2-summary/data/worldgen/biome/data.min.json',
  );
});

test('parseVanillaFiles validates the { path: json } object shape', () => {
  assert.deepEqual(parseVanillaFiles(fixture), fixture);
  assert.equal(parseVanillaFiles(null), null);
  assert.equal(parseVanillaFiles([]), null);
  assert.equal(parseVanillaFiles('x'), null);
});

test('searchVanillaKeys is case-insensitive substring, sorted; empty query returns all', () => {
  assert.deepEqual(searchVanillaKeys(fixture, 'chests'), ['chests/ancient_city', 'chests/desert_pyramid']);
  assert.deepEqual(searchVanillaKeys(fixture, 'DIAMOND'), ['blocks/diamond_ore']);
  assert.deepEqual(searchVanillaKeys(fixture, ''), ['blocks/diamond_ore', 'chests/ancient_city', 'chests/desert_pyramid']);
  assert.deepEqual(searchVanillaKeys(fixture, 'zzz'), []);
});

test('getVanillaFiles reads via the injected loader', () => {
  const r = getVanillaFiles('26.2', 'loot_table', loader);
  assert.equal(r.ok, true);
  assert.equal(r.version, '26.2');
  assert.equal(r.category, 'loot_table');
  assert.deepEqual(r.files, fixture);
});

test('getVanillaFiles surfaces an unknown category as ok:false', () => {
  const r = getVanillaFiles('26.2', 'item_modifier', loader);
  assert.equal(r.ok, false);
  assert.match(r.error, /Unknown vanilla-data category/);
});

test('searchVanillaFiles filters and reports total', () => {
  const r = searchVanillaFiles('26.2', 'loot_table', 'chests', loader);
  assert.equal(r.ok, true);
  assert.deepEqual(r.matches, ['chests/ancient_city', 'chests/desert_pyramid']);
  assert.equal(r.total, 2);
});

test('getVanillaFile returns one file or a clean miss', () => {
  const hit = getVanillaFile('26.2', 'loot_table', 'chests/ancient_city', loader);
  assert.equal(hit.ok, true);
  assert.deepEqual(hit.file, fixture['chests/ancient_city']);

  const miss = getVanillaFile('26.2', 'loot_table', 'nope', loader);
  assert.equal(miss.ok, false);
  assert.match(miss.error, /No "nope" in loot_table/);
});

test('uncached real cache read degrades to ok:false with a helpful error (zero network)', () => {
  const r = getVanillaFiles('0.0.none', 'loot_table');
  assert.equal(r.ok, false);
  assert.match(r.error, /No vanilla loot_table data cached/);
});
