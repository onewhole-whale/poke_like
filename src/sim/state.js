
const S = {
  view:'home',
  sessionLive:false,      // false=停在主页面；开始/读档后为 true
  activeSlot:null,        // 1–5：本局最近读写的槽；未存未读则为 null
  battleSpeed:'1x',       // 战斗演出：'1x' | '2x' | 'skip'（只加速/跳过演出，不跳过战斗）
  autoBattle:false,       // 战斗内开关：按 autoCfg 自动选招/用药
  autoCfg:{               // 设置页可改；本机 settings 键持久化
    useHpPotion:true,     // 血量 <50% 时尝试血瓶
    useMpPotion:true,     // 最大期望伤害技能耗不够时尝试蓝瓶
    regenStrategy:'noAttack' // maxSkill | zero | noAttack（回能时机）
  },
  demo:false,
  aura:6,                 // 灵息结晶（开启副本的通用素材）
  skillEdits:{},           // 技能编辑器草稿：id → 技能定义（覆盖 SKILLS 查询）
  ivElixir:0,             // 洗髓露：重选灵兽个体值（M2-A3）——管理员道具，暂不允许玩家获取，管理端图鉴页可发放
  essences:{JL_fire_normal_0001:2},  // 各精灵物种的专属精魄持有（如 烬烬狼精魄，仅可用于对应精灵的副本调整）
  tools:1,                // 矿镐：矿洞丰收时消耗
  toolInv:{},             // M3-1 采集工具背包 {toolId:count}；旧档 tools 数字自动迁移
  toolDur:{},             // v1.17.0 工具耐久 {toolId:currentDurability}
  blueprintInv:{},       // v1.17.0 蓝图背包 {blueprintId:count}
  spirits:[],             // 灵兽（普通+异色全在此，shiny 标记区分）
  beasts:[],              // 妖兽
  sprouts:{fire:1},       // 元素萌芽（按属性计数；any=旧版无主萌芽，可用于任意系灵兽）
  furnace:[],             // 炉膛内素材 id / 妖兽 id（'beast:<id>'）列表
  logs:[],                // 炼化手札
  wonderQueue:[],         // 奇遇收获（待副本结算时替代对应属性的一次判定）
  refineRules:null,       // 炼化映射表（管理员可配置；null = 内置默认）
  refineFate:{},          // M3-1 灵兽缘分保底 {speciesId:count}；fate≥120 必出
  // 图鉴编辑（覆盖层 + 自定义新增，localStorage 持久化）
  matEdits:{},            // 对内置素材字段的修改
  customMats:{},          // 用户新增素材
  speciesEdits:{},        // 对内置精灵物种的修改
  customSpecies:{},       // 用户新增精灵物种
  tagLib:[],              // 全局标签库（供标签选择器复用）
  // 野外冒险（M3-1 沙盒走格子）
  wonderOnce:{},         // M3-1-5a 奇遇一次性：{mapId:{eventId:true}}
  wild:{mapId:'gentlebreeze', state:'idle', grid:null, px:0, py:0, exitX:0, exitY:0, spiritId:null, battle:null, story:null, storyIdx:0, loots:[], log:[], fledFrom:null, chainId:null, chainNode:null, chainLose:null, chainPending:null, burnScald:false},
  // 副本构建
  buildSpiritId:null,
  adjusts:[],             // [已废弃 · A6 移除] 保留字段兼容旧存档
  buildMats:{},           // 副本构建投入素材 {id:count}（数量可增减，出发时消耗）
  buildExpand:{},         // 精魄拓池开关 {elem:true}（侵占对应属性 250 分存在分）
  buildGainType:'roll',   // 收获偏好：'roll' 抽取技能/专长 ｜ 'exp' 仅经验
  // 结算（M2-A6 副本战斗）
  settle:{spiritId:null, enemies:[], idx:0, kills:0, buffs:[], phase:'idle', battle:null,
          exp:0, plan:{}, gainType:'roll', logs:[], mats:{}, words:{}},
  // M2-A5 体力 + 挂机修炼（M3-1 行动制：6min+1 上限 120）
  stamina:120, staminaMax:120, staminaAt:Date.now(),  // 体力：每 6 分钟恢复 1，元素微粒可立即回体（口粮）
  trainSlots:[],   // 挂机槽：[{spiritId, mats, gainType:'exp'|'aff'|'mastery', skillId, elem, startAt, duration, ref?}]
  trainLogs:[],    // 副本/挂机完成记录（可复刻）：[{mats, words, value, exp, aff:{elem,val}, mastery:{skillId,name,val}, stamp}]
  // M2-C 图鉴收集：曾拥有/捕获/进化过的物种 id；已领取的奖励 id
  dexSeen:{},      // {JL_fire_normal_0001:true, ...}
  dexClaimed:[],   // ['ms_10','ms_20', ...]
  matSeen:{},      // 素材图鉴：曾获得过的素材 id（用尽不熄灭）
};

/* 素材持有（消耗/获得走这里） */
const matState = {};
Object.values(MATS).forEach(m => matState[m.id] = m.count);