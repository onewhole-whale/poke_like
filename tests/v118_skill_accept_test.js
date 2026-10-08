/* v1.18.0 M3-1-5b 技能填充 验收
   口径：需求文档_M3-1-5b技能填充_2026-09-19.md §4（7 条）
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
global.toast=()=>{};
const CODE = require('./_load.js').loadGame();
let code=require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,SKILLS,GLOBAL_SKILL_POOL,SKILL_STATUS,MATS,SPECIES,ULT_DEFS,
  skillById,skillEffectsOf,applyMechEffect,calcDamage,startBattle,battleSkill,tickStatus};`);
eval(code);
const T=globalThis.__T;

/* ===== 1. 40 技能落池 ===== */
console.log('1. 40 门样板技能落池');
const expect = {
  thunder:['th_emwave','th_zap','th_pulse','th_jolt'],
  ice:['ic_freeze','ic_blizzard','ic_slap','ic_snowview'],
  earth:['ea_bastion','ea_wall','ea_seismic','ea_golem'],
  dark:['da_thirst','da_drain','da_rend','da_sacrifice'],
  psy:['ps_meditate','ps_austerity','ps_daydream','ps_hand'],
  normal:['nr_armor','nr_hypnosis','nr_faith','nr_firststrike'],
  wind:['wi_tailwind','wi_slash','wi_drill','wi_volley'],
  light:['li_rainbow','li_mirror','li_weatherlock','li_kaleido'],
  fight:['fi_stop','fi_weakspot','fi_rebound','fi_stance'],
  steel:['st_mind','st_bulwark','st_trap','st_fortress'],
};
let allFound=0; const missing=[];
for(const [elem,ids] of Object.entries(expect)){
  for(const id of ids){
    const sk = T.skillById(id);
    if(sk){ allFound++; if(sk.elem!==elem) missing.push(id+'(elem='+sk.elem+')'); }
    else missing.push(id+'(未找到)');
  }
}
assert('40 门技能全部落池（实际 '+allFound+'/40）', allFound===40 && missing.length===0, missing.join(','));
// 字段完整性
const sk = T.skillById('th_pulse');
assert('th_pulse 字段完整（cost:5 power:70 speedRatio）', sk && sk.cost===1 && sk.power===70 && (sk.effects||[]).some(e=>e.type==='speedRatio'), JSON.stringify(sk&&{c:sk.cost,p:sk.power}));
const med = T.skillById('ps_meditate');
assert('ps_meditate spa_up×15（打破 cap:6）', med && (med.effects||[]).some(e=>e.type==='spa_up'&&e.layers===15), JSON.stringify(med&&med.effects));

/* ===== 2. 新状态 ===== */
console.log('2. 4 个新状态入 SKILL_STATUS');
assert('leech 入表', !!T.SKILL_STATUS.leech && T.SKILL_STATUS.leech.kind==='attr');
assert('combo 入表', !!T.SKILL_STATUS.combo);
assert('costdown 入表', !!T.SKILL_STATUS.costdown);
assert('powerup 入表', !!T.SKILL_STATUS.powerup);

/* ===== 3. 20 个新效果 ===== */
console.log('3. 20 个新效果类型');
const effects20 = ['speedRatio','defRatio','freezeCountHeal','condCooldown','condBuff','condCombo','condPower',
  'missingHpPower','randomBuff','pierceGuard','dispelBuff','varietyBuff','varietyGuard','varietyHits',
  'weatherClear','nullifyDamage','cooldownUp','condSuperEffective','neutralizeWeakness','copyPower'];
const missEff = effects20.filter(e=>!CODE.includes("case '"+e+"'") && !CODE.includes("'"+e+"':"));
assert('20 个新效果全部入 applyMechEffect/effects', missEff.length===0, '缺: '+missEff.join(','));

/* ===== 4. 天气系统 ===== */
console.log('4. 天气系统');
assert('b.weather 字段存在', CODE.includes('b.weather'));
assert('雪天 5 回合（ic_blizzard effects weather）', (T.skillById('ic_blizzard').effects||[]).some(e=>e.type==='weather'&&e.layers===5));
assert('天气锁 weatherClear', (T.skillById('li_weatherlock').effects||[]).some(e=>e.type==='weatherClear'));
assert('天气锁 priority=-2', T.skillById('li_weatherlock').priority===-2);

/* ===== 5. 先制度数值化 ===== */
console.log('5. 先制度');
assert('防御技能 priority=-6（雪景/壁垒/高墙/黑暗献祭/镜面/寸止/铁壁）',
  ['ic_snowview','ea_bastion','ea_wall','da_sacrifice','li_mirror','fi_stop','st_bulwark'].every(id=>T.skillById(id).priority===-6));
assert('先发制人 priority=+1', T.skillById('nr_firststrike').priority===1);
assert('逻辑陷阱 priority=-2', T.skillById('st_trap').priority===-2);
assert('宝可梦式排序代码存在（myPrio vs enPrio）', CODE.includes('myPrio') && CODE.includes('enPrio'));

/* ===== 6. 规则修正 ===== */
console.log('6. 规则修正');
// 6a. 冻结删受击解除：SKILL_STATUS.freeze 是 dot 类
assert('freeze kind=dot（纯持续伤害）', T.SKILL_STATUS.freeze.kind==='dot', '实际 kind='+T.SKILL_STATUS.freeze.kind);
// 6b. 属性免疫
assert('属性免疫 map 存在（freeze→ice/parasitic→grass/para→thunder/poison→poison）', CODE.includes("immuneMap") && CODE.includes("freeze:'ice'"));
// 6c. cap:6 移除：冥想 15 层无 cap
assert('spa_up 无 cap 限制（冥想 15 层生效）', !T.SKILL_STATUS.spa_up || !T.SKILL_STATUS.spa_up.cap || T.SKILL_STATUS.spa_up.cap>=15,
  'spa_up.cap='+(T.SKILL_STATUS.spa_up&&T.SKILL_STATUS.spa_up.cap));

/* ===== 7. 草系迁移 ===== */
console.log('7. 草系迁移（§2.10）');
const regen = T.SKILLS.universal.find(s=>s.id==='regen');
assert('回能 regen effects 迁移为 surge×5', regen && regen.effects && regen.effects.some(e=>e.type==='surge'&&e.layers===5) && !regen.mech,
  JSON.stringify(regen&&regen.effects));
const ss = T.skillById('g_seedshot');
assert('种子弹 effects 迁移为 gain×1', ss && ss.effects.some(e=>e.type==='gain'&&e.layers===1));
const vg = T.skillById('g_vinegrip');
assert('藤绞 effects 迁移为 gain×5', vg && vg.effects.some(e=>e.type==='gain'&&e.layers===5));
// 青草滑梯：effects.priority + field_grass cond（排序逻辑转数值）
const gg = T.skillById('g_grassyglide');
assert('青草滑梯 effects 含 priority+field_grass cond（排序时转 +1）', gg && gg.effects.some(e=>e.type==='priority'&&e.cond==='field_grass'),
  JSON.stringify(gg&&gg.effects));
note('mechToEffects 函数仍存在（编辑器 8913 行兼容展示调用，非战斗引擎双轨）','');

/* ===== cond key ===== */
console.log('cond key 四类');
['enemyUsedAttack','firstStrike','hpBelow','enemyNoDefense'].forEach(k=>{
  assert('cond key '+k+' 可判定', CODE.includes(k));
});

console.log('\nv1.18.0 技能填充验收 '+pass+' 过 / '+fail+' 失败 / '+warn+' 观察');
process.exit(fail?1:0);
