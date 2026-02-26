# UI 改进说明 - 领队/队员阶段差异化

## 🎯 改进目标

1. **增强视觉差异** - 领队和队员阶段应该有明显区别
2. **信息隐私** - 队员阶段不能看到出口位置（只有领队看得到）
3. **出口标识** - 更明显的视觉反馈

---

## 📝 修改内容

### 1️⃣ HTML 结构改进 (index.html)

#### 领队面板
```html
<div class="phase-panel-header lead-header">
  <h3>👑 领队</h3>
  <p class="phase-subtitle">描述词汇，指引队员</p>
</div>

<input class="phase-input lead-input" ... />
<button class="btn btn-submit-phase btn-lead">提交词汇</button>
```

**变化**:
- ✅ 添加 emoji 图标 (👑)
- ✅ 添加副标题说明职责
- ✅ 按钮添加色彩区分 (金色 `btn-lead`)

#### 队员面板
```html
<div class="phase-panel-header member-header">
  <h3>🎯 队员</h3>
  <p class="phase-subtitle">选择合适的格子</p>
</div>

<div class="current-word">
  <label>📝 词汇</label>
  <div id="current-word-text" class="word-text"></div>
</div>

<div class="cell-selection-hint">
  <label>📍 选择的格子</label>
  <span id="selected-cell-text" class="cell-coordinate">未选择</span>
</div>

<button class="btn btn-submit-phase btn-member">确认放置</button>
```

**变化**:
- ✅ 添加 emoji 图标 (🎯)
- ✅ 标签添加 emoji (📝 📍)
- ✅ 按钮添加色彩区分 (绿色 `btn-member`)

---

### 2️⃣ CSS 样式改进 (style.css)

#### 面板背景色差异
```css
/* Lead - 金色皇冠主题 */
.phase-panel.lead-panel {
  background: linear-gradient(135deg, rgba(200, 151, 58, 0.15) 0%, rgba(200, 151, 58, 0.05) 100%);
  border-color: rgba(200, 151, 58, 0.3);
}

/* Member - 绿色目标主题 */
.phase-panel.member-panel {
  background: linear-gradient(135deg, rgba(90, 143, 74, 0.15) 0%, rgba(90, 143, 74, 0.05) 100%);
  border-color: rgba(90, 143, 74, 0.3);
}
```

**视觉效果**:
- 领队面板: 金色渐变背景 + 半透明金色边框
- 队员面板: 绿色渐变背景 + 半透明绿色边框

#### 面板头部样式
```css
.phase-panel-header {
  padding: 12px;
  border-radius: 6px;
  text-align: center;
  margin: -4px -4px 8px -4px;
}

.phase-panel-header.lead-header {
  background: rgba(200, 151, 58, 0.2);    /* 金色背景 */
  color: var(--accent-gold);
}

.phase-panel-header.member-header {
  background: rgba(90, 143, 74, 0.2);     /* 绿色背景 */
  color: var(--accent-green);
}
```

**视觉效果**:
- 头部有彩色背景突出显示
- 字体颜色与背景匹配

#### 按钮颜色差异
```css
/* Lead Button - 金色 */
.btn-lead {
  background: var(--accent-gold);
  color: var(--bg-void);
}
.btn-lead:hover {
  background: #d4a947;
  box-shadow: 0 6px 16px rgba(200, 151, 58, 0.4);
}

/* Member Button - 绿色 */
.btn-member {
  background: var(--accent-green);
  color: var(--bg-void);
}
.btn-member:hover {
  background: #6ba05d;
  box-shadow: 0 6px 16px rgba(90, 143, 74, 0.4);
}
```

**视觉效果**:
- 领队按钮: 金色，悬停时变暗 + 金色阴影
- 队员按钮: 绿色，悬停时变暗 + 绿色阴影

---

### 3️⃣ 出口标识改进 (style.css)

#### 已探索出口
```css
.cell-exit {
  border-color: var(--accent-gold);
  box-shadow: inset 0 0 16px rgba(200, 151, 58, 0.35),
              0 0 20px rgba(200, 151, 58, 0.2);
  background: linear-gradient(135deg, var(--bg-cell-revealed) 0%,
                              rgba(200, 151, 58, 0.1) 100%);
}

/* 大号门 emoji 在中心 */
.cell-exit::before {
  content: '🚪';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 2rem;  /* ⭐ 很大 */
  z-index: 2;
}

/* EXIT 标签在底部 */
.cell-exit::after {
  content: 'EXIT';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.65rem;
  color: var(--accent-gold);
  font-weight: 700;
  letter-spacing: 0.05em;
  z-index: 1;
}
```

**视觉效果**:
- 🚪 门图标放在六边形中心，大号显示
- "EXIT" 标签在底部说明
- 金色发光边框突出显示

#### 未探索出口 (仅领队阶段可见)
```css
.cell-exit-hint {
  border-color: rgba(200, 151, 58, 0.4);
  box-shadow: inset 0 0 12px rgba(200, 151, 58, 0.2);
}

/* 闪电 emoji 在中心 */
.cell-exit-hint::before {
  content: '⚡';
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  font-size: 1.5rem;
  opacity: 0.8;
  z-index: 2;
}

/* EXIT 标签在底部 */
.cell-exit-hint::after {
  content: 'EXIT';
  position: absolute;
  bottom: 2px;
  left: 50%;
  transform: translateX(-50%);
  font-size: 0.65rem;
  color: var(--accent-gold);
  font-weight: 700;
  opacity: 0.7;
  z-index: 1;
}
```

