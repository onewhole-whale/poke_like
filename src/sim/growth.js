
/* 宝可梦式经验曲线（中等速：累计经验 = 等级³） */
function expToNext(lvl){ return lvl*lvl*lvl; }        // 升到 lvl+1 所需累计经验
function expNeed(lvl){ return expToNext(lvl) - expToNext(Math.max(1,lvl-1)); } // 本级所需
const BASE_LVL_CAP = 50;                              // 基础等级上限；灵根突破（元素萌芽）最多 +10
function lvlCapOf(sp){ return BASE_LVL_CAP + Math.min(10, sp.bonusLv||0); }
/* 亲和力：训练值（默认各系 50，上限 200，可被 affCap 专长突破）。affOf 返回该精灵某系亲和力 */
function affOf(s, elem){
  if(elem==='none') return 50;
  const a = (s.aff && s.aff[elem] != null) ? s.aff[elem] : 50;
  const eff = perkEffects(s);
  const cap = 200 + (eff.affCap||0);
  if(eff.affAll) return Math.min(cap, a + eff.affAll);
  if(eff.aff && eff.aff[elem]) return Math.min(cap, a + eff.aff[elem]);
  return a;
}
/* 技能容量系数：亲和力 ≥50% 每高10%降5%（100%→0.75，150%→0.5 封顶）；<50% 每低10%翻倍；<20% 禁带
   返回 null 表示禁带；capFloor 资质专长可突破 0.5 下限（如 0.35） */
function affCapacityMult(s, elem){
  const a = affOf(s, elem);
  const eff = perkEffects(s);
  if(a < 20 && !(eff.skillCostExempt||[]).includes(elem)) return null;
  let mult;
  if(a >= 50) mult = 1 - (a-50)*0.005;
  else mult = 1 + (50-a)/10;
  const floor = eff.capFloor!=null ? eff.capFloor : 0.5;
  if(a >= 50) mult = Math.max(floor, mult);
  return mult;
}
function skillCapCost(s, sk){
  const m = affCapacityMult(s, sk.elem);
  if(m==null) return null; // 禁带
  return Math.max(1, Math.round(sk.cost * m));
}
/* 精灵技能容量上限：基础值 + 等级成长 + 资质专长 */
function capacityOf(s){
  const sp = allSpeciesDef(s.speciesId);
  const base = speciesBase(sp);
  const eff = perkEffects(s);
  return Math.round(base.capBase + base.capGrow*(s.lvl||1)) + (eff.capBonus||0);
}
function usedCap(s){
  return (s.skills||[]).reduce((a,sk)=>a+(skillCapCost(s, sk)||0), 0);
}
/* 熟练度：技能威力系数（绝活哥：超过 100 可突破上限由专长支持） */
function masteryMult(m){ const v = m==null ? 50 : m; return Math.min(1.5, 1 + (v-50)*0.01); }
function masteryList(s){ return (s.skills||[]).concat(s.skillPool||[]); }
function masteryTotal(s){ return masteryList(s).reduce((a,sk)=>a+(sk.mastery||0),0); }
/* 专长定义解析：库存 id（标准专长）或自包含对象（加冕专属专长） */
function perkDef(pk){
  if(typeof pk==='string') return Object.values(PERKS).flat().find(x=>x.id===pk);
  return pk;
}
/* 专长效果聚合 */
function perkEffects(s){
  const out = {};
  (s.perks||[]).forEach(pid=>{
    const p = perkDef(pid);
    if(!p || !p.effects) return;
    Object.entries(p.effects).forEach(([k,v])=>{
      if(k==='aff' || k==='skillDmg' || k==='skillCostExempt'){
        if(typeof out[k]!=='object') out[k] = Array.isArray(v) ? [] : {};
        if(Array.isArray(v)) out[k] = out[k].concat(v);
        else Object.assign(out[k], v);
      } else {
        out[k] = (out[k]||0) + (typeof v==='number' ? v : 0);
      }
    });
  });
  return out;
}
function makeSpirit(speciesId, shiny, sourceDesc){
  const sp = allSpeciesDef(speciesId);
  const beta = baseBeta(sp.elem);
  const spirit = {
    id:uid(), speciesId, name:sp.name, elem:sp.elem, shiny, source:sourceDesc,
    nature:'serious',   // 灵兽性格：落库时自选（M2-A1），详情页可低成本调整
    speed:sp.speed, hp:100,
    lvl:1, exp:0, bonusLv:0,
    perks:[], capacity:0, used:0,
    energy:5, energyMax:10,
    aff:{},
    skills:[
      {id:SKILLS[sp.elem][0].id, name:SKILLS[sp.elem][0].name, kind:'direct', cost:SKILLS[sp.elem][0].cost, elem:sp.elem, mastery:0},
    ],
    skillPool:[],   // 已习得未装备的技能（装卸不损熟练度）
    masteryCap:100, beta,
    log:[sourceDesc], adventures:0,
    wins:0, losses:0, beastKinds:[], wonderGains:0, trainCount:0, flawless:0,
    nearDeathKills:0,
  };
  // 出生：1 级解锁的直接攻击入技能库待装配（d0 已默认携带）
  directUnlocked(spirit.elem, 1).forEach(sk=>{
    if(sk.id!==spirit.skills[0].id) spirit.skillPool.push({id:sk.id, name:sk.name, kind:'direct', cost:sk.cost, elem:sk.elem, mastery:0});
  });
  spirit.capacity = capacityOf(spirit);
  spirit.used = usedCap(spirit);
  return spirit;
}
function makeBeast(speciesId, shiny, where){
  markDexSeen(speciesId);   // M2-C：野外捕获点亮图鉴
  return {id:uid(), speciesId, shiny, caught:where, nature:pick(NATURES).id, iv:genRandomIV()};   // 妖兽性格随机 + 个体值随机（M2-A3）
}
/* 旧属性迁移（2026-09-13 克制表落地）：time/star/chaos → 15 常驻系
   只作用于图鉴草稿（localStorage）里可能残留的旧 elem 字段 */
