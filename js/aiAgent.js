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
 * Extract thinking/internal reasoning from LLM response
 * Handles both <thinking></thinking> tags and natural thinking markers
 * @param {string} rawText - Raw response from LLM
 * @returns {string} Extracted thinking text, or empty string if none found
 */
function extractThinkingFromResponse(rawText) {
  if (!rawText) return '';

  // Try to extract <thinking>...</thinking> blocks
  const thinkingMatch = rawText.match(/<thinking>([\s\S]*?)<\/thinking>/i);
  if (thinkingMatch && thinkingMatch[1]) {
    return thinkingMatch[1].trim();
  }

  // Try to extract reasoning before JSON (common pattern)
  const beforeJsonMatch = rawText.match(/([\s\S]*?)(?={[\s\S]*?"selectedCell"[\s\S]*?})/);
  if (beforeJsonMatch && beforeJsonMatch[1].trim().length > 0) {
    const beforeJson = beforeJsonMatch[1].trim();
    // Only return if it looks like actual reasoning (not just whitespace/noise)
    if (beforeJson.length > 10) {
      return beforeJson;
    }
  }

  return '';
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

【核心决策原则 - 相对比较分析】（重点改变！）
不是用绝对标准判断强/弱相关，而是：
  ✓ 对比「${currentWord}」与地图上每个已有词汇的相关程度
  ✓ 找出最相关的词（TOP相关词），和其他词的关联程度差异有多大
  ✓ 根据相关性的"集中度"（是否高度聚焦vs广泛相关）来决策

【决策原理】：

📊 相关性分析 - 找出"最相关的词"
当你分析「${currentWord}」时：
1. 列出与其相关的已有词汇（按相关程度排序）
2. 识别TOP相关词（最相关的1-2个词）
3. 评估其他词与TOP词的相关程度差异

【三种情况对应的位置选择】：

情况1️⃣：与TOP词的关联度远高于其他词（相关性集中）
  特征：只有1-2个词特别相关，其他词关联度明显低
  例：「长城」对「秦陵」相关度90%，对「罗马」相关度20%
  → 优先选择与TOP词（秦陵）相邻的格子
  → 不必考虑其他词（相关度差异大）
  → 置信度：0.85-0.95

情况2️⃣：与多个词的关联度都较高且接近（相关性分散）
  特征：有2-3个词与新词的相关度都在70%以上，差异<20%
  例：「泰姬陵」对「德里」80%，对「克什米尔」75%，对「莫卧儿」72%
  → 寻找与这些词都接近的"枢纽"位置
  → 如果无中心位置，选择与最相关词相邻的位置
  → 或考虑与其中某个词相邻，靠近另一个词（距离2步但几何近）
  → 置信度：0.70-0.85

情况3️⃣：与所有词的关联度都较低或平均（相关性平散）
  特征：没有明显的TOP相关词，相关度都在40-60%，或没有特别接近的词
  例：「撒哈拉沙漠」对各地标的相关度都在30-50%之间，无明显高点
  → 这是主动探索的机会！
  → 优先考虑开拓新地域、与单个词相邻
  → 寻找"连接潜力"：与某词相邻，同时靠近其他词（形成聚类种子）
  → 置信度：0.60-0.75

【具体分析步骤】：

第1步：列举相关度排序
  将已有词汇按与「${currentWord}」的关联程度从高到低列出
  为每个词估算相关度百分比（0-100%）

  例：「秦始皇陵」分析
  A. 「长城」     → 85% (同朝代、同防御体系、同中国)
  B. 「故宫」     → 75% (同中国、同古代遗迹、但不同朝代)
  C. 「埃菲尔」   → 20% (都是著名建筑，但地域完全不同)
  D. 「泰姬陵」   → 25% (都是帝王陵墓，但不同文明)

第2步：识别相关度"梯度"（关键！）
  观察排序中的相关度变化：
  - 陡峭梯度：A=85%, B=75%, C=20%
    → 有明显的"TOP相关词"(A和B)，与C、D关联大幅下降
    → 决策：倾向于与A、B相邻，不考虑C、D方向

  - 平缓梯度：A=75%, B=73%, C=70%, D=68%
    → 相关度接近，没有明显的TOP词
    → 决策：多个词都有适度关联，应寻找中心位置或平衡位置

  - 平散梯度：A=50%, B=48%, C=45%, D=43%
    → 整体相关度都很低，无明显TOP词
    → 决策：这是探索机会，不必被任何词约束

第3步：候选位置评估
  根据上面的梯度判断，评估每个候选格子：

  对于陡峭梯度（TOP词明显）：
    ✓ 与TOP词相邻 (距离1步) → 置信度0.90+ 最优
    ✓ 与TOP词距离2步但几何<150px → 置信度0.85 很好
    ✓ 与TOP词距离3步 → 置信度0.70 可考虑
    ✗ 靠近低相关词 → 置信度<0.50 避免

  对于平缓梯度（多词相关）：
    ✓ 与顶部2-3个词都接近的"中心"位置 → 置信度0.80+ 最优
    ✓ 与其中一个词相邻，距离另一个词2步但几何近 → 置信度0.75 很好
    ✓ 与任意相关词相邻 → 置信度0.70
    ✗ 远离所有词 → 避免

  对于平散梯度（整体低相关）：
    ✓ 开拓新地域，与某词相邻即可 → 置信度0.65 探索
    ✓ 选择能连接多个词的"聚类种子"位置 → 置信度0.70 很好
    ✓ 距离已有词簇2-3步的空白区 → 置信度0.65 探索
    ✓ 任何相邻位置都可接受 → 置信度0.60+

第4步：确认选择
  最终检查：
    - 这个格子确实与候选列表匹配吗？✓
    - 这个选择能否解释清楚？✓
    - 置信度与相关度梯度是否匹配？✓

【领队词汇】：「${currentWord}」
【地图已有词汇】：${exploredWords.join('、')}

【候选格子列表】（你只能从这些格子中选择）：
${candidatesSection}【距离说明】：
- 距离N步 = 拓扑距离（经过的格子数），步数越少越接近
- 几何距离Xpx = 实际像素距离，这比拓扑距离更准确反映物理接近度
- (紧邻) = 距离1步，直接相邻

【思考过程示例】：

示例1 - 陡峭梯度（TOP词明显）：
题目：新词「正定古城」，已有词：[「北京」→92%, 「天津」→88%, 「杭州」→25%, 「巴黎」→5%]
分析：
  - TOP词明显：北京、天津相关度都很高(>85%)，与杭州、巴黎差异大(>60%)
  - 梯度特征：陡峭，有明显的"北方"和"南方/国外"分割
  - 决策：必须与北京或天津相邻，不考虑南方或国外方向
  - 候选位置：与北京相邻的格子最优(0.92置信度)，与天津相邻的次优(0.88)
  - 输出：{"selectedCell":"1,2","reasoning":"相关度对比：北京92%远高于其他词，与其相邻","confidence":0.92}

示例2 - 平缓梯度（多词相关）：
题目：新词「莫卧儿时代」，已有词：[「德里」→85%, 「克什米尔」→82%, 「孟加拉」→78%, 「阿格拉」→75%]
分析：
  - 多个词相关度接近(75-85%)，梯度平缓
  - 都指向"南亚印度次大陆的同一历史时期"
  - 决策：寻找能与这些词都接近的"中心"位置
  - 候选位置：
    * 如果有与德里相邻、同时与克什米尔距离2步但几何近的 → 选(0.82置信度)
    * 否则选与德里相邻(0.85置信度)
  - 输出：{"selectedCell":"2,3","reasoning":"相关度平缓(85%/82%/78%)，选与TOP词德里相邻的中心位置","confidence":0.82}

示例3 - 平散梯度（整体低相关）：
题目：新词「撒哈拉沙漠」，已有词：[「尼罗河」→45%, 「开罗」→42%, 「长城」→28%, 「泰姬陵」→25%]
分析：
  - 所有词相关度都不高(最高45%)，梯度平散
  - 没有明显的"必须靠近"的词
  - 这是积极探索的机会！
  - 决策：开拓新地域，选择能与某词相邻+靠近其他词的位置
  - 候选位置：
    * 与尼罗河相邻，且距离开罗2步但几何近 → 选(0.70置信度)
    * 或任何与某词相邻的位置 → 接受(0.65置信度)
  - 输出：{"selectedCell":"3,1","reasoning":"相关度平散(45%/42%),无强关联词,开拓新地域与尼罗河相邻","confidence":0.68}

【输出格式】（必须严格遵守）：
{"selectedCell":"行,列","reasoning":"相关度分析+选择理由+关键距离","confidence":0.X}

💡 reasoning 示例：
- "相关度陡峭：A词92%远高于其他,选与其相邻"
- "相关度平缓：多词75-85%接近,选中心枢纽位置"
- "相关度平散：全部<50%,开拓新地域与某词相邻"
- "TOP词85%,次选词75%,差异10%较小,同时靠近两个词"

【重点提醒】：
✅ 核心是"相对比较"，不是绝对判断
✅ 观察相关度的"梯度"而不是"分级"
✅ 集中相关度(TOP词明显) → 靠近TOP词
✅ 分散相关度(多词接近) → 找中心或平衡
✅ 低相关度(全部弱) → 探索新地域
✅ 让位置选择反映相关度的梯度差异

✅ 你的选择必须是上面候选列表中的格子！`;

  return prompt;
}

/**
 * Call OpenRouter API to get AI decision
 * @param {string} prompt - The prompt to send
 * @param {string} apiKey - OpenRouter API key
 * @param {string} model - Model ID to use
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<string>} Raw response text from LLM
 */
async function callLLM(prompt, apiKey, model, timeoutMs = 15000) {
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
        model: model,
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

    // Handle 429 (Too Many Requests) with special error message
    if (response.status === 429) {
      const retryAfter = response.headers?.get?.('Retry-After') || 'unknown';
      throw new Error(`API 配额限制 (需等待: ${retryAfter}秒)`);
    }

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
 * @param {string} model - Model ID to use (default: qwen/qwen3.5-35b-a3b)
 * @returns {Promise<Object>} {cellKey, reasoning, usedFallback, prompt, candidatesInfo, llmResponse, rawJson}
 */
async function aiMemberDecide(state, apiKey, model = 'qwen/qwen3.5-35b-a3b') {
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
      thinking: '',
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
      const llmResponse = await callLLM(prompt, apiKey, model);
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
        // Success! Extract thinking if present
        const thinking = extractThinkingFromResponse(llmResponse);

        // Return the result
        return {
          cellKey: parsed.selectedCell,
          reasoning: parsed.reasoning,
          usedFallback: false,
          prompt: prompt,
          candidatesInfo: candidatesInfo,
          thinking: thinking,
          llmResponse: llmResponse,
          rawJson: llmResponse,
          strategy: `LLM策略: ${model} 基于语义相关性推理\n选中格子: "${parsed.selectedCell}"\n置信度: ${parsed.confidence.toFixed(2)}${retryCount > 0 ? `\n(重试 ${retryCount}/${maxRetries})` : ''}`
        };
      }

      // Parsing failed, record error and retry
      lastError = parsed?.error || '未知错误';
      lastParsed = parsed;
      // Continue to next retry

    } catch (error) {
      // API error, save and check if retryable
      lastError = error.message;
      // Don't retry on 429 (rate limit) - would just hit the limit again
      if (error.message.includes('API 配额限制')) {
        break; // Exit retry loop, go straight to fallback
      }
      continue; // Retry other transient errors
    }
  }

  // All retries exhausted, use fallback
  const selectedCell = fallbackSelection(contextsMap);
  const finalErrorReason = lastError || '未知错误';
  const originalResponse = lastParsed?.rawResponse || lastResponse || '(无响应)';
  const isRateLimited = finalErrorReason.includes('API 配额限制');

  // Try to extract thinking from last response even on failure
  const thinking = extractThinkingFromResponse(lastResponse || '');

  return {
    cellKey: selectedCell,
    reasoning: '推理无效，已降级',
    usedFallback: true,
    prompt: buildPrompt(state.currentRound.word, candidateContexts, state),
    candidatesInfo: candidatesInfo,
    thinking: thinking,
    llmResponse: isRateLimited
      ? `【⚠️ API 配额限制】${finalErrorReason}\n无法进行推理，已切换到本地启发式算法`
      : `【❌ 解析失败】${finalErrorReason}\n【⚠️ 已重试 ${maxRetries} 次】\n\n【📝 最后一次响应】\n${originalResponse}`,
    rawJson: lastResponse || '{}',
    strategy: isRateLimited
      ? `API 配额限制: ${finalErrorReason}\n降级到启发式算法\n选中格子: "${selectedCell}"`
      : `JSON解析失败: ${finalErrorReason} (已重试${maxRetries}次)\n降级到启发式算法\n选中格子: "${selectedCell}"`
  };
}

// Export functions for browser and Node.js environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    extractThinkingFromResponse,
    buildPrompt,
    callLLM,
    parseLLMResponse,
    fallbackSelection,
    formatCandidatesForDisplay,
    aiMemberDecide
  };
}
