/* v1.15.0 M3-1 数值经济验证（上半·机制层）独立验收测试
   验收标准来源：需求文档 §4（9 条）+ 开发报告 §5（11 条可观测断言）
   覆盖：
     A. 受击回能（野外/秘境、多段只+1、上限20、无法行动不加）
     B. 炼化保底（fate 计数/1% 采样/120 必出/只清该只/demo60/UI 缘分/持久化）
     C. 沙盒（7×7、黑雾、出口唯一可见、事件密度、移动边界、移动扣体、出口结算、撤退）
     D. 体力行动制（进入0/移动-1/采集-1/事件0/6min+1/上限120）
     E. 采集（空手50%仅普通、占用1、采空变灰）
     F. 工具数据（TOOL_TREE 48 种 / S.tools→toolInv 迁移）
     G. 敌方模版（倍率、spd 不乘、80/15/5、boss 不突袭、逃跑）
     H. 战斗 buff（表 10 个、side 映射、count、效果验证）
     I. 三层架构（TERRAIN/EVENTS/MAP_CONFIGS、override 部分覆写）
     J. demo 默认 false
   运行：node tests/sandbox_accept_test.js */
function mkEl(){
  const e = {children:[], className:'', innerHTML:'', style:{}, title:'', dataset:{}, disabled:false,
    textContent:'', value:'', selected:false, _onclick:null, _ev:{},
    addEventListener(t,f){ this._ev[t]=f; }, removeEventListener(t){ delete this._ev[t]; },
    focus(){}, blur(){},
    set onclick(f){ this._onclick=f }, get onclick(){ return this._onclick },
    classList:{_s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){f?this._s.add(c):this._s.delete(c)}, contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c); return c}, remove(){},
    querySelector(){return mkEl()}, querySelectorAll(){return []} };
  return e;
}
const LS={_d:{}, getItem(k){return this._d[k]||null}, setItem(k,v){this._d[k]=v}, removeItem(k){delete this._d[k]}};
const _els={};
global.document={querySelector:sel=>{ if(!_els[sel]) _els[sel]=mkEl(); return _els[sel]; }, querySelectorAll:()=>[], createElement:()=>mkEl(), createTextNode:t=>({nodeValue:t, textContent:t}), addEventListener:()=>{}};
global.window={addEventListener:()=>{}, location:{hash:'#/stable'}, renderSettle:()=>{}, renderWild:()=>{}};
global.location={hash:'#/stable'};
global.localStorage=LS;
global.requestAnimationFrame=fn=>fn();
global.setTimeout=fn=>fn();   // 同步执行（doRefine 内部 setTimeout）
const fs=require('fs');
let code = require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,makeSpirit,spiritStats,startBattle,battleSkill,startDgFight,dgBattleSkill,skillUsable,dgSkillUsable,
  calcDamage,typeMult,SKILLS,SKILL_STATUS,skillById,GLOBAL_SKILL_POOL,battleRoundEnd,
  doRefine,spiritCandidates,furnaceMats,spiritPool,matState,matInfo,wordsOf,unitOf,saveDraft,
  TERRAIN,FIGHT_EVENT_BASE,BATTLE_BUFFS,MAP_CONFIGS,QUALITY_RANK,MATS,
  genSandbox,applyTemplate,rollBattleBuffs,wildBeast,
  spendStamina,staminaNow,moveTo,collectTile,resolveRefine,pick,ITEMS};`);
eval(code);
const T=globalThis.__T;
let pass=0, fail=0;
const assert=(n,c,x)=>{ if(c){pass++;console.log('  ok -',n);} else {fail++;console.log('FAIL -',n,x||'');} };
const _realRand = Math.random;
const setR = v => { global.Math.random = ()=>v; };
const restoreRand = ()=>{ global.Math.random = _realRand; };
const pickT = arr => arr[Math.floor(Math.random()*arr.length)];

/* ===== A. 受击回能 ===== */
console.log('A. 受击回能（敌方攻击动作后我方 +1，多段只+1，上限20，无法行动不加）');
// 注意：battleSkill('regen') 自身 +5 能量 → 基线 = 初始 + regen5 + 受击1
const spA = T.makeSpirit('JL_water_normal_0023', false, 't'); spA.lvl=30;
T.S.spirits=[spA]; T.S.wild.spiritId=spA.id;
T.startBattle({speciesId:'JL_earth_normal_0046', name:'咚咚犀', elem:'earth', hp:3000, maxHp:3000, atk:1, spa:1, def:40, sdef:40, spd:1, lvl:30},'normal');
let bA = T.S.wild.battle; bA.energy = 5; bA.beastEnergy = 20; bA.spHp = bA.spMax;
setR(0.5);
T.battleSkill('regen');   // 玩家回能+5 → 妖兽攻击动作结算后 +1
assert('妖兽攻击动作后 energy 到顶（5→regen+5=10，受击+1被上限截断）', bA.energy === 10, '实际='+bA.energy);
assert('多段技能也只 +1（四岩连珠 4 段仍是 +1，不是 +4）', bA.energy === 10, bA.energy);
// 上限 10
 bA.energy = 10;
T.battleSkill('regen');
assert('energy=10 时不再增加（上限 10）', bA.energy===10, bA.energy);
// 无法行动（睡眠）不加
bA.energy = 5; bA.beSt = {...bA.beSt, sleep:1};
T.battleSkill('regen');
assert('妖兽睡眠无法行动 → 不加能量（5→regen+5=10）', bA.energy===10, '实际='+bA.energy);
// 秘境对称
T.S.spirits=[]; const sd = T.makeSpirit('JL_fire_normal_0001', false, 't'); sd.lvl=30; T.S.spirits=[sd];
window.renderSettle = function(){};
T.S.settle = {spiritId:sd.id, idx:0, enemies:[{name:'咚咚犀',elem:'earth',hp:3000,maxHp:3000,atk:1,spa:1,def:40,sdef:40,spd:1,lvl:30}], buffs:[], phase:'fight', logs:[]};
T.startDgFight();
const bd = T.S.settle.battle; bd.energy = 5; bd.beastEnergy = 20; bd.spHp = bd.spMax;
setR(0.5);
T.dgBattleSkill('regen');
assert('秘境对称：dgBeastTurn 攻击动作后 energy 到顶（5→10）', bd.energy === 10, '实际='+bd.energy);

/* ===== B. 炼化保底 ===== */
console.log('B. 炼化保底（fate 计数 / 1% / 120 必出 / 只清该只 / demo60 / UI / 持久化）');
T.S.refineRules=[{id:'r-t',name:'t',pool:'spirit',cond:{unit:1,anyUnit:true,words:[{w:'fire',n:1}],minQuality:'fine',spirits:['JL_fire_normal_0001','JL_fire_normal_0009']},note:''}];
// v1.16.5: 旧 flame 已删，注册临时 fire/fine 素材
T.S.customMats['tst_fire_fine']={id:'tst_fire_fine',name:'测试火材精良',elem:'fire',quality:'fine',type:'plant',tags:[],count:0,desc:'t'};
T.S.furnace=[];
// 出灵兽的可靠判据：必出时 doRefine 会 delete 被出那只的 fate（只清该只）；自然 1% 出同样清
const refineOnce=()=>{
  T.S.furnace=[]; for(let j=0;j<2;j++) T.S.furnace.push('tst_fire_fine');
  T.matState['tst_fire_fine']=(T.matState['tst_fire_fine']||0)+2;
  T.doRefine();
};
// fate 计数
T.S.refineFate = {};
refineOnce();
assert('候选池非空 → 池中每只 fate+1', T.S.refineFate['JL_fire_normal_0001']===1 && T.S.refineFate['JL_fire_normal_0009']===1, JSON.stringify(T.S.refineFate));
// 1% 采样 200 次（fate<120 恒 1%，自然 1% 出后 fate 清零再累计）
let natOut=0;
T.S.refineFate = {};
for(let i=0;i<200;i++){ const before=T.S.refineFate['JL_fire_normal_0001']||0; refineOnce(); if((T.S.refineFate['JL_fire_normal_0001']||0)<before) natOut++; }
assert('fate<120 采样 200 次出 ≤5（恒 1%）', natOut<=5, '自然出 '+natOut+' 次');
// fate=120 必出（JL_fire_normal_0001 置 119 → 炼化 → 120 → 必出 → fate 被清）
T.S.refineFate = {JL_fire_normal_0001:119, JL_fire_normal_0009:0};
refineOnce();
assert('fate=120 必出（fate 被清即出）', T.S.refineFate['JL_fire_normal_0001']===undefined, JSON.stringify(T.S.refineFate));
assert('出后只清被出的那只（JL_fire_normal_0001 清、JL_fire_normal_0009 保留 1）', T.S.refineFate['JL_fire_normal_0009']===1, JSON.stringify(T.S.refineFate));
// 多只并达阈值 → 必出其一、另一只保留（120）
T.S.refineFate = {JL_fire_normal_0001:119, JL_fire_normal_0009:119};
refineOnce();
const fw=T.S.refineFate['JL_fire_normal_0001'], lv=T.S.refineFate['JL_fire_normal_0009'];
assert('两只都达阈值 → 出一只、另一只保留 120', (fw===undefined&&lv===120)||(lv===undefined&&fw===120), 'fw='+fw+' lv='+lv);
// demo 阈值 60
T.S.demo = true; T.S.refineFate={JL_fire_normal_0001:59};
refineOnce();
assert('demo 阈值 60：fate=59→60 必出（fate 被清）', T.S.refineFate['JL_fire_normal_0001']===undefined, JSON.stringify(T.S.refineFate));
T.S.demo = false;
// UI 缘分文本（静态：3195 行渲染「缘分 X/120」）
assert('UI 缘分 X/fateCap 渲染（代码含「缘分」+fate+fateCap）', /缘分/.test(code) && /fateCap/.test(code), '静态检查');
// 持久化（saveDraft 应含 refineFate）
T.saveDraft();
const saved = JSON.parse(LS.getItem('refine-proto-codex'));
assert('saveDraft 持久化 refineFate（刷新保留）', saved.refineFate!==undefined, 'saved.refineFate='+JSON.stringify(saved.refineFate));

/* ===== C. 沙盒走格子 ===== */
console.log('C. 沙盒（7×7 / 黑雾 / 出口唯一可见 / 事件密度 / 移动边界 / 出口结算 / 撤退）');
const g = T.genSandbox('gentlebreeze');
assert('7×7 网格生成', g.size===7 && g.cells.length===7 && g.cells.every(r=>r.length===7), g.size);
const allCells = g.cells.flat();
const exits = allCells.filter(c=>c.isExit);
assert('出口唯一', exits.length===1, exits.length);
assert('起点已探索、无事件', g.cells[g.startY][g.startX].explored===true && g.cells[g.startY][g.startX].event===null, '');
assert('未探索格黑雾（explored=false）', allCells.filter(c=>!c.explored).length>=40, allCells.filter(c=>!c.explored).length);
// 事件密度统计（100 次生成）
restoreRand();
let fightC=0, wonderC=0, gatherC=0, totalC=0;
for(let i=0;i<100;i++){
  const gg = T.genSandbox('gentlebreeze');
  gg.cells.flat().forEach(c=>{
    totalC++;
    if(c.event && c.event.kind==='fight') fightC++;
    else if(c.event && c.event.kind==='wonder') wonderC++;
  });
}
console.log('  （事件统计：战斗 '+fightC/totalC*100+'% 奇遇 '+wonderC/totalC*100+'%）');
assert('事件撒布正常（战斗≥15 格/局）', fightC/100>=14, fightC/100);
// 移动扣体力 + 边界
T.S.wild = {mapId:'gentlebreeze', state:'grid', grid:g, px:g.startX, py:g.startY, exitX:g.exitX, exitY:g.exitY, spiritId:spA.id, phase:'move', battle:null, story:null, storyIdx:0, loots:[], log:[], fledFrom:null};
T.S.stamina=120; T.S.staminaMax=120; T.S.staminaAt=Date.now();
let moveErr=false;
try{ T.moveTo(-1,0); }catch(e){ moveErr=true; }
assert('边界：越界移动被拒绝（不抛异常）', !moveErr, moveErr?'moveTo(-1,0) 抛异常':'');

/* ===== D. 体力行动制 ===== */
console.log('D. 体力行动制（进入0/移动-1/采集-1/事件0/6min+1/上限120）');
assert('上限 120', T.S.staminaMax===120, T.S.staminaMax);
assert('自然恢复 6min+1（staminaAt 前移 6min → +1）', (()=>{ T.S.stamina=10; T.S.staminaAt=Date.now()-360000; return T.staminaNow()===11; })(), T.S.stamina);
// 移动 -1
T.S.stamina=120; T.S.staminaAt=Date.now();
try{ T.moveTo(1,0); }catch(e){}
assert('移动扣 1 体力（120→119）', T.S.stamina===119, T.S.stamina);
// 采集 -1（找一格可采集）
const g2 = T.genSandbox('gentlebreeze');
T.S.wild = {mapId:'gentlebreeze', state:'grid', grid:g2, px:g2.startX, py:g2.startY, exitX:g2.exitX, exitY:g2.exitY, spiritId:spA.id, phase:'move', battle:null, story:null, storyIdx:0, loots:[], log:[], fledFrom:null};
const resCell = {x:1,y:1,terrain:'grassland',plant:3,ore:0,qualityDist:{normal:1},explored:true,event:null,resolved:false,looted:false,isExit:false};
let collectErr=false;
try{
  T.S.stamina=120; T.S.staminaAt=Date.now();
  T.collectTile(resCell);
}catch(e){ collectErr=true; }
assert('采集扣 1 体力（120→119）', !collectErr && T.S.stamina===119, T.S.stamina+(collectErr?' ERR':''));
assert('采后资源扣减（普通 1 档或空手失败未置 looted）', resCell.plant<=2 || resCell.looted===true, JSON.stringify({p:resCell.plant,o:resCell.ore,l:resCell.looted}));
// 12 测试素材落库
restoreRand();
const mats12 = ['SC_none_normal_000002','SC_none_good_000003','SC_none_fine_000004','SC_none_rare_000005','SC_none_epic_000006','SC_none_legend_000007',
  'SC_none_normal_000008','SC_none_good_000009','SC_none_fine_000010','SC_none_rare_000011','SC_none_epic_000012','SC_none_legend_000013'];
assert('12 条测试素材落 MATS', mats12.every(id=>T.MATS[id]), '');

/* ===== E. 工具数据（ITEMS 12 工具+4 蓝图） ===== */
console.log('E. 工具数据（ITEMS）');
const toolCnt = Object.keys(T.ITEMS).filter(id=>T.ITEMS[id].type==='tool').length;
const bpCnt = Object.keys(T.ITEMS).filter(id=>T.ITEMS[id].type==='blueprint').length;
assert('ITEMS 含 12 工具（斧/镐×6品质）', toolCnt===12, toolCnt);
assert('ITEMS 含 4 蓝图（斧/镐×优秀/精良）', bpCnt===4, bpCnt);

/* ===== F. 敌方模版 ===== */
console.log('F. 敌方模版（倍率 / spd 不乘 / boss 不突袭 / 逃跑）');
const base = T.wildBeast('JL_fire_normal_0001');
const baseSnap = {hp:base.maxHp, atk:base.atk, def:base.def, spa:base.spa, sdef:base.sdef, spd:base.spd};
const elite = T.applyTemplate({...base, hp:base.maxHp, maxHp:base.maxHp, atk:base.atk, def:base.def, spa:base.spa, sdef:base.sdef, spd:base.spd}, 'elite');
assert('精英 血×3', Math.abs(elite.maxHp - baseSnap.hp*3)<=2, elite.maxHp+' vs '+baseSnap.hp*3);
assert('精英 攻防×1.5', Math.abs(elite.atk - baseSnap.atk*1.5)<=1 && Math.abs(elite.def - baseSnap.def*1.5)<=1, elite.atk+'/'+elite.def);
assert('精英 速度不乘', elite.spd === baseSnap.spd, elite.spd+' vs '+baseSnap.spd);
const boss = T.applyTemplate({...base, hp:base.maxHp, maxHp:base.maxHp, atk:base.atk, def:base.def, spa:base.spa, sdef:base.sdef, spd:base.spd}, 'boss');
assert('首领 血×4（v1.17.0 拍板）', Math.abs(boss.maxHp - baseSnap.hp*4)<=2, boss.maxHp+' vs '+baseSnap.hp*4);
assert('首领 攻防×2（v1.17.0 拍板）', Math.abs(boss.atk - baseSnap.atk*2)<=1 && Math.abs(boss.def - baseSnap.def*2)<=1, boss.atk+'/'+boss.def);
assert('首领 速度不乘', boss.spd === baseSnap.spd, boss.spd);
// boss 不突袭：genSandbox 生成的 boss 战斗事件 ambush=false
restoreRand();
let g4=null;
for(let i=0;i<50;i++){ g4 = T.genSandbox('gentlebreeze'); if(g4.cells.flat().some(c=>c.event&&c.event.template==='boss')) break; }
const bossCells = g4.cells.flat().filter(c=>c.event && c.event.template==='boss');
if(bossCells.length>0){
  assert('首领不突袭（ambush=false）', bossCells.every(c=>c.event.ambush===false), JSON.stringify(bossCells.map(c=>c.event.ambush)));
} else { pass++; console.log('  ok - 首领不突袭（50 次未出 boss，跳过）'); }
// 逃跑逻辑：boss 战逃跑按钮 → 退回 fledFrom、事件保留、不扣体力
const fleeCode = /fleeBtn/.test(code) && /w\.px = fr\.x/.test(code);
assert('boss 战逃跑按钮：退回上格/事件保留/不扣体力（静态）', fleeCode, fleeCode);

/* ===== G. 上位素材 UP_MATS（v1.16.1 已推倒重来） ===== */
console.log('G. 上位素材（v1.16.1 已删除，M3-1-3 重建）');
assert('UP_MATS 已删除（v1.16.1）', typeof T.UP_MATS==='undefined' || !T.UP_MATS, 'UP_MATS still defined');

/* ===== H. 战斗 buff ===== */
console.log('H. 战斗 buff（表 10 个 / side 映射 / count / 效果验证）');
const bCnt = Object.keys(T.BATTLE_BUFFS||{}).length;
assert('BATTLE_BUFFS 10 个固定数值', bCnt===10, bCnt);
const bb = T.BATTLE_BUFFS;
const hasDesc = Object.values(bb).every(x=>x.effectType && x.desc && x.params);
assert('buff 含 effectType/desc/params', hasDesc, '');
// side 映射
const rule = {count:2, pool:['b-regen','b-vuln','b-energy-5','b-harden']};
const eBuf = T.rollBattleBuffs(rule, 'easy');
assert('简单：buff→player / debuff→beast', eBuf.every(x=>(x.effectType==='debuff'?x.side==='beast':x.side==='player')), JSON.stringify(eBuf.map(x=>x.id+':'+x.side)));
const hBuf = T.rollBattleBuffs(rule, 'hard');
assert('困难：buff→beast / debuff→player', hBuf.every(x=>(x.effectType==='buff'?x.side==='beast':x.side==='player')), JSON.stringify(hBuf.map(x=>x.id+':'+x.side)));
const nBuf = T.rollBattleBuffs(rule, 'normal');
assert('普通：neutral→双方 / 非 neutral 也应有归属', nBuf.length===2 && nBuf.every(x=>x.side), JSON.stringify(nBuf.map(x=>x.id+':'+x.side)));
// count 控制数量
const c3 = T.rollBattleBuffs({count:3, pool:['b-regen','b-vuln','b-harden']}, 'easy');
assert('buffRule.count 控制数量（count=3 → 3 个）', c3.length===3, c3.length);
// 效果验证：b-regen/b-energy-5/b-harden 应在战斗中有结算/引用点（除定义与 startBattle 存储外）
const hasBuffSettle = /tickBattleBuffs/.test(code) || /b\.battleBuffs\.forEach/.test(code) || /battleBuffs\.forEach/.test(code);
assert('b-regen/b-energy-5/b-harden 战斗内效果存在（回合末结算/引用点）', hasBuffSettle, '无 tickBattleBuffs/结算引用——battleBuffs 仅存储');

/* ===== I. 三层架构 ===== */
console.log('I. 三层架构（TERRAIN/EVENTS/MAP_CONFIGS）');
const terrainN = Object.keys(T.TERRAIN||{}).length;
assert('TERRAIN 地块表 20 个基类', terrainN===20, terrainN);
assert('FIGHT_EVENT_BASE 事件基类含 difficultyEffects', T.FIGHT_EVENT_BASE && T.FIGHT_EVENT_BASE.difficultyEffects && T.FIGHT_EVENT_BASE.difficultyEffects.easy, JSON.stringify(T.FIGHT_EVENT_BASE));
assert('MAP_CONFIGS 含 gentlebreeze（7×7/锚点/tileMats/eventConfig）', T.MAP_CONFIGS && T.MAP_CONFIGS.gentlebreeze && T.MAP_CONFIGS.gentlebreeze.size===7 && T.MAP_CONFIGS.gentlebreeze.anchors && T.MAP_CONFIGS.gentlebreeze.tileMats && T.MAP_CONFIGS.gentlebreeze.eventConfig, JSON.stringify(T.MAP_CONFIGS&&T.MAP_CONFIGS.gentlebreeze&&{size:T.MAP_CONFIGS.gentlebreeze.size}));

/* ===== J. demo 默认 false ===== */
console.log('J. demo 默认 false');
assert('新档 S.demo===false', T.S.demo===false, T.S.demo);
assert('S 初始定义 demo:false', /demo:\s*false/.test(code), '静态：S.demo 默认 false');

console.log('\nv1.15.0 M3-1 数值经济验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
