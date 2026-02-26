// Controller module: Event binding and coordination between modules
// Manages lead captain phase (describes) and member phase (assigns word to cell)

/**
 * Initialize all event listeners
 * @returns {void}
 */
function initController() {
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
  // Initialize game with default config (6x6, 3 initial blocks, configurable exits)
  initGame();

  // Render game UI
  renderAll(getState());
  cacheElements();

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

  // Show feedback
  flashScreen('success');
  showFeedbackOverlay(`"${result.tile.word}" 已放置 · 第 ${updatedState.roundCount} 轮`, 1500);

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
