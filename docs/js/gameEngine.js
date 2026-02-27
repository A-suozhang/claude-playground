// Game Engine module: Game state management and logic loop
// New rules: Lead Captain provides description, Team member assigns word to cell
// Dependencies: vocabulary.js, mapEngine.js

// Load dependencies in Node.js environment
let vocabulary_funcs, mapEngine_funcs;

if (typeof module !== 'undefined' && module.exports) {
  vocabulary_funcs = require('./vocabulary.js');
  mapEngine_funcs = require('./mapEngine.js');
}

// Game state - single source of truth
let STATE = null;

/**
 * Initialize a new game
 * @param {Object} options - Game options {gridSize, initialBlockCount, exitCount}
 * @returns {void}
 */
function initGame(options = {}) {
  const getGameConfig = (typeof module !== 'undefined' && module.exports)
    ? vocabulary_funcs.getGameConfig
    : window.getGameConfig;

  const gameConfig = getGameConfig();

  // Merge with provided options
  const gridSize = options.gridSize || gameConfig.gridSize;
  const initialBlockCount = options.initialBlockCount || gameConfig.initialBlockCount;
  const exitCount = options.exitCount || gameConfig.exitCount;

  // Get functions from appropriate environment
  const funcs = (typeof module !== 'undefined' && module.exports) ? {
    selectTargetWords: vocabulary_funcs.selectTargetWords,
    buildMap: mapEngine_funcs.buildMap,
    getUnlockedCells: mapEngine_funcs.getUnlockedCells,
    getTile: mapEngine_funcs.getTile,
    placeTile: mapEngine_funcs.placeTile
  } : {
    selectTargetWords,
    buildMap,
    getUnlockedCells,
    getTile,
    placeTile
  };

  // Initialize map
  const map = funcs.buildMap(gridSize);

  // Select initial words from vocabulary (only for initialization)
  const initialWords = funcs.selectTargetWords(initialBlockCount);

  // Find initial contiguous block of cells starting from center
  const initialCells = findContiguousBlock(map.adjacency, gridSize, initialBlockCount);

  // Assign initial words to cells
  initialCells.forEach((cellKey, idx) => {
    const tile = funcs.getTile(map.tiles, cellKey);
    if (tile && idx < initialWords.length) {
      tile.word = initialWords[idx].zh;  // Store word as string (not vocabulary object)
      tile.explored = true;
    }
  });

  // Randomly mark some cells as exits
  const exitCells = selectRandomCells(map.tiles, exitCount);
  exitCells.forEach(cellKey => {
    const tile = funcs.getTile(map.tiles, cellKey);
    if (tile) {
      tile.isExit = true;
    }
  });

  // Track used words for prevention of duplicates
  const usedWords = new Set(initialWords.map(w => w.zh));

  // Randomly select curse and blessing blocks
  const curseBlocks = new Set();
  const blessingBlocks = new Set();
  const numCurseBlocks = options.numCurseBlocks || 1;
  const numBlessingBlocks = options.numBlessingBlocks || 1;

  // Get all non-initial tiles (using actual tile keys from map)
  const initialCellSet = new Set(initialCells);
  const availableCells = map.tiles
    .filter(tile => !initialCellSet.has(tile.key))
    .map(tile => tile.key);

  // Randomly select curse blocks
  for (let i = 0; i < Math.min(numCurseBlocks, availableCells.length); i++) {
    const idx = Math.floor(Math.random() * availableCells.length);
    const cellKey = availableCells[idx];
    curseBlocks.add(cellKey);
    availableCells.splice(idx, 1);
  }

  // Randomly select blessing blocks (from remaining cells)
  for (let i = 0; i < Math.min(numBlessingBlocks, availableCells.length); i++) {
    const idx = Math.floor(Math.random() * availableCells.length);
    const cellKey = availableCells[idx];
    blessingBlocks.add(cellKey);
    availableCells.splice(idx, 1);
  }

  // Mark curse and blessing tiles
  curseBlocks.forEach(cellKey => {
    const tile = funcs.getTile(map.tiles, cellKey);
    if (tile) tile.isCursed = true;
  });

  blessingBlocks.forEach(cellKey => {
    const tile = funcs.getTile(map.tiles, cellKey);
    if (tile) tile.isBlessed = true;
  });

  STATE = {
    phase: 'playing',                    // 'playing' | 'won' | 'lost'
    gameMode: 'lead',                    // 'lead' (captain describes) | 'guess' (member assigns)
    map: map,
    roundCount: 0,
    usedWords: usedWords,
    curseValue: 0,                       // Current curse accumulation
    blessingCount: 0,                    // Number of blessings (amulets) collected
    numCurseBlocks: numCurseBlocks,      // Configuration: how many curse blocks
    numBlessingBlocks: numBlessingBlocks,// Configuration: how many blessing blocks
    curseBlocks: curseBlocks,            // Set of cell keys that are curse blocks
    blessingBlocks: blessingBlocks,      // Set of cell keys that are blessing blocks
    currentRound: {
      leadDescription: null,             // Description from captain
      word: null,                        // Word to be assigned (input by member)
      selectedCell: null                 // Cell selected by member
    },
    roundHistory: [],
    config: {
      gridSize: gridSize,
      initialBlockCount: initialBlockCount,
      exitCount: exitCount
    }
  };
}

