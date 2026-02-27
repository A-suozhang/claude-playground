// Controller module: Event binding and coordination between modules
// Manages lead captain phase (describes) and member phase (assigns word to cell)

// AI Member Mode configuration
let _aiMemberEnabled = false;
let _aiApiKey = '';

/**
 * Initialize all event listeners
 * @returns {void}
 */
function initController() {
  // Theme toggle
  const themeToggle = document.getElementById('theme-toggle');
  if (themeToggle) {
    themeToggle.addEventListener('click', onThemeToggle);
  }
  initTheme();

  // AI Member Mode toggle
  const aiMemberToggle = document.getElementById('ai-member-toggle');
  if (aiMemberToggle) {
    aiMemberToggle.addEventListener('change', onAIMemberToggle);
  }

  // Game start menu
  document.querySelectorAll('.btn-start-game').forEach(btn => {
    btn.addEventListener('click', onStartGame);
  });

  // Map cells - member selects where to assign the word
  document.addEventListener('click', onCellClick);

  // Lead phase: submit description
  document.getElementById('btn-submit-lead').addEventListener('click', onSubmitLead);

  // Member phase: assign word to cell
  document.getElementById('btn-assign-word').addEventListener('click', onAssignWord);

  // Play again
  document.getElementById('btn-play-again').addEventListener('click', onPlayAgain);

  // Keyboard shortcuts
  document.addEventListener('keydown', onKeyDown);

  // Show setup screen on load
  showScreen('setup');
}

/**
 * Handle game start
 * @param {Event} event - Click event
 * @returns {void}
 */
function onStartGame(event) {
  // Read user configuration from setup screen
  const gridSize = parseInt(document.getElementById('grid-size-input').value) || 6;
  const exitCount = parseInt(document.getElementById('exit-count-input').value) || 1;
  const numCurseBlocks = parseInt(document.getElementById('curse-blocks-input').value) || 1;
  const numBlessingBlocks = parseInt(document.getElementById('blessing-blocks-input').value) || 1;

  // Read AI configuration
  _aiMemberEnabled = document.getElementById('ai-member-toggle').checked;
  _aiApiKey = document.getElementById('ai-api-key-input').value.trim();

  // Initialize game with user settings
  initGame({ gridSize, exitCount, numCurseBlocks, numBlessingBlocks });

  // Cache DOM elements before rendering (needed for renderAll to set styles)
  cacheElements();

  // Render game UI
  renderAll(getState());

  // Show game screen
  showScreen('game');
}

/**
 * Handle cell click - member selects a cell to assign the word
 * @param {Event} event - Click event
 * @returns {void}
 */
function onCellClick(event) {
  const state = getState();

  // Only allow cell selection during member phase
  if (!state || state.gameMode !== 'guess') {
    return;
  }

  const cellElem = event.target.closest('.cell');
  if (!cellElem) return;

  const cellKey = cellElem.dataset.cellKey;
  if (!cellKey) return;

  // Check if cell is selectable
  const result = checkCellSelectable(cellKey);
  if (!result.ok) {
    showTurnError(result.error);
    return;
  }

  // Update internal state
  if (typeof _getInternalState === 'function') {
    const internalState = _getInternalState();
    if (internalState && internalState.currentRound) {
      internalState.currentRound.selectedCell = cellKey;
    }
  }

  // Update visual state
  setSelectedCell(cellKey);
  clearTurnError();
}

/**
 * Handle lead captain word submission
 * @returns {void}
 */
function onSubmitLead() {
  const state = getState();

  if (!state) {
    showTurnError('游戏未初始化');
    return;
  }

  if (state.gameMode !== 'lead') {
    showTurnError('当前不是领队阶段');
    return;
  }

  // Get word from input
  const word = document.getElementById('lead-word-input').value;

  // Submit round
  const result = submitLeadRound(word);

  if (!result.ok) {
    showTurnError(result.error);
    return;
  }

  // Clear form and update UI to show member phase
  document.getElementById('lead-word-input').value = '';
  clearTurnError();

  // Update UI to show member selection phase
  renderGamePhase(getState());

  // Trigger AI member turn if enabled
  if (_aiMemberEnabled) {
    triggerAIMemberTurn();
  }
}

/**
 * Handle member cell placement
 * @returns {void}
 */
