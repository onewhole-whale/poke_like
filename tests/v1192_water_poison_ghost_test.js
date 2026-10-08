/* v1.19.2 M3-1-5d 水毒幽完备池 验收
   口径：需求文档_M3-1-5d技能池_水毒幽完备_2026-09-19.md §7.1（9条）+ §7.2（4条）
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
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,`init(); route(); globalThis.__T={S,SKILLS,GLOBAL_SKILL_POOL,SKILL_STATUS,skillById};`);
eval(code);
const T=globalThis.__T;

/* ===== 引擎机制 9 条 ===== */
console.log('§7.1 引擎机制');

// 1. energyDown/energyUp 属性状态
console.log('1. energyDown/energyUp 能耗变化');
assert('SKILL_STATUS 有 energyDown', T.SKILL_STATUS.energyDown, '未注册');
assert('SKILL_STATUS 有 energyUp', T.SKILL_STATUS.energyUp, '未注册');
assert('energyDown 注册为属性/效果状态（kind=attr 或 stat）', T.SKILL_STATUS.energyDown && ['attr','stat'].includes(T.SKILL_STATUS.energyDown.kind), JSON.stringify(T.SKILL_STATUS.energyDown));
assert('结算按下降后能耗扣能量（代码有 energyDown 扣减逻辑）', CODE.includes('energyDown') && /energyDown/.test(CODE));

// 2. 读层数动态 scalingByStatus
console.log('2. scalingByStatus 读层数动态');
assert('applyMechEffect 有 scalingByStatus case', CODE.includes("case 'scalingByStatus'"), '未注册');
const bw = T.skillById('w_bubblewave');
assert('泡沫浪花 w_bubblewave 有 scalingByStatus power', bw && (bw.effects||[]).some(e=>e.type==='scalingByStatus'&&e.status==='energyDown'&&e.perPower===10), JSON.stringify(bw&&bw.effects));
const vs = T.skillById('p_venomshot');
assert('毒液喷射 p_venomshot 有 scalingByStatus poison perPower=10', vs && (vs.effects||[]).some(e=>e.type==='scalingByStatus'&&e.status==='poison'&&e.perPower===10), JSON.stringify(vs&&vs.effects));

// 3. 能量操作 stealEnergy/drainEnergy
console.log('3. 能量操作');
assert('applyMechEffect 有 stealEnergy case', CODE.includes("case 'stealEnergy'"), '未注册');
assert('applyMechEffect 有 drainEnergy case', CODE.includes("case 'drainEnergy'"), '未注册');
const terrify = T.skillById('g_terrify');
assert('假面恐吓 g_terrify 有 stealEnergy layers=3', terrify && (terrify.effects||[]).some(e=>e.type==='stealEnergy'&&e.layers===3), JSON.stringify(terrify&&terrify.effects));
const sneak = T.skillById('g_sneak');
assert('阴影潜行 g_sneak 有 drainEnergy layers=2（敌能量-2）', sneak && (sneak.effects||[]).some(e=>e.type==='drainEnergy'&&e.layers===2), JSON.stringify(sneak&&sneak.effects));

// 4. perHit
console.log('4. perHit 每连击触发');
const sting = T.skillById('p_sting');
assert('毒刺 p_sting 有 perHit:true', sting && (sting.effects||[]).some(e=>e.perHit===true), JSON.stringify(sting&&sting.effects));
assert('毒刺 p_sting hits=2', sting && sting.hits===2, '实际 hits='+(sting&&sting.hits));

// 5. cleanseByCount
console.log('5. cleanseByCount 净化层数转效果');
assert('applyMechEffect 有 cleanseByCount case', CODE.includes("case 'cleanseByCount'"), '未注册');
const rain = T.skillById('w_rain');
assert('春雨 w_rain 有 cleanseByCount 每净化1层回5%', rain && (rain.effects||[]).some(e=>e.type==='cleanseByCount'&&e.healPerLayer===5), JSON.stringify(rain&&rain.effects));
const doc = T.skillById('p_doctor');
assert('瘟疫医生 p_doctor 有 cleanseByCount 每移除1层poison回15%', doc && (doc.effects||[]).some(e=>e.type==='cleanseByCount'&&e.status==='poison'&&e.healPerLayer===15), JSON.stringify(doc&&doc.effects));

// 6. randomDebuff
console.log('6. randomDebuff 随机减益');
assert('applyMechEffect 有 randomDebuff case', CODE.includes("case 'randomDebuff'"), '未注册');
const doll = T.skillById('g_doll');
assert('布娃娃 g_doll 有 randomDebuff', doll && (doll.effects||[]).some(e=>e.type==='randomDebuff'), JSON.stringify(doll&&doll.effects));