/**
 * Find a contiguous block of connected cells starting from center
 * For blockSize=3, ensures all pairs are adjacent (forms a triangle)
 * @param {Object} adjacency - Adjacency map
 * @param {number} gridSize - Grid size
 * @param {number} blockSize - Number of cells needed
 * @returns {Array<string>} Array of cell keys in contiguous block
 */
function findContiguousBlock(adjacency, gridSize, blockSize) {
  const centerRow = Math.floor(gridSize / 2);
  const centerCol = Math.floor(gridSize / 2);
  const centerKey = `${centerRow},${centerCol}`;

  // For blockSize=3, find two neighbors of center that are also adjacent to each other
  if (blockSize === 3) {
    const neighbors = adjacency[centerKey];
    for (let i = 0; i < neighbors.length; i++) {
      for (let j = i + 1; j < neighbors.length; j++) {
        if (adjacency[neighbors[i]].includes(neighbors[j])) {
          return [centerKey, neighbors[i], neighbors[j]];
        }
      }
    }
  }

  // BFS for other sizes
  const block = [centerKey];
  const visited = new Set([centerKey]);

  while (block.length < blockSize) {
    const candidates = [];

    block.forEach(cellKey => {
      adjacency[cellKey].forEach(neighbor => {
        if (!visited.has(neighbor)) {
          candidates.push(neighbor);
          visited.add(neighbor);
        }
      });
    });

    if (candidates.length === 0) break;

    const nextCell = candidates[Math.floor(Math.random() * candidates.length)];
    block.push(nextCell);
  }

  return block;
}

/**
 * Select N random cells from the map (excluding explored cells)
 * @param {Array<Object>} tiles - Tiles array
 * @param {number} count - Number of cells to select
 * @returns {Array<string>} Array of selected cell keys
 */
function selectRandomCells(tiles, count) {
  const unexploredTiles = tiles.filter(tile => !tile.explored);
  const shuffled = [...unexploredTiles].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count).map(tile => tile.key);
}

/**
 * Submit word from the lead captain
 * @param {string} word - Word/term
 * @returns {Object} {ok: boolean, error?: string}
 */
function submitLeadRound(word) {
  if (!STATE) return { ok: false, error: '游戏未初始化' };

  if (STATE.gameMode !== 'lead') {
    return { ok: false, error: '当前不是领队阶段' };
  }

  // Validate word
  if (!word || word.trim() === '') {
    return { ok: false, error: '请输入词汇' };
  }

  word = word.trim();

  // Check word uniqueness
  if (STATE.usedWords.has(word)) {
    return { ok: false, error: `"${word}"已经被使用过，请输入不同的词汇` };
  }

  STATE.currentRound.word = word;
  STATE.gameMode = 'guess';  // Switch to member placement phase

  return { ok: true };
}

/**
 * Place word on a cell (member selects the placement location)
 * @param {string} cellKey - Cell to place the word on
 * @returns {Object} {ok: boolean, error?: string, exitReached?: boolean, newPhase?: string}
 */
