/* A6：GLOBAL_SKILL_POOL / GLOBAL_PERK_POOL / ESSENCE_EXPAND 引用 id 运行时真实性核对 */
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
code = code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,'init(); route(); globalThis.__P={SKILLS,PERKS,GLOBAL_SKILL_POOL,GLOBAL_PERK_POOL,ESSENCE_EXPAND};');
eval(code);
const {SKILLS, PERKS, GLOBAL_SKILL_POOL, GLOBAL_PERK_POOL, ESSENCE_EXPAND} = globalThis.__P;
const allSkills = Object.values(SKILLS).flat().map(s=>s.id);
const allPerks = Object.values(PERKS).flat().map(p=>p.id);
let pass=0, fail=0;
const check=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
// 1. GLOBAL_SKILL_POOL
let missS=0, missP=0;
for(const [elem, ids] of Object.entries(GLOBAL_SKILL_POOL)){
  for(const id of ids){ if(!allSkills.includes(id)){ missS++; console.log('  MISS SKILL', elem, id); } }
}
check('GLOBAL_SKILL_POOL 全部技能 id 真实存在', missS===0, 'miss='+missS);
for(const [elem, ids] of Object.entries(GLOBAL_PERK_POOL)){
  for(const id of ids){ if(!allPerks.includes(id)){ missP++; console.log('  MISS PERK', elem, id); } }
}
check('GLOBAL_PERK_POOL 全部专长 id 真实存在', missP===0, 'miss='+missP);
// 2. ESSENCE_EXPAND 两段
let es=0, ep=0;
for(const [elem, seg] of Object.entries(ESSENCE_EXPAND)){
  if(seg.skills) for(const id of seg.skills){ if(!allSkills.includes(id)){ es++; console.log('  MISS EXPAND-SKILL', elem, id); } }
  if(seg.perks) for(const id of seg.perks){ if(!allPerks.includes(id)){ ep++; console.log('  MISS EXPAND-PERK', elem, id); } }
}
check('ESSENCE_EXPAND.skills 全部真实存在', es===0, 'miss='+es);
check('ESSENCE_EXPAND.perks 全部真实存在', ep===0, 'miss='+ep);
// 3. 通用池按属性覆盖度（非空即合理）
check('通用技能池覆盖 ≥12 属性', Object.keys(GLOBAL_SKILL_POOL).length>=12, Object.keys(GLOBAL_SKILL_POOL).length);
check('通用专长池覆盖 ≥12 属性', Object.keys(GLOBAL_PERK_POOL).length>=12, Object.keys(GLOBAL_PERK_POOL).length);
console.log('\n'+pass+' 通过, '+fail+' 失败');
process.exit(fail?1:0);
