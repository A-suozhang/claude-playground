# Claude Code 项目配置 - Landmarks Game

## 🎮 项目信息

**项目名**: Landmarks - 合作探索词汇地图游戏
**GitHub**: https://github.com/A-suozhang/claude-playground/tree/landmarks-game
**主要文件**: `/Users/a-suozhang/project/landmarks-game`

---

## 📋 最近进度

### ✅ 已完成
1. **游戏核心**: 六边形网格 + 两人协作流程
2. **视觉冲击**:
   - ✓ 领队(👑金色) vs 队员(🎯绿色) 面板差异
   - ✓ 出口标识: 🚪 大号图标 + EXIT 标签
   - ✓ 队员隐私: 无法看到出口位置
3. **代码质量**: 模块化架构 + 59个单元测试

### 最新 Commit
- Hash: `0288d4a`
- 主题: "feat: Enhance UI differentiation between lead and member phases"
- 内容: UI 差异化 + 隐私保护 + 出口改进

### 🔄 工作流

**关键文件修改顺序**:
1. `index.html` - UI 结构
2. `style.css` - 样式
3. `js/renderer.js` - 逻辑
4. 测试
5. 提交 commit
6. 推送到 GitHub

---

## 🏗️ 架构概览

```
Controller (事件绑定)
    ↓
GameEngine (状态管理) ← Vocabulary/MapEngine
    ↓
Renderer (DOM 更新)
```

**核心模块**:
- `js/gameEngine.js` - STATE 唯一真实源
- `js/renderer.js` - 创建/更新 DOM
- `js/controller.js` - 事件处理 (零逻辑)
- `js/mapEngine.js` - 六边形计算 (纯函数)
- `style.css` - 全部样式

---

## 🎯 当前 UI 状态

### 领队阶段 (👑)
- 背景: 金色渐变 `rgba(200,151,58,0.15)`
- 边框: 半透明金色 `rgba(200,151,58,0.3)`
- 按钮: 金色 `#C8973A`
- 能看到: ⚡ 未探索出口符号

### 队员阶段 (🎯)
- 背景: 绿色渐变 `rgba(90,143,74,0.15)`
- 边框: 半透明绿色 `rgba(90,143,74,0.3)`
- 按钮: 绿色 `#5A8F4A`
- 看不到: ⚡ 出口符号 (隐藏)

### 出口标识
- 未探索: ⚡ (1.5rem) + "EXIT" 标签
- 已探索: 🚪 (2rem) + "EXIT" 标签
- 颜色: 金色 + 发光效果

---

## 🧪 测试命令

```bash
# 单元测试
node tests/vocabulary.test.js
node tests/mapEngine.test.js
node tests/gameEngine.test.js

# 浏览器测试
# 打开 tests/index.html

# 本地运行
cd landmarks-game
python3 -m http.server 8000
# 访问 http://localhost:8000
```

---

## 📚 文档导航

| 文档 | 内容 |
|------|------|
| `README.md` | 项目特性介绍 |
| `QUICKSTART.md` | 5分钟快速开始 |
| `IMPLEMENTATION.md` | 完整技术说明 (13KB) |
| `UI_IMPROVEMENTS.md` | 最近 UI 改进 (9.4KB) |

---

## 🔑 关键代码位置

### 状态管理
```
gameEngine.js:
- STATE 对象结构 (L78-95)
- initGame() (L21-96)
- submitLeadRound() (L154-177)
- placeWordOnCell() (L184-255)
```

### UI 差异化
```
index.html:
- 领队面板 (L61-74)
- 队员面板 (L77-92)

style.css:
- .phase-panel.lead-panel (L495-500)
- .phase-panel.member-panel (L502-507)
- .btn-lead / .btn-member (L555-572)

renderer.js:
- createCellElement() (L114-162)
  └─ 第 L135-136 行: isAdjacent 逻辑
  └─ 第 L147-149 行: 出口条件
```

### 隐私保护
```
renderer.js:
- L147: if (tile.isExit && state.gameMode === 'lead')
  └─ 仅在领队阶段显示出口提示
- renderGamePhase() (L169-195)
  └─ 阶段切换时重新渲染地图
```

---

## 🚀 下一步改进方向 (可选)

- [ ] 多人支持 (3+ 队员轮流)
- [ ] 计分系统 (早期发现奖励)
- [ ] 游戏暂停/保存
- [ ] 音效和动画
- [ ] 移动端适配
- [ ] 自定义词汇库

---

## 💾 保存 Session 信息

在 Claude 中继续这个项目时:
1. 提到 `CLAUDE.md` 获取快速上下文
2. 查看最新 commit 了解进度
3. 参考 `UI_IMPROVEMENTS.md` 了解最近改动

---

## 📞 快速参考

**GitHub**: https://github.com/A-suozhang/claude-playground/tree/landmarks-game
**最新 Commit**: 0288d4a (UI 差异化)
**开发命令**: `python3 -m http.server 8000`
**文件结构**: 见 `IMPLEMENTATION.md` 第 3 部分

---

*最后更新: 2025-02-26 by Claude Code*