**视觉效果**:
- ⚡ 闪电图标提示"这是个特殊位置"
- "EXIT" 标签说明
- 仅在领队阶段显示

---

### 4️⃣ 队员隐私改进 (renderer.js + controller)

#### 隐藏队员的出口提示

**修改前**:
```javascript
if (tile.isExit) {
  cell.classList.add('cell-exit-hint');  // 总是显示
}
```

**修改后**:
```javascript
// 仅在领队阶段显示出口提示
if (tile.isExit && state.gameMode === 'lead') {
  cell.classList.add('cell-exit-hint');  // ⊡ 队员看不到
}
```

#### 阶段切换时重新渲染

```javascript
function renderGamePhase(state) {
  // ...
  if (state.gameMode === 'lead') {
    renderMapGrid(state);  // 重新渲染 → 显示出口提示
  } else {
    renderMapGrid(state);  // 重新渲染 → 隐藏出口提示
  }
}
```

**效果**:
- ✅ 领队看得到出口位置（⚡符号）
- ✅ 队员看不到出口位置
- ✅ 增加游戏难度和公平性

---

## 🎨 视觉对比

### 修改前
```
┌─────────────────────────┐
│  领队阶段               │  ← 背景一样
│  (金色背景)             │
└─────────────────────────┘

┌─────────────────────────┐
│  队员阶段               │  ← 背景一样
│  (金色背景)             │
└─────────────────────────┘

地图: 所有格子看起来一样
出口: 金色边框 + 小符号 (队员能看到位置)
```

### 修改后
```
┌─────────────────────────┐
│  👑 领队                │  ← 金色渐变 + 金色头部
│  描述词汇，指引队员       │
│  [输入框]               │
│  [金色提交按钮] ⭐      │
└─────────────────────────┘

┌─────────────────────────┐
│  🎯 队员                │  ← 绿色渐变 + 绿色头部
│  选择合适的格子         │
│  📝 词汇: ...          │
│  📍 选择的格子: ...     │
│  [绿色确认按钮] ⭐     │
└─────────────────────────┘

地图:
- 领队: 能看到 ⚡ 符号 (出口提示)
- 队员: 看不到 ⚡ 符号 (保密！)

出口:
- 未探索: 🚪 + "EXIT" 标签 (2rem 大号)
- 已探索: ⚡ + "EXIT" 标签 (仅领队看到)
```

---

## ✨ 用户体验改进

### 领队视角
✅ 清晰的"我是领队"标识（👑 + 金色主题）
✅ 能看到地图上所有出口位置（⚡符号）
✅ 可以根据出口位置策略性地选择词汇方向
✅ 金色按钮强调"领导"角色

### 队员视角
✅ 清晰的"我是队员"标识（🎯 + 绿色主题）
✅ 看不到出口位置（公平的挑战）
✅ 需要根据词汇描述和地图推断位置
✅ 绿色按钮强调"执行"角色
✅ 增加了探索和发现的乐趣

### 游戏体验
✅ 两个角色的区别更明显，减少误操作
✅ 信息不对称增加了游戏的策略性
✅ 出口标识更显著，找到时有成就感
✅ 整体美观度提升

---

## 🔧 技术细节

### 颜色方案
| 元素 | 领队 | 队员 |
|------|------|------|
| 背景 | 金色渐变 | 绿色渐变 |
| 头部背景 | rgba(200,151,58,0.2) | rgba(90,143,74,0.2) |
| 边框 | rgba(200,151,58,0.3) | rgba(90,143,74,0.3) |
| 按钮 | var(--accent-gold) | var(--accent-green) |
| 图标 | 👑 | 🎯 |

### CSS 变化
- `.phase-panel.lead-panel` - 新增金色样式
- `.phase-panel.member-panel` - 新增绿色样式
- `.phase-panel-header` - 新类用于头部样式
- `.btn-lead` / `.btn-member` - 新类用于按钮样式
- `.cell-exit::before/after` - 改进出口图标显示
- `.cell-exit-hint` - 改进未探索出口图标

### JavaScript 变化
- `createCellElement()` - 仅在 `state.gameMode === 'lead'` 时显示 `cell-exit-hint`
- `renderGamePhase()` - 阶段切换时调用 `renderMapGrid()` 更新可见性

---

## ✅ 测试清单

- [ ] 打开游戏，确认领队面板显示金色主题
- [ ] 提交词汇后，切换到队员面板，确认显示绿色主题
- [ ] 在领队阶段，看到出口格子有 ⚡ 符号
- [ ] 在队员阶段，看不到 ⚡ 符号
- [ ] 点击出口格子并确认放置后，看到 🚪 图标和 "EXIT" 标签
- [ ] 按钮颜色对应阶段（金色/绿色）
- [ ] 面板头部显示 emoji 和副标题
- [ ] 悬停按钮时有正确的阴影效果

---

## 📦 文件修改

| 文件 | 修改 |
|------|------|
| `index.html` | 添加面板头部结构、emoji、副标题、按钮区分类 |
| `style.css` | 新增 50+ 行样式，实现两色主题和出口标识 |
| `js/renderer.js` | 修改出口提示显示逻辑 + 阶段切换时重新渲染 |

---

**更新日期**: 2025-02-26
**状态**: ✓ 已实现
