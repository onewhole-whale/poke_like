/* v1.14.0 防御技能 · guard 机制复活 · 技能类型体系 — 独立验收测试
   验收标准来源：开发报告_v1.14.0_防御技能与技能类型体系_2026-09-16.md §5（6 条）
   覆盖：
     A. 普属性 typeMult 克制链
     B. guard 读配置数值（layers:80 → ×0.2；layers:50 → ×0.5）
     C. 防御技能 n_guard 全流程（数据 / 本回合减伤 / 冷却语义 / 恢复）
     D. 冷却通用性（cooldown:N 释放后 N 回合不可用；双引擎）
     E. 双引擎秘境（n_guard 减伤 + 冷却对称）
     F. type 三分类数据核对
   运行：node tests/guard_accept_test.js */
function mkEl(){
  const e = {children:[], className:'', innerHTML:'', style:{}, title:'', dataset:{}, disabled:false,
    textContent:'', value:'', selected:false, _onclick:null, _ev:{}, _onmd:null,
    addEventListener(t,f){ this._ev[t]=f; }, removeEventListener(t){ delete this._ev[t]; },
    fire(t,ev={}){ const e=Object.assign({preventDefault(){}, key:''}, ev); if(this._ev[t]) this._ev[t](e); if(t==='mousedown'&&this._onmd) this._onmd(e); },
    focus(){}, blur(){},
    set onmousedown(f){ this._onmd=f; }, get onmousedown(){ return this._onmd; },
    classList:{_s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){f?this._s.add(c):this._s.delete(c)}, contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c); return c}, remove(){},
    querySelector(){return mkEl()}, querySelectorAll(){return []},
    set onclick(f){this._onclick=f}, get onclick(){return this._onclick} };
  return e;
}
const LS={_d:{}, getItem(k){return this._d[k]||null}, setItem(k,v){this._d[k]=v}, removeItem(k){delete this._d[k]}};
const _els={};
global.document={querySelector:sel=>{ if(!_els[sel]) _els[sel]=mkEl(); return _els[sel]; }, querySelectorAll:()=>[], createElement:()=>mkEl(), createTextNode:t=>({nodeValue:t, textContent:t}), addEventListener:()=>{}};
global.window={addEventListener:()=>{}, location:{hash:'#/stable'}, renderSettle:()=>{}, renderWild:()=>{}};
global.location={hash:'#/stable'};
global.localStorage=LS;
global.requestAnimationFrame=fn=>fn();
global.setTimeout=()=>{};
const fs=require('fs');
let code = require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,makeSpirit,spiritStats,startBattle,battleSkill,startDgFight,dgBattleSkill,
  skillUsable,dgSkillUsable,calcDamage,typeMult,SKILLS,SKILL_STATUS,skillById,GLOBAL_SKILL_POOL,battleRoundEnd};`);
eval(code);
const T=globalThis.__T;
let pass=0, fail=0;
const assert=(n,c,x)=>{ if(c){pass++;console.log('  ok -',n);} else {fail++;console.log('FAIL -',n,x||'');} };
const setR = v => { global.Math.random = ()=>v; };
const fresh = (atk=300) => {
  const sp = T.makeSpirit('JL_water_normal_0023', false, 't'); sp.lvl=30;
  T.S.spirits=[sp]; T.S.wild.spiritId=sp.id;
  T.startBattle({speciesId:'JL_earth_normal_0046', name:'咚咚犀', elem:'earth', hp:5000, maxHp:5000, atk, spa:200, def:40, sdef:40, spd:1, lvl:30},'normal');
  const b = T.S.wild.battle;
  b.energy = 20;
  b.spHp = b.spMax;
  return {sp, b};
};

console.log('A. 普属性 typeMult 克制链');
assert('武克普 ×2', T.typeMult('fight','normal')===2, T.typeMult('fight','normal'));
assert('幽攻普 ×0.5', T.typeMult('ghost','normal')===0.5, T.typeMult('ghost','normal'));
assert('普攻幽 ×0.5', T.typeMult('normal','ghost')===0.5, T.typeMult('normal','ghost'));
assert('普不克任何（普打火 ×1）', T.typeMult('normal','fire')===1, T.typeMult('normal','fire'));
assert('普不自抵抗（火打普 ×1）', T.typeMult('fire','normal')===1, T.typeMult('fire','normal'));
assert('普攻普 ×1（无互克）', T.typeMult('normal','normal')===1, T.typeMult('normal','normal'));

console.log('B. guard 读配置（免伤值=effects.layers/100）');
const calc0 = T.calcDamage(30,30,40,30,60,{},'fire','water');
const calc8 = T.calcDamage(30,30,40,30,60,{dmgDown:0.8},'fire','water');
const calc5 = T.calcDamage(30,30,40,30,60,{dmgDown:0.5},'fire','water');
assert('layers:80 → 伤害 ×0.2（±1 向下取整）', Math.abs(calc8 - calc0*0.2)<=1, calc0+'→'+calc8);
assert('layers:50 → 伤害 ×0.5（±1 向下取整）', Math.abs(calc5 - calc0*0.5)<=1, calc0+'→'+calc5);
assert('guard 不再写死 25%（0.8 减伤档生效）', calc8 < calc0*0.4, calc8);

console.log('C. 防御技能 n_guard（数据定义 + 全流程）');
const nguard = T.skillById('n_guard');
assert('n_guard 存在且 type=防御', !!nguard && nguard.type==='防御', JSON.stringify(nguard&&nguard.type));
assert('n_guard 属性=normal / 能耗1 / 容量1', nguard.elem==='normal' && nguard.energy===1 && nguard.cost===1, JSON.stringify({elem:nguard.elem,energy:nguard.energy,cost:nguard.cost}));
assert('n_guard effects=[guard layers:80] + cooldown:1', nguard.cooldown===1 && nguard.effects&&nguard.effects[0].type==='guard' && nguard.effects[0].layers===80, JSON.stringify(nguard.effects));
assert('n_guard 进 GLOBAL_SKILL_POOL.normal 白名单', (T.GLOBAL_SKILL_POOL.normal||[]).includes('n_guard'), JSON.stringify(T.GLOBAL_SKILL_POOL.normal));

let {sp, b} = fresh();
setR(0.5);
// 基线：无防御时妖兽单回合伤害（回能回合）
b.spHp = b.spMax;
T.battleSkill('regen');
const dmgBase = b.spMax - b.spHp;
// 防御回合：释放 n_guard
b.spHp = b.spMax;
setR(0.5);
T.battleSkill('n_guard');
const logG = b.log.map(l=>l.text).join('|');
const dmgGuard = b.spMax - b.spHp;
assert('R1 释放防御：日志含「−80%」', logG.includes('−80%') || logG.includes('-80%'), logG.slice(-60));
assert('R1 本回合减伤生效：伤害 ≈ 基线 ×0.2（±1）', Math.abs(dmgGuard/dmgBase - 0.2) < 0.1, 'base='+dmgBase+' guard='+dmgGuard+'（比例 '+(dmgGuard/dmgBase).toFixed(2)+'）');
assert('R1 回合末 guard 清零（本回合生效语义）', b.spBuffs.guard===0, b.spBuffs.guard);
// R2：设计预期「下一回合该技能不可用（冷却 1 回合）」
const usableR2 = T.skillUsable(sp, nguard);
assert('R2 冷却中：n_guard 不可用（设计：cooldown:1 = 下一整回合不可用）', usableR2===false, 'R2 usable='+usableR2+'（实现实际='+(usableR2?'可用':'不可用')+'）');
// R2 点击验证：冷却中 UI 按钮置灰（skillUsable=false），直接调 battleSkill 不产生防御释放日志
const logBeforeR2 = b.log.length;
b.spHp = b.spMax; setR(0.5);
T.battleSkill('n_guard');   // 冷却中调用：UI 已置灰，此处直接调用不应触发 guard 释放
const logR2 = b.log.slice(logBeforeR2).map(l=>l.text).join('|');
assert('R2 冷却中调用不触发防御释放（无 −80% 日志）', !logR2.includes('−80%') && !logR2.includes('-80%'), logR2.slice(-80));
// R2 用 regen 正常过一回合（推进到 R3）
T.battleSkill('regen');
// R3：设计预期「再下一回合恢复」
assert('R3 恢复可用（设计）', T.skillUsable(sp, nguard)===true, T.skillUsable(sp, nguard));

console.log('D. 冷却通用性（任意技能 cooldown:N）');
// 真实释放路径：克隆 n_guard 为 cooldown:2 推入 SKILLS，测完弹出
const cdSkill = {...nguard, id:'cd_test', cooldown:2};
T.SKILLS.normal.push(cdSkill);
const sp2 = T.makeSpirit('JL_fire_normal_0001', false, 't'); sp2.lvl=30;
T.S.spirits=[sp2]; T.S.wild.spiritId=sp2.id;
T.startBattle({speciesId:'JL_earth_normal_0046', name:'咚咚犀', elem:'earth', hp:5000, maxHp:5000, atk:1, spa:1, def:40, sdef:40, spd:1, lvl:30},'normal');
let b2 = T.S.wild.battle; b2.energy = 20; b2.spHp = b2.spMax;
setR(0.5);
T.battleSkill('cd_test');   // R1 释放：写 cds=cooldown+1=3 → 回合末递减到 2
assert('R1 释放 cooldown:2 → 回合末 cds=2（当回合计入冷却）', b2.cds && b2.cds['cd_test']===2, JSON.stringify(b2.cds));
// R2 回合开始前（第 1 个冷却回合）：应不可用
assert('R2 第 1 个冷却回合：不可用（生效）', T.skillUsable(sp2, cdSkill)===false, 'R2 usable='+T.skillUsable(sp2, cdSkill));
T.battleSkill('regen');     // R2 完整回合（回合末 2→1）
assert('R2 末 cds 递减为 1（仍在冷却）', b2.cds && b2.cds['cd_test']===1, JSON.stringify(b2.cds));
// 设计语义：cooldown:2 = 释放后 2 个完整回合不可用（R2、R3）→ R4 恢复
assert('R3 第 2 个冷却回合仍不可用（设计：cooldown:2 = 2 回合不可用）', T.skillUsable(sp2, cdSkill)===false, 'R3 usable='+T.skillUsable(sp2, cdSkill)+'（实现实际='+(T.skillUsable(sp2, cdSkill)?'可用':'不可用')+'）');
T.battleSkill('regen');     // R3 完整回合（回合末 1→0 删除）
assert('R3 末 cds 归零删除', b2.cds && b2.cds['cd_test']===undefined, JSON.stringify(b2.cds));
assert('R4 恢复可用', T.skillUsable(sp2, cdSkill)===true, 'R4 usable='+T.skillUsable(sp2, cdSkill));
T.SKILLS.normal = T.SKILLS.normal.filter(x=>x.id!=='cd_test');   // 清理污染

console.log('E. 双引擎秘境（n_guard 减伤 + 冷却对称）');
T.S.spirits=[]; const sd = T.makeSpirit('JL_fire_normal_0001', false, 't'); sd.lvl=30; T.S.spirits=[sd];
window.renderSettle = function(){};
T.S.settle = {spiritId:sd.id, idx:0, enemies:[{name:'咚咚犀',elem:'earth',hp:5000,maxHp:5000,atk:100,spa:300,def:40,sdef:40,spd:1,lvl:30}], buffs:[], phase:'fight', logs:[]};
T.startDgFight();
const bd = T.S.settle.battle; bd.energy = 20; bd.spHp = bd.spMax;
setR(0.5);
T.dgBattleSkill('n_guard');
const lgd = bd.log.map(l=>l.text).join('|');
assert('秘境 R1：释放防御 → 减伤日志 + 回合末 guard 清零', (lgd.includes('−80%')||lgd.includes('-80%')) && bd.spBuffs.guard===0, lgd.slice(-60));
const dgUsable = T.dgSkillUsable(nguard);
assert('秘境 R2：n_guard 冷却中不可用（设计对称）', dgUsable===false, 'dg usable='+dgUsable);

console.log('F. type 三分类数据核对');
const allSk = Object.values(T.SKILLS).flat();
const statCnt = allSk.filter(s=>s.type==='状态').length;
const defCnt = allSk.filter(s=>s.type==='防御').length;
const mechCnt = allSk.filter(s=>s.type==='机制').length;
const atkCnt = allSk.filter(s=>s.type==='攻击').length;
assert('防御技能归防御类（v1.19.2 水系/毒系/幽系新增防御技）', defCnt===11, defCnt);
assert('回能归状态类', statCnt>=1, statCnt);
assert('11 个机制技能已全部迁移为状态（机制残留=0）', mechCnt===0, '机制残留='+mechCnt);
console.log('  （统计：攻击 '+atkCnt+' / 状态 '+statCnt+' / 防御 '+defCnt+' / 机制残留 '+mechCnt+'）');

console.log('\nv1.14.0 防御/guard/技能类型验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