function onAssignWord() {
  const state = getState();

  if (!state) {
    showTurnError('游戏未初始化');
    return;
  }

  if (state.gameMode !== 'guess') {
    showTurnError('当前不是队员放置阶段');
    return;
  }

  // Get selected cell
  const selectedCell = state.currentRound.selectedCell;

  // Validation
  if (!selectedCell) {
    showTurnError('请先点击地图上的一个格子');
    return;
  }

  // Place word on cell
  const result = placeWordOnCell(selectedCell);

  if (!result.ok) {
    showTurnError(result.error);
    // Show special feedback for curse at exit
    if (result.cursedAtExit) {
      flashScreen('error');
      showFeedbackOverlay(`你被诅咒缠身 (${result.curseValue})！无法离开此地，请找到护身符消除诅咒`, 2000);

      // Jump back to lead phase (gameMode already changed in gameEngine)
      setTimeout(() => {
        const updatedState = getState();
        setSelectedCell(null);
        clearTurnError();
        renderGamePhase(updatedState);
      }, 2000);
    }
    return;
  }

  // Update UI
  const updatedState = getState();

  // Animate the cell
  const cellElem = document.getElementById(`cell-${selectedCell}`);
  if (cellElem) {
    updateCell(selectedCell, result.tile, 'cell-assigned');
  }

  // Re-render map grid to show updated adjacent cells
  renderMapGrid(updatedState);

  // Show appropriate feedback based on tile type
  let feedbackMsg = `"${result.tile.word}" 已放置 · 第 ${updatedState.roundCount} 轮`;
  if (result.tile.isBlessed) {
    feedbackMsg += ` ✨ 获得护身符 (${updatedState.blessingCount})`;
  } else if (result.tile.isCursed) {
    if (result.blessingConsumed) {
      feedbackMsg += ` 💀 诅咒被护身符抵消 (剩余护身符: ${updatedState.blessingCount})`;
    } else {
      feedbackMsg += ` 💀 诅咒值 +1 (${updatedState.curseValue})`;
    }
  }

  // Show feedback
  flashScreen('success');
  showFeedbackOverlay(feedbackMsg, 1500);

  // Add to history
  const historyEntry = {
    round: updatedState.roundCount,
    word: result.tile.word,
    cellKey: selectedCell
  };
  appendHistoryEntry(historyEntry);

  // Reset selection
  setSelectedCell(null);
  clearTurnError();

  // Update UI for next round or check end conditions
  if (result.exitReached) {
    setTimeout(() => {
      showEndScreen('won', updatedState);
    }, 1500);
  } else {
    // Back to lead phase
    renderGamePhase(updatedState);
  }
}

/**
 * Handle play again button
 * @returns {void}
 */
function onPlayAgain() {
  showScreen('setup');
}

/**
 * Handle keyboard shortcuts
 * @param {KeyboardEvent} event - Keyboard event
 * @returns {void}
 */
function onKeyDown(event) {
  const state = getState();

  // Ctrl+Enter to submit (lead or member phase)
  if (event.key === 'Enter' && event.ctrlKey) {
    if (!state) return;

    if (state.gameMode === 'lead') {
      onSubmitLead();
    } else if (state.gameMode === 'guess') {
      onAssignWord();
    }
  }

  // Escape to clear selection
  if (event.key === 'Escape') {
    setSelectedCell(null);
    document.getElementById('lead-description-input').value = '';
    document.getElementById('member-word-input').value = '';
    clearTurnError();
  }
}

// Initialize controller when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initController);
} else {
  initController();
}

// Theme management
function initTheme() {
  const savedTheme = localStorage.getItem('theme') || 'dark';
  setTheme(savedTheme);
}

function setTheme(theme) {
  const html = document.documentElement;
  if (theme === 'light') {
    html.classList.remove('theme-dark');
    html.classList.add('theme-light');
    localStorage.setItem('theme', 'light');
    updateThemeIcon('☀️');
  } else {
    html.classList.remove('theme-light');
    html.classList.add('theme-dark');
    localStorage.setItem('theme', 'dark');
    updateThemeIcon('🌙');
  }
}

function getCurrentTheme() {
  const html = document.documentElement;
  if (html.classList.contains('theme-light')) return 'light';
  if (html.classList.contains('theme-dark')) return 'dark';
  return localStorage.getItem('theme') || 'dark';
}

function updateThemeIcon(icon) {
  const iconElem = document.querySelector('.theme-icon');
  if (iconElem) {
    iconElem.textContent = icon;
  }
}

function onThemeToggle() {
  const currentTheme = getCurrentTheme();
  const newTheme = currentTheme === 'light' ? 'dark' : 'light';
  setTheme(newTheme);
}

/**
 * Handle AI member mode toggle
 * @returns {void}
 */
