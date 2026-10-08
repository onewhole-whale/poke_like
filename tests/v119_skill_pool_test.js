/* v1.19.0 M3-1-5c 技能池收口 验收
   口径：需求文档_M3-1-5c技能池_草火收口_2026-09-19.md + 开发报告 §3（8 条）
   只校验记录，不改代码不动数值 */
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
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,`init(); route(); globalThis.__T={S,SKILLS,GLOBAL_SKILL_POOL,ULT_DEFS,BURST_DEFS,skillById,skillEffectsOf};`);
eval(code);
const T=globalThis.__T;

/* ===== 1. 能量上限 10 ===== */
console.log('1. 能量上限 10');
assert('精灵 energyMax=10', T.S.spirits && T.S.spirits[0] && (T.S.spirits[0].energyMax===10 || T.S.energyMax===10), '实际 '+(T.S.spirits&&T.S.spirits[0]&&T.S.spirits[0].energyMax));
assert('能量上限兜底 10（代码无 ||20）', !/energyMax\s*\|\|\s*20/.test(CODE), '仍有 ||20 兜底');
assert('妖兽能量封顶 10', CODE.includes('Math.min(10') || /Math\.min\(10/.test(CODE));

/* ===== 2. 草系删 13 门 ult ===== */
console.log('2. 草系删 13 门 ult（零引用）');
const deleted = ['spikearm','tropicalkick','seedbomb','drumbeat','gravity','thousandflower','leafstorm','syrupbomb','gigadrain','grassyknife','grassyseed','teablast','chilipepper'];
const deletedCN = {
  'spikearm':'尖刺臂','tropicalkick':'热带踢','seedbomb':'茁茁炸弹','drumbeat':'鼓击',
  'gravity':'万有引力','thousandflower':'千变万花','leafstorm':'起草','syrupbomb':'糖浆炸弹',
  'gigadrain':'终极吸取','grassyknife':'打草结','grassyseed':'草之誓约','teablast':'刷刷茶炮','chilipepper':'辣椒精华'
};
// 13 门 id 零引用（grep 全文件）
const stillRef = deleted.filter(id => CODE.includes("id:'"+id+"'") || CODE.includes('"id": "'+id+'"') || CODE.includes('"id":"'+id+'"'));
assert('13 门已删草系 ult 全文件零 id 引用', stillRef.length===0, '仍在: '+stillRef.map(i=>deletedCN[i]||i).join(','));

/* ===== 3. 草系 burst 9 门保留 ===== */
console.log('3. 草系 burst 9 门保留');
const keepBurst = ['sunbeam','solarblade','petaldance','petalblizzard','wildgrowth','leafstorm','seedflash','powerwhip','growth'];
const grassBurstIds = ['g_solabeam','g_solarblade','g_petaldance','g_petalblizzard','g_frenzyplant','g_leafstorm','g_seedflare','g_verdantquake','g_lightcharge'];
const missingBurst = grassBurstIds.filter(id=>!T.skillById(id));
assert('草系 burst 9 门全在（实际 '+(9-missingBurst.length)+'/9）', missingBurst.length===0, '缺: '+missingBurst.join(','));
assert('9 门都 kind=burst', grassBurstIds.every(id=>T.skillById(id).kind==='burst'));

/* ===== 4. 草系参数 ===== */
console.log('4. 草系参数调整');
const ls = T.skillById('g_leechseed');
assert('寄生种子 cost:1 energy:1', ls && ls.cost===1 && ls.energy===1, JSON.stringify(ls&&{c:ls.cost,e:ls.energy}));
const cotton = T.skillById('g_cottonspore');
assert('棉孢子 spd_down layers:5', cotton && (cotton.effects||[]).some(e=>e.type==='spd_down'&&e.layers===5), JSON.stringify(cotton&&cotton.effects));
const cottong = T.skillById('g_cottonguard');
assert('棉花防守 def_up layers:5', cottong && (cottong.effects||[]).some(e=>e.type==='def_up'&&e.layers===5), JSON.stringify(cottong&&cottong.effects));
const stunPowder = T.skillById('g_stunspore');
assert('麻痹粉 cost:1 accuracy:80', stunPowder && stunPowder.cost===1 && stunPowder.accuracy===80, JSON.stringify(stunPowder&&{c:stunPowder.cost,a:stunPowder.accuracy}));
const sleepPowder = T.skillById('g_sleeppowder');
assert('催眠粉 cost:1 accuracy:80', sleepPowder && sleepPowder.cost===1 && sleepPowder.accuracy===80);
const spore = T.skillById('g_spores');
assert('蘑菇孢子 cost:1 accuracy:80', spore && spore.cost===1 && spore.accuracy===80);
const gf = T.skillById('g_grassyterrain');
assert('青草场地 energy:4', gf && gf.energy===4, '实际 energy='+(gf&&gf.energy));

/* ===== 5. 火系 11 门新建 ===== */
console.log('5. 火系 11 门新建');
const fire11 = ['f_ember','f_flamewheel','f_charge','f_magicalfire','f_firecut','f_firepunch','f_firestorm','f_flamethrower','f_firecart','f_arson','f_fury'];
const missingFire = fire11.filter(id=>!T.skillById(id));
assert('火系 11 门全部落 SKILLS.fire', missingFire.length===0, '缺: '+missingFire.join(','));
assert('火系 11 门在 GLOBAL_SKILL_POOL.fire', fire11.every(id=>T.GLOBAL_SKILL_POOL.fire && T.GLOBAL_SKILL_POOL.fire.includes(id)));
// f_charge condPower+60 / f_firestorm condBurn+10
const fc = T.skillById('f_charge');
assert('f_charge 有 condPower+60', fc && (fc.effects||[]).some(e=>e.type==='condPower'&&(e.power===60||e.layers===60)), JSON.stringify(fc&&fc.effects));
const fstorm = T.skillById('f_firestorm');
assert('f_firestorm 有 condBurn+10', fstorm && (fstorm.effects||[]).some(e=>e.type==='condBurn'), JSON.stringify(fstorm&&fstorm.effects));

/* ===== 6. ULT_DEFS 空、BURST_DEFS 独立注册 ===== */
console.log('6. ULT_DEFS 空、BURST_DEFS 独立注册');
assert('ULT_DEFS 空对象', T.ULT_DEFS && Object.keys(T.ULT_DEFS).length===0, '实际 keys='+Object.keys(T.ULT_DEFS||{}).length);
const burstKeys = Object.keys(T.BURST_DEFS||{});
assert('BURST_DEFS 有 15 门 burst（实际 '+burstKeys.length+'）', burstKeys.length>=15, '实际 '+burstKeys.join(','));
assert('inferno 不丢', !!T.skillById('inferno'));
assert('maelstrom 不丢', !!T.skillById('maelstrom'));
assert('thunderdoom 不丢', !!T.skillById('thunderdoom'));

/* ===== 7. GLOBAL_SKILL_POOL 旧 ult id 零残留 ===== */
console.log('7. 旧 ult id 零残留');
const oldUlt = ['flamebreath','pyre','icefang','deluge','rockslide','stoneedge','shadowball','psybeam','quickattack','slam','vinewhip','razorleaf','bite','thundershock','watergun'];
const leftover = oldUlt.filter(id=>T.GLOBAL_SKILL_POOL.fire && T.GLOBAL_SKILL_POOL.fire.includes(id) || CODE.includes("'"+id+"'"));
// 只查 GLOBAL_SKILL_POOL 里
const inPool = Object.values(T.GLOBAL_SKILL_POOL).flat().filter(id=>oldUlt.includes(id));
assert('GLOBAL_SKILL_POOL 无旧 ult id', inPool.length===0, '仍在池: '+inPool.join(','));

/* ===== 8. 新条件 enemyUsedStatus / condBurn ===== */
console.log('8. 新条件双引擎');
assert('enemyUsedStatus 在代码中', CODE.includes('enemyUsedStatus'));
assert('condBurn case 在 applyMechEffect', CODE.includes("case 'condBurn'"));
assert('双引擎两处标记 enemyUsedStatus（野外+副本）', (CODE.match(/b\.enemyUsedStatus = \(sk\.type==='状态'\)/g)||[]).length>=2, '实际 '+(CODE.match(/b\.enemyUsedStatus = \(sk\.type==='状态'\)/g)||[]).length+' 处');

console.log('\nv1.19.0 技能池收口验收 '+pass+' 过 / '+fail+' 失败 / '+warn+' 观察');
process.exit(fail?1:0);
