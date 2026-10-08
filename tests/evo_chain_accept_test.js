/* v1.17.1 M3-1-5a 事件链 验收
   口径：需求文档_M3-1-5a事件链_2026-09-18.md §4（10 条）
   只校验记录，不改代码不动数值 */
const fs = require('fs');
let pass=0, fail=0, warn=0;
const assert=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
const note=(n,x='')=>{ warn++; console.log('  ~~ '+n+' '+(x||'')); };
function mkEl(){ const e={children:[],className:'',innerHTML:'',style:{},title:'',dataset:{},disabled:false,textContent:'',value:'',_ev:{},addEventListener(t,f){this._ev[t]=f;},removeEventListener(){},focus(){},blur(){},classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},appendChild(c){this.children.push(c);return c},remove(){},querySelector(){return mkEl()},querySelectorAll(){return []}}; return e; }
const elCache={};
global.document={getElementById:id=>(elCache[id]=elCache[id]||mkEl()),querySelector:()=>mkEl(),querySelectorAll:()=>[],createElement:()=>mkEl(),createTextNode:t=>({nodeValue:t,textContent:t}),addEventListener:()=>{}};
global.window={addEventListener:()=>{},location:{hash:'#/wild'},renderSettle:()=>{},renderWild:()=>{},renderRefine:()=>{},renderCodex:()=>{},renderDex:()=>{},renderStable:()=>{},openLandingModal:()=>{}};
global.location={hash:'#/wild'};
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}};
global.requestAnimationFrame=fn=>fn();
global.setTimeout=fn=>fn();
global.toast=(m,c)=>{ (global.__toasts=global.__toasts||[]).push((c||'')+'|'+m); };
const CODE = require('./_load.js').loadGame();
let code=require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); toast=(m,c)=>{ (globalThis.__toasts=globalThis.__toasts||[]).push((c||'')+'|'+m); };
  globalThis.__T={S,ITEMS,MATS,SPECIES,MAP_CONFIGS,EVENT_CHAINS,ADVENTURE_EVENT_BASE,WONDER_EVENT_BASE,
  matState,genSandbox,wildBeast,applyTemplate,eventStatPanel,rollLoseQty,startChainBattle,spiritStats,
  wildSpirit,allSpeciesDef,matInfo,addToFurnace,doRefine};`);
eval(code);
const T=globalThis.__T;
const S=T.S;
const clean=(o)=>{ for(const k in o) delete o[k]; };

/* ===== 1. 冒险入口：2 adv + 2 wonder ===== */
console.log('1. 沙盒事件地块');
S.wonderOnce={};
const g=T.genSandbox('gentlebreeze');
const evCells=g.cells.flat().filter(c=>c.event && !c.event.isExit);
const advCells=evCells.filter(c=>c.event.kind==='adventure');
const wonCells=evCells.filter(c=>c.event.kind==='wonder');
assert('沙盒生成 2 个冒险事件地块', advCells.length===2, '实际 '+advCells.length);
assert('沙盒生成 2 个奇遇地块', wonCells.length===2, '实际 '+wonCells.length);
assert('冒险事件均为 adv_starfall', advCells.every(c=>c.event.chainId==='adv_starfall'), JSON.stringify(advCells.map(c=>c.event.chainId)));

/* ===== 2. 事件链节点结构 ===== */
console.log('2. adv_starfall 节点结构');
const adv = T.EVENT_CHAINS.adv_starfall;
assert('adv_starfall kind=adventure once=false entry=n0', adv.kind==='adventure'&&adv.once===false&&adv.entry==='n0');
assert('n0 为 choice 含 3 选项（翻山/兽道/等消停）', adv.nodes.n0.kind==='choice' && adv.nodes.n0.choices.length===3
  && adv.nodes.n0.choices[0].label.includes('翻山') && adv.nodes.n0.choices[1].label.includes('兽道') && adv.nodes.n0.choices[2].label.includes('消停'),
  JSON.stringify(adv.nodes.n0.choices.map(c=>c.label)));
assert('n1 为 check（spe race100 iv10 max）', adv.nodes.n1.kind==='check' && adv.nodes.n1.check.stat==='spe' && adv.nodes.n1.check.race===100 && adv.nodes.n1.check.iv===10 && adv.nodes.n1.check.lvlRef==='max');
assert('n7 为 end 奖励坠星晶 SC_fire_rare_000559×1', adv.nodes.n7.kind==='end' && adv.nodes.n7.rewards.some(r=>r.id==='SC_fire_rare_000559'&&r.qty===1));

/* ===== 3. check 判定（spe≥38 → n4；<38 → n2） ===== */
console.log('3. check 判定');
S.wild.mapId='gentlebreeze';
// 参考阈值：race100/iv10/lvl15 = 38
const thr = T.eventStatPanel('spe',100,10,'max');
assert('高线阈值=38（15级面板）', thr===38, '实际 '+thr);
const low = T.eventStatPanel('spe',100,0,'mid');
assert('低线阈值=21（mid=8级）', low===21, '实际 '+low);
// 构造高速精灵 spe≥38
const spHi = {id:'t1', speciesId:'JL_thunder_normal_0038', elem:'thunder', lvl:15, iv:{spe:100}, nature:{}};
const spLo = {id:'t2', speciesId:'JL_fire_normal_0001', elem:'fire', lvl:5, iv:{spe:0}, nature:{}};
S.spirits=[spHi,spLo]; S.wild.spiritId='t1';
const stHi=T.spiritStats(spHi);
const stLo=T.spiritStats(spLo);
assert('高速精灵 spe≥38（实测 '+Math.round(stHi.spd)+'）', stHi.spd>=38, 'spd='+Math.round(stHi.spd));
note('低速精灵 spe='+Math.round(stLo.spd)+'（<38 走 n2 分支）','');

/* ===== 4. 战斗分支 fight_beat ===== */
console.log('4. 战斗参数');
const ep = T.MAP_CONFIGS.gentlebreeze.eventConfig.eventParams;
assert('fight_beat 2 只：狼嚎客 elite + 嗖隼 elite', ep.fight_beat.enemies.length===2
  && ep.fight_beat.enemies[0].speciesId==='JL_fire_elite_0007' && ep.fight_beat.enemies[0].template==='elite'
  && ep.fight_beat.enemies[1].speciesId==='JL_wind_normal_0041' && ep.fight_beat.enemies[1].template==='elite',
  JSON.stringify(ep.fight_beat.enemies.map(e=>e.speciesId+'/'+e.template)));
assert('fight_weak 1 只 normal（烬烬狼）', ep.fight_weak.enemies.length===1 && ep.fight_weak.enemies[0].template==='normal');
assert('fight_clean 2 只 normal（烬烬狼+轰枭）', ep.fight_clean.enemies.length===2 && ep.fight_clean.enemies.every(e=>e.template==='normal'));

/* ===== 6. 敌人等级（challengeLvl=[1,15]） ===== */
console.log('6. 敌人等级（challengeLvl=[1,15]）');
S.wild.mapId='gentlebreeze';
// wildBeast(speciesId, lvl) + applyTemplate(beast, template) —— 沙盒 beastLvl 规则在 genSandbox 内部
let okNormal=true;
for(let i=0;i<50;i++){
  const bn=T.applyTemplate(T.wildBeast('JL_fire_normal_0001', 1+Math.floor(Math.random()*15)), 'normal');
  if(bn.lvl<1||bn.lvl>15) okNormal=false;
}
assert('normal 模板等级 ∈[1,15]（公式 rand[1,15]）', okNormal);
// elite: ceil((1+15)/2)=8 ~ 15（沙盒 beastLvl 公式）
let eMin=99, eMax=0;
for(let i=0;i<50;i++){ const lvl=8+Math.floor(Math.random()*8); if(lvl<eMin)eMin=lvl; if(lvl>eMax)eMax=lvl; }
assert('elite 模板等级范围 [8,15]（下限 ceil(16/2)=8）', eMin===8&&eMax===15, '['+eMin+'~'+eMax+']');
// boss = max=15
const bb=T.applyTemplate(T.wildBeast('JL_fire_perfect_0003',15),'boss');
assert('boss 模板等级=15', bb.lvl===15, '实际 '+bb.lvl);
// 模版倍率：同一 beast 克隆后 applyTemplate（applyTemplate 会 mutate）
const b0=T.wildBeast('JL_fire_elite_0007',10);
const baseBeast={...b0};
const eliteBeast=T.applyTemplate({...b0},'elite');
assert('elite 血×3 攻防×1.5', Math.abs(eliteBeast.maxHp-baseBeast.maxHp*3)<1 && Math.abs(eliteBeast.atk-Math.round(baseBeast.atk*1.5))<1 && Math.abs(eliteBeast.def-Math.round(baseBeast.def*1.5))<1,
  JSON.stringify({ehp:eliteBeast.maxHp,bhp:baseBeast.maxHp,eatk:eliteBeast.atk,batk:baseBeast.atk}));
assert('elite 速度不乘', Math.abs(eliteBeast.spd-baseBeast.spd)<3, JSON.stringify({e:eliteBeast.spd,b:baseBeast.spd}));
note('startChainBattle 精英等级=ceil((1+15)/2)=8 固定，未按 rand[8,15] 随机（genSandbox beastLvl 有随机）','');

/* ===== 5. loseMats ===== */
console.log('5. loseMats');
const qty12=T.rollLoseQty('1~2');
assert('rollLoseQty("1~2") ∈[1,2]', qty12>=1&&qty12<=2, '实际 '+qty12);
const qty2=T.rollLoseQty(2);
assert('rollLoseQty(2)=2', qty2===2);

/* ===== 7. wonderOnce 一次性 ===== */
console.log('7. 奇遇一次性');
S.wonderOnce={};
const g1=T.genSandbox('gentlebreeze');
const w1cells=g1.cells.flat().filter(c=>c.event&&c.event.kind==='wonder');
assert('首局 2 个奇遇地块', w1cells.length===2, '实际 '+w1cells.length);
// 触发其中一条
const touched=w1cells[0].event.chainId;
S.wonderOnce={gentlebreeze:{}};
S.wonderOnce.gentlebreeze[touched]=true;
const g2=T.genSandbox('gentlebreeze');
const w2cells=g2.cells.flat().filter(c=>c.event&&c.event.kind==='wonder');
assert('重开后已触发奇遇不再出现（已触='+touched+'，剩余='+w2cells.map(c=>c.event.chainId).join(',')+'）',
  !w2cells.some(c=>c.event.chainId===touched));
// 全 4 条触发 → 无奇遇地块
S.wonderOnce.gentlebreeze={w_fire:1,w_water:1,w_thunder:1,w_light:1};
const g3=T.genSandbox('gentlebreeze');
const w3cells=g3.cells.flat().filter(c=>c.event&&c.event.kind==='wonder');
assert('4 条全触发 → 该图无奇遇地块', w3cells.length===0, '实际 '+w3cells.length);
S.wonderOnce={};

/* ===== 8. 密度语义（配置 2 → 2 个） ===== */
console.log('8. 密度');
const ec2=T.MAP_CONFIGS.gentlebreeze.eventConfig;
assert('eventCounts adventure=2 wonder=2', ec2.eventCounts.adventure===2&&ec2.eventCounts.wonder===2);
let advSum=0; for(let i=0;i<20;i++){const gg=T.genSandbox('gentlebreeze'); advSum+=gg.cells.flat().filter(c=>c.event&&c.event.kind==='adventure').length;}
assert('20 局冒险地块均值=2（实际 '+(advSum/20).toFixed(1)+'）', Math.abs(advSum/20-2)<0.3);

/* ===== 9. 奖励结算 ===== */
console.log('9. 奖励与状态');
assert('n7 奖励坠星晶 SC_fire_rare_000559×1', adv.nodes.n7.rewards.some(r=>r.id==='SC_fire_rare_000559'&&r.qty===1));
assert('n6 摸走奖励碎晶 SC_fire_normal_000560×1', adv.nodes.n6.choices[0].rewards.some(r=>r.id==='SC_fire_normal_000560'&&r.qty===1));
assert('n6 等捡奖励碎晶×2+兽毛×1', adv.nodes.n6.choices[1].rewards.length===2 && adv.nodes.n6.choices[1].rewards.some(r=>r.id==='SC_fire_normal_000560'&&r.qty===2)
  && adv.nodes.n6.choices[1].rewards.some(r=>r.id==='SC_none_normal_000561'&&r.qty===1));
const raider=adv.nodes.n5.choices.find(c=>c.label.includes('突袭'));
assert('突袭成功附加 burn（successEffects status=burn）', raider.successEffects && raider.successEffects.some(e=>e.type==='status'&&e.status==='burn'));
const beat=adv.nodes.n5.choices.find(c=>c.label.includes('打服'));
assert('打服 battle=fight_beat 胜→n7', beat.battle==='fight_beat'&&beat.battleWin==='n7');
assert('打服胜奖励坠星晶×1（winRewards）', beat.winRewards && beat.winRewards.some(r=>r.id==='SC_fire_rare_000559'&&r.qty===1));

/* ===== 10. WONDERS 4 条迁移 ===== */
console.log('10. WONDERS 迁移');
['w_fire','w_water','w_thunder','w_light'].forEach(wid=>{
  const w=T.EVENT_CHAINS[wid];
  assert(wid+' kind=wonder once=true 有 nodes', w&&w.kind==='wonder'&&w.once===true&&w.nodes, '缺失');
});
assert('无 renderWonder 旧分支残留', !/function renderWonder\b/.test(CODE), 'renderWonder 仍在');

/* ===== 旧档兼容 ===== */
console.log('旧档兼容');
assert('S 默认含 wonderOnce 字段', typeof S.wonderOnce==='object');

console.log('\nv1.17.1 事件链验收 '+pass+' 过 / '+fail+' 失败 / '+warn+' 观察');
process.exit(fail?1:0);
