/* ============================================================================
   DISCO ELYSIUM — GAME ENGINE
   ============================================================================ */

/* GAME STATE */
const STATE = {
    currentNodeId: 'node_0_opening',
    dialogueHistory: [],
    playerStats: {
        hp: PLAYER_STATS.hp,
        maxHp: PLAYER_STATS.maxHp,
        morale: PLAYER_STATS.morale,
        maxMorale: PLAYER_STATS.maxMorale,
    },
    completedChecks: new Set(),
    thoughts: { ...THOUGHTS },
    currentSkillCheck: null,
};

/* DOM ELEMENTS */
let els = {};

/* INITIALIZATION */
window.addEventListener('DOMContentLoaded', () => {
    cacheElements();
    initializeThoughtsCabinet();
    validateDialogueNodes();
    advanceToNode(STATE.currentNodeId);
    updateStatsDisplay();
});

function cacheElements() {
    els = {
        sceneText: document.getElementById('scene-text'),
        dialogueFeed: document.getElementById('dialogue-feed'),
        choicesContainer: document.getElementById('choices-container'),
        screenFlash: document.getElementById('screen-flash'),
        skillCheckModal: document.getElementById('skill-check-modal'),
        skillCheckTitle: document.getElementById('skill-check-title'),
        diceLeft: document.getElementById('dice-left'),
        diceRight: document.getElementById('dice-right'),
        skillCheckResult: document.getElementById('skill-check-result'),
        skillCheckButton: document.getElementById('skill-check-button'),
        hpFill: document.getElementById('hp-fill'),
        moraleFill: document.getElementById('morale-fill'),
        hpText: document.getElementById('hp-text'),
        moraleText: document.getElementById('morale-text'),
        thoughtsGrid: document.getElementById('thoughts-grid'),
    };
}

/* ============================================================================
   CORE DIALOGUE ENGINE
   ============================================================================ */

function advanceToNode(nodeId) {
    const node = DIALOGUE_NODES.find(n => n.id === nodeId);
    if (!node) {
        console.error('Node not found:', nodeId);
        return;
    }

    STATE.currentNodeId = nodeId;

    // Render based on node type
    switch (node.type) {
        case 'narration':
            renderNarration(node);
            break;
        case 'dialogue':
            renderDialogue(node);
            break;
        case 'skill_voice':
            renderSkillVoice(node);
            break;
        case 'choice':
            renderChoices(node);
            break;
        default:
            console.warn('Unknown node type:', node.type);
    }

    // Apply stat changes if any
    if (node.statChange) {
        modifyStats(node.statChange);
    }

    // Unlock thoughts if any
    if (node.unlockThought) {
        unlockThought(node.unlockThought);
    }

    // Auto-advance to next if no choices
    if (node.next && node.type !== 'choice') {
        setTimeout(() => advanceToNode(node.next), 2500);
    }
}

function renderNarration(node) {
    els.sceneText.innerHTML = '';
    typewriterEffect(els.sceneText, node.text, () => {
        addToDialogueFeed(node.text, 'narration');
    });
}

function renderDialogue(node) {
    els.sceneText.innerHTML = '';
    const fullText = `${node.character}\n\n${node.text}`;
    typewriterEffect(els.sceneText, fullText, () => {
        addToDialogueFeed(`${node.character}: ${node.text}`);
    });
}

function renderSkillVoice(node) {
    els.sceneText.innerHTML = '';
    typewriterEffect(els.sceneText, node.text, () => {
        addToDialogueFeed(node.text, 'skill-voice');
    });
}

function renderChoices(node) {
    els.choicesContainer.innerHTML = '';
    const choicesDiv = document.createElement('div');

    node.choices.forEach((choice, idx) => {
        const button = document.createElement('button');
        button.className = 'choice-button';

        // Apply visual styling based on choice type
        if (choice.type === 'red') {
            button.classList.add('choice-skill-red');
        } else if (choice.type === 'white') {
            button.classList.add('choice-skill-white');
        }

        // Check if skill check has been completed (red checks can only be done once)
        if (choice.skillCheck && choice.type === 'red') {
            const checkId = SKILL_CHECKS[choice.skillCheck]?.id;
            if (STATE.completedChecks.has(checkId)) {
                button.disabled = true;
                button.classList.add('choice-locked');
                button.textContent = `(${choice.text}) [LOCKED]`;
                button.setAttribute('aria-disabled', 'true');
            } else {
                button.textContent = choice.text;
                button.addEventListener('click', () => {
                    if (choice.skillCheck) {
                        openSkillCheckModal(choice.skillCheck, choice);
                    } else {
                        advanceToNode(choice.next);
                    }
                });
            }
        } else {
            button.textContent = choice.text;
            button.addEventListener('click', () => {
                if (choice.skillCheck) {
                    openSkillCheckModal(choice.skillCheck, choice);
                } else if (choice.next) {
                    advanceToNode(choice.next);
                }
            });
        }

        choicesDiv.appendChild(button);
    });

    els.choicesContainer.appendChild(choicesDiv);

    // Focus first button for keyboard navigation
    const firstButton = choicesDiv.querySelector('button:not(:disabled)');
    if (firstButton) {
        setTimeout(() => firstButton.focus(), 100);
    }
}

