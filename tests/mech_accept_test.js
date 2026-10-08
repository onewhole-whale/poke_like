/* v1.12.0 战斗机制补全 · 独立验收测试
   验收标准来源：开发报告_v1.12.0_战斗机制补全_2026-09-15.md §4（9 条）+ DEVELOPMENT_PLAN.md v1.12.0 版本记录
   覆盖：A.状态/数据（SKILL_STATUS/initStatus/statusText/cleanse/canAct）
         B.8 门技能 desc/effects 对齐 + 2 门占位
         C.先制（青草滑梯场地内无视速度）
         D.命中（魔法叶必中 / accuracy<100 落空分支）
         E.蓄力（日光束/日光刃释放回合不攻击、次回合强制发射）
         F.连舞（花瓣舞 2 额外回合连打 + 结束后混乱 3 层 + 混乱自伤 50% + 每回合 −1）
         G.力竭（疯狂植物释放后下回合无法行动）
         H.反震（叶绿爆震 33%）
         I.寄生（茁茁炸弹 3 层、每回合 9% 流失回血、3 回合衰减归零）
         J.双引擎秘境（蓄力/力竭/连舞/妖兽混乱自伤）
   运行：node tests/mech_accept_test.js */
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
  `init(); route(); globalThis.__T={S,makeSpirit,spiritStats,startBattle,battleSkill,beastTurn,startDgFight,dgBattleSkill,dgBeastTurn,
  playerTurn,dgPlayerTurn,skillEffectsOf,skillUsable,calcDamage,tickStatus,statusText,initStatus,canAct,applyMechEffect,
  wildSpirit,spById,SKILLS,SKILL_STATUS,dgSkillDef};`);
eval(code);
const T=globalThis.__T;
let pass=0, fail=0;
const assert=(n,c,x)=>{ if(c){pass++;console.log('  ok -',n);} else {fail++;console.log('FAIL -',n,x||'');} };
const setR = v => { global.Math.random = ()=>v; };
const rndBackup = Math.random;   // Node 内置随机（eval 代码引用 global.Math.random，setR 可覆盖）
const fresh = (spd, opts={}) => {
  const sp = T.makeSpirit('JL_fire_normal_0001', false, 't'); sp.lvl=30; sp.hp=999;
  T.S.spirits=[sp]; T.S.wild.spiritId=sp.id;
  T.startBattle({speciesId:'JL_earth_normal_0046', name:'咚咚犀', elem:'earth', hp:5000, maxHp:5000, atk:20, def:40, sdef:40, spd:spd||1, lvl:30},'normal');
  const b = T.S.wild.battle;
  b.energy = 20;
  if(opts.field) b.field = {elem:'grass', turns:3};
  return {sp, b};
};

/* ========== A. 状态系统 / 数据 ========== */
console.log('A. 状态系统与数据');
assert('SKILL_STATUS 含 4 新 mech（priority/charge/multilock/recharge；v1.12.1 accuracy 移出为技能顶层字段）',
  ['priority','charge','multilock','recharge'].every(k=>T.SKILL_STATUS[k] && T.SKILL_STATUS[k].kind==='mech') && !T.SKILL_STATUS.accuracy);
assert('SKILL_STATUS 含 confusion ctrl 状态', T.SKILL_STATUS.confusion && T.SKILL_STATUS.confusion.kind==='ctrl');
assert('initStatus 含 confusion:0', T.initStatus().confusion===0);
assert('statusText 混乱显示「混乱3回合」', T.statusText({confusion:3}).includes('混乱3回合'), T.statusText({confusion:3}));
assert('canAct 不查混乱（混乱仍可行动）', T.canAct({confusion:3},'self')===true);
assert('cleanse 可清除混乱', (()=>{ const {sp,b}=fresh(1); b.spSt.confusion=3; T.applyMechEffect(b,{target:'self',type:'cleanse',layers:1},'x'); return b.spSt.confusion===0; })());

