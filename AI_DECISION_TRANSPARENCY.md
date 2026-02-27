# AI 决策透明度功能 - 详细说明

## 📌 概述

增强了 AI 队员模式，在游戏中实时展示 AI 的完整决策过程，包括：
- 📋 **Prompt 策略** - AI 发送给 LLM 的完整指令
- 📊 **候选格子分析** - 每个可选格子及其相邻词汇距离
- 🧠 **LLM 响应** - LLM 返回的原始回复
- ✅ **最终决策** - 选择的格子和决策理由

## 🎯 功能说明

### UI 改进

#### 1. 新增 "AI 决策过程" 面板

在队员面板中添加了一个可折叠的决策展示区域：

```
🤖 AI 决策过程
┌─────────────────────────────────┐
│ 📋 Prompt 策略                   │
│ [textbox: 完整的 Prompt 文本]    │
├─────────────────────────────────┤
│ 📊 候选格子分析                  │
│ [textbox: 格子 + 相邻词汇距离]   │
├─────────────────────────────────┤
│ 🧠 LLM 响应                      │
│ [textbox: LLM 返回的响应]        │
├─────────────────────────────────┤
│ ✅ 最终决策                      │
│ [选中的格子及决策理由]           │
├─────────────────────────────────┤
│ 💬 原始 LLM JSON [展开/收起]    │
│ [JSON 格式的原始响应]            │
└─────────────────────────────────┘
```

### 内容展示

#### Prompt 策略 (📋)
显示 AI 接收的完整提示词，包括：
- 领队的词汇
- 地图上已有的所有词汇
- 所有候选格子的列表
- 决策规则说明

**示例**：
```
你是词汇地图游戏中的AI队员。规则：地图格子有词汇，语义相关的词应放在距离更近的格子。

【领队词汇】：「埃菲尔铁塔」
【地图已有词汇】：罗马斗兽场、长城、喜马拉雅山

【候选格子】（只能选以下格子之一）：
格子 "2,3"：
  - 与「罗马斗兽场」距离1步（紧邻）
  - 与「长城」距离2步
...
```

#### 候选格子分析 (📊)
显示每个候选格子与已探索词汇的距离关系：

**示例**：
```
格子 "2,3":
  - "罗马斗兽场" (1步)
  - "长城" (2步)
  - "喜马拉雅山" (3步)

格子 "3,4":
  - "喜马拉雅山" (1步)
  - "罗马斗兽场" (2步)

格子 "1,5":
  - "长城" (1步)
  - "喜马拉雅山" (2步)
```

#### LLM 响应 (🧠)
显示 LLM 的原始回复内容：

**示例（成功）**：
```
{"selectedCell":"2,3","reasoning":"欧洲地标，靠近罗马斗兽场","confidence":0.85}
```

**示例（解析失败降级）**：
```
解析失败，原始响应:
我认为埃菲尔铁塔应该放在..."
（自动降级到启发式算法）
```

#### 最终决策 (✅)
总结 AI 的决策策略和选择：

**示例（LLM 决策）**：
```
LLM策略: llama-3.1-8b 基于语义相关性推理
选中格子: "2,3"
置信度: 0.85
```

**示例（降级决策）**：
```
降级策略：选择与已探索格子直接相邻(1步)最多的格子。
选中格子: "3,4"，相邻词汇数: 3
```

#### 原始 LLM JSON (💬)
可展开的详情，显示 LLM 返回的原始 JSON（格式化后）：

```
{
  "selectedCell": "2,3",
  "reasoning": "欧洲地标，靠近罗马斗兽场",
  "confidence": 0.85
}
```

---

## 🔄 显示流程

```
1. 领队输入词汇 → 点击提交
   ↓
2. 隐藏决策面板 + 显示"AI 正在思考..." spinner
   ↓
3. [500ms 等待，等待感受]
   ↓
4. 调用 aiMemberDecide()
   ├─ 分析候选格子
   ├─ 构造 Prompt
   ├─ 调用 LLM (或降级)
   └─ 返回详细信息
   ↓
5. 隐藏 spinner + 显示决策面板
   ├─ 填充所有 textarea
   ├─ 高亮选中的格子
   ├─ 清空所有输入框
   └─ 面板变为可见
   ↓
6. [1200ms 等待，让玩家观察决策]
   ↓
7. 自动提交（onAssignWord）
   ↓
8. 继续下一轮
```

---

## 🛠️ 代码架构

### aiAgent.js 修改

#### 新增函数
```javascript
function formatCandidatesForDisplay(contextsMap)
// 将候选格子信息格式化为可读的文本
```

#### 修改函数
```javascript
async function aiMemberDecide(state, apiKey)
// 返回扩展的对象：
{
  cellKey,              // 选中的格子
  reasoning,            // 简短推理（15字）
  usedFallback,         // 是否使用了降级
  prompt,               // 完整 Prompt 文本
  candidatesInfo,       // 格式化的候选格子信息
  llmResponse,          // LLM 的原始响应
  rawJson,              // JSON 格式的响应
  strategy              // 详细的决策策略说明
}
```

