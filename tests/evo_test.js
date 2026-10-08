/* M2-B 普通进化机制专项测试：条件判定 / 分支归一化 / 进化结算 / 网状 / 飞升校验 */
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
global.window={addEventListener:()=>{}, location:{hash:'#/stable'}};
global.location={hash:'#/stable'};
global.localStorage=LS;
global.requestAnimationFrame=fn=>fn();
global.setTimeout=()=>{};
const fs=require('fs');
let code = require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,makeSpirit,spiritStats,landSpirit,hasNormal,allSpeciesDef,allSpecies,affOf,
  evoBranchesOf,evoCondOk,evoCondText,canEvolve,evolveSpirit,isEvoAncestor,gradeName,speciesBase,saveDraft,toast,
  openDetail,closeOverlay,renderStable,renderRefine,closeOverlay,matState,matUnitSum,QUALITY_RANK,unitOf,matInfo};`);
eval(code);
const T=globalThis.__T;
let pass=0, fail=0;
const assert=(n,c,x)=>{ if(c){pass++;console.log('  ok -',n);} else {fail++;console.log('FAIL -',n,x||'');} };
const evl = expr => { try{ return eval(expr); }catch(e){ console.log('EVAL ERR:', e.message); return null; } };

async function main(){
  // 1. evoBranchesOf：JL_fire_normal_0001 配了 evoToBranches 网状（主线火+异变冰）
  const fw = T.allSpeciesDef('JL_fire_normal_0001');
  const br = T.evoBranchesOf(fw);
  assert('JL_fire_normal_0001 归一化为 2 分支（网状）', br.length===2, JSON.stringify(br));
  assert('JL_fire_normal_0001 主线分支目标 = JL_fire_elite_0002', br[0].to==='JL_fire_elite_0002');
  assert('JL_fire_normal_0001 含 lvl/aff/mat 条件', br[0].cond.some(c=>c.type==='lvl') && br[0].cond.some(c=>c.type==='aff') && br[0].cond.some(c=>c.type==='mat'), JSON.stringify(br[0].cond));

  // 2. JL_fire_elite_0002 网状分支 → JL_fire_perfect_0003 + JL_fire_perfect_0008
  const fwe = T.allSpeciesDef('JL_fire_elite_0002');
  const brE = T.evoBranchesOf(fwe);
  assert('JL_fire_elite_0002 网状分支 → JL_fire_perfect_0003/JL_fire_perfect_0008', brE.length===2 && brE[0].to==='JL_fire_perfect_0003');
  assert('elite→perfect 条件含 lvl45+aff80+mat', brE[0].cond.some(c=>c.type==='lvl'&&c.v===45) && brE[0].cond.some(c=>c.type==='aff'&&c.elem==='fire'&&c.v===80) && brE[0].cond.some(c=>c.type==='mat'), JSON.stringify(brE[0].cond));

  // 3. 无 evoTo 的物种（传说/副本专供）= 空分支
  assert('传说混沌兽无进化分支', T.evoBranchesOf(T.allSpeciesDef('hundun')||{}).length===0 || T.evoBranchesOf(T.allSpeciesDef('hundun')||{})===[]);
  const anyLegend = T.allSpecies().find(x=>x.rarity==='legend');
  assert('传说物种无进化分支', anyLegend ? T.evoBranchesOf(anyLegend).length===0 : true, anyLegend&&anyLegend.id);

  // 4. evoCondOk：lvl / aff / stat 三种
  const s = T.makeSpirit('JL_fire_normal_0001', false, 't');
  s.lvl = 20;
  assert('20 级火狼 lvl≥30 不满足', T.evoCondOk(s, [{type:'lvl',v:30}])===false);
  s.lvl = 30;
  assert('30 级火狼 lvl≥30 满足', T.evoCondOk(s, [{type:'lvl',v:30}])===true);
  // aff：火亲和默认 50（makeSpirit 后 aff={}，affOf 返回 50），要求 ≥40 → 满足；要求 ≥60 → 不满足
  assert('aff fire≥40 满足（默认50）', T.evoCondOk(s, [{type:'aff',elem:'fire',v:40}])===true);
  assert('aff fire≥60 不满足（默认50）', T.evoCondOk(s, [{type:'aff',elem:'fire',v:60}])===false);
  // stat：atk 阈值
  const st = T.spiritStats(s);
  assert('stat atk≥'+Math.floor(st.atk)+' 满足', T.evoCondOk(s, [{type:'stat',k:'atk',v:Math.floor(st.atk)}])===true);
  assert('stat atk≥'+(st.atk+100)+' 不满足', T.evoCondOk(s, [{type:'stat',k:'atk',v:st.atk+100}])===false);
  // AND 语义：lvl30 满足 + aff60 不满足 → 整体 false
  assert('AND 语义：任一不满足即 false', T.evoCondOk(s, [{type:'lvl',v:30},{type:'aff',elem:'fire',v:60}])===false);

  // 5. canEvolve + evolveSpirit 全链路
  T.S.spirits = [];
  const sp = T.makeSpirit('JL_fire_normal_0001', false, '测试');
  sp.lvl = 30; sp.iv = {atk:31, hp:10}; sp.nature='hardy'; sp.perks=[]; sp.aff={fire:60};
  // M3-1-2: 注入火素材满足 mat 条件（v1.16.5 旧 flame 已删，注册临时 fire 素材）
  T.S.customMats['tst_fire']={id:'tst_fire',name:'测试火材',elem:'fire',quality:'normal',type:'plant',tags:[],count:0,desc:'t'};
  T.matState['tst_fire'] = 20;
  T.S.spirits.push(sp);
  const branches = T.canEvolve(sp);
  assert('30级火狼+火亲和60+火素材 → 主线分支可用', branches.find(b=>b.to==='JL_fire_elite_0002' && b.ok===true), JSON.stringify(branches.map(b=>({to:b.to,ok:b.ok}))));
  const oldId = sp.id, oldLvl = sp.lvl, oldNature = sp.nature, oldIV = {...sp.iv}, oldSkillsLen = sp.skills.length;
  const r = T.evolveSpirit(sp, 'JL_fire_elite_0002');
  assert('evolveSpirit 返回 ok', r.ok===true, r.msg||'');
  assert('进化后 speciesId = JL_fire_elite_0002', sp.speciesId==='JL_fire_elite_0002');
  assert('进化后 name = 老烬', sp.name==='老烬');
  assert('进化后 rarity 切换（新物种 elite）', T.allSpeciesDef(sp.speciesId).rarity==='elite');
  assert('进化后 id 保留', sp.id===oldId);
  assert('进化后 lvl 保留', sp.lvl===oldLvl);
  assert('进化后 nature 保留', sp.nature===oldNature);
  assert('进化后 iv 保留', sp.iv.atk===oldIV.atk && sp.iv.hp===oldIV.hp);
  assert('进化后已装备技能不丢', sp.skills.length===oldSkillsLen);
  assert('进化后 log 追加', sp.log.some(l=>String(l).includes('进化')), JSON.stringify(sp.log));
  // 面板按新种族值变化
  const newSt = T.spiritStats(sp);
  assert('进化后面板攻击提升（新种族值更高）', newSt.atk > T.spiritStats(Object.assign({},sp,{speciesId:'JL_fire_normal_0001'})).atk, newSt.atk);

  // 6. 穿透保护：条件不满足时 evolveSpirit 被拦截
  const sp2 = T.makeSpirit('JL_fire_normal_0001', false, 't2');
  sp2.lvl = 20; sp2.aff={fire:60};
  const r2 = T.evolveSpirit(sp2, 'JL_fire_elite_0002');
  assert('20级火狼穿透调用 evolveSpirit 被拦截', r2.ok===false, JSON.stringify(r2));

  // 7. 网状一对多：构造 evoToBranches 演示
  evl(`(()=>{ T.S.customSpecies['_branch_test'] = {id:'_branch_test', name:'分支测试', elem:'fire', rarity:'normal', speed:50,
    stats:{hp:50,atk:50,def:50,spa:50,sdef:50},
    evoToBranches:[
      {to:'JL_fire_elite_0002', cond:[{type:'lvl',v:20}]},
      {to:'JL_water_elite_0024', cond:[{type:'lvl',v:20},{type:'aff',elem:'water',v:80}]}
    ]}; return true; })()`);
  const bs = T.evoBranchesOf(T.allSpeciesDef('_branch_test'));
  assert('网状一对多：分支测试有 2 条分支', bs.length===2, JSON.stringify(bs.map(b=>b.to)));
  const spB = T.makeSpirit('_branch_test', false, 't');
  spB.lvl = 20; spB.aff={water:50};
  const cb = T.canEvolve(spB);
  assert('一对多：火分支条件满足 → ok', cb[0].ok===true);
  assert('一对多：水分支水亲和不足 → not ok', cb[1].ok===false);
  // 提高水亲和后第二分支也满足
  spB.aff={water:90};
  const cb2 = T.canEvolve(spB);
  assert('一对多：水亲和 90 后两分支都 ok', cb2[0].ok===true && cb2[1].ok===true, JSON.stringify(cb2.map(b=>b.ok)));
  delete T.S.customSpecies['_branch_test'];

  // 8. isEvoAncestor：JL_fire_normal_0001 是 JL_fire_elite_0002 的上游 → true；无关物种 → false
  assert('isEvoAncestor(JL_fire_elite_0002, JL_fire_normal_0001) = true', T.isEvoAncestor('JL_fire_elite_0002','JL_fire_normal_0001')===true);
  assert('isEvoAncestor(JL_fire_elite_0002, JL_fire_perfect_0003) = false（目标自身或更下游不算上游）', T.isEvoAncestor('JL_fire_elite_0002','JL_fire_perfect_0003')===false);
  assert('isEvoAncestor(JL_fire_elite_0002, JL_water_normal_0023) = false（无关物种）', T.isEvoAncestor('JL_fire_elite_0002','JL_water_normal_0023')===false);
  assert('isEvoAncestor(JL_fire_elite_0002, JL_fire_elite_0002) = false（自身不算上游）', T.isEvoAncestor('JL_fire_elite_0002','JL_fire_elite_0002')===false);

  // 9. 飞升承接上游校验：用无关妖兽承接 elite → 拒绝
  T.S.spirits = []; T.S.beasts = [];
  T.S.beasts.push({id:'b_bad', speciesId:'JL_water_normal_0023', shiny:false, caught:'测试', nature:'serious', iv:{}});
  T.landSpirit({speciesId:'JL_fire_elite_0002', shiny:false, source:'t', beastId:'b_bad'});
  assert('无关妖兽承接 elite 被拒绝（灵兽未入仓）', T.S.spirits.length===0, 'spirits='+T.S.spirits.length);
  assert('无关妖兽未被消耗', T.S.beasts.length===1, 'beasts='+T.S.beasts.length);
  // 用上游妖兽（JL_fire_normal_0001）承接 elite → 成功
  T.S.beasts = [];
  T.S.beasts.push({id:'b_ok', speciesId:'JL_fire_normal_0001', shiny:false, caught:'测试', nature:'serious', iv:{atk:5}});
  T.landSpirit({speciesId:'JL_fire_elite_0002', shiny:false, source:'t', beastId:'b_ok'});
  assert('上游妖兽承接 elite 成功', T.S.spirits.length===1, 'spirits='+T.S.spirits.length);
  assert('上游承接后妖兽被消耗', T.S.beasts.length===0);
  assert('上游承接继承妖兽 iv', T.S.spirits[0].iv && T.S.spirits[0].iv.atk===5, JSON.stringify(T.S.spirits[0].iv));

  // 10. 多对一：两个不同源物种指向同一目标（用蛇族链验证反向回溯）
  // JL_poison_normal_0080 → JL_poison_elite_0081 → JL_poison_perfect_0082；验证 isEvoAncestor(JL_poison_elite_0081, JL_poison_normal_0080) = true
  assert('多对一/链回溯：JL_poison_normal_0080 是 JL_poison_elite_0081 的上游', T.isEvoAncestor('JL_poison_elite_0081','JL_poison_normal_0080')===true);
  assert('链回溯：JL_poison_normal_0080 是 JL_poison_perfect_0082 的上游（跨级）', T.isEvoAncestor('JL_poison_perfect_0082','JL_poison_normal_0080')===true);

  console.log('\n'+pass+' 项断言，失败 '+fail);
  process.exit(fail?1:0);
}
main().catch(e=>{ console.log('FATAL', e.stack||e.message); process.exit(1); });
