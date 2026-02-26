// Map Engine module tests

const mapEngine = require('../js/mapEngine.js');
const {
  buildMap,
  computeAdjacency,
  getCenterKey,
  placeSpecialTiles,
  getUnlockedCells,
  isAdjacentToRevealed,
  placeTile,
  allTargetsFound,
  getTile
} = mapEngine;

// Simple test framework
let testCount = 0;
let passCount = 0;
let failCount = 0;

function test(name, fn) {
  testCount++;
  try {
    fn();
    console.log(`✓ Test ${testCount}: ${name}`);
    passCount++;
  } catch (error) {
    console.log(`✗ Test ${testCount}: ${name}`);
    console.log(`  Error: ${error.message}`);
    failCount++;
  }
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertEqual(actual, expected, message) {
  if (actual !== expected) {
    throw new Error(`${message}\n  Expected: ${expected}\n  Got: ${actual}`);
  }
}

function assertArrayIncludes(arr, value, message) {
  if (!arr.includes(value)) {
    throw new Error(`${message}\n  Array does not include: ${value}`);
  }
}

function assertArrayLength(arr, length, message) {
  if (!Array.isArray(arr) || arr.length !== length) {
    throw new Error(`${message}\n  Expected length: ${length}\n  Got: ${arr ? arr.length : 'not an array'}`);
  }
}

// ============ Tests ============

test('buildMap creates correct structure for 3x3', () => {
  const map = buildMap(3);
  assert(map.tiles, 'Should have tiles array');
  assert(map.adjacency, 'Should have adjacency graph');
  assertEqual(map.size, 3, 'Should set size to 3');
  assertArrayLength(map.tiles, 9, 'Should have 9 tiles for 3x3 grid');
});

test('buildMap center tile is marked as start and revealed', () => {
  const map = buildMap(3);
  const centerTile = getTile(map.tiles, '1,1');

  assert(centerTile, 'Should find center tile');
  assertEqual(centerTile.type, 'start', 'Center should be type "start"');
  assert(centerTile.revealed, 'Center should be revealed initially');
});

test('buildMap non-center tiles are marked as normal and unrevealed', () => {
  const map = buildMap(3);
  const nonCenterTile = getTile(map.tiles, '0,0');

  assert(nonCenterTile, 'Should find tile');
  assertEqual(nonCenterTile.type, 'normal', 'Non-center should be type "normal"');
  assert(!nonCenterTile.revealed, 'Non-center should not be revealed initially');
});

test('computeAdjacency creates correct graph', () => {
  const adjacency = computeAdjacency(3);

  // Center tile should have 4 neighbors
  assertArrayLength(adjacency['1,1'], 4, 'Center should have 4 neighbors');

  // Corner tile should have 2 neighbors
  assertArrayLength(adjacency['0,0'], 2, 'Corner should have 2 neighbors');

  // Edge (non-corner) tile should have 3 neighbors
  assertArrayLength(adjacency['0,1'], 3, 'Edge should have 3 neighbors');
});

test('computeAdjacency neighbors are correct for center', () => {
  const adjacency = computeAdjacency(3);
  const neighbors = adjacency['1,1'];

  assertArrayIncludes(neighbors, '0,1', 'Should include upper neighbor');
  assertArrayIncludes(neighbors, '2,1', 'Should include lower neighbor');
  assertArrayIncludes(neighbors, '1,0', 'Should include left neighbor');
  assertArrayIncludes(neighbors, '1,2', 'Should include right neighbor');
});

test('getCenterKey returns correct key for 3x3', () => {
  const key = getCenterKey(3);
  assertEqual(key, '1,1', 'Should return "1,1" for 3x3');
});

test('getCenterKey returns correct key for 5x5', () => {
  const key = getCenterKey(5);
  assertEqual(key, '2,2', 'Should return "2,2" for 5x5');
});

test('getCenterKey returns correct key for 7x7', () => {
  const key = getCenterKey(7);
  assertEqual(key, '3,3', 'Should return "3,3" for 7x7');
});

test('placeSpecialTiles marks amulets on tiles', () => {
  const map = buildMap(3);
  placeSpecialTiles(map.tiles, 2);

  const amuletCount = map.tiles.filter(tile => tile.isAmulet).length;
  assertEqual(amuletCount, 2, 'Should have 2 amulet tiles');
});

test('placeSpecialTiles does not mark center as amulet', () => {
  const map = buildMap(3);
  placeSpecialTiles(map.tiles, 8);  // Try to mark all tiles

  const centerTile = getTile(map.tiles, '1,1');
  assert(!centerTile.isAmulet, 'Center should not be marked as amulet');
});

test('getUnlockedCells initially returns center + neighbors', () => {
  const map = buildMap(3);
  const unlocked = getUnlockedCells(map.tiles, map.adjacency);

  // Center (1,1) + 4 neighbors = 5 cells
  assertArrayLength(unlocked, 5, 'Should have 5 unlocked cells initially');
  assertArrayIncludes(unlocked, '1,1', 'Should include center');
  assertArrayIncludes(unlocked, '0,1', 'Should include upper neighbor');
});

test('isAdjacentToRevealed returns true for neighbors of center', () => {
  const map = buildMap(3);

  const isAdjacent = isAdjacentToRevealed('0,1', map.tiles, map.adjacency);
  assert(isAdjacent, 'Upper neighbor should be adjacent to center');
});

test('isAdjacentToRevealed returns false for non-adjacent cells', () => {
  const map = buildMap(3);

  const isAdjacent = isAdjacentToRevealed('0,0', map.tiles, map.adjacency);
  assert(!isAdjacent, 'Corner should not be adjacent to center');
});

test('placeTile successfully places word on adjacent cell', () => {
  const map = buildMap(3);
  const word = { id: 'test1', zh: '测试', en: 'Test' };

  const result = placeTile(map.tiles, map.adjacency, '0,1', word);
  assert(result !== null, 'Should succeed placing on adjacent cell');

  const tile = getTile(map.tiles, '0,1');
  assert(tile.revealed, 'Tile should be marked as revealed');
  assertEqual(tile.word.id, 'test1', 'Word should be placed on tile');
});

test('placeTile returns null if cell not adjacent', () => {
  const map = buildMap(3);
  const word = { id: 'test1', zh: '测试', en: 'Test' };

  const result = placeTile(map.tiles, map.adjacency, '0,0', word);
  assert(result === null, 'Should fail placing on non-adjacent cell');
});

test('placeTile returns null if cell already revealed', () => {
  const map = buildMap(3);
  const word1 = { id: 'test1', zh: '测试', en: 'Test' };
  const word2 = { id: 'test2', zh: '测试2', en: 'Test2' };

  // Place first word on center
  placeTile(map.tiles, map.adjacency, '1,1', word1);

  // Try to place second word on same cell
  const result = placeTile(map.tiles, map.adjacency, '1,1', word2);
  assert(result === null, 'Should fail placing on already revealed cell');
});

test('placeTile on start tile (already revealed) returns null', () => {
  const map = buildMap(3);
  const word = { id: 'test1', zh: '测试', en: 'Test' };

  const result = placeTile(map.tiles, map.adjacency, '1,1', word);
  assert(result === null, 'Should fail placing on start tile');
});

test('getTile finds existing tile', () => {
  const map = buildMap(3);
  const tile = getTile(map.tiles, '0,0');

  assert(tile !== null, 'Should find tile');
  assertEqual(tile.row, 0, 'Should have correct row');
  assertEqual(tile.col, 0, 'Should have correct col');
});

test('getTile returns null for non-existent key', () => {
  const map = buildMap(3);
  const tile = getTile(map.tiles, '9,9');

  assert(tile === null, 'Should return null for non-existent tile');
});

test('allTargetsFound returns false initially', () => {
  const map = buildMap(3);
  const targets = [
    { id: 'word1', zh: '词1', en: 'Word1' },
    { id: 'word2', zh: '词2', en: 'Word2' }
  ];

  const found = allTargetsFound(targets, map.tiles);
  assert(!found, 'Should not find targets initially');
});

test('allTargetsFound returns true when all targets are revealed', () => {
  const map = buildMap(3);
  const targets = [
    { id: 'word1', zh: '词1', en: 'Word1' },
    { id: 'word2', zh: '词2', en: 'Word2' }
  ];

  // Place targets on tiles
  placeTile(map.tiles, map.adjacency, '0,1', targets[0]);
  placeTile(map.tiles, map.adjacency, '0,2', targets[1]);

  const found = allTargetsFound(targets, map.tiles);
  assert(found, 'Should find all targets when placed');
});

test('allTargetsFound returns false if not all targets are revealed', () => {
  const map = buildMap(3);
  const targets = [
    { id: 'word1', zh: '词1', en: 'Word1' },
    { id: 'word2', zh: '词2', en: 'Word2' },
    { id: 'word3', zh: '词3', en: 'Word3' }
  ];

  // Place only two targets
  placeTile(map.tiles, map.adjacency, '0,1', targets[0]);
  placeTile(map.tiles, map.adjacency, '0,2', targets[1]);

  const found = allTargetsFound(targets, map.tiles);
  assert(!found, 'Should not find all targets if only some are placed');
});

// ============ Summary ============
console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${passCount}/${testCount}`);
console.log(`Tests failed: ${failCount}/${testCount}`);
console.log('='.repeat(50));

process.exit(failCount > 0 ? 1 : 0);
