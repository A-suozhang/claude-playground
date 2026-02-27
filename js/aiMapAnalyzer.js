// AI Map Analyzer: Pure functions for analyzing map state and candidate cells
// Purpose: Provide map context (step distances) to LLM for semantic decision-making

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
 * Build context for each candidate cell
 * Format: For each candidate, show distances to explored words
 * Only include distances <= 4 to limit token usage
 *
 * @param {Object} state - Current game state
 * @returns {Object} Mapping from cellKey to array of {word, distance} pairs
 */
function buildCandidateContexts(state) {
  const contexts = {};
  const candidateCells = getCandidateCells(state);

  // For each candidate cell, compute distances to all explored cells
  for (const candidateKey of candidateCells) {
    const distances = bfsDistances(candidateKey, state.map.adjacency);
    const wordDistances = [];

    // Collect all explored word-cell pairs with their distances
    for (const tile of state.map.tiles) {
      if (tile.explored && tile.word) {
        const distance = distances[tile.key];
        // Only include if distance <= 4 to limit token usage
        if (distance !== undefined && distance <= 4) {
          wordDistances.push({
            word: tile.word,
            distance: distance,
            cellKey: tile.key
          });
        }
      }
    }

    // Sort by distance for clarity
    wordDistances.sort((a, b) => a.distance - b.distance);

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
    bfsDistances,
    getCandidateCells,
    buildCandidateContexts,
    getExploredWords
  };
}