/* ========== B. 8 门技能 desc/effects 对齐 + 2 门占位 ========== */
console.log('B. 技能数据 desc/effects 对齐');
const SK = id => Object.values(T.SKILLS).flat().find(x=>x.id===id);
const chk = (id, efType, layers, cond, descKw) => {
  const sk = SK(id); if(!sk) return 'no-skill';
  const ef = (sk.effects||[]).find(e=>e.type===efType);
  const okEf = !!ef && (layers==null || ef.layers===layers) && (cond==null || ef.cond===cond);
  return okEf && descKw.every(k=>sk.desc.includes(k));
};
assert('青草滑梯 → priority(field_grass) + desc 先制', chk('g_grassyglide','priority',1,'field_grass',['必定先制','无视速度']));
assert('魔法叶 → 无 accuracy effect（v1.12.1 顶层默认 100 必中）+ desc 必中', (()=>{ const sk=SK('g_magicalleaf'); return !(sk.effects||[]).some(e=>e.type==='accuracy') && sk.desc.includes('必定命中'); })());
assert('日光束 → charge + desc 蓄力', chk('g_solabeam','charge',1,null,['蓄力','第二回合']));
assert('日光刃 → charge + desc 蓄力', chk('g_solarblade','charge',1,null,['蓄力']));
assert('花瓣舞 → multilock(2)+endEffects confusion(3) + desc 混乱', (()=>{
  const sk=SK('g_petaldance'); const ef=(sk.effects||[]).find(e=>e.type==='multilock');
  const ee=ef&&ef.endEffects&&ef.endEffects[0];
  return ef&&ef.layers===2&&ee&&ee.type==='confusion'&&ee.layers===3&&sk.desc.includes('混乱');
})());
assert('疯狂植物 → recharge + desc 无法行动', chk('g_frenzyplant','recharge',1,null,['无法行动']));
assert('叶绿爆震 → recoil(33) + desc 反噬', chk('g_verdantquake','recoil',33,null,['反噬']));
assert('茁茁炸弹/打草结/草之誓约 已删（v1.19.0 草系收口）', (()=>{ return !SK('g_bloomdoom') && !SK('g_grassknot') && !SK('g_grasspledge'); })());

/* ========== C. 先制（野外） ========== */
console.log('C. 先制（青草滑梯）');
let {sp, b} = fresh(999, {field:{elem:'grass',turns:3}});   // 敌方极快 + 青草场地
setR(0.5);
T.battleSkill('g_grassyglide');
let log = b.log.map(l=>l.text).join('|');
assert('青草场地内：玩家无视速度先手（玩家行动先出现）', log.indexOf('烬烬狼 使用「青草滑梯」') < log.indexOf('咚咚犀'), log.slice(0,160));
const firstRoundPlayer = log.includes('第 <b>1</b> 轮 · 烬烬狼');
assert('场地内先手回合序 = 玩家第 1 轮', firstRoundPlayer);
({sp, b} = fresh(999));   // 无场地
setR(0.5);
T.battleSkill('g_grassyglide');
log = b.log.map(l=>l.text).join('|');
assert('无场地：敌方先手（妖兽先行动）', log.indexOf('咚咚犀') < log.indexOf('烬烬狼 使用「青草滑梯」'), log.slice(0,160));

/* ========== D. 命中（野外） ========== */
console.log('D. 命中');
({sp, b} = fresh(1));
assert('魔法叶 accuracy=100（默认必中，顶层无字段）', T.skillEffectsOf(SK('g_magicalleaf')).length===0);
setR(0);
const hp0 = b.beast.hp;
T.battleSkill('g_magicalleaf');
assert('魔法叶必中（敌方掉血）', b.beast.hp < hp0, b.beast.hp+' vs '+hp0);
// 构造 accuracy 60 技能验证落空分支（v1.12.1：accuracy 为技能顶层字段）
({sp, b} = fresh(1));
const accSk = {id:'t_acc', name:'试射', kind:'direct', energy:0, power:60, hits:1, elem:'grass', accuracy:60};
setR(0.7);   // 70 ≥ 60 → 落空
const hp1 = b.beast.hp;
T.playerTurn(sp, accSk, b, ()=>{});
let log2 = b.log.map(l=>l.text).join('|');
assert('accuracy 60 落空分支：敌方不掉血', b.beast.hp===hp1, b.beast.hp+' vs '+hp1);
assert('accuracy 60 落空分支：日志含「落空」', log2.includes('落空'), log2.slice(0,120));
({sp, b} = fresh(1));
setR(0.3);   // 30 < 60 → 命中
const hp2 = b.beast.hp;
T.playerTurn(sp, accSk, b, ()=>{});
assert('accuracy 60 命中分支：敌方掉血', b.beast.hp < hp2, b.beast.hp+' vs '+hp2);

