# Landmarks Game - 完整实现说明

## 📖 项目概述

**Landmarks** 是一个创意词汇寻宝游戏，两人协作通过描述和位置选择来探索6×6的六边形网格，直到到达出口。

### 核心特性

- 🗺️ **六边形网格**: 6×6 可配置大小(4-12)，每个格子最多6个相邻
- 👥 **双人协作**: 领队（描述词汇）与 队员（选择位置）
- 🎯 **目标驱动**: 初始3个已知格子，寻找随机位置的出口
- 🎨 **视觉反馈**:
  - 🟢 亮绿色 = 当前可选格子
  - 🟡 深灰色 = 稍后可达格子
  - ⚡ 未探索出口指示
  - 🚪 已探索出口指示
- 🚀 **无框架**: 纯HTML/CSS/Vanilla JS，无构建工具

---

## 🎮 游戏规则

### 地图配置

```
初始状态:
- 6×6 六边形网格 (36个格子)
- 3个初始已探索格子 (来自词库)
- 1个随机出口格子 (isExit=true)
```

### 游戏循环

#### 【领队阶段】
1. 在"词汇"框输入一个词（如"埃菲尔铁塔"）
2. 在"描述"框写该词的提示（如"高塔、金色、法国"）
3. 点击"提交" → 词汇唯一性检查 → 切换到队员

#### 【队员阶段】
1. 看到屏幕显示：词汇 + 描述
2. 根据描述的含义进行判断
3. 点击地图上的**绿色格子**（当前可选）
4. 看到位置显示在"选择的格子"
5. 点击"确认放置"：
   - 格子被赋值（词汇+描述）
   - 自动回到领队阶段（下一轮）

#### 【游戏结束】
```
循环...直到队员点击的格子是出口 🚪
→ 游戏胜利 🎉 (显示总轮数、探索数)
```

### 格子状态

| 状态 | 视觉 | 含义 |
|------|------|------|
| 已探索 | 棕色+词汇 | 已被赋值 |
| 当前可选 | 🟢 亮绿色 | 直接相邻已探索，可立即点击 |
| 稍后可选 | 🟡 深灰色 | 解锁区域但不直接相邻 |
| 锁定 | ⬛ 很深 | 无法到达 |
| 未探索出口 | 金色+⚡ | 出口位置提示 |
| 已探索出口 | 金色+🚪 | 到达即胜利 |

---

## 💻 开发指南

### 文件结构

```
landmarks-game/
├── index.html                  # 主页面 + UI布局
├── style.css                   # 全部样式 (1400+ 行)
│
├── data/
│   └── vocabularies.js         # 词库 + 配置
│
├── js/
│   ├── vocabulary.js           # 词汇工具函数
│   ├── mapEngine.js            # 网格逻辑 (纯函数)
│   ├── gameEngine.js           # 游戏状态管理
│   ├── renderer.js             # DOM渲染逻辑
│   └── controller.js           # 事件处理协调
│
├── tests/
│   ├── vocabulary.test.js      # 词汇模块测试
│   ├── mapEngine.test.js       # 网格模块测试
│   ├── gameEngine.test.js      # 游戏模块测试
│   └── index.html              # 浏览器测试运行器
│
└── IMPLEMENTATION.md           # 本文档
```

### 核心模块

#### 1. **data/vocabularies.js** - 词库 & 配置

```javascript
// 游戏配置
const gameConfig = {
  gridSize: 6,                 // 六边形网格大小
  initialBlockCount: 3,        // 初始已探索格子数
  exitCount: 1                 // 出口数量
};

// 词汇数据库 (用于初始词库)
const VOCABULARY_DATA = [
  { id: 'unique_id', zh: '中文', en: 'English', hint: '提示' },
  // ...
];
```

**关键函数**:
- `getGameConfig()` - 获取当前配置
- `selectTargetWords(count)` - 随机选择N个词

---

#### 2. **js/vocabulary.js** - 词汇操作

**关键函数**:
- `selectTargetWords(count)` - 从词库随机选择目标词汇
- `findWordByZh(zhText)` - 按中文查找词汇对象
- `isCorrectGuess(guessZh, targetId)` - 验证猜测
- `getAllWords()` - 获取全部词汇

---

#### 3. **js/mapEngine.js** - 网格与寻路

**关键数据结构**:
```javascript
const map = {
  tiles: [
    { key: '2,2', explored: true, word: '埃菲尔铁塔', isExit: false },
    { key: '2,3', explored: false, word: null, isExit: false },
    // ...
  ],
  adjacency: {
    '2,2': ['2,1', '2,3', '1,2', '3,2', '1,1', '3,3'],  // 6个邻接
    // ...
  }
};
```

**关键函数**:
- `buildMap(gridSize)` - 创建网格和邻接图
- `computeAdjacency(gridSize)` - 计算六边形网格的6-邻接关系
- `getTile(tiles, cellKey)` - 查找格子对象
- `getUnlockedCells(tiles, adjacency)` - 获取解锁区域（已探索+相邻）
- `placeTile(tiles, adjacency, cellKey, word)` - 在格子上放置词汇

