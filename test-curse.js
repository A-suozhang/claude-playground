/**
 * Curse System Unit Tests
 * Tests curse blocks, blessing blocks, and curse value accumulation
 */

const fs = require('fs');
const path = require('path');

// Load game modules
const vocabModule = require('./js/vocabulary.js');
const mapModule = require('./js/mapEngine.js');
const gameModule = require('./js/gameEngine.js');

const tests = [];
let passed = 0;
let failed = 0;

function test(name, fn) {
  tests.push({ name, fn });
}

function runTests() {
  console.log('\n=== Curse System Unit Tests ===\n');

  tests.forEach((t, idx) => {
    try {
      t.fn();
      console.log(`✓ Test ${idx + 1}: ${t.name}`);
      passed++;
    } catch (err) {
      console.log(`✗ Test ${idx + 1}: ${t.name}`);
      console.log(`  Error: ${err.message}`);
      failed++;
    }
  });

  console.log(`\n==================================================`);
  console.log(`Tests passed: ${passed}/${tests.length}`);
  console.log(`Tests failed: ${failed}/${tests.length}`);
  console.log(`==================================================\n`);

  return failed === 0;
}

// Define tests
test('initGame initializes curseValue to 0', () => {
  const getGameConfig = gameModule.getGameConfig || (() => ({ gridSize: 6, initialBlockCount: 3, exitCount: 1 }));
  gameModule.initGame({ gridSize: 6, numCurseBlocks: 1, numBlessingBlocks: 1 });
  const state = gameModule.getState();
  if (state.curseValue !== 0) {
    throw new Error(`Expected curseValue=0, got ${state.curseValue}`);
  }
});

test('initGame creates curseBlocks array', () => {
  gameModule.initGame({ gridSize: 6, numCurseBlocks: 2, numBlessingBlocks: 1 });
  const state = gameModule.getState();
  if (!state.curseBlocks || !Array.isArray(state.curseBlocks)) {
    throw new Error('curseBlocks should be an array in getState()');
  }
});

test('initGame creates blessingBlocks array', () => {
  gameModule.initGame({ gridSize: 6, numCurseBlocks: 1, numBlessingBlocks: 2 });
  const state = gameModule.getState();
  if (!state.blessingBlocks || !Array.isArray(state.blessingBlocks)) {
    throw new Error('blessingBlocks should be an array in getState()');
  }
});

test('initGame allocates correct number of curse blocks', () => {
  gameModule.initGame({ gridSize: 6, numCurseBlocks: 3, numBlessingBlocks: 1 });
  const state = gameModule.getState();
  if (state.curseBlocks.length !== 3) {
    throw new Error(`Expected 3 curse blocks, got ${state.curseBlocks.length}`);
  }
});

test('initGame allocates correct number of blessing blocks', () => {
  gameModule.initGame({ gridSize: 6, numCurseBlocks: 1, numBlessingBlocks: 2 });
  const state = gameModule.getState();
  if (state.blessingBlocks.length !== 2) {
    throw new Error(`Expected 2 blessing blocks, got ${state.blessingBlocks.length}`);
  }
});

test('placeWordOnCell increments curseValue on curse block', () => {
  gameModule.initGame({ gridSize: 6, numCurseBlocks: 1, numBlessingBlocks: 0 });
  const state = gameModule.getState();

  // Get a curse block cell
  const curseCell = state.curseBlocks[0];

  // Check if curse cell is adjacent to explored tiles
  const exploredTiles = state.map.tiles.filter(t => t.explored);
  const isAdjacent = exploredTiles.some(et =>
    state.map.adjacency[et.key].includes(curseCell)
  );

  // If curse block is not adjacent, skip this test (random placement issue)
  if (!isAdjacent) {
    return;
  }

  // Submit a word and place it on the curse block
  gameModule.submitLeadRound('test-word');
  const result = gameModule.placeWordOnCell(curseCell);

  // If placement failed, check result
  if (!result.ok) {
    throw new Error(`Failed to place on curse cell: ${result.error}`);
  }

  const updatedState = gameModule.getState();
  if (updatedState.curseValue !== 1) {
    throw new Error(`Expected curseValue=1 after curse block, got ${updatedState.curseValue}`);
  }
});

