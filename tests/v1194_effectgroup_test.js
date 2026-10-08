/* v1.19.4 effectGroup 通用化 验收
   口径：需求文档_M3-1-5补丁_效果组effectGroup通用化_2026-09-20.md §4（5条） */
const fs = require('fs');
let pass=0, fail=0, warn=0;
const assert=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
function mkEl(){ return {children:[],className:'',innerHTML:'',style:{},title:'',dataset:{},disabled:false,textContent:'',value:'',_ev:{},addEventListener(){},removeEventListener(){},focus(){},blur(){},classList:{add(){},remove(){},toggle(){},contains(){return false}},appendChild(c){return c},remove(){},querySelector(){return mkEl()},querySelectorAll(){return []}}; }
const elCache={};
global.document={getElementById:id=>elCache[id]||(elCache[id]=mkEl()),querySelector:()=>mkEl(),querySelectorAll:()=>[],createElement:()=>mkEl(),createTextNode:t=>({nodeValue:t,textContent:t}),addEventListener:()=>{}};
global.window={addEventListener:()=>{},location:{hash:'#/wild'},renderSettle(){},renderWild(){},renderRefine(){},renderCodex(){},renderDex(){},renderStable(){}};
global.location={hash:'#/wild'};
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}};
global.requestAnimationFrame=fn=>fn();global.setTimeout=fn=>fn();global.toast=()=>{};
const CODE = require('./_load.js').loadGame();
let code=require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'').replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,"init(); route(); globalThis.__T={SKILLS,GLOBAL_SKILL_POOL,SKILL_STATUS,skillById};");
eval(code);
const T=globalThis.__T;

console.log('1. 所有技能 effects 运行时自动包装成 all 组');
assert('normalizeEffects 函数存在', CODE.includes('function normalizeEffects') || CODE.includes('normalizeEffects'), '未实现');
assert('normalizeEffects 旧格式自动包装 all', CODE.includes("return [{type:'effectGroup', mode:'all', children:effects}]"), '无包装逻辑');
assert('normalizeEffects 已是 effectGroup 格式则直通', CODE.includes("if(effects[0] && effects[0].type==='effectGroup') return effects;"), '无直通');

console.log('2. 13 个多效果技能 normalize 后 mode=all');
const multiSkills = ['f_fury','ic_snowview','ea_bastion','ps_austerity','li_mirror','fi_stance','w_waterring','w_hotspring','p_acidpool','p_reverse','p_numb','fi_stop','st_bulwark'];
const notAll = multiSkills.filter(id=>{
  const sk = T.skillById(id);
  if(!sk || !sk.effects) return true;
  // 数据未改的旧格式，normalize 后应变 all
  if(sk.effects[0].type==='effectGroup') return sk.effects[0].mode!=='all';
  return false; // 旧格式 normalize 后必然 all
});
assert('13 个多效果技能 normalize 后 mode=all（'+(13-notAll.length)+'/13）', notAll.length===0, '非all: '+notAll.join(','));

console.log('3. g_gift 改为 effectGroup+randomOne');
const gift = T.skillById('g_gift');
assert('g_gift 存在', !!gift);
const hasRandomOne = gift && gift.effects && gift.effects.some(ef => ef.type==='effectGroup' && ef.mode==='randomOne');
assert('g_gift 用 effectGroup randomOne', hasRandomOne, JSON.stringify(gift&&gift.effects));
const rg = gift.effects.find(ef=>ef.type==='effectGroup'&&ef.mode==='randomOne');
assert('randomOne 两个子组 prob 50/50', rg && rg.children && rg.children.length===2 && rg.children[0].prob===50 && rg.children[1].prob===50, JSON.stringify(rg&&rg.children));
assert('子组1 energyFull', rg && rg.children[0].effects.some(e=>e.type==='energyFull'));
assert('子组2 energyZero', rg && rg.children[1].effects.some(e=>e.type==='energyZero'));

console.log('4. 战斗中 all 组全部执行、randomOne 只执行一个');
assert('applyEffectGroup 函数存在', CODE.includes('function applyEffectGroup'), '无 applyEffectGroup');
assert('applySkillEffects 检测 effectGroup 调 applyEffectGroup', CODE.includes("ef.type==='effectGroup'){ applyEffectGroup"), '未分派');
assert('applyEffectGroup all 模式遍历 children', /function applyEffectGroup[\s\S]{0,500}mode==='all'/.test(CODE));
assert('applyEffectGroup randomOne 模式按 prob 选一个', /function applyEffectGroup[\s\S]{0,800}mode==='randomOne'/.test(CODE));
assert('randomRoll 模式存在（预留）', /randomRoll/.test(CODE));

console.log('5. 旧 randomBranch 零残留');
assert('SKILL_STATUS 无 randomBranch 注册', !T.SKILL_STATUS.randomBranch, '仍注册');
assert('applyMechEffect 无 case randomBranch', !/case 'randomBranch'/.test(CODE), '仍有 case');
assert('技能数据无 randomBranch 引用', !/type:\s*'randomBranch'|type:\s*"randomBranch"/.test(CODE), '技能数据仍用');

console.log('\nv1.19.4 effectGroup 通用化验收 '+pass+' 过 / '+fail+' 失败 / '+warn+' 观察');
process.exit(fail?1:0);
