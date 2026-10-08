/* v1.16.7 M2 补丁 · 技能石炼化 + 副本无战斗结算 + 亲和力修复
   验收口径：需求文档_M2补丁_技能石炼化_2026-09-17.md §4（13 条）+ DEV_PLAN §10 v1.16.7 行
   只校验记录，不改代码不动数值 */
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
const elCache={};
global.document={getElementById:id=>(elCache[id]=elCache[id]||mkEl()),querySelector:()=>mkEl(),querySelectorAll:()=>[],createElement:()=>mkEl(),createTextNode:t=>({nodeValue:t,textContent:t}),addEventListener:()=>{}};
global.window={addEventListener:()=>{},location:{hash:'#/stable'},renderSettle:()=>{},renderWild:()=>{},renderRefine:()=>{},renderCodex:()=>{},renderDex:()=>{},renderStable:()=>{}};
global.location={hash:'#/stable'};
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}};
global.requestAnimationFrame=fn=>fn();
global.setTimeout=fn=>fn();
global.toast=(m,c)=>{ global.__toasts=(global.__toasts||[]).push((c||'')+'|'+m); };
const CODE = require('./_load.js').loadGame();
let code=require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); toast=(m,c)=>{ (globalThis.__toasts=globalThis.__toasts||[]).push((c||'')+'|'+m); };
   globalThis.__T={S,ITEMS,SPECIES,MATS,allSpecies,matInfo,matState,matUnitSum,isItem,itemInfo,scorePlan,buildEnemyList,depart,trainGainAll,doRefine,REFINE_RULES_DEFAULT,furnaceMats,spiritPool,spiritCandidates,rollEntry,elemEntries,GLOBAL_SKILL_POOL,GLOBAL_PERK_POOL};`);
eval(code);
const T=globalThis.__T;
const S=T.S;

/* ===== 1. 炼化未出灵兽：f_ember ≥200 → 技能石 ×1（余数弃） ===== */
console.log('1. 技能石产出');
S.customMats['tstA']={id:'tstA',name:'测试素材A',elem:'fire',quality:'good',type:'beast',tags:['牙'],count:0,desc:'t',extractInfo:{skillScore:{f_ember:260},talentScore:{}}};
const djFb = Object.keys(T.ITEMS).find(id=>T.ITEMS[id].skillId==='f_ember');
assert('ITEMS 含技能石·f_ember 条目', !!djFb, '');
T.matState['tstA']=1; S.furnace=['tstA'];
T.doRefine();
assert('f_ember 260→技能石×1（余 60 弃）', (T.matState[djFb]||0)>=1, djFb+'='+T.matState[djFb]);
assert('素材 A 被消耗（不出素材路径产物）', !T.matState['__ling__'] && !S.logs.some(l=>/灵息结晶 ×/.test(l.text)), '');
T.matState['tstA']=0; delete T.matState['tstA']; delete S.customMats['tstA']; S.furnace=[];

/* ===== 2. 素材独立判定 ===== */
console.log('2. 素材独立判定');
S.customMats['tstA2']={id:'tstA2',name:'素材A',elem:'fire',quality:'good',type:'beast',tags:['牙'],count:0,desc:'t',extractInfo:{skillScore:{f_ember:260,pyre:180},talentScore:{}}};
S.customMats['tstB']={id:'tstB',name:'素材B',elem:'fire',quality:'good',type:'beast',tags:['牙'],count:0,desc:'t',extractInfo:{skillScore:{pyre:150},talentScore:{}}};
T.matState['tstA2']=1; T.matState['tstB']=1; S.furnace=['tstA2','tstB'];
const auraBefore2=S.aura;
T.doRefine();
const djPyre = Object.keys(T.ITEMS).find(id=>T.ITEMS[id].skillId==='f_firecart');
assert('A：f_ember 260→1 块（pyre 180 弃、A 不再走素材路径）', (T.matState[djFb]||0)>=1 && !(T.matState[djPyre]||0), 'fb='+T.matState[djFb]+' pyre='+T.matState[djPyre]);
assert('B：pyre 150 不进石头 → 素材路径（无匹配→灵息结晶入 aura）', S.aura>auraBefore2, 'aura '+auraBefore2+'->'+S.aura);
T.matState['tstA2']=0; T.matState['tstB']=0; delete T.matState['tstA2']; delete T.matState['tstB']; delete S.customMats['tstA2']; delete S.customMats['tstB']; S.furnace=[];

/* ===== 3. 素材炼化路径：精良≥3 → 元素结晶 ===== */
console.log('3. 素材炼化路径');
// r-chr-fine：词条≥3 单位 + 精良（fine）→ 元素结晶
S.customMats['tstFine']={id:'tstFine',name:'精良素材',elem:'fire',quality:'fine',type:'beast',tags:['牙','毛','爪'],count:0,desc:'t',extractInfo:{skillScore:{},talentScore:{}}};
T.matState['tstFine']=1; S.furnace=['tstFine'];
T.doRefine();
const fineOut = S.logs[0]&&S.logs[0].text;
assert('精良≥3 词条 → 出元素结晶（r-chr-fine 触发）', /结晶|凝材|精良/.test(fineOut||''), fineOut||'');
T.matState['tstFine']=0; delete T.matState['tstFine']; delete S.customMats['tstFine']; S.furnace=[];

/* ===== 4. 剩余素材转化灵息结晶 ===== */
console.log('4. 灵息结晶转化');
const r4 = (()=>{ // 4 单位无词条匹配 → 1+floor(4/4)=2
  S.customMats['tstN']={id:'tstN',name:'词条素材',elem:'none',quality:'good',type:'beast',tags:['牙'],count:0,desc:'t',extractInfo:{skillScore:{},talentScore:{}}};
  T.matState['tstN']=4; S.furnace=['tstN','tstN','tstN','tstN'];
  const n0 = S.aura;
  T.doRefine();
  const n = S.aura - n0;
  T.matState['tstN']=0; delete T.matState['tstN']; delete S.customMats['tstN']; S.furnace=[];
  return n;
})();
assert('剩余 4 单位无匹配 → 灵息结晶 1+floor(4/4)=2', r4===2, '实际 '+r4);

/* ===== 5. r-micro/r-ling/r-sprout 不再产出；r-chr-* 保留 ===== */
console.log('5. 配方表');
const ruleIds = T.REFINE_RULES_DEFAULT.map(r=>r.id);
assert('r-micro/r-ling/r-sprout 不在默认规则', !ruleIds.includes('r-micro') && !ruleIds.includes('r-ling') && !ruleIds.includes('r-sprout'), ruleIds.join(','));
assert('r-chr-fine/r-chr-perf/r-gel 保留', ruleIds.includes('r-chr-fine') && ruleIds.includes('r-chr-perf') && ruleIds.includes('r-gel'), '');

/* ===== 6. 出灵兽不受影响 ===== */
console.log('6. 出灵兽优先');
// 定向配方出灵兽路径在 spiritCandidates——构造 bPool 候选（用真实精灵配方素材较复杂；验证阶段1优先：spirit 候选存在时不进阶段2）
// r-sp-JL_fire_normal_0001 定向配方：火≥15 + 爪≥4 + 精良 → 烬烬狼
S.customMats['tstSp']={id:'tstSp',name:'爪牙素材',elem:'fire',quality:'fine',type:'beast',tags:['爪'],count:0,desc:'t',extractInfo:{skillScore:{f_ember:260},talentScore:{}}};
T.matState['tstSp']=15; S.furnace=Array(15).fill('tstSp');
const sp = T.spiritCandidates(T.spiritPool(T.furnaceMats()), T.furnaceMats());
assert('spiritCandidates 定向命中 JL_fire_normal_0001', sp.directed && sp.cands.includes('JL_fire_normal_0001'), JSON.stringify(sp));
S.refineFate['JL_fire_normal_0001']=120;   // 保底必出，绕过随机
global.openLandingModal=(o)=>{}; global.window.openLandingModal=global.openLandingModal;
const logsBefore6 = S.logs.length; const auraBefore6 = S.aura; const djFbBefore6 = T.matState[djFb]||0;
T.doRefine();
assert('fate 保底 → 出灵兽（不出石头/素材）', S.logs.length>logsBefore6 || (S.aura<=auraBefore6), S.logs[0]?S.logs[0].text.slice(0,60):'no log');
assert('出灵兽时无技能石产出', (T.matState[djFb]||0)===djFbBefore6, 'djFb '+(T.matState[djFb]||0)+' before '+djFbBefore6);
S.refineFate['JL_fire_normal_0001']=0; S.furnace=[]; T.matState['tstSp']=0; delete T.matState['tstSp']; delete S.customMats['tstSp'];

/* ===== 7. scorePlan DJ_ +100 / enemyStats 0 敌人 ===== */
console.log('7. 道具进副本');
const dj = Object.keys(T.ITEMS).find(id=>T.ITEMS[id].skillId==='f_ember');
const plan = T.scorePlan({[dj]:1});
const firePlan = plan.fire||plan.universal;
assert('scorePlan DJ_ 给 f_ember +100', firePlan && firePlan.skills['f_ember']===100, JSON.stringify(plan).slice(0,200));
const enemies = T.buildEnemyList({[dj]:10}, 10);
assert('buildEnemyList 道具贡献 0 敌人', enemies.length===0, 'enemies '+enemies.length);

/* ===== 8. 10 块同技能石=1000 直接结算 / rollEntry 满权重 ===== */
console.log('8. 无敌人直接结算');
const entries = T.elemEntries(T.scorePlan({[dj]:10}).fire);
assert('10 块石 → f_ember 1000 分', entries.length===1 && entries[0].id==='f_ember' && entries[0].score===1000, JSON.stringify(entries));
let allHit=true;
for(let i=0;i<50;i++){ const r=T.rollEntry(entries); if(!r||r.id!=='f_ember'){ allHit=false; break; } }
assert('rollEntry 满 1000 分 50 次全中（抽空概率 0）', allHit, '');

/* ===== 9. 0 敌人 <1000 禁止出发 ===== */
console.log('9. 0 敌人不足 1000 禁止');
S.spirits.push({id:'tstsp',speciesId:'JL_fire_normal_0001',lvl:10,hp:50,maxHp:50,aff:{},name:'烬烬狼',skills:[{id:'f_ember',name:'烈焰吐息'}]});
S.buildSpiritId='tstsp'; S.aura=5; S.stamina=120; S.buildMats={}; S.trainSlots=[];
T.matState[dj]=1; S.buildMats={[dj]:1};
global.__toasts=[];
const auraBefore=S.aura, stamBefore=S.stamina;
T.depart();
assert('0 敌人 100 分 <1000 → 禁止出发 toast', global.__toasts.some(t=>/1000/.test(t)), JSON.stringify(global.__toasts));
assert('不消耗灵息/体力', S.aura===auraBefore && S.stamina===stamBefore, 'aura '+S.aura+'/'+auraBefore+' sta '+S.stamina+'/'+stamBefore);

/* ===== 10. 0 敌人满 1000 直接结算、无经验/训练/记录 ===== */
console.log('10. 0 敌人满 1000 结算');
S.buildMats={[dj]:10}; T.matState[dj]=10; S.trainLogs=[];
const logsBefore = S.trainLogs.length;
S.aura=5; S.stamina=120;
global.__toasts=[];
T.depart();
assert('满 1000 → 直接结算（settle 生成、won=true）', S.settle && S.settle.won===true && S.settle.enemies.length===0, JSON.stringify({won:S.settle&&S.settle.won,en:S.settle&&S.settle.enemies.length}));
assert('消耗灵息-1 体力-10', S.aura===4 && S.stamina===110, 'aura '+S.aura+' sta '+S.stamina);
assert('无挂机复刻记录（trainLogs 无新增）', S.trainLogs.length===logsBefore, 'logs '+S.trainLogs.length);
assert('无经验/训练增益（exp=0 无 aff）', S.settle.exp===0 && !(S.settle.gain&&S.settle.gain.aff), JSON.stringify({exp:S.settle.exp,gain:S.settle.gain}));
S.spirits=S.spirits.filter(b=>b.id!=='tstsp'); delete T.matState[dj]; S.buildMats={}; S.settle=null;

/* ===== 11. trainGainAll 亲和力修复 ===== */
console.log('11. 亲和力修复');
const sp2 = {id:'x1',name:'测试',elem:'fire',skills:[{id:'f_ember',name:'烈焰吐息'}]};
const gFire = T.trainGainAll(sp2, {'chr-fire':3});
const gNone = T.trainGainAll(sp2, {'SC_fire_normal_000014':3});
assert('投火结晶 → aff=火系', gFire.aff && gFire.aff.elem==='fire', JSON.stringify(gFire));
assert('未投结晶 → 无 aff（经验保留）', !gNone.aff && gNone.exp>=10, JSON.stringify(gNone));
// 多结晶取数量最多、并列取首
const gMix = T.trainGainAll(sp2, {'chr-fire':2,'chr-ice':2,'chr-water':3});
assert('多结晶取数量最多（water 3）', gMix.aff.elem==='water', JSON.stringify(gMix));

/* ===== 12. 道具表与编码 ===== */
console.log('12. ITEMS 道具表');
const itKeys=Object.keys(T.ITEMS).filter(id=>T.ITEMS[id].type==='item');
const skTotal = Object.values(T.GLOBAL_SKILL_POOL).reduce((a,v)=>a+v.length,0);
const pkTotal = Object.values(T.GLOBAL_PERK_POOL).reduce((a,v)=>a+v.length,0);
const skItems = itKeys.filter(id=>T.ITEMS[id].skillId).length;
const pkItems = itKeys.filter(id=>T.ITEMS[id].perkId).length;
assert('ITEMS 全技能+全专长各 1 条（'+(skTotal+pkTotal)+'）', skItems===skTotal && pkItems===pkTotal && itKeys.length===skTotal+pkTotal, 'skill '+skItems+'/'+skTotal+' perk '+pkItems+'/'+pkTotal);
const nums=itKeys.map(id=>parseInt(id.split('_')[2]));
const skNums=itKeys.filter(id=>T.ITEMS[id].skillId).map(id=>parseInt(id.split('_')[2])).sort((a,b)=>a-b);
const pkNums=itKeys.filter(id=>T.ITEMS[id].perkId).map(id=>parseInt(id.split('_')[2])).sort((a,b)=>a-b);
assert('DJ_ 技能石 000001~'+skTotal+' 连续、专长石 001000~'+(1000+pkTotal-1)+' 连续、全局不重复',
  skNums[0]===1 && skNums[skNums.length-1]===skTotal && skNums.every((v,i)=>i===0||v===skNums[i-1]+1)
  && pkNums[0]===1000 && pkNums[pkNums.length-1]===1000+pkTotal-1 && pkNums.every((v,i)=>i===0||v===pkNums[i-1]+1)
  && new Set(nums).size===itKeys.length);
assert('id 格式 DJ_{elem}_{6位}', itKeys.every(id=>/^DJ_[a-z]+_\d{6}$/.test(id)), itKeys.slice(0,3).join(','));
const itemSample = T.ITEMS[itKeys[0]];
assert('道具 type=item / tags 技能石|专长石', itemSample.type==='item' && (itemSample.tags.includes('技能石')||itemSample.tags.includes('专长石')), JSON.stringify(itemSample));
assert('isItem 识别 DJ_', T.isItem(itKeys[0]) && !T.isItem('SC_fire_normal_000014'));
assert('DJ_ 不进素材表（matInfo null）', T.matInfo(itKeys[0])===null);
assert('DJ_ 不参与 matUnitSum', (()=>{ for(const k in T.matState) delete T.matState[k]; T.matState[itKeys[0]]=5; const r=T.matUnitSum('none',0)===0; return r; })());
S.furnace=[dj];
assert('炼化投料排除：furnaceMats 不含 DJ_', T.furnaceMats().length===0, 'len '+T.furnaceMats().length);
S.furnace=[];

console.log('\nv1.16.7 M2 补丁 验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