function onAIMemberToggle() {
  const isChecked = document.getElementById('ai-member-toggle').checked;
  const apiKeySection = document.getElementById('ai-api-key-section');
  if (apiKeySection) {
    if (isChecked) {
      apiKeySection.classList.remove('hidden');
    } else {
      apiKeySection.classList.add('hidden');
    }
  }
}

/**
 * Display AI decision details in the panel
 * @param {Object} decision - Decision object with all details
 * @returns {void}
 */
function displayAIDecisionDetails(decision) {
  const decisionPanel = document.getElementById('ai-decision-panel');
  if (!decisionPanel) return;

  // Populate Prompt
  const promptDisplay = document.getElementById('ai-prompt-display');
  if (promptDisplay) {
    promptDisplay.value = decision.prompt || '（无Prompt）';
    promptDisplay.style.height = 'auto';
    promptDisplay.style.height = Math.min(promptDisplay.scrollHeight, 150) + 'px';
  }

  // Populate Candidates Analysis
  const candidatesDisplay = document.getElementById('ai-candidates-display');
  if (candidatesDisplay) {
    candidatesDisplay.value = decision.candidatesInfo || '（无候选格子）';
    candidatesDisplay.style.height = 'auto';
    candidatesDisplay.style.height = Math.min(candidatesDisplay.scrollHeight, 150) + 'px';
  }

  // Populate LLM Response
  const llmDisplay = document.getElementById('ai-llm-response-display');
  if (llmDisplay) {
    llmDisplay.value = decision.llmResponse || '（无响应）';
    llmDisplay.style.height = 'auto';
    llmDisplay.style.height = Math.min(llmDisplay.scrollHeight, 150) + 'px';
  }

  // Populate Final Decision
  const finalDecision = document.getElementById('ai-final-decision');
  if (finalDecision) {
    finalDecision.textContent = decision.strategy || decision.reasoning;
  }

  // Populate Raw JSON (in details section)
  const rawJsonDisplay = document.getElementById('ai-raw-json-display');
  if (rawJsonDisplay) {
    try {
      const jsonObj = JSON.parse(decision.rawJson || '{}');
      rawJsonDisplay.value = JSON.stringify(jsonObj, null, 2);
    } catch {
      rawJsonDisplay.value = decision.rawJson || '{}';
    }
  }

  // Show the panel
  decisionPanel.classList.remove('hidden');
}

/**
 * Trigger AI member turn (async process)
 * @returns {void}
 */
function triggerAIMemberTurn() {
  // Use setTimeout to avoid blocking
  setTimeout(async () => {
    const state = getState();
    if (!state || state.gameMode !== 'guess') {
      return;
    }

    const thinkingIndicator = document.getElementById('ai-thinking-indicator');
    const decisionPanel = document.getElementById('ai-decision-panel');

    // Show thinking indicator
    if (thinkingIndicator) {
      thinkingIndicator.classList.remove('hidden');
    }

    // Hide decision panel initially
    if (decisionPanel) {
      decisionPanel.classList.add('hidden');
    }

    try {
      // Wait a bit for UX feel
      await new Promise(resolve => setTimeout(resolve, 500));

      // Get AI decision with full details
      const decision = await aiMemberDecide(state, _aiApiKey);

      // Hide thinking indicator
      if (thinkingIndicator) {
        thinkingIndicator.classList.add('hidden');
      }

      // Display decision details
      displayAIDecisionDetails(decision);

      // Set selected cell visually
      setSelectedCell(decision.cellKey);

      // Wait for player to see AI's decision and reasoning
      await new Promise(resolve => setTimeout(resolve, 1200));

      // Auto-submit (call onAssignWord)
      onAssignWord();

      // Hide decision panel after submission
      if (decisionPanel) {
        decisionPanel.classList.add('hidden');
      }
    } catch (error) {
      console.error('AI decision error:', error);

      // Fallback: hide indicators and show error
      if (thinkingIndicator) {
        thinkingIndicator.classList.add('hidden');
      }
      if (decisionPanel) {
        decisionPanel.classList.add('hidden');
      }
      showTurnError('AI 决策失败，请手动选择格子');
    }
  }, 0);
}

// Expose functions for debugging
window.debugState = function() {
  const state = getState();
  if (!state) {
    console.log('Game not initialized');
    return;
  }
  console.log('=== GAME STATE ===');
  console.log('Phase:', state.phase);
  console.log('Game Mode:', state.gameMode);
  console.log('Round:', state.roundCount);
  console.log('Used Words:', Array.from(state.usedWords));
  console.log('Explored Cells:', state.map.tiles.filter(t => t.explored).length);
  console.log('Full State:', state);
};
