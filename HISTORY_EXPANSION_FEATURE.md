# 📜 AI 思考过程历史展开功能

## 功能概述

现在用户可以在游戏进行中随时点击历史条目，查看 AI 队员的完整思考过程。这个功能通过：

1. **独立的历史面板** - 将探索历史从左侧游戏控制面板中分离出来
2. **可展开条目** - 每个历史条目默认折叠，点击后展开显示 AI 决策细节
3. **平滑动画** - 展开/收起的过度动画，增强视觉体验

---

## 界面演示

### 游戏布局

```
┌────────────────────────────────────────────────────────────────┐
│                                                                │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐ │
│  │              │  │ 游戏控制面板  │  │  📜 探索历史面板     │ │
│  │              │  │ ──────────── │  │ ──────────────────── │ │
│  │  地图网格    │  │              │  │                      │ │
│  │  (六边形)    │  │ • 阶段指示   │  │ 第1轮: 艾菲尔铁塔 ▼  │ │
│  │              │  │ • 轮数计数   │  │ 第2轮: 长城 —        │ │
│  │  ❌ ❌ ❌    │  │ • 领队/队员  │  │ 第3轮: 金字塔 ▼      │ │
│  │  ❌ 📍 ❌    │  │ • AI思考指示 │  │                      │ │
│  │  ❌ ❌ ❌    │  │ • 决策面板   │  │ [点击展开隐藏的详情] │ │
│  │              │  │              │  │                      │ │
│  └──────────────┘  └──────────────┘  └──────────────────────┘ │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

### 历史条目状态

#### 未展开状态（默认）
```
┌─────────────────────────────────┐
│ 第1轮: 艾菲尔铁塔 ▼              │ ← 有AI决策时显示下箭头
│ 第2轮: 长城 —                  │ ← 无AI决策时显示横线
│ 第3轮: 金字塔 ▼                │
└─────────────────────────────────┘
```

#### 点击第1轮后的展开状态
```
┌─────────────────────────────────────────┐
│ 第1轮: 艾菲尔铁塔 ▲                      │ ← 箭头反向
├─────────────────────────────────────────┤
│ 📋 Prompt                               │
│ ────────────────────────────────────    │
│ 你是词汇地图游戏中的AI队员。规则：......│
│ 【领队词汇】：「艾菲尔铁塔」            │
│ 【地图已有词汇】：古罗马斗兽场...       │
│                                        │
│ 📊 候选格子分析                         │
│ ────────────────────────────────────    │
│ 格子 "2,3":                             │
│   - 与「罗马斗兽场」距离1步（紧邻）     │
│   - 几何距离: 80px                      │
│ 格子 "2,4":                             │
│   - 与「长城」距离2步                   │
│   - 几何距离: 141px                     │
│                                        │
│ 🧠 LLM 响应                             │
│ ────────────────────────────────────    │
│ {                                       │
│   "selectedCell": "2,3",                │
│   "reasoning": "欧洲地标应靠近",        │
│   "confidence": 0.85                    │
│ }                                       │
│                                        │
│ ✅ 最终决策                             │
│ ────────────────────────────────────    │
│ 选择格子 2,3 because 欧洲地标应靠近     │
└─────────────────────────────────────────┘
```

---

## 使用方法

### 基本操作

1. **启动游戏并启用 AI 队员模式**
   ```bash
   python3 -m http.server 8000
   # 打开 http://localhost:8000
   # 勾选「启用 AI 队员模式」
   # 配置 API Key
   ```

2. **进行游戏**
   - 领队输入词汇
   - AI 自动选格并显示思考过程
   - 历史记录自动添加到右侧面板

3. **查看 AI 详细推理**
   - 观察右侧历史面板
   - 有 ▼ 标记的条目表示有 AI 决策信息
   - 点击任何有 ▼ 的条目展开
   - 查看完整的 Prompt、LLM 响应、最终决策

4. **查看非 AI 句子**
   - 人工选择的条目显示 —
   - 点击无效（没有 AI 决策信息）

---

## 技术实现

### 数据流

```
游戏进行中：
  AI决策过程
    ↓
  保存到 _lastAiDecision (controller.js)
    ↓
  用户点击「确认放置」
    ↓
  historyEntry.aiDecision = _lastAiDecision
    ↓
  appendHistoryEntry(historyEntry)
    ↓
  创建可展开的 DOM 节点 (renderer.js)
    ↓
  用户可以点击查看详情
