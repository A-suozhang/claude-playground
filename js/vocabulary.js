// Vocabulary module: Pure functions for word operations
// Dependencies: VOCABULARY_DATA, gameConfig from data/vocabularies.js

// Load data module in Node.js environment
let VOCABULARY_DATA_LOCAL;
let gameConfig_LOCAL;

if (typeof module !== 'undefined' && module.exports) {
  const { VOCABULARY_DATA: vData, gameConfig: gConfig } = require('../data/vocabularies.js');
  VOCABULARY_DATA_LOCAL = vData;
  gameConfig_LOCAL = gConfig;
}

/**
 * Get all vocabulary words
 * @returns {Array<Object>} All 13 vocabulary words
 */
function getAllWords() {
  const data = (typeof module !== 'undefined' && module.exports) ? VOCABULARY_DATA_LOCAL : VOCABULARY_DATA;
  return [...data];
}

/**
 * Select N random target words without duplicates
 * @param {number} count - Number of words to select
 * @returns {Array<Object>} Array of selected target words
 */
function selectTargetWords(count) {
  const words = getAllWords();
  const shuffled = [...words].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

/**
 * Build the pool of options for guessing
 * Returns all words as option objects with {zh, en, categoryId}
 * @returns {Array<Object>} All vocabulary words as options
 */
function buildOptionsPool() {
  return getAllWords().map(word => ({
    zh: word.zh,
    en: word.en,
    categoryId: word.categoryId,
    id: word.id
  }));
}

/**
 * Find a word by its Chinese name
 * @param {string} zh - Chinese name to search for
 * @returns {Object|null} Word object if found, null otherwise
 */
function findWordByZh(zh) {
  return getAllWords().find(word => word.zh === zh) || null;
}

/**
 * Check if a guess matches a target word (exact match)
 * @param {Object} targetWord - The target word object
 * @param {string} guess - The guessed Chinese name
 * @returns {boolean} True if guess matches target
 */
function isCorrectGuess(targetWord, guess) {
  return targetWord.zh === guess;
}

/**
 * Get game configuration
 * @param {string} difficulty - 'easy', 'normal', or 'hard' (optional)
 * @returns {Object} Configuration object from gameConfig
 */
function getGameConfig(difficulty) {
  const config = (typeof module !== 'undefined' && module.exports) ? gameConfig_LOCAL : gameConfig;
  if (!difficulty) {
    return config;
  }
  // Merge difficulty-specific overrides if they exist
  return {
    ...config,
    ...(config.difficulties && config.difficulties[difficulty] ? config.difficulties[difficulty] : {})
  };
}

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    getAllWords,
    selectTargetWords,
    buildOptionsPool,
    findWordByZh,
    isCorrectGuess,
    getGameConfig
  };
}
