// Geometric Distance Tests - Verify continuous distance calculation
const aiMapAnalyzer = require('../js/aiMapAnalyzer.js');

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

function assertApprox(actual, expected, tolerance, message) {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, `${message} (expected ~${expected}, got ${actual.toFixed(2)}, diff: ${diff.toFixed(2)})`);
}

console.log('\n=== Geometric Distance Tests ===\n');

// Test 1: Pixel coordinate calculation
console.log('Test 1: Pixel Coordinate Calculation');
const pos00 = aiMapAnalyzer.offsetToPixel(0, 0, 80);
assertEqual(pos00.x, 0, 'Position (0,0) x-coordinate');
assertEqual(pos00.y, 0, 'Position (0,0) y-coordinate');

const pos01 = aiMapAnalyzer.offsetToPixel(0, 1, 80);
assertEqual(pos01.x, 80, 'Position (0,1) x-coordinate (one column to right)');
assertEqual(pos01.y, 0, 'Position (0,1) y-coordinate (same row)');

const pos10 = aiMapAnalyzer.offsetToPixel(1, 0, 80);
assertApprox(pos10.x, 40, 1, 'Position (1,0) x-coordinate (offset row)');
assertApprox(pos10.y, 60, 1, 'Position (1,0) y-coordinate (next row, 75% overlap)');

// Test 2: Geometric distance - same row
console.log('\nTest 2: Geometric Distance - Same Row');
const dist00_10 = aiMapAnalyzer.geometricDistance('0,0', '0,1', 80);
assertApprox(dist00_10, 80, 1, 'Distance (0,0) to (0,1) = 80px (one cell width)');

const dist00_20 = aiMapAnalyzer.geometricDistance('0,0', '0,2', 80);
assertApprox(dist00_20, 160, 1, 'Distance (0,0) to (0,2) = 160px (two cells)');

// Test 3: Geometric distance - different rows (key test: offset differences)
console.log('\nTest 3: Geometric Distance - Different Rows & Columns');
const dist00_10hex = aiMapAnalyzer.geometricDistance('0,0', '1,0', 80);
console.log(`  Distance (0,0) to (1,0) = ${dist00_10hex.toFixed(2)}px`);
assertApprox(dist00_10hex, 72.1, 1, 'Diagonal distance with row offset (40px x-offset, 60px y-offset)');

const dist00_11 = aiMapAnalyzer.geometricDistance('0,0', '1,1', 80);
console.log(`  Distance (0,0) to (1,1) = ${dist00_11.toFixed(2)}px`);
assert(dist00_11 < dist00_10hex || dist00_11 > dist00_10hex, 'Direction matters: (1,1) distance differs from (1,0)');

// Test 4: Symmetry check
console.log('\nTest 4: Distance Symmetry');
const distA = aiMapAnalyzer.geometricDistance('2,3', '3,4', 80);
const distB = aiMapAnalyzer.geometricDistance('3,4', '2,3', 80);
assertApprox(distA, distB, 0.01, 'Distance is symmetric: dist(A→B) == dist(B→A)');

// Test 5: Triangle inequality
console.log('\nTest 5: Triangle Inequality');
const d01 = aiMapAnalyzer.geometricDistance('0,0', '1,0', 80);
const d12 = aiMapAnalyzer.geometricDistance('1,0', '2,0', 80);
const d02 = aiMapAnalyzer.geometricDistance('0,0', '2,0', 80);
assert(d02 <= d01 + d12 + 0.01, 'Triangle inequality holds: d(0→2) ≤ d(0→1) + d(1→2)');

// Test 6: Integration test - Compare topological vs geometric
console.log('\nTest 6: Context Building with Geometric Distances');
const testState = {
  map: {
    tiles: [
      { key: '0,0', explored: true, word: 'A' },
      { key: '0,1', explored: true, word: 'B' },
      { key: '0,2', explored: false, word: null },
      { key: '1,0', explored: false, word: null },
      { key: '1,1', explored: true, word: 'C' },
      { key: '1,2', explored: false, word: null }
    ],
    adjacency: {
      '0,0': ['0,1', '1,0', '1,1'],
      '0,1': ['0,0', '0,2', '1,0', '1,1'],
      '0,2': ['0,1', '1,1', '1,2'],
      '1,0': ['0,0', '0,1', '1,1'],
      '1,1': ['0,0', '0,1', '0,2', '1,0', '1,2'],
      '1,2': ['0,1', '0,2', '1,1']
    }
  }
};

const contexts = aiMapAnalyzer.buildCandidateContexts(testState);
assert('0,2' in contexts, 'Candidate 0,2 has context');
assert(contexts['0,2'].length > 0, 'Candidate 0,2 has explored neighbors');

// Check that geometric distance is calculated
const ctx02 = contexts['0,2'];
const hasGeoDistance = ctx02.every(c => typeof c.geometricDistance === 'number');
assert(hasGeoDistance, 'All contexts have geometricDistance values');

// Check that results are sorted by geometric distance
const isSorted = ctx02.every((c, i, arr) => i === 0 || c.geometricDistance >= arr[i-1].geometricDistance);
assert(isSorted, 'Context sorted by geometric distance (ascending)');

function assertEqual(actual, expected, message) {
  assert(actual === expected, `${message} (expected ${expected}, got ${actual})`);
}

// Summary
console.log('\n==================================================');
console.log(`Tests passed: ${passCount}`);
console.log(`Tests failed: ${failCount}`);
console.log('==================================================\n');

process.exit(failCount > 0 ? 1 : 0);