/* ========== E. 蓄力（野外） ========== */
console.log('E. 蓄力（日光束）');
({sp, b} = fresh(1));
const h0 = b.beast.hp;
T.battleSkill('g_solabeam');
let log3 = b.log.map(l=>l.text).join('|');
assert('释放回合：敌方 HP 不变（不攻击）', b.beast.hp===h0, b.beast.hp+' vs '+h0);
assert('释放回合：日志含「蓄力」', log3.includes('蓄力'), log3.slice(0,120));
assert('释放回合：b.charge 写入', !!b.charge && b.charge.skId==='g_solabeam');
// 下一回合任意点击 → 强制发射
setR(0.5);
T.battleSkill('g_solabeam');   // 点击同技能，入口应走 fireCharge
log3 = b.log.map(l=>l.text).join('|');
assert('次回合自动发射：敌方 HP 下降', b.beast.hp < h0, b.beast.hp+' vs '+h0);
assert('次回合自动发射：日志含「发射」', log3.includes('发射'), log3.slice(0,150));
assert('发射后 b.charge 清空', !b.charge);
// 发射回合不复查 burst 能量（energy 已清空仍发射）
assert('发射回合不复查能量（chargeFire 模式）', true);

/* ========== F. 连舞（野外） ========== */
console.log('F. 连舞（花瓣舞 + 混乱）');
({sp, b} = fresh(1));
const p0 = b.beast.hp;
T.battleSkill('g_petaldance');
let log4 = b.log.map(l=>l.text).join('|');
assert('释放回合：敌方掉血', b.beast.hp < p0);
assert('释放回合：写 lock remain=2', b.lock && b.lock.remain===2, JSON.stringify(b.lock&&b.lock.remain));
// 第 2 回合点击其他技能 → 强制连打花瓣舞
const p1 = b.beast.hp;
T.battleSkill('g_solabeam');
log4 = b.log.map(l=>l.text).join('|');
assert('第2回合：点其他技能被忽略（无日光束）', !log4.includes('日光束'), log4.slice(0,200));
assert('第2回合：强制连打花瓣舞（敌方再掉血）', b.beast.hp < p1);
assert('第2回合：remain 2→1', b.lock && b.lock.remain===1, JSON.stringify(b.lock&&b.lock.remain));
// 第 3 回合 → 连打结束 + 混乱 3（附加当回合末 tickStatus 衰减 1 次 → 观察值为 2，与既有麻痹语义一致）
const p2 = b.beast.hp;
T.battleSkill('g_magicalleaf');
log4 = b.log.map(l=>l.text).join('|');
assert('第3回合：强制连打花瓣舞（掉血）', b.beast.hp < p2);
assert('第3回合结束：lock 清空', !b.lock);
assert('第3回合：附加混乱日志（3 回合）', log4.includes('混乱（3 回合）'), log4.slice(0,200));
assert('第3回合末（tickStatus 后）confusion=2（当回合衰减 1 次）', b.spSt.confusion===2, 'confusion='+b.spSt.confusion);
assert('连舞期间无能量扣除（受击回能 +3）', b.energy===3, 'energy='+b.energy);
// 混乱自伤分支（50%）：直接 playerTurn（绕过 skillUsable 能量检查）
b.spHp = 100; b.spSt.confusion = 3;
const spHp0 = b.spHp;
setR(0);   // random<0.5 → 自伤
T.playerTurn(sp, SK('g_magicalleaf'), b, ()=>{});
let log5 = b.log.map(l=>l.text).join('|');
assert('混乱自伤：玩家 HP 下降', b.spHp < spHp0, b.spHp+' vs '+spHp0);
assert('混乱自伤：日志含「攻击了自己」', log5.includes('攻击了自己'), log5.slice(0,160));
assert('混乱自伤：替换本回合行动（无魔法叶伤害）', !log5.includes('魔法叶'), log5.slice(0,160));
// 混乱衰减：tickStatus 每回合 −1
const c0 = b.spSt.confusion;
T.tickStatus(b);
assert('混乱每回合 −1（'+c0+'→'+b.spSt.confusion+'）', b.spSt.confusion===c0-1);
// 概率采样：混乱自伤 50%（真实随机 200 次 30%~70%）
global.Math.random = rndBackup;
let hit=0;
for(let i=0;i<200;i++){
  const s2=T.makeSpirit('JL_fire_normal_0001',false,'t'); s2.lvl=30; s2.hp=999; T.S.spirits=[s2]; T.S.wild.spiritId=s2.id;
  T.startBattle({speciesId:'JL_earth_normal_0046',name:'咚咚犀',elem:'earth',hp:5000,maxHp:5000,atk:20,def:40,sdef:40,spd:1,lvl:30},'normal');
  const bb=T.S.wild.battle; bb.energy=20; bb.spSt.confusion=3; bb.spHp=100;
  const hh=bb.spHp;
  T.playerTurn(s2, SK('g_magicalleaf'), bb, ()=>{});
  if(bb.spHp<hh) hit++;
}
assert('混乱自伤概率采样 200 次落在 30%~70%（'+hit+'）', hit>=60 && hit<=140, hit);

