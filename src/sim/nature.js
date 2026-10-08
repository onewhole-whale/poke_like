

/* 性格系统（M2-A1）：抄宝可梦，25 种性格 = 5 中性 + 20 修正
   修正：一项面板 ×1.1、另一项 ×0.9；血量不受性格影响
   键：atk 攻击 / def 防御 / spa 特攻 / spd 特防 / spe 速度（特攻特防随 6 维种族值 A2 接入，表已预留） */
const NATURES = [
  {id:'serious', name:'认真', up:null, down:null},
  {id:'bashful', name:'坦率', up:null, down:null},
  {id:'docile',  name:'害羞', up:null, down:null},
  {id:'quirky',  name:'浮躁', up:null, down:null},
  {id:'hardy',   name:'实干', up:null, down:null},
  {id:'lonely',  name:'孤僻', up:'atk', down:'def'},
  {id:'adamant', name:'固执', up:'atk', down:'spa'},
  {id:'naughty', name:'顽皮', up:'atk', down:'spd'},
  {id:'brave',   name:'勇敢', up:'atk', down:'spe'},
  {id:'bold',    name:'大胆', up:'def', down:'atk'},
  {id:'impish',  name:'淘气', up:'def', down:'spa'},
  {id:'lax',     name:'乐天', up:'def', down:'spd'},
  {id:'relaxed', name:'悠闲', up:'def', down:'spe'},
  {id:'modest',  name:'保守', up:'spa', down:'atk'},
  {id:'mild',    name:'温和', up:'spa', down:'def'},
  {id:'quiet',   name:'冷静', up:'spa', down:'spe'},
  {id:'rash',    name:'马虎', up:'spa', down:'spd'},
  {id:'calm',    name:'沉着', up:'spd', down:'atk'},
  {id:'gentle',  name:'温顺', up:'spd', down:'def'},
  {id:'sassy',   name:'自大', up:'spd', down:'spe'},
  {id:'careful', name:'慎重', up:'spd', down:'spa'},
  {id:'timid',   name:'胆小', up:'spe', down:'atk'},
  {id:'hasty',   name:'急躁', up:'spe', down:'def'},
  {id:'jolly',   name:'爽朗', up:'spe', down:'spa'},
  {id:'naive',   name:'天真', up:'spe', down:'spd'},
];
function natureOf(id){ return NATURES.find(n=>n.id===id) || NATURES[0]; }
/* 性格对某面板项的修正系数：提升 ×1.1 / 降低 ×0.9 / 无关 ×1 */
function natureMult(id, stat){
  const n = natureOf(id);
  if(n.up===stat) return 1.1;
  if(n.down===stat) return 0.9;
  return 1;
}
/* 性格的可见描述：如「固执 · 攻击↑ 特攻↓」；中性为「认真 · 无修正」 */
function natureDesc(id){
  const n = natureOf(id);
  const nm = {atk:'攻击', def:'防御', spa:'特攻', spd:'特防', spe:'速度'};
  if(!n.up) return n.name+' · 无修正';
  return n.name+' · '+nm[n.up]+'↑ '+nm[n.down]+'↓';
};

/* 技能表：三分类体系
   kind    direct 直接攻击（无特殊效果 · 纯威力 · 可分段 · 可耗能）/ ult 绝技（耗能+机制）/ burst 爆发技（满足条件后清空能量）
   cost    占用技能容量（受亲和力修正）
   energy  释放能耗（直接攻击 0/2/4/6/8，每 +1 点总威力 +20；爆发技为触发条件：剩余能量 ≥ energy 时可用，使用后清空）
   power   总威力（崩铁式伤害公式的威力项，60 威力 ≈ 旧倍率 1.0）
   hits    连击段数（每段独立结算，总威力 ÷ 段数）
   mech    机制：execute 斩杀 / heal 治愈 / guard 铁壁（减伤）/ sunder 破甲（易伤+穿透）/ surge 回能 / grow 光能聚集（每次使用其他草系技能威力永久 +60）/ gain 攻击后回能（字段 gain:1 或 5）
   通用技【回能】全系可用：不消耗能量，回复 5 点能量。 */
/* 技能表：三分类体系（2026-09-13 M1 重构）
   kind  direct    直接攻击（无特殊效果 · 纯威力 · 可分段 · 可耗能）
         ult       绝技（耗能 + 机制）
         burst     爆发技（满足条件后清空能量）
         mechanic  机制（如回能：不占容量、无熟练度、默认携带）
   直接攻击设计模板：每段威力 × 段数 = 总威力；能耗每 +1 点，总威力 +20（洛克王国式）
   0 耗模板：60×1 / 30×2 / 20×3 / 15×4 / 12×5（总威力恒 60）
   妖兽与灵兽共用「妖兽技能池」= 全属性直接攻击，随等级解锁，10 级解锁全部（满级 60）；
   绝技/爆发技只能后天获取（副本/奇遇/专属），不在妖兽池，妖兽只会直接攻击。 */;
/* 直接攻击解锁等级（索引对齐 DIRECT_TPL）：1-10 级全解锁，满级 60 */;;
/* 技能攻击轨道（M2-A2）：phys 物理=吃攻击/防御，spec 特殊=吃特攻/特防
   按属性意象分轨：能量外放型（火水雷冰光念风毒幽）→ 特殊；实体接触型（土草钢武恶虫）→ 物理 */;