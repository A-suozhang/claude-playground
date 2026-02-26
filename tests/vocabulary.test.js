// Vocabulary module tests
// Dependencies: Load vocabularies.js and vocabulary.js

// Load dependencies (using relative paths)
const { VOCABULARY_DATA, difficultyConfig } = require('../data/vocabularies.js');
const {
  getAllWords,
  selectTargetWords,
  buildOptionsPool,
  findWordByZh,
  isCorrectGuess,
  getDifficultyConfig
} = require('../js/vocabulary.js');

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

function assertArrayLength(arr, length, message) {
  if (!Array.isArray(arr) || arr.length !== length) {
    throw new Error(`${message}\n  Expected length: ${length}\n  Got: ${arr ? arr.length : 'not an array'}`);
  }
}

// ============ Tests ============

test('getAllWords returns 13 words', () => {
  const words = getAllWords();
  assertArrayLength(words, 13, 'Should return exactly 13 words');
});

test('getAllWords returns independent array (no mutation)', () => {
  const words1 = getAllWords();
  words1.pop();
  const words2 = getAllWords();
  assertArrayLength(words2, 13, 'Original data should not be mutated');
});

test('getAllWords returns objects with required fields', () => {
  const words = getAllWords();
  words.forEach((word, index) => {
    assert(word.zh, `Word ${index} missing zh field`);
    assert(word.en, `Word ${index} missing en field`);
    assert(word.hint, `Word ${index} missing hint field`);
    assert(word.categoryId, `Word ${index} missing categoryId field`);
  });
});

test('selectTargetWords returns correct count', () => {
  const selected = selectTargetWords(5);
  assertArrayLength(selected, 5, 'Should return 5 words');
});

test('selectTargetWords returns no duplicates', () => {
  const selected = selectTargetWords(10);
  const ids = selected.map(w => w.id);
  const uniqueIds = new Set(ids);
  assertEqual(uniqueIds.size, ids.length, 'Should have no duplicate words');
});

test('selectTargetWords works for edge cases', () => {
  const selected0 = selectTargetWords(0);
  assertArrayLength(selected0, 0, 'Should handle count=0');

  const selected13 = selectTargetWords(13);
  assertArrayLength(selected13, 13, 'Should handle count=13');
});

test('findWordByZh finds existing word', () => {
  const word = findWordByZh('埃菲尔铁塔');
  assert(word !== null, 'Should find Eiffel Tower');
  assertEqual(word.en, 'Eiffel Tower', 'Should return correct word');
});

test('findWordByZh returns null for missing word', () => {
  const word = findWordByZh('不存在的词汇');
  assert(word === null, 'Should return null for non-existent word');
});

test('isCorrectGuess matches exact text', () => {
  const targetWord = { zh: '埃菲尔铁塔', en: 'Eiffel Tower' };
  const correct = isCorrectGuess(targetWord, '埃菲尔铁塔');
  const incorrect = isCorrectGuess(targetWord, '埃菲尔');

  assert(correct === true, 'Should match exact text');
  assert(incorrect === false, 'Should not match partial text');
});

test('getDifficultyConfig returns correct values', () => {
  const easy = getDifficultyConfig('easy');
  assert(easy.targetCount === 3, 'Easy should have 3 targets');
  assert(easy.maxCurses === 5, 'Easy should allow 5 curses');
  assert(easy.gridSize === 3, 'Easy should have 3x3 grid');

  const normal = getDifficultyConfig('normal');
  assert(normal.targetCount === 5, 'Normal should have 5 targets');

  const hard = getDifficultyConfig('hard');
  assert(hard.targetCount === 7, 'Hard should have 7 targets');
  assert(hard.maxCurses === 2, 'Hard should allow 2 curses');
});

test('getDifficultyConfig returns normal for invalid difficulty', () => {
  const invalid = getDifficultyConfig('impossible');
  assertEqual(invalid.targetCount, 5, 'Should default to normal');
});

test('buildOptionsPool creates correct structure', () => {
  const pool = buildOptionsPool();
  assertArrayLength(pool, 13, 'Should have 13 options');

  pool.forEach((opt, idx) => {
    assert(opt.zh, `Option ${idx} missing zh`);
    assert(opt.en, `Option ${idx} missing en`);
    assert(opt.categoryId, `Option ${idx} missing categoryId`);
    assert(opt.id, `Option ${idx} missing id`);
  });
});

// ============ Summary ============
console.log('\n' + '='.repeat(50));
console.log(`Tests passed: ${passCount}/${testCount}`);
console.log(`Tests failed: ${failCount}/${testCount}`);
console.log('='.repeat(50));

process.exit(failCount > 0 ? 1 : 0);