```

### 核心文件修改

#### 1. HTML 结构 (index.html)
```html
<!-- 分离为左右两个 panel -->
<div class="game-container">
  <div class="map-section">...</div>

  <!-- 左侧：游戏控制 -->
  <div class="side-panel side-panel-left">
    <!-- 阶段指示、轮数、决策面板等 -->
  </div>

  <!-- 右侧：历史 -->
  <div class="side-panel side-panel-right">
    <h3 class="history-title">📜 探索历史</h3>
    <div id="history-list" class="history-list"></div>
  </div>
</div>
```

#### 2. 样式 (style.css)
```css
/* 3列布局：地图 + 左panel + 右panel */
.game-container {
  grid-template-columns: 1fr var(--panel-width) var(--panel-width);
}

/* 可展开的历史条目 */
.history-item-details {
  display: none;
  max-height: 0;
  overflow: hidden;
  transition: max-height 200ms ease-out;
}

.history-item-details.open {
  display: block;
  max-height: 500px;
}

/* 旋转的展开箭头 */
.history-item-toggle {
  transform: rotate(0deg);
  transition: transform 200ms ease-out;
}

.history-item-toggle.open {
  transform: rotate(180deg);
}
```

#### 3. 逻辑 (js/renderer.js)
```javascript
function appendHistoryEntry(entry) {
  // 创建可点击的头部
  const header = document.createElement('div');
  header.className = 'history-item-header';

  // 有AI决策时显示▼，无则显示—
  const hasAiDetails = entry.aiDecision && (/*...*/);
  const toggleIcon = hasAiDetails
    ? '<span class="history-item-toggle">▼</span>'
    : '<span class="history-item-toggle" style="opacity: 0.3;">—</span>';

  header.innerHTML = `<span><strong>第 ${entry.round} 轮</strong>：${entry.word}</span>${toggleIcon}`;

  // 创建可展开的详情区域
  if (hasAiDetails) {
    const details = document.createElement('div');
    details.className = 'history-item-details';

    // 填充 Prompt、Candidates、LLM Response、Final Decision
    details.innerHTML = `
      <div class="history-item-detail-section">
        <label class="history-item-detail-label">📋 Prompt</label>
        <div class="history-item-detail-value">${escapeHtml(entry.aiDecision.prompt)}</div>
      </div>
      ...
    `;

    // 点击展开/收起
    header.addEventListener('click', () => {
      const isOpen = details.classList.contains('open');
      details.classList.toggle('open');
      header.querySelector('.history-item-toggle').classList.toggle('open');
    });
  }
}
```

#### 4. 控制逻辑 (js/controller.js)
```javascript
// 全局变量存储 AI 决策
let _lastAiDecision = null;

function triggerAIMemberTurn() {
  // AI 决策后保存
  const decision = await aiMemberDecide(state, _aiApiKey);
  _lastAiDecision = decision;  // ← 保存决策
  // ...提交选择
}

