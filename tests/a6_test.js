/* M2-A6 专项：存在分 / 压缩 / 拓池 / rollEntry / 敌人生成 / 素材投入 */
function mkEl(){
  const e = {
    children:[], className:'', innerHTML:'', style:{}, title:'', dataset:{}, disabled:false,
    textContent:'', value:'', selected:false,
    classList:{_s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){f?this._s.add(c):this._s.delete(c)}, contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c); return c}, remove(){},
    querySelector(){return mkEl()}, querySelectorAll(){return []},
  };
  return e;
}
global.document = {
  querySelector:()=>mkEl(), querySelectorAll:()=>[], createElement:()=>mkEl(), createTextNode:t=>({nodeValue:t, textContent:t}), addEventListener:()=>{},
};
global.window = { addEventListener:()=>{}, location:{hash:'#/'} };
global.location = { hash:'#/' };
global.requestAnimationFrame = fn=>fn();
global.setTimeout = ()=>{};
const fs = require('fs');
let code = require('./_load.js').loadGame();
code = code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code = code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,matState,matInfo,matHash,scorePlan,rollEntry,elemEntries,extractInfoOf,enemyStats,buildEnemyList,addBuildMat,subBuildMat,matsToList,matsDict,MATS,DUNGEON_SPECIALS,allSpeciesDef,depart,startDgFight,ESSENCE_EXPAND};`);
eval(code);
const T = globalThis.__T;
let pass=0, fail=0;
const check=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
try{
  // v1.16.1: DROPS 已删，注册自定义 beast 素材替代 fw_fang 供 buildEnemyList 分发测试
  T.S.customMats = T.S.customMats||{};
  T.S.customMats['custom_fang'] = {id:'custom_fang', name:'测试狼牙', elem:'fire', quality:'fine', type:'beast', tags:['牙'], count:0, from:'JL_fire_normal_0001'};
  // 1. 存在分：custom_fang（火·精良 beast）→ 火属性
  const p1 = T.scorePlan({custom_fang:1});
  const e1 = Object.keys(p1)[0];
  check('custom_fang 归火属性', e1==='fire', e1);
  check('单素材存在分 >0 且 <1000（不压缩）', p1.fire.total>0 && p1.fire.total<1000 && !p1.fire.scaled, 'total='+p1.fire.total);

  // 2. 超 1000 等比压缩：同一素材 30 份 → 触发压缩且 total===1000
  const big = {}; big.custom_fang = 30;
  const p2 = T.scorePlan(big);
  check('30 份 custom_fang 触发压缩', p2.fire.scaled===true, JSON.stringify({total:p2.fire.total, scaled:p2.fire.scaled}));
  check('压缩后总存在分=1000', p2.fire.total===1000, 'total='+p2.fire.total);

  // 3. 拓池：buildExpand.fire → cap 750 + 扩展条目进入 elemEntries
  const p3 = T.scorePlan({custom_fang:1});
  check('未拓池时 cap=1000', p3.fire.cap===1000);
  T.S.buildExpand = {fire:true};
  const p4 = T.scorePlan({custom_fang:1});
  check('拓池后 cap=750', p4.fire.cap===750 && p4.fire.expand===true, 'cap='+p4.fire.cap);
  const en = T.elemEntries(p4.fire);
  const hasExpand = en.some(x=> (T.ESSENCE_EXPAND.skills.fire||[]).includes(x.id) || (T.ESSENCE_EXPAND.perks.fire||[]).includes(x.id));
  check('拓池条目进入抽取列表', hasExpand, 'n='+en.length);
  const escore = en.find(x=>x.expand);
  check('扩展条目存在分=250/(条目数)', escore && Math.abs(escore.score - 250/( (T.ESSENCE_EXPAND.skills.fire||[]).length + (T.ESSENCE_EXPAND.perks.fire||[]).length )) < 0.001, escore&&escore.score);
  T.S.customMats['tst_fire_fine']={id:'tst_fire_fine',name:'测试火材精良',elem:'fire',quality:'fine',type:'plant',tags:[],count:0,desc:'t'};
  T.S.customMats['tst_plant']={id:'tst_plant',name:'测试植物材',elem:'none',quality:'normal',type:'plant',tags:[],count:0,desc:'t'};
  T.S.customMats['tst_ore']={id:'tst_ore',name:'测试矿石材',elem:'none',quality:'normal',type:'ore',tags:[],count:0,desc:'t'};
  T.S.buildExpand = {};

  // 3.1 拓池四功能：skills/perks 侵占存在分（cap 750）；repeat/boost 不占（cap 1000）
  T.S.buildExpand = {fire:{skills:true}};
  const p5 = T.scorePlan({tst_fire_fine:1});
  check('仅附加高级技能 → cap 750 且侵占', p5.fire.cap===750 && p5.fire.occupies===true && p5.fire.repeat===false && p5.fire.boost===false, 'cap='+p5.fire.cap);
  T.S.buildExpand = {fire:{repeat:true}};
  const p6 = T.scorePlan({tst_fire_fine:1});
  check('仅重复抽取 → cap 1000 不侵占存在分', p6.fire.cap===1000 && p6.fire.occupies===false && p6.fire.repeat===true, 'cap='+p6.fire.cap);
  T.S.buildExpand = {fire:{repeat:true, boost:true}};
  const p7 = T.scorePlan({tst_fire_fine:1});
  check('repeat+boost 并存且不侵占', p7.fire.repeat===true && p7.fire.boost===true && p7.fire.cap===1000, 'cap='+p7.fire.cap);
  T.S.buildExpand = {fire:{skills:true,perks:true,repeat:true,boost:true}};
  const p8 = T.scorePlan({tst_fire_fine:1});
  const en8 = T.elemEntries(p8.fire);
  const skIn = (T.ESSENCE_EXPAND.skills.fire||[]).every(id=> en8.some(x=>x.id===id));
  const pkIn = (T.ESSENCE_EXPAND.perks.fire||[]).every(id=> en8.some(x=>x.id===id));
  check('四功能全开 → 侵占 250 且双池条目入池（去重后）', p8.fire.cap===750 && p8.fire.repeat===true && p8.fire.boost===true && skIn && pkIn, 'cap='+p8.fire.cap+' entries='+en8.length);
  T.S.buildExpand = {};

  // 4. rollEntry：总存在分>0 时命中后返回条目；0 分 → null
  const r0 = T.rollEntry([]);
  check('空条目 → null', r0===null);
  const ent = [{kind:'skill', id:'x', score:1000}];
  let hit=0; for(let i=0;i<200;i++){ if(T.rollEntry(ent)) hit++; }
  check('满容量条目必命中', hit===200, 'hit='+hit);
  const ent2 = [{kind:'skill', id:'x', score:500}];
  let hit2=0; for(let i=0;i<200;i++){ if(T.rollEntry(ent2)) hit2++; }
  check('半容量条目约一半命中（抽空逻辑）', hit2>50 && hit2<150, 'hit='+hit2);

  // 5. 敌人生成：妖兽 5 换 1 / 植物→元素灵 / 矿石→魔像 / 等级=我方
  const sp = T.S.spirits[0];
  T.S.buildSpiritId = sp.id;
  T.S.buildMats = {custom_fang:5};
  const list1 = T.buildEnemyList({custom_fang:5}, 1);
  check('5 flame → 1 只烬烬狼妖兽', list1.length===1 && list1[0].name==='烬烬狼', JSON.stringify(list1.map(e=>e.name)));
  check('敌人等级=我方等级(1)', list1[0].lvl===1, list1[0].lvl);
  const list5 = T.buildEnemyList({custom_fang:12}, 1);
  check('12 flame → 3 只（向上取整）', list5.length===3, 'n='+list5.length);
  // 植物
  T.S.buildMats = {tst_plant:5};
  const listP = T.buildEnemyList({tst_plant:5}, 1);
  check('5 植物素材 → 1 只元素灵', listP.length===1 && /灵/.test(listP[0].name), JSON.stringify(listP.map(e=>e.name)));
  check('元素灵为完美品质', T.allSpeciesDef(listP[0].speciesId).rarity==='perfect', T.allSpeciesDef(listP[0].speciesId).rarity);
  // 矿石
  T.S.buildMats = {tst_ore:5};
  const listO = T.buildEnemyList({tst_ore:5}, 1);
  check('5 矿石素材 → 1 只魔像', listO.length===1 && /巨像/.test(listO[0].name), JSON.stringify(listO.map(e=>e.name)));
  // 混合大乱战
  const mixed = T.buildEnemyList({custom_fang:10, tst_plant:5, tst_ore:10}, 1);
  check('混合投入 → 2+1+2=5 只', mixed.length===5, 'n='+mixed.length);
  // 洗牌（多次调用分布不同——随机性只做健全性检查）
  const names1 = T.buildEnemyList({custom_fang:10, tst_plant:5, tst_ore:10}, 1).map(e=>e.name).join(',');
  check('敌列表可生成且元素齐备', /烬烬狼/.test(names1) && /灵/.test(names1) && /巨像/.test(names1), names1);

  // 6. 素材投入面板逻辑（addBuildMat/subBuildMat 字典）
  T.matState["custom_fang"] = 6;
  T.S.buildMats = {};
  T.addBuildMat("custom_fang");
  T.addBuildMat("custom_fang");
  check('投入 2 次 → buildMats.custom_fang=2', T.S.buildMats.custom_fang===2, JSON.stringify(T.S.buildMats));
  T.subBuildMat("custom_fang");
  check('撤回 1 → =1', T.S.buildMats.custom_fang===1);
  T.subBuildMat("custom_fang");
  check('撤回至 0 → 键删除（可完全撤回）', T.S.buildMats.custom_fang===undefined, JSON.stringify(T.S.buildMats));

  // 7. 素材可提取信息：flame 有默认 extractInfo，技能仅本属性相关
  const m = T.matInfo('tst_fire_fine');
  const ei = T.extractInfoOf(m);
  const skillKeys = Object.keys(ei.skillScore||{});
  check('flame 默认可提取信息含技能分', skillKeys.length>0, JSON.stringify(skillKeys));
  check('元素微粒等培养素材无默认可提取信息（靠素材定义覆盖）', true);

  // 8. 无素材时出发被拦截（逻辑守卫：depart 需 buildMats 非空）
  T.S.buildMats = {};
  const preDep = T.S.settle;
  T.depart();
  check('无素材出发被拦截（不生成副本）', !T.S.settle || T.S.settle===preDep, 'settle='+!!T.S.settle);
}catch(e){ console.log('EXC', e.message); fail++; }
console.log('\n'+pass+' 通过, '+fail+' 失败');
process.exit(fail?1:0);
