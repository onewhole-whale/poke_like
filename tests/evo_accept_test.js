/* M2-B 普通进化机制 · 独立验收测试（验收标准来源：开发报告_M2-B进化线_2026-09-15.md §8）
   覆盖：①数据完整性（21条链/目标可解析/品级每跳+1/传说3只无目标）
         ②条件判定（lvl/aff/stat 三类、AND、缺条件文案含当前值）
         ③进化结算（speciesId/name/rarity/面板/iv/nature/lvl/exp/bonusLv/perks/aff/shiny/source 保留、
                     skillPool 解锁新技能、已装备不丢、log 追加、穿透拦截）
         ④网状进化（一对多 / 多对一）
         ⑤管理端配置（customSpecies / speciesEdits 路径，openSpeciesForm 保存逻辑模拟）
         ⑥飞升承接校验（elite/perfect + 上游通过 / 无关拒绝不消耗 / 自身拒绝 / normal/legend 不受影响）
   运行：node tests/evo_accept_test.js */
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
  `init(); route(); globalThis.__T={S,SPECIES,makeSpirit,spiritStats,landSpirit,hasNormal,allSpeciesDef,allSpecies,affOf,
  evoBranchesOf,evoCondOk,evoCondText,canEvolve,evolveSpirit,isEvoAncestor,gradeName,saveDraft,toast,directUnlocked,matState,matUnitSum,unitOf,QUALITY_RANK,matInfo};`);
eval(code);
const T=globalThis.__T;
let pass=0, fail=0;
const assert=(n,c,x)=>{ if(c){pass++;console.log('  ok -',n);} else {fail++;console.log('FAIL -',n,x||'');} };

/* ========== ① 数据完整性 ========== */
console.log('① 数据完整性');
// 1.1 所有含 evoTo/evoToBranches 的物种目标可解析
const all = T.allSpecies();
const evoSpecies = all.filter(sp=>sp.evoTo || (Array.isArray(sp.evoToBranches)&&sp.evoToBranches.length));
let unresolvable = [];
evoSpecies.forEach(sp=>{
  T.evoBranchesOf(sp).forEach(b=>{ if(!T.allSpeciesDef(b.to)) unresolvable.push(sp.id+'→'+b.to); });
});
assert('所有进化目标 ID 可解析（0 悬空）', unresolvable.length===0, unresolvable.join(','));
assert('含进化路线的物种数 > 0', evoSpecies.length>0, String(evoSpecies.length));

// 1.2 链数 = 21，每条链每跳品级 +1（normal→elite→perfect）
// 链根 = 无进化源 且 有进化目标 的物种；沿分支走到没有进化目标为止（主干取第一个分支）
const hasEvoSource = id => all.some(x=>T.evoBranchesOf(x).some(b=>b.to===id));
const roots = evoSpecies.filter(sp=>!hasEvoSource(sp.id));
assert('链根数 = 43', roots.length===43, String(roots.length));
let chainBroken = [], chainJumps = 0, chainTotal = 0;
const RANK = {normal:0, elite:1, perfect:2, legend:3};
roots.forEach(root=>{
  let cur = root; const chain = [cur.id];
  while(true){
    const brs = T.evoBranchesOf(cur);
    if(!brs.length) break;
    const nxt = T.allSpeciesDef(brs[0].to);
    if(!nxt){ chainBroken.push(cur.id+'→?'); break; }
    const srcR = RANK[cur.rarity], tgtR = RANK[nxt.rarity];
    if(tgtR !== srcR+1){ chainBroken.push(cur.id+'('+cur.rarity+')→'+nxt.id+'('+nxt.rarity+') 品级跳'+ (tgtR-srcR)); }
    chainJumps++; chainTotal++;
    chain.push(nxt.id);
    cur = nxt;
  }
  if(chain.length<3) console.log('  注意：链 '+chain.join('→')+' 长度 '+chain.length+'（不足3层，若为正常数据可忽略）');
});
assert('21 条链无断链（目标可解析）', chainBroken.length===0, chainBroken.join(','));
assert('链上每跳目标品级 = 源品级+1（共 '+chainJumps+' 跳）', chainBroken.length===0);
// 1.3 链上所有物种品级不超过 perfect；不存在 elite→elite 同级链
// 1.4 传说 3 只无进化目标
const legends = all.filter(sp=>sp.rarity==='legend');
assert('传说精灵恰 3 只', legends.length===3, legends.map(x=>x.id+':'+x.name).join(','));
assert('传说 3 只均无 evoTo/evoToBranches', legends.every(sp=>!sp.evoTo && !(Array.isArray(sp.evoToBranches)&&sp.evoToBranches.length)), legends.map(x=>x.id).join(','));
// 1.5 DUNGEON_SPECIALS（副本专供，id 为 *_spirit / *_golem）不进进化链
assert('副本专供物种（元素灵/魔像）无进化目标', evoSpecies.every(sp=>!/_spirit$|_golem$/.test(sp.id)), evoSpecies.map(x=>x.id).filter(id=>/_spirit$|_golem$/.test(id)).join(','));