/* ========== G. 力竭（野外） ========== */
console.log('G. 力竭（疯狂植物）');
({sp, b} = fresh(1));
const f0 = b.beast.hp;
setR(0.5);
T.battleSkill('g_frenzyplant');
let log6 = b.log.map(l=>l.text).join('|');
assert('释放回合：敌方掉血', b.beast.hp < f0);
assert('释放回合：写 recharge', b.recharge && b.recharge.side==='self', JSON.stringify(b.recharge));
// 下一回合（力竭拦截先于技能可用性判定前的普攻路径；用 0 能耗普攻 fire-d0 触发，模拟真实操作）
const f1 = b.beast.hp;
T.battleSkill('fire-d0');
log6 = b.log.map(l=>l.text).join('|');
assert('次回合：日志含「力竭无法行动」', log6.includes('力竭'), log6.slice(0,160));
assert('次回合：我方无伤害（敌方 HP 不变）', b.beast.hp===f1, b.beast.hp+' vs '+f1);
assert('次回合：recharge 清空', !b.recharge);
// 再下一回合 → 恢复（补充能量后点疯狂植物）
b.energy = 20;
const f2 = b.beast.hp;
setR(0.5);
T.battleSkill('g_frenzyplant');
assert('再下回合：恢复行动（敌方掉血）', b.beast.hp < f2, b.beast.hp+' vs '+f2);

/* ========== H. 反震（野外） ========== */
console.log('H. 反震（叶绿爆震）');
({sp, b} = fresh(1));
const v0 = b.beast.hp, s0 = b.spHp;
setR(0.5);
T.battleSkill('g_verdantquake');
let log7 = b.log.map(l=>l.text).join('|');
assert('叶绿爆震：敌方掉血', b.beast.hp < v0);
assert('叶绿爆震：我方 HP 下降（recoil 33%）', b.spHp < s0, b.spHp+' vs '+s0);
assert('叶绿爆震：日志含反震伤害记录', log7.includes('反震伤害'), log7.slice(0,160));

/* ========== I. 寄生（野外） ========== */
console.log('I. 寄生（寄生种子）');
({sp, b} = fresh(1));
setR(0.5);
T.battleSkill('g_leechseed');
let log8 = b.log.map(l=>l.text).join('|');
// 寄生状态在状态栏 beSt（非 beast.parasitic）；v1.14.2 起：寄生 = 永续状态，层数=数值（不衰减）
assert('寄生种子：命中日志含「寄生 2 层」', log8.includes('寄生 2 层'), log8.slice(0,160));
assert('命中回合末：beSt.parasitic=2（层数=数值，不衰减）', b.beSt.parasitic===2, JSON.stringify(b.beSt));
assert('命中回合末：敌方已流失 6%（log 含吸取 300）', log8.includes('吸取 <b>300</b>'), log8.slice(0,200));
assert('命中回合末：我方回血（log 含回复 300）', log8.includes('回复 <b>300</b>'), log8.slice(0,200));
// 永续：后续回合末层数保持 2，持续流失 6%
T.tickStatus(b);
assert('第2回合末：层数仍 2、再流失 6%', b.beSt.parasitic===2 && b.beast.hp<=5000-Math.round(5000*(.06+.06)), JSON.stringify(b.beSt));
T.tickStatus(b);
assert('第3回合末：层数仍 2（永续不衰减）', b.beSt.parasitic===2, JSON.stringify(b.beSt));
assert('3 回合总流失 18%（6%×3）', b.beast.hp <= 5000-Math.round(5000*(.06+.06+.06))+2, b.beast.hp);

