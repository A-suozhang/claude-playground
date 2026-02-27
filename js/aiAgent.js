// AI Agent: Main AI decision-making logic
// Uses OpenRouter API to call LLM for semantic reasoning
// Dependencies: aiMapAnalyzer.js

// Load dependencies in Node.js environment
let aiMapAnalyzer_funcs;

if (typeof module !== 'undefined' && module.exports) {
  aiMapAnalyzer_funcs = require('./aiMapAnalyzer.js');
}

/**
 * Get functions from appropriate environment
 */
function getAIFuncs() {
  return (typeof module !== 'undefined' && module.exports) ? aiMapAnalyzer_funcs : {
    bfsDistances,
    getCandidateCells,
    buildCandidateContexts,
    getExploredWords
  };
}

/**
 * Build the prompt for LLM decision-making
 * @param {string} currentWord - The word to place
 * @param {Array} candidateContexts - Array of {cellKey, contexts: [{word, distance}]}
 * @param {Object} state - Current game state (for explored words)
 * @returns {string} The prompt text
 */
function buildPrompt(currentWord, candidateContexts, state) {
  const funcs = getAIFuncs();
  const exploredWords = funcs.getExploredWords(state);

  // Build candidate descriptions
  let candidatesSection = '';
  for (const {cellKey, contexts} of candidateContexts) {
    candidatesSection += `格子 "${cellKey}"：\n`;
    if (contexts.length === 0) {
      candidatesSection += '  （距离已知词汇过远，无邻接信息）\n';
    } else {
      for (const {word, distance} of contexts) {
        const proximityHint = distance === 1 ? '（紧邻）' : '';
        candidatesSection += `  - 与「${word}」距离${distance}步${proximityHint}\n`;
      }
    }
    candidatesSection += '\n';
  }

  const prompt = `你是词汇地图游戏中的AI队员。规则：地图格子有词汇，语义相关的词应放在距离更近的格子。

【领队词汇】：「${currentWord}」
【地图已有词汇】：${exploredWords.join('、')}

【候选格子】（只能选以下格子之一）：
${candidatesSection}【规则】语义越相关→应选择距离更近的格子。请选择最合适的格子。

输出 JSON（无其他内容）：
{"selectedCell":"行,列","reasoning":"理由（15字内）","confidence":0.8}`;

  return prompt;
}

/**
 * Call OpenRouter API to get AI decision
 * @param {string} prompt - The prompt to send
 * @param {string} apiKey - OpenRouter API key
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<string>} Raw response text from LLM
 */
async function callLLM(prompt, apiKey, timeoutMs = 15000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'meta-llama/llama-3.1-8b-instruct:free',
        messages: [
          {
            role: 'user',
            content: prompt
          }
        ],
        max_tokens: 150,
        temperature: 0.3
      }),
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    return content;
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      throw new Error('LLM request timeout');
    }
    throw error;
  }
}

/**
 * Parse JSON response from LLM
 * @param {string} rawText - Raw text from LLM
 * @param {Array} validCellKeys - List of valid cell keys for validation
 * @returns {Object|null} Parsed response or null if invalid
 */
function parseLLMResponse(rawText, validCellKeys) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return null;
    }

    const parsed = JSON.parse(jsonMatch[0]);

    // Validate required fields
    if (!parsed.selectedCell || !parsed.reasoning) {
      return null;
    }

    // Validate that selectedCell is in valid candidates
    if (!validCellKeys.includes(parsed.selectedCell)) {
      return null;
    }

    return {
      selectedCell: parsed.selectedCell,
      reasoning: String(parsed.reasoning).substring(0, 30),
      confidence: parsed.confidence || 0.5
    };
  } catch (error) {
    return null;
  }
}

/**
 * Fallback selection: pick cell with most direct neighbors (distance=1)
 * @param {Object} candidateContexts - Mapping from cellKey to distance array
 * @returns {string} Selected cell key
 */
function fallbackSelection(candidateContexts) {
  let bestCell = null;
  let maxNeighbors = -1;

  for (const [cellKey, contexts] of Object.entries(candidateContexts)) {
    // Count direct neighbors (distance == 1)
    const directNeighbors = contexts.filter(c => c.distance === 1).length;
    if (directNeighbors > maxNeighbors) {
      maxNeighbors = directNeighbors;
      bestCell = cellKey;
    }
  }

  // If no direct neighbors, pick first candidate
  if (bestCell === null) {
    bestCell = Object.keys(candidateContexts)[0];
  }

  return bestCell;
}

/**
 * Main AI decision function
 * @param {Object} state - Current game state
 * @param {string} apiKey - OpenRouter API key (can be empty for fallback-only)
 * @returns {Promise<Object>} {cellKey, reasoning, usedFallback}
 */
async function aiMemberDecide(state, apiKey) {
  const funcs = getAIFuncs();

  // Get candidate cells
  const candidateCells = funcs.getCandidateCells(state);
  if (candidateCells.length === 0) {
    throw new Error('No candidate cells available');
  }

  // Build contexts
  const contextsMap = funcs.buildCandidateContexts(state);

  // Convert to array format for prompt
  const candidateContexts = candidateCells.map(cellKey => ({
    cellKey,
    contexts: contextsMap[cellKey] || []
  }));

  // If no API key, use fallback immediately
  if (!apiKey || apiKey.trim() === '') {
    const selectedCell = fallbackSelection(contextsMap);
    return {
      cellKey: selectedCell,
      reasoning: '程序降级',
      usedFallback: true
    };
  }

  // Try to call LLM
  try {
    const prompt = buildPrompt(state.currentRound.word, candidateContexts, state);
    const llmResponse = await callLLM(prompt, apiKey);

    // Parse response
    const parsed = parseLLMResponse(llmResponse, candidateCells);

    if (parsed) {
      return {
        cellKey: parsed.selectedCell,
        reasoning: parsed.reasoning,
        usedFallback: false
      };
    }

    // If parsing failed, use fallback
    const selectedCell = fallbackSelection(contextsMap);
    return {
      cellKey: selectedCell,
      reasoning: '推理无效，已降级',
      usedFallback: true
    };
  } catch (error) {
    // API or timeout error, use fallback
    const selectedCell = fallbackSelection(contextsMap);
    return {
      cellKey: selectedCell,
      reasoning: '网络错误，已降级',
      usedFallback: true
    };
  }
}

// Export functions for browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    buildPrompt,
    callLLM,
    parseLLMResponse,
    fallbackSelection,
    aiMemberDecide
  };
}
