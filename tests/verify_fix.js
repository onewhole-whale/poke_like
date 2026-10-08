/* v1.15.1 回归补验：7 项修复的独立动态验证（不依赖 sandbox_accept_test.js 自报）
   覆盖：refineFate/toolInv 持久化+旧档迁移 / TOOL_TREE 48 种结构 / tickBattleBuffs 数值
        / 事件密度 / 空手仅普通 / moveTo 越界 / gather 不自动采集 */
const fs = require('fs');
let pass=0, fail=0;
const assert=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
function mkEl(){
  const e={children:[],className:'',innerHTML:'',style:{},title:'',dataset:{},disabled:false,textContent:'',value:'',_ev:{},
    addEventListener(t,f){this._ev[t]=f;},removeEventListener(){},focus(){},blur(){},
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c);return c},remove(){},querySelector(){return mkEl()},querySelectorAll(){return []}};
  return e;
}
const LS={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}};
global.document={querySelector:()=>mkEl(),querySelectorAll:()=>[],createElement:()=>mkEl(),createTextNode:t=>({nodeValue:t,textContent:t}),addEventListener:()=>{}};
global.window={addEventListener:()=>{},location:{hash:'#/stable'},renderSettle:()=>{},renderWild:()=>{}};
global.location={hash:'#/stable'};
global.localStorage=LS;
global.requestAnimationFrame=fn=>fn();
global.setTimeout=fn=>fn();
let code = require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,saveDraft,init,TOOL_TREE,tickBattleBuffs,genSandbox,collectTile,moveTo,spendStamina,staminaNow,matAny,matInfo,makeSpirit,startBattle,wildBeast,applyTemplate,rollBattleBuffs,battleRoundEnd};`);
eval(code);
const T=globalThis.__T;

console.log('A. TOOL_TREE 结构');
const tk = Object.keys(T.TOOL_TREE);
assert('48 种工具（8 细分 × 6 品质）', tk.length===48, '实际 '+tk.length);
assert('id 规范 {subtype}-{quality}', tk.every(id=>/^[a-z]+-(normal|good|fine|rare|epic|legend)$/.test(id)));
const sawN = T.TOOL_TREE['saw-normal'], pickN = T.TOOL_TREE['pick-normal'], pickL = T.TOOL_TREE['pick-legend'];
assert('锯变体 yield×2（normal 1→2）', sawN && sawN.yield===2, JSON.stringify(sawN&&sawN.yield));
assert('锯变体 durability×0.6（100→60）', sawN && sawN.durability===60, JSON.stringify(sawN&&sawN.durability));
assert('capacity 1/3/5/7/9/11（normal=1, legend=11）', pickN.capacity===1 && pickL.capacity===11, pickN.capacity+'/'+pickL.capacity);
assert('字段齐全（yield/durability/capacity/subtype/quality/rank）', ['yield','durability','capacity','subtype','quality','rank'].every(k=>k in pickN));

console.log('B. refineFate + toolInv 持久化 / 旧档迁移');
LS.setItem('refine-proto-codex', JSON.stringify({tools:3}));   // 旧档：数字 tools
T.init();   // 重新读草稿
assert('旧档 tools=3 → toolInv[\'pick-normal\']=3', T.S.toolInv && T.S.toolInv['pick-normal']===3, JSON.stringify(T.S.toolInv));
T.S.refineFate = {JL_fire_normal_0001:7};
T.S.toolInv['pick-normal'] = 2;
T.saveDraft();
const saved = JSON.parse(LS.getItem('refine-proto-codex'));
assert('saveDraft 含 refineFate', saved.refineFate && saved.refineFate.JL_fire_normal_0001===7, JSON.stringify(saved.refineFate));
assert('saveDraft 含 toolInv', saved.toolInv && saved.toolInv['pick-normal']===2, JSON.stringify(saved.toolInv));
LS.setItem('refine-proto-codex', JSON.stringify({refineFate:{JL_fire_normal_0001:9}, toolInv:{'pick-normal':2}}));
T.init();
assert('init 读回 refineFate（JL_fire_normal_0001=9）', T.S.refineFate.JL_fire_normal_0001===9, JSON.stringify(T.S.refineFate));
assert('init 读回 toolInv（pick-normal=2）', T.S.toolInv['pick-normal']===2, JSON.stringify(T.S.toolInv));
LS.setItem('refine-proto-codex', JSON.stringify({}));
T.init();
assert('空档 init 不报错、refineFate={}', T.S.refineFate && typeof T.S.refineFate==='object');

console.log('C. tickBattleBuffs 数值结算');
const b1 = {battleBuffs:[{id:'b-regen',side:'player',params:{pct:.12}}], spMax:100, spHp:50, energy:5, energyMax:20, beast:{hp:40,maxHp:100}, beastEnergy:5};
T.tickBattleBuffs(b1, {});
assert('b-regen player 回血 12%（50→62）', b1.spHp===62, 'spHp='+b1.spHp);
const b2 = {battleBuffs:[{id:'b-energy-5',side:'player',params:{energy:5}}], spMax:100, spHp:100, energy:5, energyMax:20, beast:{hp:100,maxHp:100}, beastEnergy:5};
T.tickBattleBuffs(b2, {});
assert('b-energy-5 回能 +5（5→10）', b2.energy===10, 'energy='+b2.energy);
const b3 = {battleBuffs:[{id:'b-energy-5',side:'player',params:{energy:5}}], spMax:100, spHp:100, energy:19, energyMax:20, beast:{hp:100,maxHp:100}, beastEnergy:5};
T.tickBattleBuffs(b3, {});
assert('b-energy-5 上限 20（19→20 不溢出）', b3.energy===20, 'energy='+b3.energy);
const b4 = {battleBuffs:[{id:'b-regen',side:'beast',params:{pct:.12}}], spMax:100, spHp:100, energy:5, energyMax:20, beast:{hp:40,maxHp:100}, beastEnergy:5};
T.tickBattleBuffs(b4, {});
assert('b-regen beast 侧回血 12%（40→52）', b4.beast.hp===52, 'beast.hp='+b4.beast.hp);
const b5 = {battleBuffs:[{id:'b-regen',side:'both',params:{pct:.12}}], spMax:100, spHp:50, energy:5, energyMax:20, beast:{hp:40,maxHp:100}, beastEnergy:5};
T.tickBattleBuffs(b5, {});
assert('side=both 双方都回血', b5.spHp===62 && b5.beast.hp===52, b5.spHp+'/'+b5.beast.hp);
const dmgDownRefs = (code.match(/b-harden[\s\S]{0,220}dmgDown/g)||[]).length;
assert('b-harden 减伤 8% 并入 dmgDown（野外+秘境双引擎）', dmgDownRefs>=2, '引用块='+dmgDownRefs);

console.log('D. 事件密度（100 次生成采样）');
const _realRand = Math.random;
let fw=0;
for(let i=0;i<100;i++){
  const g = T.genSandbox('burning');
  for(const row of g.cells) for(const c of row){
    if(c.event && !c.resolved && (c.event.kind==='fight'||c.event.kind==='wonder')) fw++;
  }
}
const den = fw/100/49*100;
assert('战斗+奇遇 ≈50%（45~55%）', den>=45 && den<=55, '密度='+den.toFixed(1)+'%');

console.log('E. 空手采集仅普通 + 50%');
const sp = T.makeSpirit('JL_water_normal_0023',false,'t'); sp.lvl=30; T.S.spirits=[sp];
const g2 = T.genSandbox('burning');
const r3 = g2.cells.flat().find(c=>(c.plant>0||c.ore>0) && !c.isExit) || {plant:1,ore:0,looted:false};
let gotN=0, nonNormal=0;
for(let i=0;i<100;i++){
  r3.plant=1; r3.ore=0; r3.looted=false;
  T.S.wild={zone:'burning',state:'grid',grid:g2,px:0,py:0,exitX:g2.exitX,exitY:g2.exitY,spiritId:sp.id,phase:'move',battle:null,story:null,storyIdx:0,loots:[],log:[],fledFrom:null};
  T.S.stamina=120; T.S.staminaAt=Date.now();
  const n0=T.S.wild.loots.length;
  T.collectTile(r3);
  const got=T.S.wild.loots.length-n0;
  if(got>0){
    gotN++;
    const last=T.S.wild.loots[T.S.wild.loots.length-1];
    const m=T.matAny(last.id);
    if(m && m.quality!=='normal') nonNormal++;
  }
}
assert('v1.16.5 空窗期：空手 0 出货（M3-1-4 补测试素材后恢复 50%）', gotN===0, gotN);
assert('空手出货全普通（空窗不验）', nonNormal===0, 'nonNormal='+nonNormal);

console.log('F. moveTo 越界保护');
const g3 = T.genSandbox('burning');
T.S.wild={zone:'burning',state:'grid',grid:g3,px:0,py:0,exitX:g3.exitX,exitY:g3.exitY,spiritId:'x',phase:'move',battle:null,story:null,storyIdx:0,loots:[],log:[],fledFrom:null};
T.S.stamina=120; T.S.staminaAt=Date.now();
let mvErr=false;
try{ T.moveTo(-1,0); }catch(e){ mvErr=true; }
assert('moveTo(-1,0) 不抛异常', !mvErr, mvErr?'ERR':'');
assert('越界后位置不变（px=0,py=0）', T.S.wild.px===0 && T.S.wild.py===0, T.S.wild.px+','+T.S.wild.py);
assert('越界不扣体力（仍 120）', T.S.stamina===120, T.S.stamina);

console.log('G. gather 事件不自动采集，点当前格才采');
const g4 = T.genSandbox('burning');
const srcG = g4.cells.flat().find(c=>(c.plant>0||c.ore>0) && !(c.x===1&&c.y===0) && !(c.x===g4.exitX&&c.y===g4.exitY));
g4.cells[0][1] = Object.assign({}, srcG, {x:1,y:0,explored:false,event:{kind:'gather',gathered:false},resolved:false,looted:false,isExit:false});
T.S.wild={zone:'burning',state:'grid',grid:g4,px:0,py:0,exitX:g4.exitX,exitY:g4.exitY,spiritId:'x',phase:'move',battle:null,story:null,storyIdx:0,loots:[],log:[],fledFrom:null};
T.S.stamina=120; T.S.staminaAt=Date.now();
T.moveTo(1,0);
assert('进入 gather 格仅扣移动 1 体力（120→119，无采集费）', T.S.stamina===119, T.S.stamina);
assert('进入 gather 格不自动出货（loots 空）', T.S.wild.loots.length===0, 'loots='+T.S.wild.loots.length);
const gCell = g4.cells[0][1];
const _gReal = Math.random; Math.random = ()=>0.1;   // 固定出货分支
T.collectTile(gCell);
Math.random = _gReal;
assert('点当前格才采集（再扣 1 → 118）', T.S.stamina===118, T.S.stamina);
assert('v1.16.5 空窗期：采集池空，点格不出货', T.S.wild.loots.length===0, 'loots='+T.S.wild.loots.length);
assert('采集后资源扣光 looted=true', gCell.plant===0 && gCell.looted===true, JSON.stringify({p:gCell.plant,l:gCell.looted}));

console.log('\nv1.15.1 修复补验 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