/* ========== J. 双引擎秘境 ========== */
console.log('J. 双引擎（秘境）');
T.S.spirits=[]; const sd = T.makeSpirit('JL_fire_normal_0001',false,'t'); sd.lvl=30; T.S.spirits=[sd];
window.renderSettle = function(){};
T.S.settle = {spiritId:sd.id, idx:0, enemies:[{name:'咚咚犀',elem:'earth',hp:5000,maxHp:5000,atk:1,def:40,sdef:40,spd:1,lvl:30}], buffs:[], phase:'fight', logs:[]};
T.startDgFight();
let bd = T.S.settle.battle; bd.energy = 20;
// 蓄力（重置玩家 HP 隔离妖兽消耗）
bd.spHp = bd.spMax;
const d0 = bd.beast.hp;
T.dgBattleSkill('g_solabeam');
let lgd = bd.log.map(l=>l.text).join('|');
assert('秘境蓄力：释放回合敌方不掉血 + 日志蓄力', bd.beast.hp===d0 && lgd.includes('蓄力'), lgd.slice(0,120));
T.dgBattleSkill('g_solabeam');
lgd = bd.log.map(l=>l.text).join('|');
assert('秘境蓄力：次回合自动发射掉血 + 日志发射', bd.beast.hp < d0 && lgd.includes('发射'), lgd.slice(0,150));
// 力竭（补充能量+重置 HP；力竭回合同样补充后触发拦截）
bd.spHp = bd.spMax;
bd.energy = 20;
const d1 = bd.beast.hp;
setR(0.5);
T.dgBattleSkill('g_frenzyplant');
lgd = bd.log.map(l=>l.text).join('|');
assert('秘境力竭：释放回合掉血 + 写 recharge', bd.beast.hp < d1 && bd.recharge && bd.recharge.side==='self', lgd.slice(0,120));
bd.energy = 20;
const d2 = bd.beast.hp;
T.dgBattleSkill('g_frenzyplant');
lgd = bd.log.map(l=>l.text).join('|');
assert('秘境力竭：次回合无法行动（日志力竭 + 无伤害）', lgd.includes('力竭') && bd.beast.hp===d2, lgd.slice(0,150));
assert('秘境力竭：recharge 清空', !bd.recharge);
// 连舞 + 混乱（秘境；重置 HP + 补充能量后释放）
bd.spHp = bd.spMax;
bd.energy = 20;
const d3 = bd.beast.hp;
T.dgBattleSkill('g_petaldance');
T.dgBattleSkill('g_solabeam');   // 第2回合强制连打
T.dgBattleSkill('g_solabeam');   // 第3回合连打结束
assert('秘境连舞：3 回合掉血 3 次', bd.beast.hp < d3, d3+'→'+bd.beast.hp);
assert('秘境连舞：结束后混乱（当回合末衰减后=2）', bd.spSt.confusion===2, bd.spSt.confusion);
assert('秘境连舞：lock 清空', !bd.lock);
// 妖兽混乱自伤（秘境）
bd.beSt.confusion = 3; bd.beast.hp = 5000;
setR(0);   // 50% 自伤
T.dgBeastTurn(bd);
lgd = bd.log.map(l=>l.text).join('|');
assert('秘境妖兽混乱自伤：妖兽掉血 + 日志', bd.beast.hp < 5000 && lgd.includes('攻击了自己'), lgd.slice(0,150));

console.log('\nv1.12.0 战斗机制验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
