// ╔══════════════════════════════════════════════════════════════╗
// ║              一、全局数据容器                                  ║
// ╚══════════════════════════════════════════════════════════════╝
var petIds = [];
var petNames = [];
var eggGroups = [];
var evolvesFromId = [];
var petTags = [];
var compatibleMap = new Map();
var groupNames = {};
var specialTagNames = {};
var seasonNames = {};

// ── 统一库存（所有已录入精灵）──
// inventory: [{ species, gender: "male"|"female", shiny, personality, medals }, ...]
var inventory = [];

// ── 已入窝雌性（从 inventory 选取，只读副本）──
// nestFemales: [{ species, shiny, personality, medals }, ...]
var nestFemales = [];

// 模态框临时状态（添加精灵用，仍沿用旧逻辑）
var modalType = null;
var modalTempCounts = null;
var modalTempShinyCounts = null;
var modalTempPersonalities = null;
var modalTempMedals = null;
var modalSavedInventory = null;
var modalMaxFemales = 0;
var modalSearchResults = [];
var replaceTargetIndex = -1;

// 推荐结果
var lastResultData = null;

// 进化链缓存
var evolutionChainCache = new Map();

// 性格 & 奖牌
var personalityData = {};
var medalData = {};

// 雄性筛选条件
var filterOnlyShiny = false;
var filterPersonality = '';
var filterMedals = {};

// 网格常量
var GRID_SIZE = 7;
var FINE_GRID = GRID_SIZE * 2;

// 位置图状态
var currentPlacement = { maleCoords: [], femaleCoords: [], maleSlots: [], femaleInstances: [] };
var originalPlacement = null;
