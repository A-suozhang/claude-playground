# 六边形网格布局机制 - 完整总结

## 问题背景

在实现动态 gridSize 功能时，发现当 gridSize 增大时，地图高度会线性增长而宽度被限制，导致地图变成竖长条。

## 根本原因分析

### 写死的值及其影响

| 位置 | 旧值 | 问题 |
|------|-----|------|
| `js/renderer.js L93` | `containerWidth = 420px` | 限制宽度上限，无法适应大 gridSize |
| `style.css L213` | `grid-auto-rows: 70px` | 硬写行高，不随 cellSize 变化 |
| `js/renderer.js L95` | `minCellSize = 40px` | 当 gridSize > 10 时触发下限 |
| `style.css L202` | `row-gap: calc(-0.37 * cellSize)` | 行间距与行高冲突，拉高了行间距 |

### 数学验证（gridSize=12 之前的问题）

```javascript
// 旧计算
columnWidth = max(40, 420 / 12) = 50px（被 minCellSize 限制）
grid-auto-rows = 70px（硬写）
row-gap = -0.37 * 50 = -18.5px（太弱）
实际行高 = 70 + (-18.5) = 51.5px
总宽度 = 12 × 50 = 600px
总高度 = 12 × 51.5 = 618px
宽高比 = 600:618 ≈ 0.97:1 ❌ 变成竖长条
```

## 解决方案

### 核心思路

**去掉所有硬写的行高，让行高等于列宽，从而保证正方形**

```javascript
grid-auto-rows = columnWidth  // 动态！
row-gap = -columnWidth * hexagonOverlapRatio  // 动态但比例固定
```

### 关键常数

这些是**无法消除且必要的几何/UI 常数**：

```javascript
const minCellSize = 40;              // UI 可读性最小值
const baseCellSize = 83;             // 设计标准（gridSize=6 时）
const baseGridSize = 6;              // 参考基点
const hexagonOverlapRatio = 0.5;     // 六边形重叠比例（几何常数）
```

### 新计算公式

```javascript
columnWidth = max(40, (83 * 6) / gridSize) = max(40, 498 / gridSize)

grid-auto-rows = columnWidth
row-gap = -columnWidth * 0.5
effectiveRowHeight = columnWidth * (1 - 0.5) = columnWidth * 0.5

总高度 ≈ gridSize × effectiveRowHeight ≈ gridSize × columnWidth × 0.5
```

### 验证（所有 gridSize 的一致性）

```
gridSize=6:
  columnWidth = 498 / 6 = 83px
  grid-auto-rows = 83px
  row-gap = -83 * 0.5 = -41.5px
  effectiveRowHeight = 83 - 41.5 = 41.5px
  总宽度 = 6 × 83 = 498px
  总高度 = 6 × 41.5 = 249px
  宽高比 = 498:249 = 2:1 ✓

gridSize=8:
  columnWidth = 498 / 8 = 62px
  grid-auto-rows = 62px
  row-gap = -62 * 0.5 = -31px
  effectiveRowHeight = 62 - 31 = 31px
  总宽度 = 8 × 62 = 496px
  总高度 = 8 × 31 = 248px
  宽高比 ≈ 2:1 ✓

gridSize=12:
  columnWidth = 498 / 12 = 41.5px
  grid-auto-rows = 41.5px
  row-gap = -41.5 * 0.5 = -20.75px
  effectiveRowHeight = 41.5 - 20.75 = 20.75px
  总宽度 = 12 × 41.5 = 498px
  总高度 = 12 × 20.75 = 249px
  宽高比 = 498:249 = 2:1 ✓
```

**结论**：无论 gridSize 多大，宽高比都稳定在约 2:1，保证视觉一致性。

## CSS 布局实现

### HTML 结构

```html
<div class="game-container">      <!-- 1fr + 380px 两列 -->
  <div class="map-section">        <!-- flex 居中 -->
    <div class="map-grid">         <!-- CSS Grid -->
      <div class="cell">...</div>  <!-- gridSize² 个格子 -->
    </div>
  </div>
  <div class="side-panel">...</div>
</div>
```

### 关键 CSS 规则

```css
.map-grid {
  display: grid;
  /* 以下由 JavaScript 动态设置 */
  /* grid-template-columns: repeat(gridSize, columnWidthpx) */
  /* grid-auto-rows: columnWidthpx */
  /* row-gap: -columnWidth*0.5px */
  width: fit-content;
}

.cell {
  width: var(--cell-size-dynamic, 70px);
  height: var(--cell-size-dynamic, 70px);
  clip-path: polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%);
}
```

## 六边形偏移机制

### 为什么要偏移？

六边形网格有两种排列方式，我们采用"蜂窝"排列，其中：
- 奇数行（第 0、2、4...行）正常排列
- 偶数行（第 1、3、5...行）向右偏移**一个格子的宽度的 50%**

### 实现方法

```javascript
// renderMapGrid() 中
const row = Math.floor(index / gridSize);
if (row % 2 === 1) {
  cell.style.marginLeft = `${cellSize * 0.5}px`;
}
```

## 边框显示问题

### 发现的问题

`clip-path` 会裁剪 `border`，导致六边形的边框只有部分可见（仅在接近矩形的地方）。

### 解决方案

用 `filter: drop-shadow()` 替代 `border`：

```css
.cell-adjacent {
  border: 3px solid var(--accent-green);
  filter: drop-shadow(0 0 12px rgba(90, 143, 74, 0.6));
}
```

**关键特性**：`drop-shadow` 作用在元素的形状上（考虑 clip-path），而不是矩形 box。

## UI 细节调整

### 可前往格子 (`.cell-adjacent`)

- **外观**：淡绿色边框（3px）+ 轻微发光
- **Hover**：轻微绿色填充 + 发光加强
- **实现**：`filter: drop-shadow()` 保证完整边框

### 出口提示 (`.cell-exit-hint`)

- **仅在领队看到**（gameMode='lead' 时）
- **外观**：明显的金色渐变填充 + 闪烁动画 + ⚡ 图标
- **目的**：让领队能清楚看到出口位置

### 已探索格子 (`.cell-explored`)

- **外观**：稍亮的背景 + 绿色边框
- **包含内容**：词汇文本或出口标识（🚪）

## 关键代码位置

| 文件 | 行号 | 内容 |
|------|------|------|
| `js/renderer.js` | 87-107 | `renderAll()` - 动态计算所有网格参数 |
| `js/renderer.js` | 119-138 | `renderMapGrid()` - 添加六边形偏移 |
| `style.css` | 197-208 | `.map-grid` - 去除硬写值 |
| `style.css` | 210-214 | `.map-grid.hexagon-grid` - 清空旧规则 |
| `style.css` | 270-285 | `.cell-adjacent` - 绿色边框样式 |
| `style.css` | 363-368 | `.cell-exit-hint` - 出口提示样式 |

## 总结

通过**彻底理解六边形网格的数学关系**和 **CSS Grid + clip-path 的相互作用**，实现了真正自适应的响应式网格布局。关键在于：

1. ✅ **动态行高** = 动态列宽（保证正方形）
2. ✅ **相对行间距** = 列宽的百分比（保证几何一致性）
3. ✅ **正确的边框方案** = 用 `drop-shadow` 而不是 `border`
4. ✅ **清晰的视觉区分** = 不同状态用不同样式（边框 vs 填充）

所有硬值都是无法消除且合理的设计常数，不会随意改变。