### controller.js 修改

#### 新增函数
```javascript
function displayAIDecisionDetails(decision)
// 将决策信息填充到 UI 的各个 textarea 中
```

#### 修改函数
```javascript
function triggerAIMemberTurn()
// 现在调用 displayAIDecisionDetails()
// 等待时间增加到 1200ms（让玩家看决策）
```

### index.html 修改

新增 HTML 结构：
```html
<div id="ai-decision-panel" class="ai-decision-panel hidden">
  <h4>🤖 AI 决策过程</h4>

  <div class="ai-section">
    <label>📋 Prompt 策略</label>
    <textarea id="ai-prompt-display" class="ai-display-text" readonly></textarea>
  </div>

  <div class="ai-section">
    <label>📊 候选格子分析</label>
    <textarea id="ai-candidates-display" class="ai-display-text" readonly></textarea>
  </div>

  <div class="ai-section">
    <label>🧠 LLM 响应</label>
    <textarea id="ai-llm-response-display" class="ai-display-text" readonly></textarea>
  </div>

  <div class="ai-section">
    <label>✅ 最终决策</label>
    <div id="ai-final-decision" class="ai-final-decision"></div>
  </div>

  <details class="ai-toggle-details">
    <summary>💬 原始 LLM JSON</summary>
    <textarea id="ai-raw-json-display" class="ai-display-text" readonly></textarea>
  </details>
</div>
```

### style.css 新增

```css
.ai-decision-panel { /* 面板容器 */ }
.ai-section { /* 每个决策部分 */ }
.ai-display-text { /* textare 样式 */ }
.ai-final-decision { /* 最终决策显示 */ }
.ai-toggle-details { /* 可展开的详情 */ }
```

---

## 💡 使用场景

### 1. 学习 AI 推理

观察 AI 如何：
- 理解候选格子之间的距离关系
- 根据词汇语义做出选择
- 处理多个候选的优先级

**对话**：
> "哦，AI 选择格子 (3,4) 是因为这个格子靠近'罗马斗兽场'，而'埃菲尔铁塔'和'罗马斗兽场'都是欧洲地标。"

### 2. 调试 AI 性能

如果 AI 做出了奇怪的选择：
- 查看 Prompt 确认信息是否正确
- 检查距离分析是否有错
- 看 LLM 响应是否合理

### 3. 改进策略

通过观察多局游戏，可以发现：
- Prompt 模板是否清晰
- LLM 是否理解了规则
- 降级算法的有效性

---

## 🔧 技术实现细节

### Textarea 自适应高度

```javascript
// 自动调整 textarea 高度以适应内容
const textarea = document.getElementById('ai-prompt-display');
textarea.style.height = 'auto';
textarea.style.height = Math.min(textarea.scrollHeight, 150) + 'px';
```

### JSON 格式化

```javascript
try {
  const jsonObj = JSON.parse(decision.rawJson || '{}');
  rawJsonDisplay.value = JSON.stringify(jsonObj, null, 2);  // 缩进 2 空格
} catch {
  rawJsonDisplay.value = decision.rawJson || '{}';
}
```

### 动态显示/隐藏

```javascript
// 显示面板
decisionPanel.classList.remove('hidden');

// 隐藏面板
decisionPanel.classList.add('hidden');
```

---

## 📋 降级信息示例

### 无 API Key 降级

**Prompt 策略**：
```
（未使用LLM，直接降级）
```

**最终决策**：
```
降级策略：选择与已探索格子直接相邻(1步)最多的格子。
选中格子: "3,4"，相邻词汇数: 3
```

### LLM 超时降级

**LLM 响应**：
```
API错误: LLM request timeout
```

**最终决策**：
```
API调用失败，降级到启发式算法
选中格子: "2,3"
```

### JSON 解析失败降级

**LLM 响应**：
```
解析失败，原始响应:
我认为埃菲尔铁塔和罗马斗兽场都是欧洲地标...
所以应该选择靠近的格子...
```

**最终决策**：
```
JSON解析失败，降级到启发式算法
选中格子: "3,4"
```

---

## 🎓 学习价值

通过这个功能，用户可以：

1. **理解 AI 决策过程** - 看到完整的思考链
2. **验证 AI 逻辑** - 确认推理是否合理
3. **调试问题** - 找出哪里出错了
4. **改进提示词** - 基于 LLM 的回复优化 Prompt
5. **比较策略** - AI vs 人类的不同决策方式

---

## 🚀 后续改进方向

- [ ] 支持导出决策日志（JSON 格式）
- [ ] 保存游戏过程中的所有 AI 决策
- [ ] 可视化格子距离（高亮候选格子和它们的距离）
- [ ] 对比 AI 和人类决策的效果差异
- [ ] 让用户在决策后给 AI 打分反馈

---

*最后更新：2025-02-27*