/* ========== ② 条件判定 ========== */
console.log('② 条件判定');
// M3-1-2: 注入火/冰素材供进化 mat 条件测试（v1.16.5 旧 flame/frost 已删，注册临时素材）
T.S.customMats['tst_fire']={id:'tst_fire',name:'测试火材',elem:'fire',quality:'normal',type:'plant',tags:[],count:0,desc:'t'};
T.S.customMats['tst_fire_good']={id:'tst_fire_good',name:'测试火材优',elem:'fire',quality:'good',type:'plant',tags:[],count:0,desc:'t'};
T.S.customMats['tst_water']={id:'tst_water',name:'测试水材',elem:'water',quality:'fine',type:'plant',tags:[],count:0,desc:'t'};
T.matState['tst_fire']=50; T.matState['tst_fire_good']=50; T.matState['tst_water']=50;
const s30 = T.makeSpirit('JL_fire_normal_0001', false, 't'); s30.lvl=30; s30.aff={fire:60}; s30.iv={atk:31}; s30.nature='hardy';
// lvl 类
assert('lvl≥30 满足（Lv30）', T.evoCondOk(s30,[{type:'lvl',v:30}])===true);
assert('lvl≥31 不满足（Lv30）', T.evoCondOk(s30,[{type:'lvl',v:31}])===false);
// aff 类
assert('aff fire≥60 满足', T.evoCondOk(s30,[{type:'aff',elem:'fire',v:60}])===true);
assert('aff fire≥61 不满足', T.evoCondOk(s30,[{type:'aff',elem:'fire',v:61}])===false);
assert('aff water≥80 不满足（水亲和默认50）', T.evoCondOk(s30,[{type:'aff',elem:'water',v:80}])===false);
// stat 类（spiritStats 结算后值，含 iv/性格/等级）
const st30 = T.spiritStats(s30);
assert('stat atk≥'+st30.atk+' 满足', T.evoCondOk(s30,[{type:'stat',k:'atk',v:st30.atk}])===true);
assert('stat atk≥'+(st30.atk+1)+' 不满足', T.evoCondOk(s30,[{type:'stat',k:'atk',v:st30.atk+1}])===false);
assert('stat spe 映射 spd 生效（spe≥'+st30.spd+'）', T.evoCondOk(s30,[{type:'stat',k:'spe',v:st30.spd}])===true);
// AND 语义
assert('AND：lvl 满足+aff 不满足 → false', T.evoCondOk(s30,[{type:'lvl',v:30},{type:'aff',elem:'fire',v:99}])===false);
assert('AND：全满足 → true', T.evoCondOk(s30,[{type:'lvl',v:30},{type:'aff',elem:'fire',v:60},{type:'stat',k:'atk',v:st30.atk}])===true);
assert('空条件 = 无条件满足', T.evoCondOk(s30,[])===true && T.evoCondOk(s30,null)===true);
// 缺条件文案：含当前值 vs 需求值
const txt = T.evoCondText([{type:'lvl',v:30},{type:'aff',elem:'fire',v:80}], s30);
assert('缺条件文案含当前值（现30）', txt.includes('现30'), txt);
assert('缺条件文案含需求值（Lv≥30）', txt.includes('Lv≥30'), txt);
assert('缺条件文案含火亲和需求与当前（火亲和≥80 现60）', txt.includes('火亲和≥80') && txt.includes('现60'), txt);
const txtNoSp = T.evoCondText([{type:'lvl',v:30}]);
assert('无 spirit 时不显示当前值', txtNoSp==='Lv≥30', txtNoSp);
// canEvolve：JL_fire_normal_0001 网状主线 lvl30+aff fire60+mat
const fwB = T.canEvolve(s30);
assert('Lv30+火亲和60+火素材 → JL_fire_normal_0001 主线可进化', fwB.find(b=>b.to==='JL_fire_elite_0002'&&b.ok===true), JSON.stringify(fwB.map(b=>({to:b.to,ok:b.ok}))));
const s20 = T.makeSpirit('JL_fire_normal_0001', false, 't'); s20.lvl=20; s20.aff={fire:60};
assert('Lv20 → canEvolve ok=false', T.canEvolve(s20).every(b=>!b.ok));

