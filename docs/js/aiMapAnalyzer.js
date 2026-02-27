// AI Map Analyzer: Pure functions for analyzing map state and candidate cells
// Purpose: Provide map context (geometric + topological distances) to LLM for semantic decision-making

/**
 * Convert offset coordinates (row, col) to pixel coordinates
 * @param {number} row - Row (0-indexed)
 * @param {number} col - Column (0-indexed)
 * @param {number} cellSize - Size of each hex cell in pixels (default 80)
 * @returns {Object} Pixel coordinates {x, y}
 */
function offsetToPixel(row, col, cellSize = 80) {
  // Hexagon layout: rows are offset by half-width
  // Column determines x position (each column is cellSize wide)
  // Row determines y position (with vertical overlap)
  const x = col * cellSize + (row % 2) * (cellSize / 2);
  const y = row * (cellSize * 0.75);  // 75% overlap for hexagons
  return { x, y };
}

/**
 * Calculate Euclidean distance between two cells (geometric distance)
 * @param {string} cellKey1 - First cell (e.g., "2,3")
 * @param {string} cellKey2 - Second cell (e.g., "3,4")
 * @param {number} cellSize - Size of each hex cell in pixels (default 80)
 * @returns {number} Geometric distance in pixels
 */
function geometricDistance(cellKey1, cellKey2, cellSize = 80) {
  const [row1, col1] = cellKey1.split(',').map(Number);
  const [row2, col2] = cellKey2.split(',').map(Number);

  const pos1 = offsetToPixel(row1, col1, cellSize);
  const pos2 = offsetToPixel(row2, col2, cellSize);

  const dx = pos2.x - pos1.x;
  const dy = pos2.y - pos1.y;

  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * BFS to compute step distances from a starting cell to all other cells
 * @param {string} startKey - Starting cell key (e.g., "2,3")
 * @param {Object} adjacency - Adjacency map from map.adjacency
 * @returns {Object} Distance map: {cellKey: stepDistance}
 */
function bfsDistances(startKey, adjacency) {
  const distances = {};
  const queue = [startKey];
  distances[startKey] = 0;

  while (queue.length > 0) {
    const current = queue.shift();
    const neighbors = adjacency[current] || [];

    for (const neighbor of neighbors) {
      if (!(neighbor in distances)) {
        distances[neighbor] = distances[current] + 1;
        queue.push(neighbor);
      }
    }
  }

  return distances;
}

/**
 * Get list of candidate cells (adjacent to explored, not yet explored)
 * @param {Object} state - Current game state
 * @returns {Array} Array of candidate cell keys
 */
function getCandidateCells(state) {
  const candidates = [];
  const explored = new Set();

  // Collect all explored cells
  state.map.tiles.forEach(tile => {
    if (tile.explored) {
      explored.add(tile.key);
    }
  });

  // Find cells adjacent to explored but not yet explored
  for (const cellKey of explored) {
    const neighbors = state.map.adjacency[cellKey] || [];
    for (const neighbor of neighbors) {
      if (!explored.has(neighbor) && !candidates.includes(neighbor)) {
        candidates.push(neighbor);
      }
    }
  }

  return candidates;
}

/**
 * Build context for each candidate cell with both topological and geometric distances
 * Format: For each candidate, show distances to explored words
 * Only include topological distances <= 4 to limit token usage
 *
 * @param {Object} state - Current game state
 * @returns {Object} Mapping from cellKey to array of {word, distance, geometricDistance} pairs
 */
function buildCandidateContexts(state) {
  const contexts = {};
  const candidateCells = getCandidateCells(state);

  // For each candidate cell, compute distances to all explored cells
  for (const candidateKey of candidateCells) {
    const bfsDistancesMap = bfsDistances(candidateKey, state.map.adjacency);
    const wordDistances = [];

    // Collect all explored word-cell pairs with their distances
    for (const tile of state.map.tiles) {
      if (tile.explored && tile.word) {
        const topologicalDistance = bfsDistancesMap[tile.key];
        // Only include if topological distance <= 4 to limit token usage
        if (topologicalDistance !== undefined && topologicalDistance <= 4) {
          // Calculate geometric (Euclidean) distance for more precise ranking
          const geoDistance = geometricDistance(candidateKey, tile.key, 80);

          wordDistances.push({
            word: tile.word,
            distance: topologicalDistance,      // step count (1, 2, 3...)
            geometricDistance: geoDistance,     // pixel-based distance
            cellKey: tile.key
          });
        }
      }
    }

    // Sort by geometric distance for better semantic grouping
    // (cells at similar topological distance but different directions will be separated)
    wordDistances.sort((a, b) => a.geometricDistance - b.geometricDistance);

    contexts[candidateKey] = wordDistances;
  }

  return contexts;
}

/**
 * Get all explored words (for prompt context)
 * @param {Object} state - Current game state
 * @returns {Array} Array of explored word strings
 */
function getExploredWords(state) {
  return state.map.tiles
    .filter(tile => tile.explored && tile.word)
    .map(tile => tile.word);
}

// Export functions for browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    offsetToPixel,
    geometricDistance,
    bfsDistances,
    getCandidateCells,
    buildCandidateContexts,
    getExploredWords
  };
}
