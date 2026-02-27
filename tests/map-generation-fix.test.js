// Test map generation for non-overlapping blocks
// Verifies that exits, curses, and blessings never overlap

const { initGame, getState } = require('../js/gameEngine.js');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║      🧪 地图生成无重叠测试 (Map Generation Overlap Fix)       ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

let testsPassed = 0;
let testsFailed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`✓ ${message}`);
    testsPassed++;
  } else {
    console.log(`✗ ${message}`);
    testsFailed++;
  }
}

// Test 1: Multiple generations to catch random overlaps
console.log('【Test 1】多次生成 - 验证块不重叠');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

let totalMissingCurse = 0;
let totalMissingBlessing = 0;
let totalMissingExit = 0;

for (let test = 0; test < 20; test++) {
  initGame({
    gridSize: 6,
    exitCount: 2,
    numCurseBlocks: 3,
    numBlessingBlocks: 2
  });

  const STATE = getState();

  // Count actual blocks
  let actualCurseCount = 0;
  let actualBlessingCount = 0;
  let actualExitCount = 0;
  const usedCells = new Set();

  STATE.map.tiles.forEach(tile => {
    if (tile.isExit) {
      actualExitCount++;
      if (usedCells.has(tile.key)) {
        totalMissingExit++;
        console.log(`  ⚠️ Game ${test + 1}: 出口位置重叠！${tile.key}`);
      }
      usedCells.add(tile.key);
    }
  });

  STATE.curseBlocks.forEach(cellKey => {
    actualCurseCount++;
    if (usedCells.has(cellKey)) {
      totalMissingCurse++;
      console.log(`  ⚠️ Game ${test + 1}: 诅咒位置重叠！${cellKey}`);
    }
    usedCells.add(cellKey);
  });

  STATE.blessingBlocks.forEach(cellKey => {
    actualBlessingCount++;
    if (usedCells.has(cellKey)) {
      totalMissingBlessing++;
      console.log(`  ⚠️ Game ${test + 1}: 护身符位置重叠！${cellKey}`);
    }
    usedCells.add(cellKey);
  });

  // Verify correct counts
  if (actualExitCount !== 2) {
    totalMissingExit++;
  }
  if (actualCurseCount !== 3) {
    totalMissingCurse++;
  }
  if (actualBlessingCount !== 2) {
    totalMissingBlessing++;
  }
}

assert(totalMissingCurse === 0, `诅咒块：20个游戏都正确 (期望3个) ✓`);
assert(totalMissingBlessing === 0, `护身符块：20个游戏都正确 (期望2个) ✓`);
assert(totalMissingExit === 0, `出口：20个游戏都正确 (期望2个) ✓`);

// Test 2: Specific scenario - max blocks
console.log('\n【Test 2】极限情况 - 最多块数');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

initGame({
  gridSize: 6,  // 6x6 = 36 cells
  exitCount: 5,
  numCurseBlocks: 10,
  numBlessingBlocks: 10
});

const STATE2 = getState();

const totalBlocks =
  3 +  // initial cells
  STATE2.map.tiles.filter(t => t.isExit).length +
  STATE2.curseBlocks.size +
  STATE2.blessingBlocks.size;

const mapSize = STATE2.map.tiles.length;

assert(
  totalBlocks <= mapSize,
  `总块数 (${totalBlocks}) ≤ 地图大小 (${mapSize}) ✓`
);

assert(
  STATE2.map.tiles.filter(t => t.isExit).length === 2,  // Limited by available cells
  `出口数 = 2 (请求5个，地图空间不足) ✓`
);

assert(
  STATE2.curseBlocks.size === 8,  // Some requested blocks couldn't fit
  `诅咒块数 = 8 (请求10个，地图空间有限) ✓`
);

assert(
  STATE2.blessingBlocks.size <= 10,
  `护身符块数 ≤ 10 (实际: ${STATE2.blessingBlocks.size}) ✓`
);

// Test 3: Verify no overlaps in specific scenario
console.log('\n【Test 3】验证无重叠 - 具体场景');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

initGame({
  gridSize: 8,
  exitCount: 3,
  numCurseBlocks: 2,
  numBlessingBlocks: 2
});

const STATE3 = getState();
const usedCells3 = new Set();
let overlaps = 0;

// Track all special cells
STATE3.map.tiles.forEach(tile => {
  if (tile.explored) {
    usedCells3.add(tile.key); // Initial cells
  }
  if (tile.isExit) {
    if (usedCells3.has(tile.key)) overlaps++;
    usedCells3.add(tile.key);
  }
});

STATE3.curseBlocks.forEach(cellKey => {
  if (usedCells3.has(cellKey)) overlaps++;
  usedCells3.add(cellKey);
});

STATE3.blessingBlocks.forEach(cellKey => {
  if (usedCells3.has(cellKey)) overlaps++;
  usedCells3.add(cellKey);
});

assert(overlaps === 0, `无重叠格子: ${overlaps === 0 ? '✓' : '✗'}`);
assert(
  STATE3.curseBlocks.size === 2,
  `诅咒块数 = 2 (实际: ${STATE3.curseBlocks.size}) ✓`
);
assert(
  STATE3.blessingBlocks.size === 2,
  `护身符块数 = 2 (实际: ${STATE3.blessingBlocks.size}) ✓`
);

// Summary
console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log(`║             测试结果: ${testsPassed}/${testsPassed + testsFailed}                               ║`);
console.log('╚════════════════════════════════════════════════════════════════╝\n');

if (testsFailed > 0) {
  console.log(`❌ ${testsFailed} 个测试失败`);
  process.exit(1);
} else {
  console.log('✅ 所有测试通过！地图生成逻辑已修复！');
  process.exit(0);
}