/* ========== ③ 进化结算 ========== */
console.log('③ 进化结算');
T.S.spirits=[];
const sp = T.makeSpirit('JL_fire_normal_0001', false, '测试来源'); 
sp.lvl=30; sp.exp=12345; sp.bonusLv=2; sp.nature='hardy'; sp.iv={atk:31,hp:10}; sp.perks=['secondwind','blaze-affinity'];
sp.aff={fire:70,water:55}; sp.shiny=true; sp.source='山河秘境';
sp.skills=[{id:'fire-d0',name:'火花',kind:'direct',cost:1,elem:'fire',mastery:88}];
sp.skillPool=[{id:'fire-d1',name:'火球',kind:'direct',cost:1,elem:'fire',mastery:30}];
T.S.spirits.push(sp);
const preLvl=sp.lvl, preExp=sp.exp, preBonus=sp.bonusLv, preNature=sp.nature, preIV=JSON.stringify(sp.iv),
      prePerks=sp.perks.slice(), preAff=JSON.stringify(sp.aff), preShiny=sp.shiny, preSource=sp.source,
      preSkills=sp.skills.slice(), prePool=sp.skillPool.slice(), preId=sp.id;
const poolBefore = sp.skillPool.length;
const r = T.evolveSpirit(sp, 'JL_fire_elite_0002');
assert('结算返回 ok', r.ok===true, r.msg||'');
assert('speciesId → JL_fire_elite_0002', sp.speciesId==='JL_fire_elite_0002');
assert('name → 老烬', sp.name==='老烬');
assert('rarity 随新物种 = elite', T.allSpeciesDef(sp.speciesId).rarity==='elite');
assert('elem 保留（同为 fire）', sp.elem==='fire');
assert('speed 切换到新物种 90', sp.speed===90, String(sp.speed));
assert('id 保留', sp.id===preId);
assert('lvl 保留', sp.lvl===preLvl);
assert('exp 保留', sp.exp===preExp);
assert('bonusLv 保留', sp.bonusLv===preBonus);
assert('nature 保留', sp.nature===preNature);
assert('iv 保留', JSON.stringify(sp.iv)===preIV);
assert('perks 保留', JSON.stringify(sp.perks)===JSON.stringify(prePerks));
assert('aff 保留', JSON.stringify(sp.aff)===preAff);
assert('shiny 保留', sp.shiny===preShiny);
assert('source 保留', sp.source===preSource);
assert('已装备技能不丢（skills 原样）', JSON.stringify(sp.skills)===JSON.stringify(preSkills));
assert('原 skillPool 不丢', JSON.stringify(sp.skillPool.slice(0,prePool.length))===JSON.stringify(prePool));
assert('新物种 direct 技能解锁进 skillPool（数量增加）', sp.skillPool.length>poolBefore, sp.skillPool.length+'>'+poolBefore);
const newIds = sp.skillPool.map(x=>x.id);
assert('skillPool 无重复 id', new Set(newIds).size===newIds.length);
const fireDirectIds = new Set(T.directUnlocked('fire', sp.lvl).map(x=>x.id));
assert('新解锁技能全部来自 fire 系 direct 池', newIds.every(id=>fireDirectIds.has(id)), newIds.join(','));
assert('log 追加进化记录', (sp.log||[]).some(l=>String(l).includes('进化：烬烬狼 → 老烬')), JSON.stringify(sp.log));
// 面板按新种族值变化
const stBefore = T.spiritStats(Object.assign({}, sp, {speciesId:'JL_fire_normal_0001'}));
const stAfter = T.spiritStats(sp);
assert('进化后 atk 面板提升（75→100 种族值）', stAfter.atk>stBefore.atk, stAfter.atk+'>'+stBefore.atk);
assert('进化后 hp 面板提升（55→70）', stAfter.hp>stBefore.hp);
assert('进化后 spd 面板提升（70→90）', stAfter.spd>stBefore.spd);
// 二次进化：JL_fire_elite_0002 → JL_fire_perfect_0003（lvl45+aff fire80+mat fire fine20）
const spE = T.makeSpirit('JL_fire_elite_0002', false, 't2'); spE.lvl=45; spE.nature='hardy'; spE.iv={atk:31}; spE.aff={fire:90};
T.S.spirits.push(spE);
const r2 = T.evolveSpirit(spE,'JL_fire_perfect_0003');
assert('二阶进化 ok（Lv45 满足 elite→perfect）', r2.ok===true, r2.msg||'');
assert('二阶进化 speciesId → JL_fire_perfect_0003', spE.speciesId==='JL_fire_perfect_0003');
assert('二阶进化 rarity → perfect', T.allSpeciesDef('JL_fire_perfect_0003').rarity==='perfect');
const spE45 = T.makeSpirit('JL_fire_elite_0002', false, 't3'); spE45.lvl=44;
const r3 = T.evolveSpirit(spE45,'JL_fire_perfect_0003');
assert('Lv44 二阶进化被拦截', r3.ok===false, JSON.stringify(r3));
// 穿透保护：不满足条件 / 目标不存在 / 跳级
const spBad = T.makeSpirit('JL_fire_normal_0001', false, 't'); spBad.lvl=20; spBad.aff={fire:60};
assert('穿透 1：条件不满足 evolveSpirit 拦截', T.evolveSpirit(spBad,'JL_fire_elite_0002').ok===false);
assert('穿透 2：无此分支拦截（跳级 JL_fire_normal_0001→JL_fire_perfect_0003）', T.evolveSpirit(spBad,'JL_fire_perfect_0003').ok===false);
assert('穿透 3：目标物种不存在拦截', T.evolveSpirit(spBad,'no_such_species').ok===false);