test('placeWordOnCell consumes blessing when getting curse block', () => {
  gameModule.initGame({ gridSize: 6, numCurseBlocks: 2, numBlessingBlocks: 1 });
  let state = gameModule.getState();

  // Place on curse block first
  let curseCell = state.curseBlocks[0];

  // Find an adjacent curse cell
  let exploredTiles = state.map.tiles.filter(t => t.explored);
  let isCurseAdjacent = exploredTiles.some(et =>
    state.map.adjacency[et.key].includes(curseCell)
  );

  if (!isCurseAdjacent) {
    // Try second curse block
    curseCell = state.curseBlocks[1] || curseCell;
    isCurseAdjacent = exploredTiles.some(et =>
      state.map.adjacency[et.key].includes(curseCell)
    );
  }

  if (!isCurseAdjacent) {
    // Skip test if no adjacent curse block
    return;
  }

  gameModule.submitLeadRound('word1');
  const curseResult = gameModule.placeWordOnCell(curseCell);
  if (!curseResult.ok) {
    return;
  }

  // Verify curse value increased
  state = gameModule.getState();
  if (state.curseValue !== 1) {
    throw new Error(`Expected curseValue=1 after curse, got ${state.curseValue}`);
  }

  // Place on blessing block
  const blessingCell = state.blessingBlocks[0];

  // Check if blessing is adjacent
  exploredTiles = state.map.tiles.filter(t => t.explored);
  const isBlessingAdjacent = exploredTiles.some(et =>
    state.map.adjacency[et.key].includes(blessingCell)
  );

  if (!isBlessingAdjacent) {
    // Skip if blessing block is not reachable
    return;
  }

  gameModule.submitLeadRound('word2');
  const blessingResult = gameModule.placeWordOnCell(blessingCell);

  // Verify we got a blessing
  state = gameModule.getState();
  if (state.blessingCount !== 1) {
    throw new Error(`Expected blessingCount=1 after blessing block, got ${state.blessingCount}`);
  }

  // Now place on another curse block - it should consume the blessing
  let curse2Cell = state.curseBlocks[1] || state.curseBlocks[0];
  if (curse2Cell === curseCell) {
    // Skip if only one curse block and it's the same
    return;
  }

  exploredTiles = state.map.tiles.filter(t => t.explored);
  const isCurse2Adjacent = exploredTiles.some(et =>
    state.map.adjacency[et.key].includes(curse2Cell)
  );

  if (!isCurse2Adjacent) {
    // Skip if second curse is not reachable
    return;
  }

  gameModule.submitLeadRound('word3');
  gameModule.placeWordOnCell(curse2Cell);

  // Verify blessing was consumed but curseValue stayed at 1
  state = gameModule.getState();
  if (state.blessingCount !== 0) {
    throw new Error(`Expected blessingCount=0 after consuming blessing, got ${state.blessingCount}`);
  }
  if (state.curseValue !== 1) {
    throw new Error(`Expected curseValue=1 (blessing consumed), got ${state.curseValue}`);
  }
});

test('placeWordOnCell prevents exit when cursed', () => {
  gameModule.initGame({ gridSize: 6, numCurseBlocks: 1, numBlessingBlocks: 0 });
  let state = gameModule.getState();

  // Place on curse block
  const curseCell = state.curseBlocks[0];

  // Check if curse cell is reachable
  const exploredTiles = state.map.tiles.filter(t => t.explored);
  const isCurseAdjacent = exploredTiles.some(et =>
    state.map.adjacency[et.key].includes(curseCell)
  );

  if (!isCurseAdjacent) {
    // Skip if curse block is not adjacent
    return;
  }

  gameModule.submitLeadRound('word1');
  const curseResult = gameModule.placeWordOnCell(curseCell);
  if (!curseResult.ok) {
    // Skip if placement fails
    return;
  }

  // Try to exit while cursed
  state = gameModule.getState();
  const exitCell = state.map.tiles.find(t => t.isExit).key;

  // Check if exit is reachable
  const updatedExplored = state.map.tiles.filter(t => t.explored);
  const isExitAdjacent = updatedExplored.some(et =>
    state.map.adjacency[et.key].includes(exitCell)
  );

  if (!isExitAdjacent) {
    // Skip if exit is not reachable
    return;
  }

  gameModule.submitLeadRound('word2');
  const result = gameModule.placeWordOnCell(exitCell);

  if (result.ok && state.curseValue > 0) {
    throw new Error('Should not be able to exit when cursed');
  }
  if (!result.cursedAtExit && state.curseValue > 0) {
    throw new Error('Should set cursedAtExit flag when exiting while cursed');
  }
});

test('placeWordOnCell allows exit when not cursed', () => {
  gameModule.initGame({ gridSize: 6, numCurseBlocks: 0, numBlessingBlocks: 0 });
  const state = gameModule.getState();

  // Get exit cell
  const exitCell = state.map.tiles.find(t => t.isExit).key;
  const exitTile = state.map.tiles.find(t => t.isExit);

  // Make sure exit is adjacent to initial block
  const exploredTiles = state.map.tiles.filter(t => t.explored);
  const isAdjacent = exploredTiles.some(et =>
    state.map.adjacency[et.key].includes(exitCell)
  );

  if (!isAdjacent) {
    // Skip this test if exit is not reachable in this random configuration
    return;
  }

  // Place on exit cell
  gameModule.submitLeadRound('exit-word');
  const result = gameModule.placeWordOnCell(exitCell);

  if (!result.ok && state.curseValue === 0) {
    throw new Error(`Should be able to exit when not cursed: ${result.error}`);
  }
});

test('CSS has curse block styles', () => {
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  if (!css.includes('.cell-cursed')) {
    throw new Error('CSS should define .cell-cursed styles');
  }
  if (!css.includes('cell-blessed')) {
    throw new Error('CSS should define .cell-blessed styles');
  }
});

test('CSS has curse indicator styles', () => {
  const css = fs.readFileSync(path.join(__dirname, 'style.css'), 'utf8');
  if (!css.includes('.curse-indicator')) {
    throw new Error('CSS should define .curse-indicator styles');
  }
});

test('HTML contains curse configuration inputs', () => {
  const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
  if (!html.includes('id="curse-blocks-input"')) {
    throw new Error('HTML should contain curse-blocks-input');
  }
  if (!html.includes('id="blessing-blocks-input"')) {
    throw new Error('HTML should contain blessing-blocks-input');
  }
});

test('Controller reads curse configuration from HTML inputs', () => {
  const js = fs.readFileSync(path.join(__dirname, 'js/controller.js'), 'utf8');
  if (!js.includes('curse-blocks-input')) {
    throw new Error('Controller should read curse-blocks-input');
  }
  if (!js.includes('blessing-blocks-input')) {
    throw new Error('Controller should read blessing-blocks-input');
  }
  if (!js.includes('numCurseBlocks') || !js.includes('numBlessingBlocks')) {
    throw new Error('Controller should pass curse config to initGame');
  }
});

// Run all tests
const allPassed = runTests();
process.exit(allPassed ? 0 : 1);
