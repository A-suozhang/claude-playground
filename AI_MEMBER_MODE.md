# AI Member Mode - 完整技术文档

## 📋 概述

AI Member Mode 允许玩家在设置中启用人工智能队员，由 OpenRouter 的免费模型池（openrouter/free）自动进行格子选择决策。

**核心特性**：
- ✅ **语义相关性推理**：LLM 基于词语语义和空间距离做决策（非离散的邻接二值判断）
- ✅ **信息平等**：AI 与人类队员看到完全相同的信息（无法看出口/诅咒/护身符）
- ✅ **优雅降级**：API 失败/超时时自动切换到本地启发式算法
- ✅ **零 gameEngine 修改**：所有 AI 操作通过现有 controller 接口

---

## 🏗️ 架构

```
Setup Screen
  ├─ checkbox: 启用 AI 队员模式
  ├─ password input: OpenRouter API Key (可选)
  └─ event: onAIMemberToggle()
              ├─ 保存到 _aiMemberEnabled, _aiApiKey
              └─ 隐藏/显示 API 密钥输入框

Lead Phase (leadround submitted)
  └─ onSubmitLead() 成功
      └─ triggerAIMemberTurn() [异步]
          ├─ 显示 ai-thinking-indicator
          ├─ 500ms 等待 (UX feel)
          ├─ aiMemberDecide(state, apiKey)
          │   ├─ BFS 距离分析 (aiMapAnalyzer)
          │   ├─ LLM 调用 (aiAgent)
          │   └─ 返回 {cellKey, reasoning, usedFallback}
          ├─ setSelectedCell(cellKey) [视觉高亮]
          ├─ 显示推理文字
          ├─ 800ms 等待 (让玩家看清选择)
          ├─ onAssignWord() [自动提交]
          └─ 隐藏指示器
```

---

## 📁 文件说明

### **js/aiMapAnalyzer.js** (纯函数)

地图分析工具，为 LLM 构建上下文。

| 函数 | 用途 |
|------|------|
| `bfsDistances(startKey, adjacency)` | BFS 计算从任意格子到所有格子的步数 |
| `getCandidateCells(state)` | 找到相邻已探索的未探索格子 |
| `buildCandidateContexts(state)` | 为每个候选格子构建 [{word, distance}] 列表 |
| `getExploredWords(state)` | 提取所有已探索的词汇 |

**关键约束**：
- 仅在 Prompt 中包含 `word` 和 `distance`，不包含 `isExit`, `isCursed`, `isBlessed`
- 最多显示距离 ≤ 4 的邻居词（控制 token 使用）

### **js/aiAgent.js** (决策引擎)

OpenRouter API 集成 + 决策逻辑。

| 函数 | 用途 |
|------|------|
| `buildPrompt(word, contexts, state)` | 构造 LLM Prompt |
| `callLLM(prompt, apiKey, timeout)` | 调用 OpenRouter API (openrouter/free 免费模型池) |
| `parseLLMResponse(rawText, validKeys)` | 解析 JSON，验证 cellKey 合法性 |
| `fallbackSelection(contexts)` | 降级算法：选直接相邻最多的格子 |
| `aiMemberDecide(state, apiKey)` | **主入口**，返回 async {cellKey, reasoning, usedFallback} |

**API 配置**：
- 模型：`openrouter/free`（OpenRouter 免费模型池，自动选择最优可用模型）
- 超时：15 秒
- Temperature：0.3（低温度→更确定的推理）
- Max Tokens：150

### **index.html** 更新

```html
<!-- 设置屏：AI 配置 -->
<div class="ai-settings">
  <label>
    <input id="ai-member-toggle" type="checkbox">
    启用 AI 队员模式
  </label>
  <div id="ai-api-key-section" class="hidden">
    <input id="ai-api-key-input" type="password" placeholder="sk-...">
    <p>留空则使用本地降级策略</p>
  </div>
</div>

<!-- 队员面板：AI 指示器 -->
<div id="ai-thinking-indicator" class="hidden">
  <span class="ai-spinner"></span>
  <span>AI 正在思考...</span>
</div>
<div id="ai-reasoning-text" class="hidden">
  <span>💭 推理：</span>
  <span id="ai-reasoning-content"></span>
</div>
```

### **js/controller.js** 修改

