// Renderer module: All DOM operations and rendering logic
// New rules: Render lead captain view vs. team member view

// Cache DOM elements
let els = {};

/**
 * Cache all DOM elements for quick access
 * @returns {void}
 */
function cacheElements() {
  els = {
    // Screens
    app: document.getElementById('app'),
    setupScreen: document.getElementById('setup-screen'),
    gameScreen: document.getElementById('game-screen'),
    endScreen: document.getElementById('end-screen'),

    // Buttons
    btnStartGame: document.getElementById('btn-start-game'),
    btnSubmitLead: document.getElementById('btn-submit-lead'),
    btnAssignWord: document.getElementById('btn-assign-word'),
    btnPlayAgain: document.getElementById('btn-play-again'),

    // Game UI
    mapGrid: document.getElementById('map-grid'),
    phaseLabel: document.getElementById('phase-label'),
    phaseDescription: document.getElementById('phase-description'),
    roundCount: document.getElementById('round-count'),

    // Lead phase panel
    leadPanel: document.getElementById('lead-panel'),
    leadDescriptionInput: document.getElementById('lead-description-input'),

    // Member phase panel
    memberPanel: document.getElementById('member-panel'),
    currentDescriptionText: document.getElementById('current-description-text'),
    selectedCellText: document.getElementById('selected-cell-text'),
    memberWordInput: document.getElementById('member-word-input'),

    // Error & status
    turnError: document.getElementById('turn-error'),

    // History
    historyList: document.getElementById('history-list'),

    // End Screen
    endTitle: document.getElementById('end-title'),
    endRounds: document.getElementById('end-rounds'),
    endExplored: document.getElementById('end-explored'),
    endMessage: document.getElementById('end-message'),

    // Feedback
    feedbackOverlay: document.getElementById('feedback-overlay'),
    feedbackText: document.getElementById('feedback-text')
  };
}

/**
 * Show a specific screen and hide others
 * @param {string} screenName - 'setup', 'game', or 'end'
 * @returns {void}
 */
function showScreen(screenName) {
  els.setupScreen.classList.add('hidden');
  els.gameScreen.classList.add('hidden');
  els.endScreen.classList.add('hidden');

  switch (screenName) {
    case 'setup':
      els.setupScreen.classList.remove('hidden');
      break;
    case 'game':
      els.gameScreen.classList.remove('hidden');
      break;
    case 'end':
      els.endScreen.classList.remove('hidden');
      break;
  }
}

/**
 * Full render of the game UI
 * @param {Object} state - Game state
 * @returns {void}
 */
function renderAll(state) {
  // Set dynamic grid columns based on map size (inline style to override CSS)
  const gridSize = state.map.size;

  // Calculate cell size: scale proportionally
  // For gridSize=6: columnWidth≈83px; for gridSize=12: columnWidth≈42px
  const minCellSize = 40;
  const baseCellSize = 83;
  const baseGridSize = 6;
  const containerWidth = baseCellSize * baseGridSize; // = 498px
  const columnWidth = Math.max(minCellSize, Math.floor(containerWidth / gridSize));

  els.mapGrid.style.gridTemplateColumns = `repeat(${gridSize}, ${columnWidth}px)`;

  // Set grid-auto-rows to match column width for square aspect ratio
  els.mapGrid.style.gridAutoRows = `${columnWidth}px`;

  // Row-gap scales with cell size for hexagon overlap (geometric constant: 0.5 ratio)
  const hexagonOverlapRatio = 0.5;
  els.mapGrid.style.rowGap = `${-columnWidth * hexagonOverlapRatio}px`;

  // Update cell dimensions CSS variable
  document.documentElement.style.setProperty('--cell-size-dynamic', `${columnWidth}px`);

  renderMapGrid(state);
  renderGamePhase(state);
  clearHistory();
  showScreen('game');
}

/**
 * Render the hexagonal map grid with all cells
 * @param {Object} state - Game state
 * @returns {void}
 */
function renderMapGrid(state) {
  els.mapGrid.innerHTML = '';

  const gridSize = state.map.size;
  const cellSize = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--cell-size-dynamic').trim()) || 70;
  const offsetAmount = cellSize * 0.5; // Half cell width for hex offset

  state.map.tiles.forEach((tile, index) => {
    const cell = createCellElement(tile, state);

    // Calculate which row this cell is in
    const row = Math.floor(index / gridSize);

    // Odd rows (1, 3, 5...) are offset to the right by half cell width for hexagon pattern
    if (row % 2 === 1) {
      cell.style.marginLeft = `${offsetAmount}px`;
    }

    els.mapGrid.appendChild(cell);
  });
}

/**
 * Create a hexagonal cell DOM element
 * @param {Object} tile - Tile object
 * @param {Object} state - Game state
 * @returns {HTMLElement}
 */
