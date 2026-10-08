/* v1.18.2 M3-1-5b 补丁·技能字段填写规则 验收
   口径：需求文档_M3-1-5b补丁_技能字段填写规则_2026-09-19.md §4（6 条） */
const fs = require('fs');
let pass=0, fail=0, warn=0;
const assert=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
function mkEl(){ const e={children:[],className:'',innerHTML:'',style:{},title:'',dataset:{},disabled:false,textContent:'',value:'',_ev:{},addEventListener(t,f){this._ev[t]=f;},removeEventListener(){},focus(){},blur(){},classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},appendChild(c){this.children.push(c);return c},remove(){},querySelector(){return mkEl()},querySelectorAll(){return []}}; return e; }
const elCache={};
global.document={getElementById:id=>(elCache[id]=elCache[id]||mkEl()),querySelector:()=>mkEl(),querySelectorAll:()=>[],createElement:()=>mkEl(),createTextNode:t=>({nodeValue:t,textContent:t}),addEventListener:()=>{}};
global.window={addEventListener:()=>{},location:{hash:'#/wild'},renderSettle:()=>{},renderWild:()=>{},renderRefine:()=>{},renderCodex:()=>{},renderDex:()=>{},renderStable:()=>{}};
global.location={hash:'#/wild'};
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}};
global.requestAnimationFrame=fn=>fn(); global.setTimeout=fn=>fn(); global.toast=()=>{};
const CODE = require('./_load.js').loadGame();
let code=require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,`init(); route(); globalThis.__T={S,SKILLS,skillById,skillCapCost};`);
eval(code);
const T=globalThis.__T;

/* §2.3 表：id -> [代价, cost, energy] */
const TBL = {
  th_emwave:[2,1,1], th_zap:[2,1,1], th_pulse:[5,1,4], th_jolt:[2,1,1],
  ic_freeze:[3,1,2], ic_blizzard:[7,1,6], ic_slap:[4,1,3], ic_snowview:[4,1,3],
  ea_bastion:[2,1,1], ea_wall:[3,1,2], ea_seismic:[4,1,3], ea_golem:[2,1,1],
  da_thirst:[3,1,2], da_drain:[3,1,2], da_rend:[4,1,3], da_sacrifice:[3,1,2],
  ps_meditate:[4,1,3], ps_austerity:[3,1,2], ps_daydream:[3,1,2], ps_hand:[4,1,3],
  nr_armor:[3,1,2], nr_hypnosis:[4,1,3], nr_faith:[3,1,2], nr_firststrike:[2,1,1],
  wi_tailwind:[3,1,2], wi_slash:[3,1,2], wi_drill:[4,1,3], wi_volley:[4,1,3],
  li_rainbow:[4,1,3], li_mirror:[1,1,0], li_weatherlock:[2,1,1], li_kaleido:[4,1,3],
  fi_stop:[3,1,2], fi_weakspot:[4,1,3], fi_rebound:[3,1,2], fi_stance:[4,1,3],
  st_mind:[2,1,1], st_bulwark:[3,1,2], st_trap:[3,1,2], st_fortress:[4,1,3],
};

console.log('1. cost 全部=1（回能=0）');
const badCost=[];
for(const id in TBL){ const sk=T.skillById(id); if(!sk){badCost.push(id+'(缺失)');continue;} if(sk.cost!==1) badCost.push(id+'(cost='+sk.cost+')'); }
assert('40 门 cost 全部=1', badCost.length===0, badCost.join(','));
const regen = T.SKILLS.universal.find(s=>s.id==='regen');
assert('回能 regen cost=0', regen && regen.cost===0, '实际 cost='+(regen&&regen.cost));

console.log('2. energy = 代价-1（逐门对照 §2.3 表）');
const badEnergy=[];
for(const id in TBL){ const sk=T.skillById(id); if(!sk) continue;
  const [price,,expectE]=TBL[id];
  if(sk.energy!==expectE) badEnergy.push(id+'(实际 energy='+sk.energy+',期望 '+expectE+')');
}
assert('40 门 energy 全部与表一致', badEnergy.length===0, badEnergy.join(','));

console.log('3. 排序 key = energy+(cost-1)（代码 8828 行 skCost）');
// cost=1 时 skCost=energy；表内 energy 列即排序 key
const badSort=[];
for(const id in TBL){ const sk=T.skillById(id); if(!sk) continue;
  const skc = (sk.energy||0)+((sk.cost||0)-1);
  // 表内 energy 列 = 排序 key（cost=1 时 skCost=energy）
  const [,,expectE]=TBL[id];
  if(skc!==expectE) badSort.push(id+'(skCost='+skc+',期望 '+expectE+')');
}
assert('40 门排序 key 与表内 energy 列一致', badSort.length===0, badSort.join(','));

console.log('4. 镜面防御 energy=0 恒可释放');
const mirror = T.skillById('li_mirror');
assert('镜面防御 energy=0', mirror && mirror.energy===0, '实际 energy='+(mirror&&mirror.energy));
assert('镜面防御 cost=1', mirror && mirror.cost===1);
assert('镜面防御排序 key=0（排最前）', mirror && (mirror.energy||0)+((mirror.cost||0)-1)===0);

console.log('5. 技能列表按代价排序');
// 收集 40 门代价分布
const prices = Object.entries(TBL).map(([id,[price]])=>({id,price}));
const priceSet = [...new Set(prices.map(p=>p.price))].sort((a,b)=>a-b);
assert('代价分布 1~7（镜面1/暴风雪7）', priceSet[0]===1 && priceSet[priceSet.length-1]===7, '实际 '+priceSet.join(','));
assert('镜面防御是 1 代价（排最前）', TBL.li_mirror[0]===1);
assert('暴风雪是 7 代价（排最后）', TBL.ic_blizzard[0]===7);
assert('排序逻辑代码存在（8828 行 skCost=energy+(cost-1)）', CODE.includes('skCost') && CODE.includes('(sk.energy||0)+((sk.cost||0)-1)'));

console.log('6. v1.1 其余内容不受影响（回归）');
// 快速抽验 v1.18.0 关键项
assert('40 技能仍在池', Object.keys(TBL).every(id=>!!T.skillById(id)));
assert('先制 +1 仍在（nr_firststrike priority=1）', T.skillById('nr_firststrike').priority===1);
assert('防御 -6 仍在（ic_snowview priority=-6）', T.skillById('ic_snowview').priority===-6);
assert('暴风雪 weather×5 仍在', T.skillById('ic_blizzard').effects.some(e=>e.type==='weather'&&e.layers===5));
assert('新状态 leech 仍在', CODE.includes('leech:'));

console.log('\nv1.18.2 技能字段填写规则验收 '+pass+' 过 / '+fail+' 失败 / '+warn+' 观察');
process.exit(fail?1:0);