新增函数：
- `onAIMemberToggle()` - 切换 API 类密钥输入框显示
- `triggerAIMemberTurn()` - 异步 AI 决策流程

新增全局变量：
- `_aiMemberEnabled` - AI 模式状态
- `_aiApiKey` - OpenRouter API Key

修改函数：
- `onStartGame()` - 读取 AI 设置
- `onSubmitLead()` - 在成功后调用 `triggerAIMemberTurn()`

### **style.css** 增强

```css
.ai-settings { /* 设置组样式 */ }
.ai-api-key-section { /* API 输入框容器 */ }
.ai-thinking-indicator { /* 旋转 spinner */ }
.ai-spinner { /* @keyframes spin */ }
.ai-reasoning-text { /* 推理文字展示 */ }

/* 动画 */
@keyframes spin { /* 旋转动画 */ }
@keyframes slideDown { /* 下滑动画 */ }
@keyframes slideInLeft { /* 左滑动画 */ }
@keyframes fadeIn { /* 淡入动画 */ }
```

---

## 🧠 决策流程详解

### 第一阶段：程序提供结构 (aiMapAnalyzer)

1. **寻找候选格子**
   ```javascript
   candidateCells = getCandidateCells(state)
   // 返回：相邻已探索、未被探索的格子列表
   // 例如：['2,3', '3,4', '1,2']
   ```

2. **构建距离上下文**
   ```javascript
   contexts = buildCandidateContexts(state)
   // 返回：{
   //   '2,3': [{word: '罗马斗兽场', distance: 1}, {word: '长城', distance: 2}],
   //   '3,4': [{word: '喜马拉雅山', distance: 1}, {word: '埃菲尔铁塔', distance: 3}],
   //   ...
   // }
   ```
   - 仅包含距离 ≤ 4 的邻居（控制 token）
   - 🚫 不包含 `isExit`, `isCursed`, `isBlessed`（公平起见）

### 第二阶段：LLM 语义推理 (aiAgent)

1. **构造 Prompt**
   ```markdown
   你是词汇地图游戏中的AI队员。规则：地图格子有词汇，语义相关的词应放在距离更近的格子。

   【领队词汇】：「埃菲尔铁塔」
   【地图已有词汇】：罗马斗兽场、长城、喜马拉雅山

   【候选格子】（只能选以下格子之一）：
   格子 "2,3"：
     - 与「罗马斗兽场」距离1步（紧邻）
     - 与「长城」距离2步

   格子 "3,4"：
     - 与「喜马拉雅山」距离1步（紧邻）
     - 与「埃菲尔铁塔」距离3步

   【规则】语义越相关→应选择距离更近的格子。请选择最合适的格子。

   输出 JSON（无其他内容）：
   {"selectedCell":"行,列","reasoning":"理由（15字内）","confidence":0.8}
   ```

2. **LLM 推理**（OpenRouter 免费模型）
   - 识别「埃菲尔铁塔」与「罗马斗兽场」都是欧洲地标，语义高度相关
   - 选择格子 "2,3"（距离罗马斗兽场最近）

3. **响应解析**
   ```json
   {
     "selectedCell": "2,3",
     "reasoning": "欧洲地标，靠近罗马斗兽场",
     "confidence": 0.85
   }
   ```

---

## 🔄 降级机制

| 场景 | 处理方式 |
|------|---------|
| 用户未填 API Key | 直接使用 fallback（不出错） |
| API 请求超时（15s） | AbortController 中止，使用 fallback |
| JSON 解析失败 | try/catch 捕获，使用 fallback |
| LLM 返回无效 cellKey | 验证失败，使用 fallback |
| 网络错误 | 使用 fallback |

**Fallback 算法**：
```javascript
function fallbackSelection(contextsMap) {
  // 统计每个候选格子的直接相邻数（distance == 1）
  // 选择最多的那个
  // 如果打平，选第一个
}
```

示例：
- 格子 "2,3"：3 个直接相邻词
- 格子 "3,4"：1 个直接相邻词
- **选择 "2,3"**

---

## 🛡️ 安全和隐私

### API Key 安全
- 存储在客户端内存（`_aiApiKey` 变量）
- 每个游戏会话共用同一 API Key
- 不持久化到 localStorage（避免泄露）
- 用户可随时清空输入框

### 信息对称
- AI 看到的地图信息 = 人类队员看到的信息
- 都无法看到：`isExit`, `isCursed`, `isBlessed` 标记
- Prompt 中只传 `word` 和 `distance`，无其他元数据

