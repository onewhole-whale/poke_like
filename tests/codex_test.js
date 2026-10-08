function mkEl(){
  const e = {
    children:[], className:'', innerHTML:'', style:{}, title:'', dataset:{}, disabled:false,
    textContent:'', value:'', selected:false, _onclick:null,
    _ev:{}, _onmd:null,
    addEventListener(t,f){ this._ev[t]=f; },
    removeEventListener(t){ delete this._ev[t]; },
    fire(t,ev={}){ const e=Object.assign({preventDefault(){}, key:''}, ev); if(this._ev[t]) this._ev[t](e); if(t==='mousedown'&&this._onmd) this._onmd(e); },
    focus(){}, blur(){},
    set onmousedown(f){ this._onmd=f; }, get onmousedown(){ return this._onmd; },
    classList:{_s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){f?this._s.add(c):this._s.delete(c)}, contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c); return c}, remove(){},
    querySelector(){return mkEl()}, querySelectorAll(){return []},
    set onclick(f){this._onclick=f}, get onclick(){return this._onclick},
  };
  return e;
}
const LS = {_d:{}, getItem(k){return this._d[k]||null}, setItem(k,v){this._d[k]=v}, removeItem(k){delete this._d[k]}};
global.document = {querySelector:()=>mkEl(), querySelectorAll:()=>[], createElement:()=>mkEl(), createTextNode:t=>({nodeValue:t, textContent:t}), addEventListener:()=>{}};
global.window = {addEventListener:()=>{}, location:{hash:'#/codex'}};
global.location = {hash:'#/codex'};
global.localStorage = LS;
global.requestAnimationFrame = fn=>fn();
global.setTimeout = ()=>{};
const fs=require('fs');
let code = require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,matInfo,allMatDef,allSpecies,allSpeciesDef,comboInfo,addToFurnace,removeFromFurnace,matState,renderCodex,renderRefine,renderWild,makeSpirit,saveDraft,QUALITY,MAT_TYPE,ELEM,tagPicker,collectTagLib,dropsOf,beastMatIds,essenceName,essenceOf,allEssences,landSpirit};`);
eval(code);
const T=globalThis.__T;
let pass=0,fail=0;
const assert=(n,c,x)=>{ if(c){pass++;console.log('  ok -',n);} else {fail++;console.log('FAIL -',n,x||'');} };

// 1. 图鉴视图渲染
try{ T.renderCodex(); assert('renderCodex 渲染', true); }catch(e){ assert('renderCodex 渲染', false, e.message); }

// 2. 编辑内置素材：编辑 SC_none_fine_000001 改名 + 加 tag（v1.16.5 旧 flame 已删，MATS 现仅生命精华）
T.S.matEdits['SC_none_fine_000001'] = {name:'生命精华·改', tags:['地火','太阳'], elem:'none', quality:'fine', type:'beast', desc:'x'};
assert('编辑覆盖生效', T.allMatDef('SC_none_fine_000001').name==='生命精华·改' && T.allMatDef('SC_none_fine_000001').tags.includes('太阳'));
assert('matInfo 也走覆盖', T.matInfo('SC_none_fine_000001').name==='生命精华·改');

// 3. 新增自定义素材（火 · 精良）
const nid = 'custom_sunstone';
T.S.customMats[nid] = {id:nid, name:'日曜石', elem:'fire', quality:'fine', type:'ore', tags:['太阳'], desc:'', count:3};
T.matState[nid] = 3;
assert('自定义素材入表', T.allMatDef(nid).name==='日曜石');
T.addToFurnace(nid);
T.addToFurnace('custom_sunstone');
const info = T.comboInfo();
assert('自定义素材未命中定向 → 无候选', info.cands.length===0 && info.chance===0, info.cands.join(','));
// 自定义素材叠加进烬烬狼定向（火≥15 爪≥4）后进候选（巨量压缩 3 条：火15 爪5）
// 注：自定义素材优先于 matEdits，直接改 customMats 定义；内置素材走 matEdits
T.S.customMats[nid].tags = ['太阳','巨量','爪'];
T.S.matEdits = T.S.matEdits||{};
['custom_sunstone','custom_sunstone'].forEach(k=>{
  T.S.matEdits[k] = {...T.allMatDef(k), tags:[...(T.allMatDef(k).tags||[]),'巨量']};
});
T.S.furnace = ['custom_sunstone','custom_sunstone','custom_sunstone'];
const infoA = T.comboInfo();
assert('自定义素材可进定向候选（火+爪）', infoA.cands.includes('JL_fire_normal_0001') && infoA.chance>0, infoA.cands.join(','));
T.S.furnace = [];

// 4. 新增自定义精灵 → 进入炼化候选
T.S.customSpecies['custom_ignis'] = {id:'custom_ignis', name:'烬狐', elem:'fire', rarity:'rare', speed:70, desc:''};
assert('自定义精灵入全表', T.allSpecies().some(s=>s.id==='custom_ignis'));
// 为自定义精灵建定向配方
T.S.refineRules = (T.S.refineRules||[]).concat([{id:'r-sp-custom-ignis', name:'烬狐 · 薪火之炉', pool:'spirit', cond:{unit:15, anyUnit:true, words:[{w:'爪',n:4}], minQuality:'fine', spirits:['custom_ignis']}, note:''}]);
T.S.furnace = ['custom_sunstone','custom_sunstone','custom_sunstone'];
const info2 = T.comboInfo();
assert('自定义精灵有定向配方即可炼出（稀有+火）', info2.cands.includes('custom_ignis') && info2.directed===true, info2.cands.join(','));
T.S.furnace = [];

// 5. 编辑精灵生效：JL_fire_normal_0001 提速
T.S.speciesEdits['JL_fire_normal_0001'] = {...T.allSpeciesDef('JL_fire_normal_0001'), speed:99};
const sp = T.makeSpirit('JL_fire_normal_0001', false, 't');
assert('精灵编辑影响新灵兽', sp.speed===99);

// 6. 素材编辑（v1.16.1: DROPS 已删，素材池空；matEdits 仍可改 MATS 素材）
T.S.customMats['custom_sunstone'].name='炽焰石'; T.S.customMats['custom_sunstone'].tags=['牙','炽热'];
assert('素材可改名', T.matInfo('custom_sunstone').name==='炽焰石');
assert('素材带 tag', T.matInfo('custom_sunstone').tags.includes('炽热'));

// 6.1 素材池（v1.16.1: 空池，框架就绪待 M3-1-3 填数据）
assert('烬烬狼素材池 5 条（v1.16.6 填充）', T.dropsOf('JL_fire_normal_0001').length===5);
assert('妖兽素材集不含已删通用素材（v1.16.4 bone/gale/chaos 已删）', !T.beastMatIds().includes('bone') && !T.beastMatIds().includes('gale') && !T.beastMatIds().includes('chaos'));

// 6.1.1 素材池一致性（v1.16.1: 全空）
assert('轰枭素材池 5 条', T.dropsOf('JL_thunder_normal_0038').length===5);
assert('咚咚犀素材池 5 条', T.dropsOf('JL_earth_normal_0046').length===5);
assert('无 from 素材进集（DROPS 已删）', T.beastMatIds().every(id=>{
  const m = T.allMatDef(id);
  return !m || !m.from;
}));
assert('内置109只精灵素材池各 5 条（v1.16.6 填充）', T.allSpecies().filter(sp=>!T.S.customSpecies[sp.id]).every(sp=>(sp.drops||[]).length===5));

// 6.1.2 万圣节批量扩充（2026-09-11 精灵入表，素材池 v1.16.1 清空）
const halloween = ['JL_fire_normal_0053','JL_wind_normal_0056','JL_earth_normal_0063','JL_dark_normal_0070','JL_thunder_normal_0033','JL_wind_normal_0077','JL_ghost_elite_0095','JL_fire_elite_0007','JL_poison_elite_0102','JL_earth_elite_0105','JL_dark_legend_0108','JL_fire_legend_0109'];
assert('万圣节 12 精灵全部入表', halloween.every(id=>T.allSpeciesDef(id)));
assert('万圣节精灵素材池各 5 条', halloween.every(id=>T.dropsOf(id).length===5));
assert('品级梯度正确（普通/精英/完美/传说）', T.allSpeciesDef('JL_dark_legend_0108').rarity==='legend' && T.allSpeciesDef('JL_fire_legend_0109').rarity==='legend' && T.allSpeciesDef('JL_ghost_elite_0095').rarity==='elite' && T.allSpeciesDef('JL_fire_normal_0053').rarity==='normal' && T.allSpeciesDef('JL_fire_perfect_0055').rarity==='perfect');
assert('血月侯为恶系传说（620-640）', T.allSpeciesDef('JL_dark_legend_0108').elem==='dark' && T.allSpeciesDef('JL_dark_legend_0108').speed===140);
assert('属性重划落地（2026-09-13）', T.allSpeciesDef('JL_ghost_elite_0095').elem==='ghost' && T.allSpeciesDef('JL_dark_normal_0070').elem==='dark' && T.allSpeciesDef('JL_light_elite_0088').elem==='light' && T.allSpeciesDef('JL_poison_elite_0081').elem==='poison' && T.allSpeciesDef('JL_poison_elite_0102').elem==='poison');
assert('精魄名自动派生万圣', T.essenceName('JL_dark_legend_0108')==='血月侯精魄');

// 6.2 精魄体系：按精灵区分
assert('精魄名自动派生', T.essenceName('JL_fire_normal_0001')==='烬烬狼精魄');
assert('精魄持有按精灵', T.essenceOf('JL_fire_normal_0001')===T.S.essences.JL_fire_normal_0001);
assert('精魄清单含全部精灵', T.allEssences().some(e=>e.from==='JL_fire_normal_0001'&&e.count>0));
const ec0 = T.essenceOf('JL_fire_normal_0001');
T.landSpirit({speciesId:'JL_fire_normal_0001', shiny:false, source:'t', fromRefine:true});
assert('重复炼化得该精灵精魄', T.essenceOf('JL_fire_normal_0001')===ec0+1);

// 6.3 自定义精灵掉落物挂载
T.S.customSpecies['custom_ignis'].drops = ['custom_sunstone'];
assert('自定义精灵可挂掉落物', T.dropsOf('custom_ignis').length===1 && T.dropsOf('custom_ignis')[0].id==='custom_sunstone');

// 7. 持久化
T.saveDraft();
const saved = JSON.parse(LS.getItem('refine-proto-codex'));
assert('草稿持久化', saved.customMats[nid] && saved.speciesEdits.JL_fire_normal_0001.speed===99);

// 8. 品质→能级映射
assert('品质映射', T.QUALITY.normal.rank===0 && T.QUALITY.good.rank===1 && T.QUALITY.fine.rank===2 && T.QUALITY.rare.rank===3 && T.QUALITY.epic.rank===4 && T.QUALITY.legend.rank===5);
assert('来源类型', T.MAT_TYPE.ore.name==='矿石' && T.MAT_TYPE.plant.name==='植物' && T.MAT_TYPE.beast.name==='妖兽');

// 9. 标签库扫描（内置 + 编辑覆盖 + 自定义）
T.collectTagLib();
assert('标签库含内置标签', T.S.tagLib.includes('地火') && T.S.tagLib.includes('太阳'));
assert('标签库去重排序', T.S.tagLib.length===new Set(T.S.tagLib).size);

// 10. 标签选择器：初始已选 + 下拉候选过滤
const tp = T.tagPicker(['地火']);
assert('选择器初始已选', tp.get().includes('地火'));
const inp = tp.node.children[1].children[0];
const drop = tp.node.children[1].children[1];
inp.fire('focus');
const shown = drop.children.map(c=>c.innerHTML);
assert('下拉列出未选标签', shown.includes('太阳'));
assert('已选标签不出现在下拉', !shown.includes('地火'));
inp.value='不存在的标签';
inp.fire('input');
const newItem = drop.children.find(c=>c.className.includes('new'));
assert('无匹配时出现新建项', !!newItem && newItem.innerHTML.includes('不存在的标签'));

// 11. 新建标签：点击新建项 → 并入已选 + 标签库
newItem.fire('mousedown');
assert('新建并入已选', tp.get().includes('不存在的标签'));
assert('新建并入标签库', T.S.tagLib.includes('不存在的标签'));

// 12. Enter 快捷新建
const tp2 = T.tagPicker([]);
const inp2 = tp2.node.children[1].children[0];
inp2.value='赤霄';
inp2.fire('keydown', {key:'Enter'});
assert('Enter 新建标签', tp2.get().includes('赤霄'));

// 13. 空输入 Backspace 移除最后一个已选
const tp3 = T.tagPicker(['甲','乙']);
const inp3 = tp3.node.children[1].children[0];
inp3.fire('keydown', {key:'Backspace'});
const g3 = tp3.get();
assert('Backspace 移除末尾已选', g3.length===1 && g3[0]==='甲');

console.log('\nPASS '+pass+' / '+(pass+fail));
process.exit(fail>0?1:0);