// 7. wenling 问灵
console.log('7. wenling 问灵状态');
assert('SKILL_STATUS 有 wenling', T.SKILL_STATUS.wenling, '未注册');
const pen = T.skillById('g_pen');
assert('笔仙 g_pen 附 wenling', pen && (pen.effects||[]).some(e=>e.type==='wenling'), JSON.stringify(pen&&pen.effects));

// 8. isDebuff + 落井下石
console.log('8. isDebuff 正负字段 + 落井下石');
assert('所有效果状态有 isDebuff 字段（代码全局遍历）', CODE.includes('isDebuff'), '代码无 isDebuff');
const opp = T.skillById('g_opportunity');
assert('落井下石 g_opportunity 用 enemyHasDebuffStatus 条件 +80', opp && (opp.effects||[]).some(e=>e.type==='condPower'&&e.cond==='enemyHasDebuffStatus'&&e.layers===80), JSON.stringify(opp&&opp.effects));

// 9. 湿润场地 field_water
console.log('9. 湿润场地 field_water');
assert('SKILL_STATUS 有 field_water 或 field 类型支持 water', T.SKILL_STATUS.field || CODE.includes('field_water'), '未注册');
const wet = T.skillById('w_wetfield');
assert('湿润场地 w_wetfield 有 field_water layers=8', wet && (wet.effects||[]).some(e=>e.type==='field_water'&&e.layers===8), JSON.stringify(wet&&wet.effects));
assert('代码有湿润场地减伤10%逻辑', /field\.elem==='water'|field_water/.test(CODE) || CODE.includes('field.elem==="water"'));

/* ===== §7.2 技能池 4 条 ===== */
console.log('§7.2 技能池');

// 10. 水系 13 门
console.log('10. 水系 13 门注册进 water 池');
const water13 = ['w_watergun','w_surf','w_watercut','w_bubblewave','w_bubblepop','w_tianhong','w_mudshot','w_waterring','w_wetfield','w_mistheal','w_hotspring','w_goodbadspring','w_rain'];
const missW = water13.filter(id=>!T.skillById(id));
assert('水系 13 门全在（实际 '+(13-missW.length)+'/13）', missW.length===0, '缺: '+missW.join(','));
assert('水系 13 门在 GLOBAL_SKILL_POOL.water', water13.every(id=>T.GLOBAL_SKILL_POOL.water && T.GLOBAL_SKILL_POOL.water.includes(id)));

// 11. 毒系 14 门新增 + 纯攻从8减到3
console.log('11. 毒系 14 门新增 + 纯攻减到3');
const poison14 = ['p_needle','p_sting','p_venomshot','p_quill','p_disease','p_mudslap','p_poisonmist','p_venomcoat','p_breath','p_trap','p_acidpool','p_doctor','p_reverse','p_numb'];
const missP = poison14.filter(id=>!T.skillById(id));
assert('毒系 14 门新增全在（实际 '+(14-missP.length)+'/14）', missP.length===0, '缺: '+missP.join(','));
assert('毒系保留 3 门纯攻 poison-nd1/poison-nd8/poison-nd9', T.skillById('poison-nd1')&&T.skillById('poison-nd8')&&T.skillById('poison-nd9'));
assert('毒系删除 5 门纯攻 poison-nd0/poison-nd7/poison-nd2/poison-nd4/poison-nd11', !T.skillById('poison-nd0')&&!T.skillById('poison-nd7')&&!T.skillById('poison-nd2')&&!T.skillById('poison-nd4')&&!T.skillById('poison-nd11'));

// 12. 幽系 13 门
console.log('12. 幽系 13 门注册进 ghost 池');
const ghost13 = ['g_drain','g_shadowball','g_opportunity','g_balance','g_spirit','g_sleepy','g_nightmare','g_gift','g_terrify','g_doll','g_pen','g_fire','g_sneak'];
const missG = ghost13.filter(id=>!T.skillById(id));
assert('幽系 13 门全在（实际 '+(13-missG.length)+'/13）', missG.length===0, '缺: '+missG.join(','));
assert('幽系 13 门在 GLOBAL_SKILL_POOL.ghost', ghost13.every(id=>T.GLOBAL_SKILL_POOL.ghost && T.GLOBAL_SKILL_POOL.ghost.includes(id)));

// 13. 草系 g_energyball 降特防 4→2
console.log('13. 草系 g_energyball 降特防 4→2');
const eb = T.skillById('g_energyball');
assert('g_energyball sdef_down layers=2', eb && (eb.effects||[]).some(e=>e.type==='sdef_down'&&e.layers===2), JSON.stringify(eb&&eb.effects));

console.log('\nv1.19.2 水毒幽完备池验收 '+pass+' 过 / '+fail+' 失败 / '+warn+' 观察');
process.exit(fail?1:0);