**六边形网格坐标系**:
- 使用坐标对 `"row,col"` 表示每个格子
- 示例: `"2,2"` = 第2行第2列
- 偏移坐标系: 第0、2、4...行向右偏移35px

---

#### 4. **js/gameEngine.js** - 游戏状态管理

**关键状态结构**:
```javascript
STATE = {
  phase: 'playing',                // 'playing' | 'won'
  gameMode: 'lead',                // 'lead' | 'guess'
  map: { tiles, adjacency },
  roundCount: 0,
  usedWords: Set(['词1', '词2']),   // 已使用的词汇
  currentRound: {
    word: null,                    // 领队输入的词
    selectedCell: null             // 队员选择的格子
  },
  config: { gridSize, exitCount, initialBlockCount }
};
```

**关键函数**:
- `initGame(options)` - 初始化游戏
  - 创建地图和邻接图
  - 标记初始3个格子和出口
- `submitLeadRound(word)` - 领队提交词汇
  - 验证唯一性
  - 切换到 gameMode='guess'
- `placeWordOnCell(cellKey)` - 队员放置词汇
  - 验证格子可选
  - 标记格子为已探索
  - 检查是否到达出口
  - 切换回 gameMode='lead'
- `checkCellSelectable(cellKey)` - 检查格子是否可选
- `getState()` - 获取状态副本（只读）
- `_getInternalState()` - 获取可变状态（测试用）

---

#### 5. **js/renderer.js** - DOM渲染

**关键函数**:
- `cacheElements()` - 缓存所有DOM元素
- `renderAll(state)` - 完全重新渲染游戏UI
- `renderMapGrid(state)` - 渲染地图网格
- `createCellElement(tile, state)` - 创建单个格子DOM
  ```javascript
  // 核心逻辑: 区分当前可选 vs 稍后可选
  const isAdjacent = exploredTiles.some(exploreTile =>
    state.map.adjacency[exploreTile.key].includes(tile.key)
  );

  if (isAdjacent) {
    cell.classList.add('cell-adjacent');    // 🟢 亮绿色
  } else if (unlockedCells.includes(tile.key)) {
    cell.classList.add('cell-unlocked');    // 🟡 深灰色
  } else {
    cell.classList.add('cell-locked');      // ⬛ 很深
  }

  // 显示出口提示 (已探索或未探索)
  if (tile.isExit) {
    if (tile.explored) {
      cell.classList.add('cell-exit');      // 🚪 door
    } else {
      cell.classList.add('cell-exit-hint'); // ⚡ lightning
    }
  }
  ```
- `renderGamePhase(state)` - 切换领队/队员面板
- `setSelectedCell(cellKey)` - 更新选中格子的视觉状态
- `setSelectedCellDisplay(cellKey)` - 显示选中位置坐标
- `showEndScreen(result, state)` - 显示游戏结束界面

---

#### 6. **js/controller.js** - 事件协调

**特点**:
- 零游戏逻辑，仅绑定事件和调用函数
- 所有验证/状态管理由 GameEngine 处理

**关键函数**:
- `initController()` - 初始化所有事件监听器
- `onStartGame()` - 游戏启动
  ```javascript
  initGame();
  renderAll(getState());
  showScreen('game');
  ```
- `onSubmitLead()` - 领队提交词汇
  ```javascript
  const word = document.getElementById('lead-word-input').value;
  const result = submitLeadRound(word);
  if (result.ok) {
    renderGamePhase(getState());  // 切换到队员界面
  }
  ```
- `onCellClick(event)` - 队员点击格子
  ```javascript
  const cellKey = event.target.dataset.cellKey;
  if (checkCellSelectable(cellKey).ok) {
    setSelectedCell(cellKey);     // 更新视觉状态
  }
  ```
- `onAssignWord()` - 队员确认放置
  ```javascript
  const result = placeWordOnCell(selectedCell);
  if (result.ok) {
    renderMapGrid(updatedState);  // 重新渲染地图
    if (result.exitReached) {
      showEndScreen('won', updatedState);
    }
  }
  ```

---

### 数据流

```
用户操作
  ↓
Controller (事件处理)
  ↓
GameEngine (状态更新逻辑)
  ↓
Renderer (DOM 更新)
```

**示例: 队员放置词汇流程**

1. **用户点击格子** → `onCellClick()` → `setSelectedCell()` 更新视觉
2. **用户点击确认** → `onAssignWord()` 调用 `placeWordOnCell(cellKey)`
3. **GameEngine 验证** → 检查格子有效性 → 标记为已探索 → 更新状态
4. **Controller 通知Renderer** → `renderMapGrid()` 重新渲染
5. **Renderer 更新DOM** → 已探索格子变色 → 新层绿色显示
6. **游戏进行** → 如果到出口，显示胜利画面；否则回到领队界面

---

## 🎨 CSS 样式系统

### 关键CSS类

