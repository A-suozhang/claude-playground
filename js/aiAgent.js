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
 * @param {Array} candidateContexts - Array of {cellKey, contexts: [{word, distance, geometricDistance}]}
 * @param {Object} state - Current game state (for explored words)
 * @returns {string} The prompt text
 */
function buildPrompt(currentWord, candidateContexts, state) {
  const funcs = getAIFuncs();
  const exploredWords = funcs.getExploredWords(state);

  // Build candidate descriptions with geometric distance info
  let candidatesSection = '';
  for (const {cellKey, contexts} of candidateContexts) {
    candidatesSection += `格子 "${cellKey}"：\n`;
    if (contexts.length === 0) {
      candidatesSection += '  （距离已知词汇过远，无邻接信息）\n';
    } else {
      for (const {word, distance, geometricDistance} of contexts) {
        const proximityHint = distance === 1 ? '（紧邻）' : '';
        const geoHint = geometricDistance ? `[几何距离: ${Math.round(geometricDistance)}px]` : '';
        candidatesSection += `  - 与「${word}」距离${distance}步${proximityHint} ${geoHint}\n`;
      }
    }
    candidatesSection += '\n';
  }

  const prompt = `你是词汇地图游戏中的AI队员。规则：地图格子有词汇，语义相关的词应放在距离更近的格子。

【领队词汇】：「${currentWord}」
【地图已有词汇】：${exploredWords.join('、')}

【候选格子】（只能选以下格子之一，注意几何距离反映真实空间接近度）：
${candidatesSection}【规则】语义越相关→应选择距离更近的格子。请选择最合适的格子。
注：距离值包括：
- 步数 = 经过多少个格子的拓扑距离
- 几何距离 = 实际像素距离（更准确反映空间接近度）

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
        model: 'openrouter/free',
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
 * Format candidate contexts for display (with geometric distances)
 * @param {Object} contextsMap - Map of cellKey to distance contexts
 * @returns {string} Formatted text for display
 */
function formatCandidatesForDisplay(contextsMap) {
  let text = '';
  for (const [cellKey, contexts] of Object.entries(contextsMap)) {
    text += `格子 "${cellKey}":\n`;
    if (contexts.length === 0) {
      text += '  （无邻接词汇）\n';
    } else {
      for (const {word, distance, geometricDistance} of contexts) {
        const geoInfo = geometricDistance ? ` [${Math.round(geometricDistance)}px]` : '';
        text += `  - "${word}" (${distance}步${geoInfo})\n`;
      }
    }
  }
  return text;
}

/**
 * Main AI decision function (with detailed tracing)
 * @param {Object} state - Current game state
 * @param {string} apiKey - OpenRouter API key (can be empty for fallback-only)
 * @returns {Promise<Object>} {cellKey, reasoning, usedFallback, prompt, candidatesInfo, llmResponse, rawJson}
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

  // Format candidate info for display
  const candidatesInfo = formatCandidatesForDisplay(contextsMap);

  // If no API key, use fallback immediately
  if (!apiKey || apiKey.trim() === '') {
    const selectedCell = fallbackSelection(contextsMap);
    return {
      cellKey: selectedCell,
      reasoning: '无API Key，使用本地启发式算法',
      usedFallback: true,
      prompt: '（未使用LLM，直接降级）',
      candidatesInfo: candidatesInfo,
      llmResponse: '（已跳过LLM调用）',
      rawJson: '{}',
      strategy: `降级策略：选择与已探索格子直接相邻(1步)最多的格子。\n选中格子: "${selectedCell}"，相邻词汇数: ${contextsMap[selectedCell]?.filter(c => c.distance === 1).length || 0}`
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
        usedFallback: false,
        prompt: prompt,
        candidatesInfo: candidatesInfo,
        llmResponse: llmResponse,
        rawJson: llmResponse,
        strategy: `LLM策略: llama-3.1-8b 基于语义相关性推理\n选中格子: "${parsed.selectedCell}"\n置信度: ${parsed.confidence.toFixed(2)}`
      };
    }

    // If parsing failed, use fallback
    const selectedCell = fallbackSelection(contextsMap);
    return {
      cellKey: selectedCell,
      reasoning: '推理无效，已降级',
      usedFallback: true,
      prompt: prompt,
      candidatesInfo: candidatesInfo,
      llmResponse: `解析失败，原始响应:\n${llmResponse}`,
      rawJson: llmResponse,
      strategy: `JSON解析失败，降级到启发式算法\n选中格子: "${selectedCell}"`
    };
  } catch (error) {
    // API or timeout error, use fallback
    const selectedCell = fallbackSelection(contextsMap);
    return {
      cellKey: selectedCell,
      reasoning: `网络/超时错误，已降级 (${error.message})`,
      usedFallback: true,
      prompt: buildPrompt(state.currentRound.word, candidateContexts, state),
      candidatesInfo: candidatesInfo,
      llmResponse: `API错误: ${error.message}`,
      rawJson: '{}',
      strategy: `API调用失败，降级到启发式算法\n选中格子: "${selectedCell}"`
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
    formatCandidatesForDisplay,
    aiMemberDecide
  };
}