const ELEM_MIGRATE = {
  JL_poison_elite_0081:'poison', JL_poison_elite_0102:'poison', JL_light_elite_0088:'light',
  JL_dark_legend_0107:'dark', JL_dark_normal_0070:'dark', JL_ghost_elite_0095:'ghost', JL_dark_legend_0108:'dark'
};
function migrateElem(elem, speciesId){
  if(speciesId && ELEM_MIGRATE[speciesId]) return ELEM_MIGRATE[speciesId];
  if(elem==='time') return 'poison';
  if(elem==='star') return 'light';
  if(elem==='chaos') return 'dark';
  return elem;
}
function migrateCodexData(){
  Object.keys(S.speciesEdits).forEach(id=>{
    const e = S.speciesEdits[id];
    if(e && e.elem) e.elem = migrateElem(e.elem, id);
  });
  Object.keys(S.customSpecies).forEach(id=>{
    const sp = S.customSpecies[id];
    if(sp && sp.elem) sp.elem = migrateElem(sp.elem, id);
  });
  Object.keys(S.customMats).forEach(id=>{
    const m = S.customMats[id];
    if(m && m.elem) m.elem = migrateElem(m.elem);
  });
  Object.keys(S.matEdits).forEach(id=>{
    const m = S.matEdits[id];
    if(m && m.elem) m.elem = migrateElem(m.elem);
  });
}

function init(){
  // 加载图鉴编辑草稿（若有）
  try{
    const d = JSON.parse(localStorage.getItem('refine-proto-codex')||'null');
    if(d){
      S.matEdits = d.matEdits||{};
      S.customMats = d.customMats||{};
      S.speciesEdits = d.speciesEdits||{};
      S.customSpecies = d.customSpecies||{};
      S.tagLib = d.tagLib||[];
      S.skillEdits = d.skillEdits||{};
      S.essences = {...S.essences, ...(d.essences||{})};
      if(Array.isArray(d.refineRules) && d.refineRules.length>0) S.refineRules = d.refineRules;
      // M2-C：图鉴点亮进度与领取记录持久化（旧档缺省为空，不报错）
      if(d.dexSeen && typeof d.dexSeen==='object') S.dexSeen = d.dexSeen;
      if(Array.isArray(d.dexClaimed)) S.dexClaimed = d.dexClaimed;
      if(d.matSeen && typeof d.matSeen==='object') S.matSeen = d.matSeen;
      // M3-1：炼化缘分保底 + 工具背包持久化（旧档缺省 {}）
      if(d.refineFate && typeof d.refineFate==='object') S.refineFate = d.refineFate;
      if(d.toolInv && typeof d.toolInv==='object') S.toolInv = d.toolInv;
      else if(typeof d.tools==='number' && d.tools>0 && !S.toolInv['pick-normal']){
        // 旧档 d.tools 数字 → 普通矿镐 ×N（用存档值，非页面默认）
        S.toolInv = Object.assign({}, S.toolInv, {'pick-normal':d.tools});
      }
      // 自定义素材的持有数量并入 matState
      Object.keys(S.customMats).forEach(id=>{ matState[id] = S.customMats[id].count||0; });
      migrateCodexData();   // 旧属性（time/star/chaos）迁移到 15 常驻系
    }
  }catch(e){}
  collectTagLib();
  if(!S.matSeen) S.matSeen = {};
  Object.keys(matState).forEach(id=>{ if((matState[id]||0)>0) S.matSeen[id] = true; });
  if(typeof loadPlay==='function' && loadPlay()) return;
  // 初始灵兽：一只炼化而来的烬烬狼
  S.spirits.push(makeSpirit('JL_fire_normal_0001', false, '由「焰髓石 ×2」炼化而生，先天资质圆满'));
  markDexSeen('JL_fire_normal_0001');   // M2-C：初始灵兽点亮图鉴
  // 初始妖兽：含一只异色燎雀
  S.beasts.push(makeBeast('JL_fire_normal_0001', false, '落日坡 · 巡猎'));
  S.beasts.push(makeBeast('JL_water_normal_0023', false, '夜雨溪谷 · 垂钓'));
  S.beasts.push(makeBeast('JL_thunder_normal_0038', false, '雷殛岭 · 伏击'));
  S.beasts.push(makeBeast('JL_fire_normal_0016', true, '焚风谷深处 · 仅此一只'));
  S.logs.unshift({t:'初入山门', cls:'', text:'你从师父手中接过炼妖壶。壶身温热，像在等第一炉火。'});
}