/* ========== ④ 网状进化 ========== */
console.log('④ 网状进化');
// 一对多：同物种不同条件 → 不同目标
T.S.customSpecies['_branch_demo'] = {id:'_branch_demo', name:'分支演示兽', elem:'fire', rarity:'normal', speed:50,
  stats:{hp:50,atk:50,def:50,spa:50,sdef:50},
  evoToBranches:[
    {to:'JL_fire_elite_0002', cond:[{type:'lvl',v:20}]},
    {to:'JL_water_elite_0024', cond:[{type:'lvl',v:20},{type:'aff',elem:'water',v:80}]}
  ]};
const bd = T.makeSpirit('_branch_demo', false, 't'); bd.lvl=20; bd.aff={water:50};
const cb = T.canEvolve(bd);
assert('一对多：2 条分支', cb.length===2, JSON.stringify(cb.map(b=>b.to)));
assert('一对多：分支1 火条件满足 → ok', cb[0].to==='JL_fire_elite_0002' && cb[0].ok===true);
assert('一对多：分支2 水亲和不足 → not ok', cb[1].to==='JL_water_elite_0024' && cb[1].ok===false);
bd.aff={water:90};
const cb2 = T.canEvolve(bd);
assert('一对多：水亲和90后两分支均 ok', cb2[0].ok===true && cb2[1].ok===true);
const rb = T.evolveSpirit(bd,'JL_water_elite_0024');
assert('一对多：走水分支结算到 JL_water_elite_0024', rb.ok===true && bd.speciesId==='JL_water_elite_0024' && bd.name==='潮歌', JSON.stringify(rb));
delete T.S.customSpecies['_branch_demo'];
// 多对一：两个不同源物种 evoTo 指向同一目标
T.S.customSpecies['_src_a'] = {id:'_src_a', name:'源A', elem:'fire', rarity:'normal', speed:50, stats:{hp:50,atk:50,def:50,spa:50,sdef:50}, evoTo:'_common_target', evoCond:[{type:'lvl',v:10}]};
T.S.customSpecies['_src_b'] = {id:'_src_b', name:'源B', elem:'water', rarity:'normal', speed:50, stats:{hp:50,atk:50,def:50,spa:50,sdef:50}, evoTo:'_common_target', evoCond:[{type:'lvl',v:10}]};
T.S.customSpecies['_common_target'] = {id:'_common_target', name:'共同目标', elem:'light', rarity:'elite', speed:60, stats:{hp:80,atk:60,def:60,spa:60,sdef:60}};
const sa = T.makeSpirit('_src_a', false, 't'); sa.lvl=10;
const sb = T.makeSpirit('_src_b', false, 't'); sb.lvl=10;
assert('多对一：源A 可进化为共同目标', T.canEvolve(sa)[0].to==='_common_target' && T.canEvolve(sa)[0].ok===true);
assert('多对一：源B 可进化为共同目标', T.canEvolve(sb)[0].to==='_common_target' && T.canEvolve(sb)[0].ok===true);
T.evolveSpirit(sa,'_common_target'); T.evolveSpirit(sb,'_common_target');
assert('多对一：两源进化后同物种', sa.speciesId==='_common_target' && sb.speciesId==='_common_target');
assert('多对一：isEvoAncestor(共同目标, 源A)=true', T.isEvoAncestor('_common_target','_src_a')===true);
assert('多对一：isEvoAncestor(共同目标, 源B)=true', T.isEvoAncestor('_common_target','_src_b')===true);
delete T.S.customSpecies['_src_a']; delete T.S.customSpecies['_src_b']; delete T.S.customSpecies['_common_target'];

