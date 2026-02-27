// AI Integration Test: Verify HTML structure and basic controller integration

const fs = require('fs');
const path = require('path');

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

function assertIncludes(text, substring, message) {
  assert(text.includes(substring), `${message} (substring not found: "${substring}")`);
}

console.log('\n=== AI Integration Test ===\n');

// Test 1: HTML file exists and contains AI UI elements
const htmlPath = path.join(__dirname, '../index.html');
assert(fs.existsSync(htmlPath), 'Test 1a: index.html exists');

const htmlContent = fs.readFileSync(htmlPath, 'utf-8');
assertIncludes(htmlContent, 'ai-member-toggle', 'Test 1b: HTML contains AI toggle checkbox');
assertIncludes(htmlContent, 'ai-api-key-input', 'Test 1c: HTML contains API key input');
assertIncludes(htmlContent, 'ai-thinking-indicator', 'Test 1d: HTML contains thinking indicator');
assertIncludes(htmlContent, 'ai-reasoning-text', 'Test 1e: HTML contains reasoning text display');

// Test 2: Script references are correct
assertIncludes(htmlContent, 'js/aiMapAnalyzer.js', 'Test 2a: HTML includes aiMapAnalyzer.js');
assertIncludes(htmlContent, 'js/aiAgent.js', 'Test 2b: HTML includes aiAgent.js');

// Test 3: CSS file exists and contains AI styles
const cssPath = path.join(__dirname, '../style.css');
assert(fs.existsSync(cssPath), 'Test 3a: style.css exists');

const cssContent = fs.readFileSync(cssPath, 'utf-8');
assertIncludes(cssContent, 'ai-settings', 'Test 3b: CSS contains ai-settings style');
assertIncludes(cssContent, 'ai-thinking-indicator', 'Test 3c: CSS contains ai-thinking-indicator style');
assertIncludes(cssContent, 'ai-reasoning-text', 'Test 3d: CSS contains ai-reasoning-text style');
assertIncludes(cssContent, 'ai-spinner', 'Test 3e: CSS contains ai-spinner animation');

// Test 4: Controller.js has AI integration
const controllerPath = path.join(__dirname, '../js/controller.js');
const controllerContent = fs.readFileSync(controllerPath, 'utf-8');
assertIncludes(controllerContent, '_aiMemberEnabled', 'Test 4a: Controller has _aiMemberEnabled variable');
assertIncludes(controllerContent, '_aiApiKey', 'Test 4b: Controller has _aiApiKey variable');
assertIncludes(controllerContent, 'triggerAIMemberTurn', 'Test 4c: Controller has triggerAIMemberTurn function');
assertIncludes(controllerContent, 'onAIMemberToggle', 'Test 4d: Controller has onAIMemberToggle handler');
assertIncludes(controllerContent, 'aiMemberDecide', 'Test 4e: Controller calls aiMemberDecide');

// Test 5: AI modules exist
const aiAnalyzerPath = path.join(__dirname, '../js/aiMapAnalyzer.js');
assert(fs.existsSync(aiAnalyzerPath), 'Test 5a: aiMapAnalyzer.js exists');

const aiAgentPath = path.join(__dirname, '../js/aiAgent.js');
assert(fs.existsSync(aiAgentPath), 'Test 5b: aiAgent.js exists');

// Test 6: aiMapAnalyzer exports required functions
const aiAnalyzerContent = fs.readFileSync(aiAnalyzerPath, 'utf-8');
assertIncludes(aiAnalyzerContent, 'function bfsDistances', 'Test 6a: aiMapAnalyzer exports bfsDistances');
assertIncludes(aiAnalyzerContent, 'function getCandidateCells', 'Test 6b: aiMapAnalyzer exports getCandidateCells');
assertIncludes(aiAnalyzerContent, 'function buildCandidateContexts', 'Test 6c: aiMapAnalyzer exports buildCandidateContexts');
assertIncludes(aiAnalyzerContent, 'function getExploredWords', 'Test 6d: aiMapAnalyzer exports getExploredWords');

// Test 7: aiAgent exports required functions
const aiAgentContent = fs.readFileSync(aiAgentPath, 'utf-8');
assertIncludes(aiAgentContent, 'function buildPrompt', 'Test 7a: aiAgent exports buildPrompt');
assertIncludes(aiAgentContent, 'function callLLM', 'Test 7b: aiAgent exports callLLM');
assertIncludes(aiAgentContent, 'function parseLLMResponse', 'Test 7c: aiAgent exports parseLLMResponse');
assertIncludes(aiAgentContent, 'function fallbackSelection', 'Test 7d: aiAgent exports fallbackSelection');
assertIncludes(aiAgentContent, 'function aiMemberDecide', 'Test 7e: aiAgent exports aiMemberDecide');

// Test 8: Verify no breaking changes to gameEngine
const gameEnginePath = path.join(__dirname, '../js/gameEngine.js');
const gameEngineContent = fs.readFileSync(gameEnginePath, 'utf-8');
assert(!gameEngineContent.includes('_aiMemberEnabled'), 'Test 8a: gameEngine not modified with AI code');
assert(!gameEngineContent.includes('aiMemberDecide'), 'Test 8b: gameEngine does not call AI functions');

// Test 9: Verify no breaking changes to renderer
const rendererPath = path.join(__dirname, '../js/renderer.js');
const rendererContent = fs.readFileSync(rendererPath, 'utf-8');
assert(!rendererContent.includes('_aiMemberEnabled'), 'Test 9a: renderer not modified with AI code');
assert(!rendererContent.includes('aiMemberDecide'), 'Test 9b: renderer does not call AI functions');

console.log('\n==================================================');
console.log(`Tests passed: ${passCount}`);
console.log(`Tests failed: ${failCount}`);
console.log('==================================================\n');

process.exit(failCount > 0 ? 1 : 0);
