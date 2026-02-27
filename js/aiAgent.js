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

【相关性层级定义】（从强到弱）：
LEVEL 1 - 强相关（必须满足多个条件）：
  ✓ 同一地域/地区（如两个欧洲城市、两个中国景点）
  ✓ 同一历史时期且文化关联密切
  ✓ 同一类型且规模相当（如两个超级大都市、两个世界遗产）
  ✓ 直接的历史联系（如同一文明）

LEVEL 2 - 中相关（满足 1-2 个条件）：
  ✓ 同一大洲或跨越相近地区
  ✓ 相关历史时期（如都在中世纪）
  ✓ 相同分类（如都是自然奇迹）
  ✓ 存在间接的文化交融

LEVEL 3 - 弱相关：
  ✓ 同一生物圈或气候带
  ✓ 共享某些特征（如都是山脉）
  ✓ 仅在主题分类上相关

【核心决策策略】：

📊 分析模式 A：强相关存在
  - IF 存在 LEVEL 1 强相关词 → 优先与其相邻（距离=1步）
  - IF 多个 LEVEL 1 词汇 → 找与它们共同相邻的格子，或几何最近的
  - 置信度：0.9+

📈 分析模式 B：只有中相关
  - 检查是否有 LEVEL 2 中相关词
  - IF 与中相关词相邻 → 选择它（与相关词距离1步）
  - IF 与中相关词距离2步且几何接近 → 也可考虑（距离太近相关性强）
  - 置信度：0.7-0.8

🔍 分析模式 C：积极探索（关键！）
  - IF 没有强相关词，但有弱相关词 AND 你有多个候选格子
  - 即使只与 1 个已知词汇相邻，也要主动选择
  - 特别是当这个格子与其他弱相关词汇距离较近（2-3步，几何距离<200px）时
  - 这样做的好处：开拓新地域、发现潜在的词汇聚类
  - 置信度：0.6-0.7（合理的探索选择）

【领队词汇】：「${currentWord}」
【地图已有词汇】：${exploredWords.join('、')}

【候选格子列表】（你只能从这些格子中选择）：
${candidatesSection}【距离说明】：
- 距离N步 = 拓扑距离（经过格子数），步数越少越接近
- 几何距离Xpx = 实际像素距离，<150px 为"几何接近"
- (紧邻) = 距离1步，优先选择目标

【决策流程】：

1️⃣ 特征识别
   - 「${currentWord}」的地理位置、类型、历史时期、文化特征
   - 列出哪些特征会与已有词汇匹配

2️⃣ 相关性分类（关键！）
   - 逐个检查已有词汇与「${currentWord}」的相关性
   - 明确标注为 LEVEL 1/2/3
   - 例：「长城」= LEVEL 1 强相关(同国家、都是防御工事)
   - 例：「泰姬陵」= LEVEL 2 中相关(同亚洲、都是人文遗迹)

3️⃣ 选择逻辑（根据分析模式）
   ├─ 有 LEVEL 1 词汇？
   │  └─ 选择与它相邻的格子（距离1步）✓ 高置信度
   │
   ├─ 只有 LEVEL 2 词汇？
   │  ├─ 有与它相邻的格子？→ 选择 ✓
   │  └─ 没有相邻但距离2步且几何近？→ 可选 (探索)
   │
   └─ 只有 LEVEL 3 弱相关或无相关？
      └─ 选择最有"连接潜力"的格子
         (与任意词语相邻，但也接近其他词汇)
         这是主动探索，值得尝试！✓

4️⃣ 置信度评估
   - LEVEL 1 相邻：0.9（非常肯定）
   - LEVEL 1 距离2步：0.8（较肯定）
   - LEVEL 2 相邻：0.75（相当肯定）
   - 积极探索：0.65（合理探索）

【思考过程示例 - 模式B/C】：
- 「泰姬陵」与地图已有词汇分析：
  - 「德里」= LEVEL 1(同国家、都在印度)距离1步 ✓
  - 「印度教庙宇」= LEVEL 2(同南亚文化) 距离3步
  - 与德里相邻的候选格子中，1,1 距离150px，1,2 距离180px
  - 选择 1,1（靠近强相关词汇）✓

- 「撒哈拉沙漠」分析：
  - 「尼罗河」= LEVEL 2(同地区、相邻地理) 距离2步
  - 「开罗」= LEVEL 2(同地区) 距离2步
  - 候选格子中，2,0 只与"某词"相邻、距离180px → 主动探索！
  - 虽然与强相关词距离2步，但几何接近+开拓新方向 → 选择 2,0 (0.65置信度)

📋 【输出格式】（必须严格遵守）：
{"selectedCell":"行,列","reasoning":"LEVEL分类+选择策略+距离/置信依据","confidence":0.X}

💡 reasoning 示例：
- "LEVEL 1强相关(同国家)，距离1步，紧邻罗马 ✓"
- "LEVEL 2中相关(同亚洲)，距离2步但几何150px，值得相邻"
- "LEVEL 3弱相关，积极探索模式，与1个词相邻但接近多个词汇"
- "相关性分析：A=LEVEL1距离1步✓，距离50px；B=LEVEL2距离2步，几何150px；距离50px最优"

⚠️ 重点提醒：
- 不要被"高度相关"绑架！即使没有LEVEL 1词汇，也要敢于探索
- 只与1个词相邻但几何接近其他词+距离2步以内 = 很好的探索选择
- 置信度≥0.6就值得尝试，游戏需要平衡"聚集相关词"和"探索发现"

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
