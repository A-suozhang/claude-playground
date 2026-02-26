// Map Engine module: Pure functions for grid/map operations
// Dependencies: None

/**
 * Build a map structure with tiles and adjacency graph
 * @param {number} size - Grid size (e.g., 3 for 3x3)
 * @returns {Object} Map object with size, tiles array, and adjacency graph
 */
function buildMap(size) {
  const tiles = [];

  // Create all tiles in the grid
  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const key = `${row},${col}`;
      const isCenterTile = row === Math.floor(size / 2) && col === Math.floor(size / 2);

      tiles.push({
        key: key,
        row: row,
        col: col,
        type: isCenterTile ? 'start' : 'normal',
        word: null,
        revealed: isCenterTile,
        isAmulet: false
      });
    }
  }

  const adjacency = computeAdjacency(size);

  return {
    size: size,
    tiles: tiles,
    adjacency: adjacency
  };
}

/**
 * Compute adjacency graph for hexagonal grid (6 neighbors)
 * Using offset coordinates: even-q layout
 * @param {number} size - Grid size
 * @returns {Object} Adjacency map: {cellKey: Array<adjacentCellKeys>}
 */
function computeAdjacency(size) {
  const adjacency = {};

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const key = `${row},${col}`;
      adjacency[key] = [];

      // Hexagonal neighbors (even-q offset coordinates)
      // 6 directions for hexagons
      const directions = col % 2 === 0 ? [
        [-1, -1], [-1, 0],  // top-left, top-right
        [0, -1],  [0, 1],   // left, right
        [1, -1],  [1, 0]    // bottom-left, bottom-right
      ] : [
        [-1, 0],  [-1, 1],  // top-left, top-right
        [0, -1],  [0, 1],   // left, right
        [1, 0],   [1, 1]    // bottom-left, bottom-right
      ];

      directions.forEach(([dRow, dCol]) => {
        const newRow = row + dRow;
        const newCol = col + dCol;

        if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size) {
          adjacency[key].push(`${newRow},${newCol}`);
        }
      });
    }
  }

  return adjacency;
}

/**
 * Get the center tile key for a given grid size
 * @param {number} size - Grid size
 * @returns {string} Center key (e.g., "1,1" for 3x3)
 */
function getCenterKey(size) {
  const center = Math.floor(size / 2);
  return `${center},${center}`;
}

/**
 * Place special amulet tiles on the map (mutates tiles in-place)
 * @param {Array<Object>} tiles - Tiles array
 * @param {number} amuletCount - Number of amulets to place
 * @returns {void}
 */
function placeSpecialTiles(tiles, amuletCount) {
  // Get all non-center tiles
  const availableTiles = tiles.filter(tile => tile.type !== 'start');

  // Randomly select positions for amulets
  const shuffled = [...availableTiles].sort(() => Math.random() - 0.5);

  for (let i = 0; i < Math.min(amuletCount, shuffled.length); i++) {
    shuffled[i].isAmulet = true;
  }
}

/**
 * Get all cells that are currently unlocked (revealed or adjacent to revealed)
 * @param {Array<Object>} tiles - Tiles array
 * @param {Object} adjacency - Adjacency graph
 * @returns {Array<string>} Array of unlocked cell keys
 */
function getUnlockedCells(tiles, adjacency) {
  const unlocked = new Set();

  // Find all revealed tiles
  const revealedTiles = tiles.filter(tile => tile.revealed);

  // Add all revealed tiles
  revealedTiles.forEach(tile => {
    unlocked.add(tile.key);
  });

  // Add all tiles adjacent to revealed tiles
  revealedTiles.forEach(tile => {
    adjacency[tile.key].forEach(neighborKey => {
      unlocked.add(neighborKey);
    });
  });

  return Array.from(unlocked);
}

/**
 * Check if a cell is adjacent to a revealed cell
 * @param {string} cellKey - Cell key to check
 * @param {Array<Object>} tiles - Tiles array
 * @param {Object} adjacency - Adjacency graph
 * @returns {boolean} True if adjacent to revealed cell
 */
function isAdjacentToRevealed(cellKey, tiles, adjacency) {
  const revealedTiles = tiles.filter(tile => tile.revealed);
  return revealedTiles.some(revealed => adjacency[revealed.key].includes(cellKey));
}

/**
 * Place a word tile on the map at a specific cell
 * Only succeeds if the cell is adjacent to a revealed cell (or is already revealed)
 * @param {Array<Object>} tiles - Tiles array
 * @param {Object} adjacency - Adjacency graph
 * @param {string} cellKey - Target cell key
 * @param {Object} word - Word object to place
 * @returns {Array<Object>|null} Updated tiles array if successful, null otherwise
 */
function placeTile(tiles, adjacency, cellKey, word) {
  const cell = getTile(tiles, cellKey);

  // Cell doesn't exist
  if (!cell) {
    return null;
  }

  // Cell already revealed (word already placed)
  if (cell.revealed) {
    return null;
  }

  // Cell is not adjacent to any revealed cell
  if (!isAdjacentToRevealed(cellKey, tiles, adjacency) && cell.type !== 'start') {
    return null;
  }

  // Place the word and mark as revealed
  cell.word = word;
  cell.revealed = true;

  return tiles;
}

/**
 * Check if all target words have been found on the map
 * @param {Array<Object>} targetWords - Target word objects
 * @param {Array<Object>} tiles - Tiles array
 * @returns {boolean} True if all targets have been revealed
 */
function allTargetsFound(targetWords, tiles) {
  const revealedWords = new Set();

  tiles.forEach(tile => {
    if (tile.revealed && tile.word) {
      revealedWords.add(tile.word.id);
    }
  });

  return targetWords.every(target => revealedWords.has(target.id));
}

/**
 * Get a tile by its key
 * @param {Array<Object>} tiles - Tiles array
 * @param {string} cellKey - Cell key to find
 * @returns {Object|null} Tile object if found, null otherwise
 */
function getTile(tiles, cellKey) {
  return tiles.find(tile => tile.key === cellKey) || null;
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildMap,
    computeAdjacency,
    getCenterKey,
    placeSpecialTiles,
    getUnlockedCells,
    isAdjacentToRevealed,
    placeTile,
    allTargetsFound,
    getTile
  };
}
