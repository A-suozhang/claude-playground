// Pure data module: Vocabulary definitions for Landmarks game
// No business logic, only structured data

const VOCABULARY_DATA = [
  // Landmarks (5 items)
  {
    id: 'landmark_eiffel',
    zh: '埃菲尔铁塔',
    en: 'Eiffel Tower',
    hint: '这座高塔在巴黎，鑫金色大铁塔',
    categoryId: 'landmarks'
  },
  {
    id: 'landmark_great_wall',
    zh: '长城',
    en: 'Great Wall',
    hint: '中国最著名的建筑，蜿蜒于山脉之间',
    categoryId: 'landmarks'
  },
  {
    id: 'landmark_statue',
    zh: '自由女神像',
    en: 'Statue of Liberty',
    hint: '矗立于纽约港，举起火焰的女性雕像',
    categoryId: 'landmarks'
  },
  {
    id: 'landmark_colosseum',
    zh: '罗马斗兽场',
    en: 'Colosseum',
    hint: '古罗马的标志性建筑，曾经举办角斗士比赛',
    categoryId: 'landmarks'
  },
  {
    id: 'landmark_pyramid',
    zh: '金字塔',
    en: 'Pyramid',
    hint: '埃及沙漠中的古代建筑奇迹，外形为三角形的巨石堆',
    categoryId: 'landmarks'
  },

  // Nature (5 items)
  {
    id: 'nature_mountain',
    zh: '喜马拉雅山',
    en: 'Himalayas',
    hint: '世界最高的山脉，座落在亚洲',
    categoryId: 'nature'
  },
  {
    id: 'nature_ocean',
    zh: '太平洋',
    en: 'Pacific Ocean',
    hint: '陆地上最大的海洋，跨越两个大陆',
    categoryId: 'nature'
  },
  {
    id: 'nature_forest',
    zh: '亚马逊雨林',
    en: 'Amazon Rainforest',
    hint: '地球的肺，南美洲最大的森林生态系统',
    categoryId: 'nature'
  },
  {
    id: 'nature_waterfall',
    zh: '瀑布',
    en: 'Waterfall',
    hint: '水从高处落下的景象，形成了壮观的白色水帘',
    categoryId: 'nature'
  },
  {
    id: 'nature_coral_reef',
    zh: '珊瑚礁',
    en: 'Coral Reef',
    hint: '海洋中五彩斑斓的生态世界，由珊瑚虫构建',
    categoryId: 'nature'
  },

  // Mystery (3 items)
  {
    id: 'mystery_void',
    zh: '虚空',
    en: 'The Void',
    hint: '无尽的黑暗，存在于时间与空间的边界',
    categoryId: 'mystery'
  },
  {
    id: 'mystery_echo',
    zh: '回声',
    en: 'Echo',
    hint: '声音的幽灵，在空旷之处晕染',
    categoryId: 'mystery'
  },
  {
    id: 'mystery_dream',
    zh: '梦境',
    en: 'Dream',
    hint: '在沉睡中编织的秘密，被遗忘的真实',
    categoryId: 'mystery'
  }
];

// Game configuration: defines map and game parameters
const gameConfig = {
  // Map settings
  gridSize: 6,          // 6x6 hexagonal grid by default
  initialBlockCount: 3, // Number of initial contiguous starting blocks
  exitCount: 1,         // Number of exit tiles on the map

  // Future: difficulty levels could adjust these settings
  difficulties: {
    easy: {
      exitCount: 2,
      initialBlockCount: 3
    },
    normal: {
      exitCount: 1,
      initialBlockCount: 3
    },
    hard: {
      exitCount: 1,
      initialBlockCount: 3
    }
  }
};

// Export for both Node.js and browser environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    VOCABULARY_DATA,
    gameConfig
  };
}
