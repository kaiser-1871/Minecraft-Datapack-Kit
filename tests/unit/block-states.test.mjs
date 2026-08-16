// block-states.test.mjs — pure parsing + cache-degrade behavior for block states.
// Zero network: parse functions and read functions are fed inline fixtures via the injectable
// loader; the only real-cache assertion is the uncached-version degrade path.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseBlockStatesEntry, parseBlockStates, loadBlockStates, listBlockStates, getBlockStates,
} from '../../dist/block-states.js';

const fixture = {
  oak_stairs: [
    { facing: ['north', 'south', 'west', 'east'], half: ['top', 'bottom'], waterlogged: ['true', 'false'] },
    { facing: 'north', half: 'bottom', waterlogged: 'false' },
  ],
  stone: [{}, {}],
  redstone_wire: [{ power: [0, 1, 2, 3] }, { power: 0 }],
  broken: 'nope',
};

const loader = (url) => {
  assert.match(url, /block_states$/);
  return fixture;
};

test('parseBlockStatesEntry converts a real-shaped entry to { properties, defaults }', () => {
  assert.deepEqual(parseBlockStatesEntry(fixture.oak_stairs), {
    properties: { facing: ['north', 'south', 'west', 'east'], half: ['top', 'bottom'], waterlogged: ['true', 'false'] },
    defaults: { facing: 'north', half: 'bottom', waterlogged: 'false' },
  });
});

test('parseBlockStatesEntry coerces numeric values to strings', () => {
  assert.deepEqual(parseBlockStatesEntry([{ power: [0, 1, 2] }, { power: 0 }]), {
    properties: { power: ['0', '1', '2'] },
    defaults: { power: '0' },
  });
});

test('parseBlockStatesEntry accepts property-less blocks ([{},{}])', () => {
  assert.deepEqual(parseBlockStatesEntry([{}, {}]), { properties: {}, defaults: {} });
});

test('parseBlockStatesEntry rejects malformed shapes', () => {
  assert.equal(parseBlockStatesEntry(null), null);
  assert.equal(parseBlockStatesEntry('nope'), null);
  assert.equal(parseBlockStatesEntry({}), null);
  assert.equal(parseBlockStatesEntry(['x', {}]), null);             // properties not an object
  assert.equal(parseBlockStatesEntry([{}, 'x']), null);             // defaults not an object
  assert.equal(parseBlockStatesEntry([{ a: 'not-array' }, {}]), null); // values not an array
});

test('parseBlockStates keeps valid entries (incl. property-less) and skips malformed', () => {
  const data = parseBlockStates(fixture);
  assert.deepEqual(Object.keys(data).sort(), ['oak_stairs', 'redstone_wire', 'stone']);
  assert.deepEqual(data.stone, { properties: {}, defaults: {} });
  assert.deepEqual(data.redstone_wire.properties.power, ['0', '1', '2', '3']);
});

test('getBlockStates looks up a block, strips minecraft: prefix, undefined for unknown', () => {
  const expected = {
    properties: { facing: ['north', 'south', 'west', 'east'], half: ['top', 'bottom'], waterlogged: ['true', 'false'] },
    defaults: { facing: 'north', half: 'bottom', waterlogged: 'false' },
  };
  assert.deepEqual(getBlockStates('1.21.4', 'minecraft:oak_stairs', loader), expected);
  assert.deepEqual(getBlockStates('1.21.4', 'oak_stairs', loader), expected);
  assert.equal(getBlockStates('1.21.4', 'nope', loader), undefined);
});

test('listBlockStates returns sorted bare ids', () => {
  assert.deepEqual(listBlockStates('1.21.4', loader), ['oak_stairs', 'redstone_wire', 'stone']);
});

test('uncached version degrades gracefully against the real cache (zero network)', () => {
  assert.deepEqual(loadBlockStates('0.0.none'), {});
  assert.deepEqual(listBlockStates('0.0.none'), []);
  assert.equal(getBlockStates('0.0.none', 'stone'), undefined);
});