function createCellElement(tile, state) {
  const cell = document.createElement('div');
  cell.id = `cell-${tile.key}`;
  cell.className = 'cell';
  cell.dataset.cellKey = tile.key;

  // Determine cell state classes
  if (tile.explored) {
    cell.classList.add('cell-explored');

    // Add curse/blessing indicators if explored
    if (tile.isCursed) {
      cell.classList.add('cell-cursed');
    } else if (tile.isBlessed) {
      cell.classList.add('cell-blessed');
    }

    // Add exit indicator if this is an exit
    if (tile.isExit) {
      cell.classList.add('cell-exit');
    }
  } else {
    // Check if cell is in unlocked region (adjacent to explored cells)
    const unlockedCells = getUnlockedCells(state.map.tiles, state.map.adjacency);
    const exploredTiles = state.map.tiles.filter(t => t.explored);

    // Check if this cell is directly adjacent to any explored cell
    const isAdjacent = exploredTiles.some(exploreTile =>
      state.map.adjacency[exploreTile.key].includes(tile.key)
    );

    if (isAdjacent) {
      cell.classList.add('cell-adjacent');
    } else if (unlockedCells.includes(tile.key)) {
      cell.classList.add('cell-unlocked');
    } else {
      cell.classList.add('cell-locked');
    }

    // LEAD PHASE: Show curse/blessing hints and exit hint
    // This allows the leader to see special blocks and plan strategy
    if (state.gameMode === 'lead') {
      if (tile.isCursed) {
        cell.classList.add('cell-curse-hint');
      } else if (tile.isBlessed) {
        cell.classList.add('cell-blessing-hint');
      }
      if (tile.isExit) {
        cell.classList.add('cell-exit-hint');
      }
    }
  }

  // Add word display if explored and has word
  if (tile.explored && tile.word) {
    const wordText = document.createElement('div');
    wordText.className = 'cell-word';
    wordText.textContent = tile.word;
    cell.appendChild(wordText);
  }

  return cell;
}

/**
 * Render game phase (lead vs. member) and update UI accordingly
 * @param {Object} state - Game state
 * @returns {void}
 */
function renderGamePhase(state) {
  els.roundCount.textContent = state.roundCount;

  // Update curse indicator
  updateCurseIndicator(state);

  if (state.gameMode === 'lead') {
    // Lead Captain Phase
    els.phaseLabel.textContent = '领队阶段';
    els.phaseDescription.textContent = '输入一个词汇';
    els.leadPanel.classList.remove('hidden');
    els.memberPanel.classList.add('hidden');

    // Re-render map to show exit hints in lead phase
    renderMapGrid(state);
  } else {
    // Member Placement Phase
    els.phaseLabel.textContent = '队员阶段';
    els.phaseDescription.textContent = '点击地图选择这个词汇应该放在哪里';
    els.leadPanel.classList.add('hidden');
    els.memberPanel.classList.remove('hidden');

    // Show the current word
    if (document.getElementById('current-word-text')) {
      document.getElementById('current-word-text').textContent = state.currentRound.word || '(无)';
    }

    // Re-render map to hide exit hints in member phase (privacy)
    renderMapGrid(state);
  }
}

/**
 * Update a single cell after word assignment
 * @param {string} cellKey - Cell key
 * @param {Object} tile - Tile object
 * @param {string} animClass - Animation class to apply
 * @returns {void}
 */
function updateCell(cellKey, tile, animClass = null) {
  const cellElem = document.getElementById(`cell-${cellKey}`);
  if (!cellElem) return;

  // Update classes
  cellElem.classList.remove('cell-locked', 'cell-unlocked', 'cell-selected');
  cellElem.classList.add('cell-explored');

  if (tile.isExit) {
    cellElem.classList.add('cell-exit');
  }

  // Add word text
  if (tile.word) {
    cellElem.innerHTML = '';
    const wordText = document.createElement('div');
    wordText.className = 'cell-word';
    wordText.textContent = tile.word;
    cellElem.appendChild(wordText);
  }

  // Add animation if specified
  if (animClass) {
    cellElem.classList.add(animClass);
    setTimeout(() => {
      cellElem.classList.remove(animClass);
    }, 600);
  }
}

/**
 * Update selected cell display
 * @param {string|null} cellKey - Cell key or null
 * @returns {void}
 */
function setSelectedCellDisplay(cellKey) {
  if (!cellKey) {
    els.selectedCellText.textContent = '未选择格子';
    els.selectedCellText.style.color = '';
  } else {
    const [row, col] = cellKey.split(',');
    els.selectedCellText.textContent = `选中位置: (${row}, ${col})`;
    els.selectedCellText.style.color = 'var(--accent-gold)';
  }
}

/**
 * Set selected cell visual state
 * @param {string|null} cellKey - Cell key or null
 * @returns {void}
 */
function setSelectedCell(cellKey) {
  // Remove old selection
  document.querySelectorAll('.cell-selected').forEach(el => {
    el.classList.remove('cell-selected');
  });

  // Add new selection if provided
  if (cellKey) {
    const cellElem = document.getElementById(`cell-${cellKey}`);
    if (cellElem) {
      cellElem.classList.add('cell-selected');
      // Update STATE to track selection
      if (typeof _getInternalState === 'function') {
        const internalState = _getInternalState();
        if (internalState) {
          internalState.currentRound.selectedCell = cellKey;
        }
      }
    }
  }

  setSelectedCellDisplay(cellKey);
}