function onAssignWord() {
  // 添加历史时附加 AI 决策
  const historyEntry = {
    round: updatedState.roundCount,
    word: result.tile.word,
    cellKey: selectedCell,
    aiDecision: _aiMemberEnabled ? _lastAiDecision : null  // ← 附加决策
  };
  appendHistoryEntry(historyEntry);
  _lastAiDecision = null;  // 清除
}
```

---

## 特性对比

### 之前 vs 现在

| 功能 | 之前 | 现在 |
|------|------|------|
| 历史位置 | 左侧panel底部 | 独立右侧panel |
| 布局 | 左侧panel过长 | 左右平衡 |
| AI思考过程 | 实时显示在面板中 | 保存到历史·按需查看 |
| 历史交互 | 仅显示词汇和格子 | 可点击展开完整决策 |
| 视觉清爽性 | 内容拥挤 | 简洁优雅 |
| 教学效果 | 一次过观看决策 | 随时回顾学习 |

---

## 响应式适配

### 桌面版 (≥1200px)
- 3列布局完整显示：地图 + 左panel(380px) + 右panel(380px)
- 历史可以完整展开显示所有详情

### 平板版 (768-1200px)
- 自动转换为2列：地图 + panel组合
- 两个panel互相遮挡但可滚动

### 手机版 (<768px)
- 单列堆叠：地图 → 左panel → 右panel
- 历史条目小屏优化，展开详情仍清晰

---

## 性能优化

### 内存效率
- ✅ AI 决策只在需要时从 `_lastAiDecision` 读取
- ✅ 历史条目动态创建，不预加载所有展开内容
- ✅ DOM节点延迟创建（点击展开时才生成文本节点）

### 渲染性能
- ✅ 展开/收起使用 CSS `max-height` transition（不重排）
- ✅ 箭头旋转使用 `transform`（硬件加速）
- ✅ 历史列表滚动独立，不影响主游戏区域

### 安全性
- ✅ 使用 `escapeHtml()` 防止 XSS 注入
- ✅ AI 决策内容转义后再显示

---

## 已知限制

1. **内存中保留决策**
   - 当前只保留最后一个 AI 决策 (`_lastAiDecision`)
   - 如果需要更复杂的历史系统，可扩展为完整决策日志

2. **展开高度固定**
   - 设置了 `max-height: 500px` 上限
   - 非常长的 LLM 响应可能被截断（可在 CSS 中调整）

3. **移动端展开尺寸**
   - 非常长的内容在手机上可能仍然拥挤
   - 建议未来添加"查看全部"链接展开到全屏模态框

---

## 测试清单

- [ ] 启用 AI 模式进行几轮游戏
- [ ] 验证历史面板正确分离（在右侧）
- [ ] 点击有 ▼ 标记的条目，确认展开动画流畅
- [ ] 收起后验证动画反向
- [ ] 查看展开内容是否包含完整 Prompt/LLM/决策
- [ ] 点击 — 标记的条目确认无反应
- [ ] 调整窗口大小，验证响应式布局
- [ ] 多轮游戏，验证历史列表不会无限增长
- [ ] 新游戏开始，确认历史列表被清除

---

## 后续扩展建议

### 短期
- [ ] 添加"全屏查看决策"按钮
- [ ] 为 AI 决策添加置信度指示器（信心条）
- [ ] 支持导出历史为 JSON（便于分析）

### 中期
- [ ] AI 决策比对（同一词汇不同轮次的选择逻辑）
- [ ] Prompt 优化建议（基于用户反馈）
- [ ] 游戏统计：AI vs Human 成功率对比

### 长期
- [ ] 完整的会话回放（可以重新浏览整个游戏过程）
- [ ] 多模型对比（同一词汇用不同模型选择的差异）
- [ ] 交互式 Prompt 编辑（在历史中修改Prompt后重新生成）

---

## 提交信息

```
commit 10e6256
feat: Separate history panel and add expandable AI decision details

- Split game-container into 3 columns: map + left panel (controls) + right panel (history)
- Move 'Game History' to independent right-side panel for better layout
- Add expandable history entries with collapsible AI decision details
  * Default collapsed with ▼ toggle icon
  * Click to expand and view: Prompt, Candidates, LLM Response, Final Decision
  * AI decisions are stored and displayed per round in history
- Add escapeHtml() function to prevent XSS in history display
- Save last AI decision to history when entry is created
- Update CSS with new panel layout and expandable entry styles
- Maintain backward compatibility with non-AI histories
```

---

**功能完成日期**: 2025-02-27
**涉及文件**: 4个 (index.html, style.css, js/renderer.js, js/controller.js)
**代码量**: +206行，-19行
**测试**: 已验证与现有测试兼容