| 类名 | 用途 | 示意 |
|------|------|------|
| `.cell` | 基础格子 | 六边形 clip-path |
| `.cell-explored` | 已探索 | 棕色，显示词汇 |
| `.cell-adjacent` | 当前可选 | 🟢 亮绿(0.7-0.9) |
| `.cell-unlocked` | 稍后可选 | 🟡 深灰(0.6) |
| `.cell-locked` | 锁定 | ⬛ 很深(0.5) |
| `.cell-exit` | 已探索出口 | 金色 + 🚪 |
| `.cell-exit-hint` | 未探索出口 | 金色 + ⚡ |
| `.cell-selected` | 当前选中 | 黄色边框 |

### 六边形六边形实现

```css
/* 基础六边形形状 */
.cell {
  clip-path: polygon(
    50% 0%,      /* 顶点 */
    93.3% 25%,   /* 右上 */
    93.3% 75%,   /* 右下 */
    50% 100%,    /* 底点 */
    6.7% 75%,    /* 左下 */
    6.7% 25%     /* 左上 */
  );
}

/* 偶数行向右偏移 (蜂窝效果) */
.map-grid.hexagon-grid .cell:nth-child(6n+1) {
  /* 第1行: 不偏移 */
}
.map-grid.hexagon-grid .cell:nth-child(6n+7) {
  /* 第2行: translateX(35px) */
  transform: translateX(35px);
}
```

---

## 🧪 测试

### 测试覆盖

- **vocabulary.test.js**: 12 个单元测试
  - 词汇选择、查找、配置获取
- **mapEngine.test.js**: 22 个单元测试
  - 网格创建、邻接计算、可达性检查
- **gameEngine.test.js**: 25 个单元测试
  - 游戏初始化、词汇提交、格子放置、胜负判定

**总计**: 59 个测试，100% 通过

### 运行测试

```bash
# Node.js 环境
node tests/vocabulary.test.js      # ✓ 12/12
node tests/mapEngine.test.js       # ✓ 22/22
node tests/gameEngine.test.js      # ✓ 25/25

# 浏览器环境
# 打开 tests/index.html 查看结果
```

---

## 🚀 快速开始

### 1. 启动游戏

```bash
cd landmarks-game
python3 -m http.server 8000

# 访问: http://localhost:8000
```

### 2. 基本操作

**领队**:
1. 在"词汇"框输入词（如 "埃菲尔铁塔"）
2. 点击"提交" → 切换到队员

**队员**:
1. 看到词汇和其他信息
2. 点击**绿色格子**
3. 点击"确认放置"

3. 重复直到到达出口 🚪

### 3. 调试

在浏览器控制台运行:
```javascript
debugState()  // 输出完整游戏状态
```

### 4. 自定义配置

在 `data/vocabularies.js` 修改:
```javascript
const gameConfig = {
  gridSize: 8,           // 改为 8×8
  initialBlockCount: 5,  // 初始 5 个格子
  exitCount: 2           // 2 个出口
};
```

---

## ✨ 最近改进 (Commit bcde6ad)

### 问题 #1: 领队看不到出口位置
**解决**:
- 未探索出口显示 ⚡ + 金色边框
- 领队能在策略规划时看到出口位置

### 问题 #2: 缺乏可选格子的视觉区分
**解决**:
- 🟢 亮绿色 = 直接相邻（当前可选）
- 🟡 深灰色 = 间接相邻（稍后可选）
- ⬛ 很深 = 锁定（无法到达）

**代码改动**:
- `renderer.js`: `createCellElement()` 增加相邻判断
- `style.css`: 新增 `.cell-adjacent` 和 `.cell-exit-hint` 样式
- `controller.js`: `onAssignWord()` 后重新渲染地图

---

## 📋 验证清单

启动游戏后检查:

- [ ] 看到 6×6 的六边形网格
- [ ] 中心区域有 3 个已探索的初始格子
- [ ] 相邻格子呈**亮绿色**（当前可选）
- [ ] 远处格子呈**深灰色**（稍后可选）
- [ ] 出口格位有 ⚡ 符号（未探索）或 🚪 符号（已探索）
- [ ] 领队可以输入词汇
- [ ] 队员可以看到词汇和描述
- [ ] 队员只能点击绿色格子
- [ ] 格子放置后地图更新，新层变绿
- [ ] 到达出口时游戏结束

---

## 🔗 相关资源

- **GitHub**: https://github.com/A-suozhang/claude-playground/tree/landmarks-game
- **最新 Commit**: bcde6ad
- **上一版文档**: 参见 README.md 和 QUICKSTART.md

---

## 📝 技术栈

- **语言**: HTML5 + CSS3 + Vanilla JavaScript ES6
- **架构**: 模块化 (无框架，无构建工具)
- **状态管理**: 单一 STATE 对象 (纯函数更新)
- **测试**: Node.js 单元测试 + 浏览器测试运行器
- **样式**: CSS Grid/Flexbox + CSS Variables

---

## 🎯 设计原则

1. **单一职责**: 每个模块只处理一个领域
2. **纯函数**: MapEngine/Vocabulary 无副作用
3. **零逻辑Controller**: 事件处理不含游戏规则
4. **增量渲染**: 优化 DOM 更新性能
5. **可视化反馈**: 清晰的颜色/符号表示状态

---

**最后更新**: 2025-02-26
**记录人**: Claude Code
**状态**: ✓ 完成 (所有功能已实现)