/**
 * Show turn error message
 * @param {string} message - Error message
 * @returns {void}
 */
function showTurnError(message) {
  els.turnError.textContent = message;
  els.turnError.classList.remove('hidden');

  setTimeout(() => {
    els.turnError.classList.add('hidden');
  }, 3000);
}

/**
 * Clear turn error message
 * @returns {void}
 */
function clearTurnError() {
  els.turnError.classList.add('hidden');
}

/**
 * Append a history entry
 * @param {Object} entry - History entry {round, description, word, cellKey}
 * @returns {void}
 */
function appendHistoryEntry(entry) {
  const item = document.createElement('div');
  item.className = 'history-item';

  const header = document.createElement('div');
  header.className = 'history-item-header';
  header.innerHTML = `<strong>第 ${entry.round} 轮</strong>：${entry.word}`;

  item.appendChild(header);

  // Prepend to history (newest first)
  if (els.historyList.firstChild) {
    els.historyList.insertBefore(item, els.historyList.firstChild);
  } else {
    els.historyList.appendChild(item);
  }
}

/**
 * Clear history list
 * @returns {void}
 */
function clearHistory() {
  els.historyList.innerHTML = '';
}

/**
 * Show end screen
 * @param {string} result - 'won' or 'lost'
 * @param {Object} state - Final game state
 * @returns {void}
 */
function showEndScreen(result, state) {
  const isWon = result === 'won';
  const exploredCount = state.map.tiles.filter(t => t.explored).length;

  els.endTitle.textContent = isWon ? '🎉 成功到达出口！' : '💔 游戏结束';
  els.endTitle.className = isWon ? 'end-win' : 'end-loss';

  els.endRounds.textContent = state.roundCount;
  els.endExplored.textContent = exploredCount;

  if (isWon) {
    els.endMessage.innerHTML = `
      <div>恭喜！你成功探索到了地图上的出口！</div>
      <div style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
        探索了 <strong>${exploredCount}</strong> 个格子，用了 <strong>${state.roundCount}</strong> 轮
      </div>
    `;
  } else {
    els.endMessage.innerHTML = `
      <div>游戏结束。</div>
      <div style="margin-top: 1rem; font-size: 0.9rem; color: var(--text-secondary);">
        探索了 <strong>${exploredCount}</strong> 个格子，进行了 <strong>${state.roundCount}</strong> 轮
      </div>
    `;
  }

  showScreen('end');
}

/**
 * Show feedback overlay with message
 * @param {string} message - Feedback message
 * @param {number} duration - Duration in ms (default 2000)
 * @returns {void}
 */
function showFeedbackOverlay(message, duration = 2000) {
  els.feedbackText.textContent = message;
  els.feedbackOverlay.classList.remove('hidden');

  setTimeout(() => {
    els.feedbackOverlay.classList.add('hidden');
  }, duration);
}

/**
 * Flash screen with a color effect
 * @param {string} type - 'success' or 'failure'
 * @returns {void}
 */
function flashScreen(type) {
  const color = type === 'success' ? 'rgba(90, 143, 74, 0.4)' : 'rgba(154, 58, 58, 0.4)';
  const overlay = document.createElement('div');
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: ${color};
    pointer-events: none;
    z-index: 999;
    animation: flash-fade 0.8s ease-out forwards;
  `;

  document.body.appendChild(overlay);
  setTimeout(() => overlay.remove(), 800);
}

/**
 * Helper: Get unlocked cells (adjacent to explored)
 * @param {Array<Object>} tiles - Tiles array
 * @param {Object} adjacency - Adjacency graph
 * @returns {Array<string>}
 */
function getUnlockedCells(tiles, adjacency) {
  const unlocked = new Set();

  const exploredTiles = tiles.filter(tile => tile.explored);

  exploredTiles.forEach(tile => {
    unlocked.add(tile.key);
  });

  exploredTiles.forEach(tile => {
    adjacency[tile.key].forEach(neighborKey => {
      unlocked.add(neighborKey);
    });
  });

  return Array.from(unlocked);
}

/**
 * Update curse indicator display
 * @param {Object} state - Game state
 * @returns {void}
 */
function updateCurseIndicator(state) {
  const curseIndicator = document.getElementById('curse-indicator');
  const curseText = document.getElementById('curse-text');

  if (curseIndicator && state.curseValue !== undefined) {
    const blessingCount = state.blessingCount || 0;
    let displayText = '';

    if (state.curseValue > 0) {
      // Show curse value when > 0 with blessing count
      displayText = `💀 诅咒值: ${state.curseValue}/${state.numCurseBlocks}`;
    } else {
      // Show safe status with blessing count
      displayText = `✨ 诅咒值: 0/${state.numCurseBlocks}`;
    }

    // Add blessing count if any
    if (blessingCount > 0) {
      displayText += ` | 🛡️ 护身符: ${blessingCount}`;
    }

    if (curseText) {
      curseText.textContent = displayText;
    } else {
      curseIndicator.textContent = displayText;
    }
    curseIndicator.classList.remove('hidden');
  }
}

// Initialize on DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', cacheElements);
} else {
  cacheElements();
}
