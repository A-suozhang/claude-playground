// AI Agent Tests
const aiMapAnalyzer = require('../js/aiMapAnalyzer.js');
const aiAgent = require('../js/aiAgent.js');
const mapEngine = require('../js/mapEngine.js');

let passCount = 0;
let failCount = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    passCount++;
  } else {
    console.log(`✗ ${message}`);
    failCount++;
  }
}

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected ${expected}, got ${actual})`);
}

function assertArrayIncludes(array, value, message) {
  assert(array.includes(value), `${message} (array does not include ${value})`);
}

// ============= TESTS =============

console.log('\n=== Testing aiMapAnalyzer ===\n');

// Test 1: bfsDistances computes correct distances
const adjacency = {
  '0,0': ['0,1', '1,0'],
  '0,1': ['0,0', '1,1'],
  '1,0': ['0,0', '1,1'],
  '1,1': ['0,1', '1,0']
};

const distances = aiMapAnalyzer.bfsDistances('0,0', adjacency);
assertEqual(distances['0,0'], 0, 'Test 1a: Distance from 0,0 to itself is 0');
assertEqual(distances['0,1'], 1, 'Test 1b: Distance from 0,0 to 0,1 is 1');
assertEqual(distances['1,0'], 1, 'Test 1c: Distance from 0,0 to 1,0 is 1');
assertEqual(distances['1,1'], 2, 'Test 1d: Distance from 0,0 to 1,1 is 2');

// Test 2: getCandidateCells returns cells adjacent to explored
const testState = {
  map: {
    tiles: [
      { key: '0,0', explored: true, word: 'word1' },
      { key: '0,1', explored: false, word: null },
      { key: '1,0', explored: false, word: null },
      { key: '1,1', explored: false, word: null }
    ],
    adjacency: adjacency
  }
};

const candidates = aiMapAnalyzer.getCandidateCells(testState);
assertArrayIncludes(candidates, '0,1', 'Test 2a: Candidate 0,1 is adjacent to explored 0,0');
assertArrayIncludes(candidates, '1,0', 'Test 2b: Candidate 1,0 is adjacent to explored 0,0');
assert(candidates.length === 2, 'Test 2c: Exactly 2 candidates adjacent to explored (0,1 and 1,0)');

// Test 3: buildCandidateContexts creates word-distance mappings
const contexts = aiMapAnalyzer.buildCandidateContexts(testState);
assert('0,1' in contexts, 'Test 3a: Candidate 0,1 has context');
assert('1,0' in contexts, 'Test 3b: Candidate 1,0 has context');
assert(contexts['0,1'].length > 0, 'Test 3c: Context for 0,1 has word distances');

// Test 4: getExploredWords returns only explored words
const exploredWords = aiMapAnalyzer.getExploredWords(testState);
assert(exploredWords.length === 1, 'Test 4a: Only 1 explored word');
assert(exploredWords[0] === 'word1', 'Test 4b: Explored word is correct');

console.log('\n=== Testing aiAgent ===\n');

// Test 5: buildPrompt creates valid prompt
const prompt = aiAgent.buildPrompt('测试词',
  [
    {cellKey: '0,1', contexts: [{word: 'word1', distance: 1}]},
    {cellKey: '1,0', contexts: [{word: 'word1', distance: 2}]}
  ],
  testState
);
assert(prompt.includes('测试词'), 'Test 5a: Prompt includes current word');
assert(prompt.includes('word1'), 'Test 5b: Prompt includes explored words');
assert(prompt.includes('0,1'), 'Test 5c: Prompt includes candidate cells');
assert(prompt.includes('JSON'), 'Test 5d: Prompt requests JSON format');

// Test 6: parseLLMResponse parses valid JSON
const validResponse = '{"selectedCell":"0,1","reasoning":"离word1最近","confidence":0.9}';
const parsed = aiAgent.parseLLMResponse(validResponse, ['0,1', '1,0']);
assert(parsed !== null, 'Test 6a: Valid JSON is parsed');
assert(parsed.selectedCell === '0,1', 'Test 6b: Parsed cell is correct');
assert(parsed.reasoning === '离word1最近', 'Test 6c: Parsed reasoning is correct');

// Test 7: parseLLMResponse returns error for invalid cellKey
const invalidCellResponse = '{"selectedCell":"9,9","reasoning":"bad","confidence":0.5}';
const invalidParsed = aiAgent.parseLLMResponse(invalidCellResponse, ['0,1', '1,0']);
assert(invalidParsed && invalidParsed.error, 'Test 7: Invalid cellKey is rejected with error message');

// Test 8: fallbackSelection picks cell with most direct neighbors
const fallbackContexts = {
  '0,1': [{ word: 'word1', distance: 1 }],      // 1 direct neighbor
  '1,0': [
    { word: 'word1', distance: 1 },
    { word: 'word2', distance: 1 }
  ]  // 2 direct neighbors
};
const fallback = aiAgent.fallbackSelection(fallbackContexts);
assert(fallback === '1,0', 'Test 8: Fallback selects cell with most direct neighbors');

// Test 9: parseLLMResponse truncates long reasoning
const longResponse = '{"selectedCell":"0,1","reasoning":"这是一个非常长的推理文字，远超过了十五个字符的限制","confidence":0.5}';
const truncated = aiAgent.parseLLMResponse(longResponse, ['0,1']);
assert(truncated.reasoning.length <= 30, 'Test 9: Long reasoning is truncated');

// Test 10: aiMemberDecide returns fallback when no API key
(async () => {
  try {
    const decision = await aiAgent.aiMemberDecide(testState, '');
    assert(decision.usedFallback === true, 'Test 10a: Empty API key triggers fallback');
    assert('cellKey' in decision, 'Test 10b: Decision has cellKey');
    assert('reasoning' in decision, 'Test 10c: Decision has reasoning');
  } catch (error) {
    console.log(`✗ Test 10: Error in aiMemberDecide: ${error.message}`);
    failCount++;
  }

  // Print summary
  console.log('\n==================================================');
  console.log(`Tests passed: ${passCount}/10`);
  console.log(`Tests failed: ${failCount}/10`);
  console.log('==================================================\n');

  process.exit(failCount > 0 ? 1 : 0);
})();
