# Landmarks 网页游戏

一个浏览器单人 Landmarks 字谜游戏，采用纯HTML/CSS/JS实现，无框架无构建工具。

## 项目特性

- **探索式玩法**: 在 3×3 地图上点击格子，写下描述，猜测隐藏词汇
- **三个难度等级**: 简单(3目标/5失误) · 普通(5目标/3失误) · 困难(7目标/2失误)
- **护符与诅咒系统**: 找到护符可抵消错误，累计诅咒导致失败
- **动态评分**: 早期猜对得分更高，诅咒越多分数越低
- **暗黑风美学**: 仿照Disco Elysium的视觉设计，复古魔幻氛围
- **完全响应式**: 适配桌面、平板、手机

## 文件结构

```
landmarks-game/
├── index.html                # 主页面
├── style.css                 # 全部样式
├── data/
│   └── vocabularies.js       # 词汇数据(13个词)
├── js/
│   ├── vocabulary.js         # 词汇逻辑(纯函数)
│   ├── mapEngine.js          # 网格逻辑(纯函数)
│   ├── gameEngine.js         # 游戏状态(含STATE)
│   ├── renderer.js           # DOM渲染
│   └── controller.js         # 事件协调
└── tests/
    ├── vocabulary.test.js    # 词汇模块测试(12用例)
    ├── mapEngine.test.js     # 网格模块测试(22用例)
    ├── gameEngine.test.js    # 游戏模块测试(25用例)
    └── index.html            # 浏览器测试运行器
```

## 快速开始

### 1. 在浏览器中运行游戏

```bash
# 从项目根目录启动本地服务器(任意HTTP服务器都可以)
cd landmarks-game
python3 -m http.server 8000

# 访问: http://localhost:8000
```

### 2. 运行 Node.js 单元测试

```bash
# 各模块的测试都可独立运行
node tests/vocabulary.test.js      # ✓ 12/12 passed
node tests/mapEngine.test.js       # ✓ 22/22 passed
node tests/gameEngine.test.js      # ✓ 25/25 passed

# 或全部运行
bash run_tests.sh  # (如果创建了该脚本)
```

### 3. 浏览器测试运行器

打开 `tests/index.html` 在浏览器中查看所有测试结果。

## 游戏流程

1. **设置界面**: 选择难度(简单/普通/困难)
2. **游戏界面**:
   - 左侧: 3×3 地图网格,中心格子已开启
   - 右侧: 统计栏、描述输入、词汇选择框、猜测历史
3. **每个回合**:
   - 点击相邻未探索格子
   - 写下对该位置的描述(30-200字)
   - 从下拉菜单选择猜测的词汇
   - 点击"确认猜测"
4. **猜测处理**:
   - **猜对**: 格子显示词汇,获得分数(早期更高),新格子解锁
   - **猜错**: 增加诅咒1个,或消耗护符抵消
5. **游戏结束**:
   - **胜利**: 找到所有目标词汇
   - **失败**: 诅咒数达到上限

## 神经架构

### 数据流向

```
Controller (事件)
    ↓
GameEngine (状态逻辑) ← Vocabulary/MapEngine (纯函数)
    ↓
Renderer (DOM更新)
```

### 核心模块

| 模块 | 职责 | 关键特性 |
|------|------|---------|
| `data/vocabularies.js` | 词汇和难度数据 | 13个词,3个难度配置 |
| `js/vocabulary.js` | 词汇操作 | 随机选择,精确比对,配置查询 |
| `js/mapEngine.js` | 网格和寻路 | 邻接图,可达性检查,目标验证 |
| `js/gameEngine.js` | 游戏循环 | 状态管理,回合处理,胜负判定 |
| `js/renderer.js` | 渲染层 | 全量/增量渲染,动画控制,UI更新 |
| `js/controller.js` | 事件层 | 事件绑定,模块协调,零逻辑 |

## 测试覆盖

- **59 个单元测试**, 100% 通过
- 覆盖词汇、网格、游戏引擎的核心逻辑
- 支持 Node.js 和浏览器两种运行环境

```
Vocabulary:   12 tests ✓ (getAllWords, selectTargetWords, findWordByZh...)
MapEngine:    22 tests ✓ (buildMap, computeAdjacency, placeTile...)
GameEngine:   25 tests ✓ (initGame, submitGuess, evaluatePhase...)
```

## 调试

在游戏运行过程中,打开浏览器控制台并运行:

```javascript
window.debugState()
```

输出完整的游戏状态对象,包括:
- 当前阶段(phase)
- 玩家统计(score/curses/amulets)
- 地图状态(已探索格子)
- 词汇进度(找到/未找到)

## 浏览器兼容性

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+
- 移动浏览器(iOS Safari, Chrome Android)

## 技术栈

- **HTML5**: 语义化结构
- **CSS3**: Grid/Flexbox 布局,动画,响应式设计
- **Vanilla JS**: 模块化架构,纯函数范式,JSON深拷贝状态管理

## 后续扩展方向

- [ ] 多人对战模式
- [ ] 成就系统
- [ ] 每日挑战
- [ ] 自定义词汇包
- [ ] 本地存档/云存档
- [ ] 移动端优化(触觉反馈)

## 许可证

MIT License
