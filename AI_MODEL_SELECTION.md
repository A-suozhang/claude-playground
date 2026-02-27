# AI Model Selection & Thinking Display

## 新功能概览

本次更新为 AI 队员系统添加了两个重要功能：

### 1️⃣ AI 模型选择

**位置**：游戏设置界面 → AI 队员模式 → **AI 模型下拉框**

**可选模型**：
- ✅ **Qwen 3.5-35B（付费，稳定）** `qwen/qwen3.5-35b-a3b` — 默认选项，推荐使用
- 🔄 **Qwen 3-8B（免费，可能限流）** `qwen/qwen3-8b:free` — 成本低，偶尔可能遭遇 API 限流

**工作流程**：
```
游戏设置 → 勾选"启用 AI 队员模式"
         → AI 模型下拉框出现
         → 选择模型
         → 输入 API Key
         → 开始游戏
```

### 2️⃣ AI 思考过程展示

**位置**：游戏中队员阶段 → AI 决策过程面板 → **💭 AI 思考过程**

**展示内容**：
- 当 LLM 响应中包含显式推理过程时（如 `<thinking>...</thinking>` 标签或文本推理），会在此区域展示
- 自动从 LLM 响应提取并清理
- 条件显示：仅当有实际思考内容时显示该区域

**AI 决策面板完整结构**：
```
📋 Prompt 策略          → 发送给 LLM 的完整提示词
📊 候选格子分析        → 地图空间分析信息
💭 AI 思考过程         → LLM 的思考步骤（新增，条件显示）
🧠 LLM 响应            → 模型原始响应
✅ 最终决策            → 选择的格子和理由
💬 原始 LLM JSON       → 可展开的 JSON 数据
```

## 技术实现

### 后端变更

**`js/controller.js`**
```javascript
// 新增变量
let _aiModel = 'qwen/qwen3.5-35b-a3b';

// 在 onStartGame() 中读取用户选择
_aiModel = document.getElementById('ai-model-select')?.value || 'qwen/qwen3.5-35b-a3b';

// 在 triggerAIMemberTurn() 中传入模型
const decision = await aiMemberDecide(state, _apiKey, _aiModel);

// 在 displayAIDecisionDetails() 中显示思考过程
if (decision.thinking && decision.thinking.trim().length > 0) {
  thinkingSection.classList.remove('hidden');
  thinkingDisplay.value = decision.thinking;
}
```

**`js/aiAgent.js`**
```javascript
// 新增函数：提取思考内容
function extractThinkingFromResponse(rawText)
  // 支持 <thinking>...</thinking> 标签
  // 支持 JSON 前的推理文本

// 更新 callLLM 签名
async function callLLM(prompt, apiKey, model, timeoutMs = 15000)

// 更新 aiMemberDecide 签名并返回 thinking
async function aiMemberDecide(state, apiKey, model = 'qwen/qwen3.5-35b-a3b')
  // 返回对象现包含 thinking 字段
```

### 前端变更

**`index.html`**
- ✅ 添加 AI 模型下拉框（L53-57）
- ✅ 添加思考过程展示区域（L156-160）

**`style.css`**
- ✅ 下拉框样式 `.ai-model-select`
- ✅ 标签样式 `.ai-model-label`

## 使用指南

### 场景 1：想要稳定的 AI 推理（推荐）
1. 启用 AI 队员模式
2. **模型选择**：保持默认 "Qwen 3.5-35B（付费，稳定）"
3. 输入有效的 OpenRouter API Key
4. 开始游戏

### 场景 2：尝试免费模型（降低成本）
1. 启用 AI 队员模式
2. **模型选择**：改为 "Qwen 3-8B（免费，可能限流）"
3. 输入 API Key
4. 开始游戏
5. 如果遭遇 429 限流，自动降级到本地启发式算法

### 场景 3：查看 AI 的完整推理链
1. 启用 AI 队员模式并开始游戏
2. 进入队员阶段后，AI 会自动决策
3. 查看 AI 决策面板中的各个步骤：
   - 📋 看 LLM 收到了什么提示
   - 📊 看候选格子如何分析
   - 💭 看 AI 的思考过程（如有）
   - 🧠 看原始响应
   - ✅ 看最终决策理由

## 向后兼容性

✅ 所有更改都是向后兼容的：
- `aiMemberDecide()` 的第 3 个参数有默认值 → 无需修改旧代码
- 思考过程字段可选 → 不包含思考的响应正常工作
- 模型下拉框有默认值 → 即使 DOM 加载失败也能工作
- 所有 25 个单元测试通过

## 测试验证

```bash
# 运行单元测试
node tests/aiAgent.test.js

# 预期结果：Tests passed: 25/25
```

## 下一步（可选）

- [ ] 添加更多模型选项（Claude 3.5、 GPT-4V 等）
- [ ] 持久化用户的模型偏好到 localStorage
- [ ] 模型成本对比显示
- [ ] 添加模型性能监测（调用耗时、成功率等）
- [ ] 支持用户定义 API 端点

---

**更新时间**：2025-02-27 | **模型选择版本**：1.0