/* ============================================================================
   TYPEWRITER EFFECT
   ============================================================================ */

function typewriterEffect(element, text, callback) {
    element.textContent = '';
    let index = 0;
    const speed = 25; // ms per character

    // Check for reduced motion preference
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function type() {
        if (index < text.length) {
            element.textContent += text.charAt(index);
            index++;
            if (!prefersReducedMotion) {
                setTimeout(type, speed);
            } else {
                type();
            }
        } else {
            if (callback) callback();
        }
    }

    if (prefersReducedMotion) {
        element.textContent = text;
        if (callback) callback();
    } else {
        type();
    }
}

/* ============================================================================
   DIALOGUE FEED MANAGEMENT
   ============================================================================ */

function addToDialogueFeed(text, className = '') {
    const entry = document.createElement('div');
    entry.className = `dialogue-entry ${className}`;
    entry.textContent = text;
    els.dialogueFeed.appendChild(entry);

    // Keep only last N entries in memory, fade older ones
    updateDialogueFadeState();
    scrollFeedToBottom();
}

function updateDialogueFadeState() {
    const entries = els.dialogueFeed.querySelectorAll('.dialogue-entry');
    entries.forEach((entry, idx) => {
        if (idx < entries.length - 2) {
            entry.classList.add('faded');
        } else {
            entry.classList.remove('faded');
        }
    });
}

function scrollFeedToBottom() {
    els.dialogueFeed.scrollTop = els.dialogueFeed.scrollHeight;
}

/* ============================================================================
   SKILL CHECKS & DICE ROLLING
   ============================================================================ */

function openSkillCheckModal(checkId, choice) {
    const check = SKILL_CHECKS[checkId];
    if (!check) {
        console.error('Skill check not found:', checkId);
        return;
    }

    STATE.currentSkillCheck = { check, choice };

    // Show modal
    els.skillCheckModal.classList.add('active');
    els.skillCheckTitle.textContent = `${SKILLS[check.skill].name} Check — Difficulty ${check.difficulty}`;
    els.skillCheckResult.textContent = '';
    els.diceLeft.textContent = '?';
    els.diceRight.textContent = '?';

    // Start dice rolling animation
    rollDice(check, choice);
}

function rollDice(check, choice) {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Pre-determine result
    const roll = Math.floor(Math.random() * 6) + 1;
    const roll2 = Math.floor(Math.random() * 6) + 1;
    const skillLevel = PLAYER_SKILLS[check.skill];
    const total = roll + roll2 + skillLevel;
    const success = total >= check.difficulty;

    // Animate dice rolling
    if (!prefersReducedMotion) {
        let rollCount = 0;
        const rollInterval = setInterval(() => {
            els.diceLeft.textContent = Math.floor(Math.random() * 6) + 1;
            els.diceRight.textContent = Math.floor(Math.random() * 6) + 1;
            rollCount++;

            if (rollCount > 30) {
                clearInterval(rollInterval);
                showDiceResult(roll, roll2, skillLevel, total, check, choice, success);
            }
        }, 33);
    } else {
        showDiceResult(roll, roll2, skillLevel, total, check, choice, success);
    }
}

function showDiceResult(roll, roll2, skillLevel, total, check, choice, success) {
    els.diceLeft.textContent = roll;
    els.diceRight.textContent = roll2;

    const resultText = document.createElement('div');
    resultText.innerHTML = `
        <div>${roll} + ${roll2} + ${skillLevel} (${SKILLS[check.skill].name}) = <strong>${total}</strong></div>
        <div style="margin-top: 8px; font-weight: bold; color: ${success ? '#22aa22' : '#cc3333'}">
            ${success ? 'SUCCESS' : 'FAILURE'} vs DC ${check.difficulty}
        </div>
    `;
    els.skillCheckResult.innerHTML = '';
    els.skillCheckResult.appendChild(resultText);

    // Update button action
    els.skillCheckButton.onclick = () => {
        closeSkillCheckModal();
        flashScreen(success ? 'success' : 'failure');

        // Mark red checks as completed
        if (check.checkType === 'red') {
            STATE.completedChecks.add(check.id);
        }

        // Advance to appropriate node
        const nextNodeId = success ? check.onSuccess : check.onFailure;
        setTimeout(() => advanceToNode(nextNodeId), 800);
    };
}