function placeWordOnCell(cellKey) {
  if (!STATE) {
    return { ok: false, error: '游戏未初始化' };
  }

  if (STATE.gameMode !== 'guess') {
    return { ok: false, error: '当前不是队员放置阶段' };
  }

  // Validate that word has been provided by captain
  if (!STATE.currentRound.word) {
    return { ok: false, error: '领队还未提供词汇' };
  }

  // Get getTile function
  const getTileFn = (typeof module !== 'undefined' && module.exports)
    ? mapEngine_funcs.getTile
    : getTile;

  // Validate cell
  const tile = getTileFn(STATE.map.tiles, cellKey);
  if (!tile) {
    return { ok: false, error: '选择的位置不存在' };
  }

  if (tile.explored) {
    return { ok: false, error: '该位置已经被赋值，请选择未探索的格子' };
  }

  // Check if cell is adjacent to explored cells
  const exploredTiles = STATE.map.tiles.filter(t => t.explored);
  const isAdjacent = exploredTiles.some(t =>
    STATE.map.adjacency[t.key].includes(cellKey)
  );
  if (!isAdjacent) {
    return { ok: false, error: '该位置不相邻已探索区域，请选择相邻格子' };
  }

  // PRE-CHECK: Calculate curse/blessing changes BEFORE modifying state
  // This allows us to reject cursed-at-exit BEFORE marking the tile as explored
  let newCurseValue = STATE.curseValue;
  let newBlessingCount = STATE.blessingCount;

  if (STATE.blessingBlocks.has(cellKey)) {
    // Collect a blessing (amulet) - will be used to negate future curses
    newBlessingCount++;
  } else if (STATE.curseBlocks.has(cellKey)) {
    // Encounter a curse - use blessing if available, otherwise accumulate curse
    if (newBlessingCount > 0) {
      newBlessingCount--;  // Consume one blessing
    } else {
      newCurseValue++;     // Accumulate curse if no blessing available
    }
  }

  // CRITICAL: Check if this is an exit BEFORE modifying tile state
  // If cursed at exit, reject WITHOUT marking explored (so player can try again after collecting blessing)
  if (tile.isExit && newCurseValue > 0) {
    // Change gameMode back to lead phase (user should not continue choosing)
    STATE.gameMode = 'lead';
    STATE.currentRound = {
      leadDescription: null,
      word: null,
      selectedCell: null
    };

    return {
      ok: false,
      error: '你被诅咒缠身，无法离开这个地方！必须先找到护身符消除诅咒。',
      cursedAtExit: true,
      curseValue: newCurseValue
    };
  }

  // NOW it's safe to modify state
  // Place word on cell
  const word = STATE.currentRound.word;

  tile.word = word;
  tile.explored = true;
  STATE.usedWords.add(word);
  STATE.roundCount++;

  // Apply curse/blessing logic (now safe since we checked exit condition first)
  STATE.curseValue = newCurseValue;
  STATE.blessingCount = newBlessingCount;

  // Check if this is an exit (now we know it's not cursed, so it's safe to exit)
  let exitReached = false;
  if (tile.isExit) {
    exitReached = true;
    STATE.phase = 'won';
  }

  // Prepare for next round
  STATE.currentRound = {
    leadDescription: null,
    word: null,
    selectedCell: null
  };
  STATE.gameMode = 'lead';  // Back to lead phase

  return {
    ok: true,
    exitReached: exitReached,
    newPhase: STATE.phase,
    curseValue: STATE.curseValue,
    blessingCount: STATE.blessingCount,
    blessingConsumed: STATE.blessingBlocks.has(cellKey) === false && STATE.curseBlocks.has(cellKey) && newBlessingCount < STATE.blessingCount,
    tile: {
      key: cellKey,
      word: word,
      isCursed: STATE.curseBlocks.has(cellKey),
      isBlessed: STATE.blessingBlocks.has(cellKey)
    }
  };
}

/**
 * Check if member can select a specific cell
 * @param {string} cellKey - Cell key to check
 * @returns {Object} {ok: boolean, error?: string}
 */
function checkCellSelectable(cellKey) {
  if (!STATE) return { ok: false, error: '游戏未初始化' };

  if (STATE.gameMode !== 'guess') {
    return { ok: false, error: '当前不是队员选择阶段' };
  }

  const getTileFn = (typeof module !== 'undefined' && module.exports)
    ? mapEngine_funcs.getTile
    : getTile;

  const tile = getTileFn(STATE.map.tiles, cellKey);
  if (!tile) {
    return { ok: false, error: '该位置不存在' };
  }

  if (tile.explored) {
    return { ok: false, error: '该位置已被赋值' };
  }

  // 直接计算可选范围，避免使用全局getUnlockedCells
  const exploredTiles = STATE.map.tiles.filter(t => t.explored);
  const isAdjacent = exploredTiles.some(t =>
    STATE.map.adjacency[t.key].includes(cellKey)
  );

  if (!isAdjacent) {
    return { ok: false, error: '该位置不可选' };
  }

  return { ok: true };
}

/**
 * Get a copy of the current game state (readonly)
 * @returns {Object} Current STATE object
 */
function getState() {
  if (!STATE) return null;

  // Return a copy with Sets converted to Arrays for serialization
  return {
    phase: STATE.phase,
    gameMode: STATE.gameMode,
    map: STATE.map,
    roundCount: STATE.roundCount,
    usedWords: Array.from(STATE.usedWords),
    curseValue: STATE.curseValue,
    blessingCount: STATE.blessingCount,
    numCurseBlocks: STATE.numCurseBlocks,
    numBlessingBlocks: STATE.numBlessingBlocks,
    curseBlocks: Array.from(STATE.curseBlocks || new Set()),
    blessingBlocks: Array.from(STATE.blessingBlocks || new Set()),
    currentRound: STATE.currentRound,
    roundHistory: STATE.roundHistory,
    config: STATE.config
  };
}

/**
 * Get the internal state for testing (mutable)
 * @returns {Object} Current STATE object
 */
function _getInternalState() {
  return STATE;
}

/**
 * Set internal state for testing purposes
 * @param {Object} newState - State to set
 * @returns {void}
 */
function _setInternalState(newState) {
  STATE = newState;
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    initGame,
    submitLeadRound,
    placeWordOnCell,
    checkCellSelectable,
    getState,
    _getInternalState,
    _setInternalState
  };
}
