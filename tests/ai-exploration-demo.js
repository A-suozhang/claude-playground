// Demo: AI Exploration Strategy - showing how new prompt changes decisions
// This demo illustrates the LEVEL 1/2/3 classification method

const { initGame, getState } = require('../js/gameEngine.js');
const aiModule = require('../js/aiAgent.js');

console.log('╔════════════════════════════════════════════════════════════════╗');
console.log('║       🔍 AI 探索策略演示 (Exploration Strategy Demo)         ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');

// Scenario 1: Analyzing words with different relevance levels
console.log('【演示1】相关性层级分类\n');

const scenarios = [
  {
    name: '强相关场景 (LEVEL 1)',
    currentWord: '长城',
    exploredWords: ['中国', '秦朝', '防御工事', '故宫'],
    analysis: {
      '中国': 'LEVEL 1 强相关 ⭐⭐⭐ - 同地域、同国家',
      '秦朝': 'LEVEL 1 强相关 ⭐⭐⭐ - 同朝代、同防御体系',
      '防御工事': 'LEVEL 2 中相关 ⭐⭐ - 同类型但较宽泛',
      '故宫': 'LEVEL 1 强相关 ⭐⭐⭐ - 同国家、同中国文化遗产',
    },
    oldStrategy: '选择与LEVEL 1词相邻的格子(0.9置信度)',
    newStrategy: '选择与LEVEL 1词相邻的格子(0.9置信度) - 相同 ✓',
  },

  {
    name: '中相关场景 (LEVEL 2)',
    currentWord: '泰姬陵',
    exploredWords: ['埃及金字塔', '罗马斗兽场', '德里门'],
    analysis: {
      '埃及金字塔': 'LEVEL 2 中相关 ⭐⭐ - 都是古代宏伟建筑，但地域不同',
      '罗马斗兽场': 'LEVEL 2 中相关 ⭐⭐ - 都是经典古迹，但大洲不同',
      '德里门': 'LEVEL 1 强相关 ⭐⭐⭐ - 同国家(印度)、同地区',
    },
    oldStrategy: '犹豫→被迫选择距离最经济的位置',
    newStrategy: '积极：与德里门相邻(LEVEL1)或距离2步但几何近的位置(0.8置信度)',
  },

  {
    name: '弱相关探索 (LEVEL 3)',
    currentWord: '撒哈拉沙漠',
    exploredWords: ['埃菲尔铁塔', '长城', '泰姬陵', '自由女神像'],
    analysis: {
      '埃菲尔铁塔': 'LEVEL 3 弱相关 ⭐ - 都是地标但地域/时代差异大',
      '长城': 'LEVEL 3 弱相关 ⭐ - 都是防御/建筑，但地域/类型完全不同',
      '泰姬陵': 'LEVEL 2 中相关 ⭐⭐ - 同亚洲地区，但类型差异(建筑vs地形)',
      '自由女神像': 'LEVEL 3 弱相关 ⭐ - 都是著名标志但相距遥远',
    },
    oldStrategy: '❌ "找不到高度相关词"→ 极度犹豫，选择被迫',
    newStrategy: '✅ 积极探索(0.65置信度)：选择与某词相邻+开拓新地域，为地理聚类创造空间',
  },
];

scenarios.forEach((scenario, idx) => {
  console.log(`${idx + 1}. ${scenario.name}`);
  console.log(`   当前词：${scenario.currentWord}`);
  console.log(`   已有词：${scenario.exploredWords.join(', ')}\n`);

  console.log('   📊 相关性分析：');
  Object.entries(scenario.analysis).forEach(([word, relevance]) => {
    console.log(`      ${word}: ${relevance}`);
  });

  console.log(`\n   OLD AI 策略: ${scenario.oldStrategy}`);
  console.log(`   NEW AI 策略: ${scenario.newStrategy}`);
  console.log();
});

// Scenario 2: Decision confidence levels
console.log('\n【演示2】置信度评估体系\n');

const confidenceLevels = [
  { situation: 'LEVEL 1相邻(距离1步)', confidence: 0.90, risk: '低', example: '长城+秦陵相邻' },
  { situation: 'LEVEL 1距离2步+几何近', confidence: 0.80, risk: '低', example: '长城离秦陵2步，150px内' },
  { situation: 'LEVEL 2相邻(距离1步)', confidence: 0.75, risk: '中低', example: '埃及金字塔相邻中东词汇' },
  { situation: 'LEVEL 2距离2步+几何近', confidence: 0.70, risk: '中', example: '同大洲但距离2步' },
  { situation: '探索性选择(弱相关)', confidence: 0.65, risk: '中', example: '与1词相邻，靠近多词' },
  { situation: '完全随机/被迫选择', confidence: 0.55, risk: '高', example: '无关联词汇，边界位置' },
];

console.log('  置信度 │ 风险   │ 场景描述                    │ 示例');
console.log('  -------┼────────┼─────────────────────────────┼─────────────────────');
confidenceLevels.forEach(item => {
  const confStr = `${(item.confidence * 100).toFixed(0)}%`.padEnd(7);
  const riskStr = item.risk.padEnd(6);
  const situationStr = item.situation.padEnd(27);
  console.log(`  ${confStr} │ ${riskStr} │ ${situationStr} │ ${item.example}`);
});