function closeSkillCheckModal() {
    els.skillCheckModal.classList.remove('active');
}

function flashScreen(type) {
    els.screenFlash.classList.remove('flash-success', 'flash-failure');
    els.screenFlash.offsetHeight; // Trigger reflow
    els.screenFlash.classList.add(`flash-${type}`);
}

/* ============================================================================
   STATS MANAGEMENT
   ============================================================================ */

function modifyStats(changes) {
    if (changes.hp) {
        STATE.playerStats.hp = Math.max(0, Math.min(STATE.playerStats.maxHp, STATE.playerStats.hp + changes.hp));
    }
    if (changes.morale) {
        STATE.playerStats.morale = Math.max(0, Math.min(STATE.playerStats.maxMorale, STATE.playerStats.morale + changes.morale));
    }
    if (changes.intellect) {
        PLAYER_SKILLS.intellect = Math.max(1, PLAYER_SKILLS.intellect + changes.intellect);
    }
    if (changes.psyche) {
        PLAYER_SKILLS.psyche = Math.max(1, PLAYER_SKILLS.psyche + changes.psyche);
    }
    if (changes.physique) {
        PLAYER_SKILLS.physique = Math.max(1, PLAYER_SKILLS.physique + changes.physique);
    }
    if (changes.motorics) {
        PLAYER_SKILLS.motorics = Math.max(1, PLAYER_SKILLS.motorics + changes.motorics);
    }
    updateStatsDisplay();
}

function updateStatsDisplay() {
    const hpPercent = (STATE.playerStats.hp / STATE.playerStats.maxHp) * 100;
    const moralePercent = (STATE.playerStats.morale / STATE.playerStats.maxMorale) * 100;

    els.hpFill.style.width = `${hpPercent}%`;
    els.moraleFill.style.width = `${moralePercent}%`;
    els.hpText.textContent = `${STATE.playerStats.hp} / ${STATE.playerStats.maxHp}`;
    els.moraleText.textContent = `${STATE.playerStats.morale} / ${STATE.playerStats.maxMorale}`;
}

/* ============================================================================
   THOUGHTS CABINET
   ============================================================================ */

function initializeThoughtsCabinet() {
    els.thoughtsGrid.innerHTML = '';
    Object.entries(STATE.thoughts).forEach(([key, thought]) => {
        const item = document.createElement('div');
        item.className = `thought-item ${thought.unlocked ? 'unlocked' : 'locked'}`;
        item.textContent = thought.icon;
        item.title = thought.unlocked ? `${thought.title}: ${thought.description}` : 'Locked';
        item.dataset.thoughtKey = key;

        item.addEventListener('click', () => {
            if (thought.unlocked) {
                alert(`${thought.title}\n\n${thought.description}`);
            }
        });

        els.thoughtsGrid.appendChild(item);
    });
}

function unlockThought(thoughtKey) {
    if (STATE.thoughts[thoughtKey]) {
        STATE.thoughts[thoughtKey].unlocked = true;
        const thoughtItem = els.thoughtsGrid.querySelector(`[data-thought-key="${thoughtKey}"]`);
        if (thoughtItem) {
            thoughtItem.classList.add('unlocked');
            thoughtItem.classList.remove('locked');
            thoughtItem.title = `${STATE.thoughts[thoughtKey].title}: ${STATE.thoughts[thoughtKey].description}`;
        }

        // Apply thought effects
        const effect = STATE.thoughts[thoughtKey].effect;
        if (effect) {
            modifyStats(effect);
        }
    }
}

/* ============================================================================
   KEYBOARD ACCESSIBILITY
   ============================================================================ */

document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
        const buttons = els.choicesContainer.querySelectorAll('.choice-button:not(:disabled)');
        if (buttons.length === 1) {
            buttons[0].click();
        }
    }

    if (e.key === 'Escape') {
        closeSkillCheckModal();
    }
});

/* ============================================================================
   DEBUG: log state to console
   ============================================================================ */

window.debugState = () => {
    console.log('Game State:', STATE);
    console.log('Player Skills:', PLAYER_SKILLS);
    console.log('Thoughts:', STATE.thoughts);
};

window.skipToNode = (nodeId) => {
    const node = DIALOGUE_NODES.find(n => n.id === nodeId);
    if (node) {
        advanceToNode(nodeId);
    } else {
        console.error('Node not found:', nodeId);
    }
};
