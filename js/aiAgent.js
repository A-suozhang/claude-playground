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

  const prompt = `你是词汇地图游戏中的AI队员。

⚠️ 【输出要求】（最重要）：
1. ✅ selectedCell 必须是下列候选列表中的格子，不能超出范围
2. ✅ 输出必须是有效的 JSON 格式：{"selectedCell":"行,列","reasoning":"理由","confidence":0.8}
3. ✅ 无其他文字，只输出 JSON

【游戏规则】：地图格子有词汇，你需要放置领队给的词汇，使得语义相关的词尽可能靠近。

【核心决策策略】：
1️⃣ 第一步：判断高度相关词汇
   - 分析「${currentWord}」是否与某个或多个已有词汇高度相关（语义相关、同类别、同地域等）
   - 如果存在高度相关的词，优先选择与它们相邻的格子（距离=1步）

2️⃣ 第二步：确保与高度相关词相邻
   - 如有多个高度相关的词，找与它们共同相邻的格子
   - 🔴 绝对优先原则：在确保与高度相关词汇相邻的前提下再做其他选择

3️⃣ 第三步：精细选择
   - 在所有与高度相关词相邻的格子中，根据与其他词汇的关联度和几何距离选择最合适的
   - 综合考虑：与其他词的相关性 + 几何距离的均衡

【领队词汇】：「${currentWord}」
【地图已有词汇】：${exploredWords.join('、')}

【候选格子列表】（你只能从这些格子中选择）：
${candidatesSection}【距离说明】：
- 距离N步 = 拓扑距离，经过N个格子才能到达
- 几何距离Xpx = 实际像素空间距离（更准确反映物理接近度）
- (紧邻) = 距离1步，最近的相邻位置（第一步需要寻找的目标）

【决策步骤】：
1. 识别「${currentWord}」的关键特征（地理位置/文物类型/历史时期/文化特征等）
2. 逐个分析与已有词汇的相关性：
   - 说出为什么认为与某词"高度相关"（地理邻近/文化关联/历史联系等）
   - 标注每个相关词的距离信息
3. 在与高度相关词相邻的格子中比较：
   - 计算几何距离（px）差异
   - 解释为什么选择这个格子而不是另一个
4. 最终输出：selectedCell、简短理由、置信度

【思考过程示例】：
- 「埃菲尔铁塔」与「罗马斗兽场」都是欧洲建筑，高度相关！距离1步（紧邻）
- 「罗马斗兽场」在格子 0,1
- 与它相邻的候选格子中，0,2 距离为 150px，0,3 距离为 220px
- 0,2 几何距离最近，选择它

📋 【输出格式】（必须严格遵守）：
{"selectedCell":"行,列","reasoning":"关键依据+选择原因（可包含距离数字）","confidence":0.8}

💡 reasoning 可以包含：
- reasoning 例：「欧洲地标，靠近斗兽场 150px」
- reasoning 例：「同文化时期，距罗马1步、距长城2步」
- reasoning 例：「几何距离权衡：0,1=80px vs 0,2=140px，选0,1」

✅ 你的选择必须是上面候选列表中的格子！`;

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
        model: 'openai/gpt-oss-120b:free',
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
 * @returns {Object|null} Parsed response with error info or null if invalid
 */
function parseLLMResponse(rawText, validCellKeys) {
  try {
    // Check if response is empty
    if (!rawText || rawText.trim() === '') {
      return {
        error: 'LLM 返回空响应',
        rawResponse: rawText
      };
    }

    // Try to extract JSON from the response
    const jsonMatch = rawText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return {
        error: '无法从响应中提取JSON格式',
        rawResponse: rawText
      };
    }

    let parsed;
    try {
      parsed = JSON.parse(jsonMatch[0]);
    } catch (parseError) {
      return {
        error: `JSON解析错误: ${parseError.message}`,
        rawResponse: rawText
      };
    }

    // Validate required fields
    if (!parsed.selectedCell) {
      return {
        error: '缺少必需字段: selectedCell',
        rawResponse: rawText
      };
    }

    if (!parsed.reasoning) {
      return {
        error: '缺少必需字段: reasoning',
        rawResponse: rawText
      };
    }

    // Validate that selectedCell is in valid candidates
    if (!validCellKeys.includes(parsed.selectedCell)) {
      return {
        error: `无效的格子位置: "${parsed.selectedCell}" 不在候选格子中`,
        rawResponse: rawText
      };
    }

    return {
      selectedCell: parsed.selectedCell,
      reasoning: String(parsed.reasoning).substring(0, 30),
      confidence: parsed.confidence || 0.5
    };
  } catch (error) {
    return {
      error: `未知错误: ${error.message}`,
      rawResponse: rawText
    };
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

  // Try to call LLM with retry logic
  const maxRetries = 3;
  let lastError = null;
  let lastResponse = null;
  let lastParsed = null;

  for (let retryCount = 0; retryCount < maxRetries; retryCount++) {
    try {
      const prompt = buildPrompt(state.currentRound.word, candidateContexts, state);
      const llmResponse = await callLLM(prompt, apiKey);
      lastResponse = llmResponse;

      // Check if response is empty
      if (!llmResponse || llmResponse.trim() === '') {
        lastError = '空响应';
        continue; // Retry
      }

      // Parse response
      const parsed = parseLLMResponse(llmResponse, candidateCells);
      lastParsed = parsed;

      if (parsed && !parsed.error) {
        // Success! Return the result
        return {
          cellKey: parsed.selectedCell,
          reasoning: parsed.reasoning,
          usedFallback: false,
          prompt: prompt,
          candidatesInfo: candidatesInfo,
          llmResponse: llmResponse,
          rawJson: llmResponse,
          strategy: `LLM策略: GPT-OSS-120B 基于语义相关性推理\n选中格子: "${parsed.selectedCell}"\n置信度: ${parsed.confidence.toFixed(2)}${retryCount > 0 ? `\n(重试 ${retryCount}/${maxRetries})` : ''}`
        };
      }

      // Parsing failed, record error and retry
      lastError = parsed?.error || '未知错误';
      lastParsed = parsed;
      // Continue to next retry

    } catch (error) {
      // API error, save and retry
      lastError = error.message;
      continue;
    }
  }

  // All retries exhausted, use fallback
  const selectedCell = fallbackSelection(contextsMap);
  const finalErrorReason = lastError || '未知错误';
  const originalResponse = lastParsed?.rawResponse || lastResponse || '(无响应)';

  return {
    cellKey: selectedCell,
    reasoning: '推理无效，已降级',
    usedFallback: true,
    prompt: buildPrompt(state.currentRound.word, candidateContexts, state),
    candidatesInfo: candidatesInfo,
    llmResponse: `【❌ 解析失败】${finalErrorReason}\n【⚠️ 已重试 ${maxRetries} 次】\n\n【📝 最后一次响应】\n${originalResponse}`,
    rawJson: lastResponse || '{}',
    strategy: `JSON解析失败: ${finalErrorReason} (已重试${maxRetries}次)\n降级到启发式算法\n选中格子: "${selectedCell}"`
  };
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