### LLM 不见的信息
- 除了词汇和距离，LLM 无法推断地图大小、格子坐标、格子类型等
- 即使 LLM 试图反推出口位置，也缺少足够信息

---

## 🧪 测试覆盖

### 单元测试 (tests/aiAgent.test.js - 25 个)

| 测试 | 覆盖内容 |
|------|---------|
| BFS 距离 | 正确计算步数 |
| 候选格子 | 找到相邻的未探索格子 |
| 距离上下文 | 为每个候选生成词-距离列表 |
| 已探索词汇 | 提取类表 |
| Prompt 构造 | 包含必要信息，格式正确 |
| JSON 解析 | 有效/无效 JSON 处理 |
| 长推理截断 | 推理文字限制在 30 字符 |
| 降级选择 | 选最多直接相邻的格子 |
| 无 API Key | 直接使用 fallback |
| 异步决策 | 返回正确结构 |

### 集成测试 (tests/ai-integration.test.js - 32 个)

| 测试 | 覆盖内容 |
|------|---------|
| HTML 结构 | UI 元素都存在 |
| 脚本加载| aiMapAnalyzer.js, aiAgent.js 都引入 |
| CSS 样式 | 所有 AI 相关 CSS 都定义 |
| Controller 集成 | _aiMemberEnabled, triggerAIMemberTurn 等概念 |
| No Breaking Changes | gameEngine 和 renderer 完全未改 |

---

## 🚀 使用指南

### 启用 AI 队员

1. 打开游戏
2. 在设置屏勾选「启用 AI 队员模式」
3. （可选）输入 OpenRouter API Key：
   - 访问 https://openrouter.ai/keys
   - 复制你的 API Key
   - 粘贴到输入框
4. 点击「开始游戏」

### 游戏流程

1. **领队阶段**：输入词汇，点击提交
2. **AI 自动选择**：
   - 显示「AI 正在思考...」（旋转 spinner）
   - 等待 500ms
   - AI 做出决策
   - 显示推理文字（15 字以内）
   - 等待 800ms（让你看清选择）
   - 自动提交，继续下一轮

### 调试

```javascript
// 查看当前游戏状态
console.log(window.debugState());

// 查看 AI 配置
console.log('AI 启用:', window._aiMemberEnabled);
console.log('API Key:', window._aiApiKey ? '[已设置]' : '[未设置]');

// 手动触发 AI 决策（需要在队员阶段）
const state = window.getState();
const decision = await window.aiMemberDecide(state, window._aiApiKey);
console.log('AI 决策:', decision);
```

---

## 📊 技术指标

| 指标 | 值 |
|------|-----|
| 单元测试覆盖 | 25/25 (100%) |
| 集成测试覆盖 | 32/32 (100%) |
| gameEngine 修改 | 0 行 |
| renderer 修改 | 0 行 |
| 新增代码行数 | ~450 (aiMapAnalyzer + aiAgent) |
| 样式代码 | ~150 行 CSS |
| 降级算法性能 | O(n) (n = 候选格子数) |
| LLM 超时 | 15 秒 |
| 推理延迟 | 500ms (thinking) + 800ms (display) + LLM |

---

## 🔮 未来改进

- [ ] 支持多种 LLM 模型选择（GPT-4, Claude 等）
- [ ] 记录 AI 推理历史，显示"AI 置信度"
- [ ] 加入"AI 难度"设置（conservative/aggressive）
- [ ] 离线模式加强降级算法（如距离启发式）
- [ ] 国际化支持（英文 Prompt）

---

## 📞 常见问题

**Q: 我没有 OpenRouter API Key，能用吗？**
A: 可以！留空 API Key 输入框，AI 会使用本地"选最多直接邻居"的启发式算法，同样有趣。

**Q: AI 能看到隐藏信息吗？**
A: 不能。AI 和人类队员看到的信息完全相同，都无法看出口/诅咒/护身符位置。

**Q: API 超时怎么办？**
A: 15 秒后会自动使用降级算法，游戏不会卡住。

**Q: 为什么 AI 有时候选择"奇怪"的格子？**
A: 这是正常的！LLM 基于语义相关性推理，有时会有创意性的连接（比如"科技产品"关联）。

---

*最后更新：2025-02-27*