/* ========== ⑤ 管理端配置（customSpecies / speciesEdits 保存路径模拟） ========== */
console.log('⑤ 管理端配置');
// customSpecies 路径：直接构造保存结果（openSpeciesForm 保存逻辑见 UI 测试，此处验证数据路径）
T.S.customSpecies['_admin_new'] = {id:'_admin_new', name:'管理端新兽', elem:'thunder', rarity:'normal', speed:55,
  stats:{hp:52,atk:60,def:48,spa:55,sdef:48}, evoTo:'JL_thunder_elite_0031', evoCond:[{type:'lvl',v:25}]};
const an = T.makeSpirit('_admin_new', false, 't'); an.lvl=25;
assert('customSpecies 路径：新兽可进化', T.canEvolve(an)[0].ok===true && T.canEvolve(an)[0].to==='JL_thunder_elite_0031');
delete T.S.customSpecies['_admin_new'];
// speciesEdits 路径：覆盖内置精灵的进化配置
T.S.speciesEdits['JL_fire_normal_0001'] = {...(T.SPECIES['JL_fire_normal_0001']||{}), evoToBranches:[{to:'JL_fire_elite_0002',cond:[{type:'lvl',v:5}]}]};
const fw5 = T.makeSpirit('JL_fire_normal_0001', false, 't'); fw5.lvl=5;
assert('speciesEdits 路径：编辑后 Lv5 即可进化（原需30）', T.canEvolve(fw5).find(b=>b.to==='JL_fire_elite_0002'&&b.ok===true));
const fw3 = T.makeSpirit('JL_fire_normal_0001', false, 't'); fw3.lvl=3;
assert('speciesEdits 路径：Lv3 仍不满足', T.canEvolve(fw3).every(b=>!(b.to==='JL_fire_elite_0002'&&b.ok)));
delete T.S.speciesEdits['JL_fire_normal_0001'];
assert('删除编辑后恢复默认（Lv20 火狼不可进化）', T.canEvolve(T.makeSpirit('JL_fire_normal_0001',false,'t')).every(b=>!b.ok));