// Scenario 3: Strategy selection flowchart
console.log('\n【演示3】AI 决策流程图\n');
console.log(`
  START: 分析新词「${scenarios[2].currentWord}」
     │
     ├─ 存在 LEVEL 1 强相关词？
     │  ├─ 是 → 选择与其相邻(0.9) ✅
     │  └─ 否 ↓
     │
     ├─ 存在 LEVEL 2 中相关词？
     │  ├─ 是 → 距离1步相邻？
     │  │      ├─ 是 → 选择(0.75) ✅
     │  │      └─ 否 → 距离2步但几何近(150px)?
     │  │             ├─ 是 → 选择(0.70) ✅ (探索)
     │  │             └─ 否 ↓
     │  └─ 否 ↓
     │
     └─ 积极探索模式 (LEVEL 3 弱相关)
        ├─ 多个候选格子？
        │  ├─ 是 → 选择"连接潜力"最高的(0.65) ✅
        │  │       (与某词相邻+靠近其他多词)
        │  └─ 否 → 选择唯一或最经济的(0.55) ⚠️

  END: 输出选择 + reasoning + confidence
`);

// Scenario 4: Practical game progression
console.log('\n【演示4】实际游戏进展对比\n');

const gameProgression = [
  {
    step: '1',
    newWord: '埃菲尔铁塔',
    context: '(起点，地图刚开始)',
    oldBehavior: '选择相邻已探索(N/A) → 任意',
    newBehavior: '选择相邻已探索(N/A) → 任意',
    result: '相同 ✓',
  },
  {
    step: '2',
    newWord: '巴黎圣母院',
    context: '已有[埃菲尔] - LEVEL 1强相关',
    oldBehavior: '寻找与埃菲尔相邻的格子 ✓',
    newBehavior: '寻找与埃菲尔相邻的格子 ✓',
    result: '相同 ✓ (强相关优先)',
  },
  {
    step: '3',
    newWord: '颐和园',
    context: '已有[埃菲尔,巴黎圣母院] - 无强相关',
    oldBehavior: '❌ 犹豫，被迫选择离现有词"相对近"的位置',
    newBehavior: '✅ 积极探索，选择开拓亚洲区域的位置',
    result: '改进！地图扩展 🌍',
  },
  {
    step: '4',
    newWord: '长城',
    context: '已有[颐和园] - LEVEL 1强相关',
    oldBehavior: '✓ 与颐和园相邻',
    newBehavior: '✓ 与颐和园相邻',
    result: '相同 ✓ (亚洲聚类形成)',
  },
  {
    step: '5',
    newWord: '泰姬陵',
    context: '已有[长城,颐和园,埃菲尔..] - 多区域分散',
    oldBehavior: '❌ 在各聚类边界徘徊，难以决策',
    newBehavior: '✅ 选择南亚或中心连接位置，建立区域中枢',
    result: '改进！整体结构更清晰 📊',
  },
];

console.log('  步 │ 新词汇      │ 上下文                 │ OLD AI 策略       │ NEW AI 策略');
console.log('  ───┼─────────────┼────────────────────────┼───────────────────┼───────────────────────');
gameProgression.forEach(item => {
  const stepStr = item.step.padEnd(3);
  const wordStr = item.newWord.padEnd(11);
  const contextStr = item.context.padEnd(22);
  const oldStr = item.oldBehavior.padEnd(17);
  const result = item.result;

  console.log(`  ${stepStr} │ ${wordStr} │ ${contextStr} │ ${oldStr} │ ${result}`);
  console.log(`     │             │                        │                   │ → ${item.newBehavior}`);
  console.log();
});

// Summary
console.log('\n【总结】新策略的核心优势\n');

const advantages = [
  {
    icon: '🎯',
    title: '决策更果敢',
    old: '找不到完美相关→被迫选择',
    new: '分级评估→有依据的探索(0.65置信度)',
  },
  {
    icon: '🗺️',
    title: '地图更均衡',
    old: '词汇聚集，地图扭曲',
    new: '积极开拓新区域，形成多个聚类',
  },
  {
    icon: '⚡',
    title: '进度更快',
    old: '频繁的"无法决策"延迟选择',
    new: '即使弱相关也有清晰的选择理由',
  },
  {
    icon: '📖',
    title: '策略更透明',
    old: 'reasoning简单，难理解AI思考',
    new: 'LEVEL + reasoning，玩家易理解',
  },
  {
    icon: '🔗',
    title: '连接性更好',
    old: '各聚类孤立，难以连接',
    new: '探索式选择创建区域之间的桥梁',
  },
];

advantages.forEach(adv => {
  console.log(`${adv.icon} ${adv.title.padEnd(12)} │ OLD: ${adv.old.padEnd(30)} │ NEW: ${adv.new}`);
});

console.log('\n╔════════════════════════════════════════════════════════════════╗');
console.log('║  ✅ 新 Prompt 已生效！下次 AI 推理时自动使用新策略               ║');
console.log('║  📚 详见：AI_EXPLORATION_STRATEGY.md                           ║');
console.log('╚════════════════════════════════════════════════════════════════╝\n');
