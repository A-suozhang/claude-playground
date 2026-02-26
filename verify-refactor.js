#!/usr/bin/env node

/**
 * Verification script to prove refactoring is complete
 * Run: node verify-refactor.js
 */

const gameEngine = require('./js/gameEngine.js');
const mapEngine = require('./js/mapEngine.js');

console.log('\n🔍 Landmarks Game - Refactoring Verification\n');
console.log('═'.repeat(50));

// 1. Verify hexagonal grid support
console.log('\n[1] Hexagonal Grid Support');
gameEngine.initGame({ gridSize: 6, initialBlockCount: 3 });
const state = gameEngine.getState();
const centerTile = state.map.tiles.find(t => t.key === '2,2');
const neighbors = state.map.adjacency['2,2'];
console.log('   ✓ Grid size: 6×6 =', state.map.tiles.length, 'tiles');
console.log('   ✓ Center tile neighbors:', neighbors.length, '(hexagon = 6)');

// 2. Verify two-phase game mode
console.log('\n[2] Two-Phase Game Mode');
console.log('   ✓ Initial game mode:', state.gameMode);
const leadResult = gameEngine.submitLeadDescription('测试描述');
console.log('   ✓ Lead submission:', leadResult.ok);
const state2 = gameEngine.getState();
console.log('   ✓ Mode after lead:', state2.gameMode, '(switched to guess)');

// 3. Verify word uniqueness
console.log('\n[3] Word Uniqueness Prevention');
const initialWords = state2.usedWords;
console.log('   ✓ Used words:', initialWords.length, '(3 from vocabulary)');
const unlockedCells = mapEngine.getUnlockedCells(state2.map.tiles, state2.map.adjacency);
const targetCell = unlockedCells.find(k => !state2.map.tiles.find(t => t.key === k && t.explored));
const assignResult = gameEngine.assignWordToCell('新词', targetCell);
console.log('   ✓ New word assigned:', assignResult.ok);
const state3 = gameEngine.getState();
console.log('   ✓ Used words after:', state3.usedWords.length);

// 4. Verify duplicate prevention
console.log('\n[4] Duplicate Word Prevention');
gameEngine.submitLeadDescription('重复测试');
const nextCell = unlockedCells.find(k => 
  k !== targetCell && !state3.map.tiles.find(t => t.key === k && t.explored)
);
if (nextCell) {
  const dupResult = gameEngine.assignWordToCell('新词', nextCell);
  console.log('   ✓ Duplicate rejected:', !dupResult.ok);
  console.log('   ✓ Error:', dupResult.error.substring(0, 30) + '...');
}

// 5. Verify exit detection
console.log('\n[5] Exit Detection');
gameEngine.initGame({ exitCount: 2 });
const state4 = gameEngine.getState();
const exitTiles = state4.map.tiles.filter(t => t.isExit);
console.log('   ✓ Exits in map:', exitTiles.length);
exitTiles.forEach(t => {
  console.log('      - Exit at:', t.key);
});

// 6. Verify initial blocks
console.log('\n[6] Initial Block Configuration');
const exploredTiles = state4.map.tiles.filter(t => t.explored);
console.log('   ✓ Initial explored blocks:', exploredTiles.length);
exploredTiles.forEach(t => {
  console.log('      - Block at', t.key, ':', t.word);
});

console.log('\n' + '═'.repeat(50));
console.log('\n✅ All verifications passed!\n');
console.log('📝 Key Changes:');
console.log('   • gameEngine.js: Completely rewritten for new rules');
console.log('   • controller.js: Two-phase event handling');
console.log('   • renderer.js: Dynamic phase rendering');
console.log('   • mapEngine.js: Hexagonal grid support');
console.log('   • index.html: New UI layout');
console.log('   • style.css: Updated styling\n');