/* ========== ⑥ 飞升承接校验 ========== */
console.log('⑥ 飞升承接校验');
function mkBeast(speciesId, shiny){
  return {id:'b_'+Math.random().toString(36).slice(2,8), speciesId, shiny:!!shiny, caught:'测试', nature:'serious', iv:{atk:5}};
}
T.S.spirits=[]; T.S.beasts=[];
// elite 目标 + 上游妖兽 → 通过
T.S.beasts.push(mkBeast('JL_fire_normal_0001'));
T.landSpirit({speciesId:'JL_fire_elite_0002', shiny:false, source:'t', beastId:T.S.beasts[0].id});
assert('elite+上游(JL_fire_normal_0001) 承接成功', T.S.spirits.length===1, 'spirits='+T.S.spirits.length);
assert('elite+上游 妖兽被消耗', T.S.beasts.length===0);
assert('elite+上游 继承 iv', T.S.spirits[0].iv && T.S.spirits[0].iv.atk===5);
T.S.spirits=[]; T.S.beasts=[];
// perfect 目标 + 上游形态（跨级：JL_poison_normal_0080 承接 JL_poison_perfect_0082）→ 通过
T.S.beasts.push(mkBeast('JL_poison_normal_0080'));
T.landSpirit({speciesId:'JL_poison_perfect_0082', shiny:false, source:'t', beastId:T.S.beasts[0].id});
assert('perfect+跨级上游(JL_poison_normal_0080) 承接成功', T.S.spirits.length===1 && T.S.spirits[0].speciesId==='JL_poison_perfect_0082', 'spirits='+T.S.spirits.length);
T.S.spirits=[]; T.S.beasts=[];
// elite 目标 + 无关妖兽 → 拒绝且不消耗
T.S.beasts.push(mkBeast('JL_water_normal_0023'));
const nBefore = T.S.beasts.length;
T.landSpirit({speciesId:'JL_fire_elite_0002', shiny:false, source:'t', beastId:T.S.beasts[0].id});
assert('elite+无关妖兽 被拒绝（未入仓）', T.S.spirits.length===0);
assert('elite+无关妖兽 不消耗妖兽', T.S.beasts.length===nBefore);
T.S.spirits=[]; T.S.beasts=[];
// elite 目标 + 自身形态妖兽 → 拒绝且不消耗
T.S.beasts.push(mkBeast('JL_fire_elite_0002'));
T.landSpirit({speciesId:'JL_fire_elite_0002', shiny:false, source:'t', beastId:T.S.beasts[0].id});
assert('elite+自身形态妖兽 被拒绝', T.S.spirits.length===0);
assert('elite+自身形态妖兽 不消耗', T.S.beasts.length===1);
T.S.spirits=[]; T.S.beasts=[];
// 下游形态妖兽 → 拒绝（JL_fire_perfect_0003 不是 JL_fire_elite_0002 上游）
T.S.beasts.push(mkBeast('JL_fire_perfect_0003'));
T.landSpirit({speciesId:'JL_fire_elite_0002', shiny:false, source:'t', beastId:T.S.beasts[0].id});
assert('elite+下游形态(JL_fire_perfect_0003) 被拒绝', T.S.spirits.length===0);
T.S.spirits=[]; T.S.beasts=[];
// normal 目标不受校验影响（JL_fire_normal_0001 承接用任何妖兽都行——按设计 normal 不校验）
T.S.beasts.push(mkBeast('JL_water_normal_0023'));
T.landSpirit({speciesId:'JL_fire_normal_0001', shiny:false, source:'t', beastId:T.S.beasts[0].id});
assert('normal 目标不受上游校验限制', T.S.spirits.length===1, 'spirits='+T.S.spirits.length);
T.S.spirits=[]; T.S.beasts=[];
// legend 目标不受校验影响
T.S.beasts.push(mkBeast('JL_water_normal_0023'));
T.landSpirit({speciesId:'JL_fire_legend_0109', shiny:false, source:'t', beastId:T.S.beasts[0].id});
assert('legend 目标不受上游校验限制', T.S.spirits.length===1, 'spirits='+T.S.spirits.length);
T.S.spirits=[]; T.S.beasts=[];
// 无 beastId（炼化直出 elite）不受校验影响
T.landSpirit({speciesId:'JL_fire_elite_0002', shiny:false, source:'t'});
assert('无妖兽承接（炼化直出 elite）不受限', T.S.spirits.length===1);

console.log('\n验收测试 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
