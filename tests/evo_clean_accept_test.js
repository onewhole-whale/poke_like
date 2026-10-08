/* v1.16.4 妖兽素材机制残留清理（删 onlyKill + 删 bone/gale/chaos + 删 beastMatIds 防御段）
   验收口径：req-docs/DEVELOPMENT_PLAN.md §10 v1.16.4 行（用户拍板：不做兼容，直接删）
   分组 A-H；只校验记录，不改代码不动数值 */
const fs = require('fs');
let pass=0, fail=0;
const assert=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
function mkEl(){
  const e={children:[],className:'',innerHTML:'',style:{},title:'',dataset:{},disabled:false,textContent:'',value:'',_ev:{},
    addEventListener(t,f){this._ev[t]=f;},removeEventListener(){},focus(){},blur(){},
    classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c);return c},remove(){},querySelector(){return mkEl()},querySelectorAll(){return []}};
  return e;
}
global.document={querySelector:()=>mkEl(),querySelectorAll:()=>[],createElement:()=>mkEl(),createTextNode:t=>({nodeValue:t,textContent:t}),addEventListener:()=>{}};
global.window={addEventListener:()=>{},location:{hash:'#/stable'},renderSettle:()=>{},renderWild:()=>{}};
global.location={hash:'#/stable'};
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}};
global.requestAnimationFrame=fn=>fn();
global.setTimeout=fn=>fn();
const CODE = require('./_load.js').loadGame();
let code=require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,MATS,allSpecies,allSpeciesDef,matInfo,matAny,matState,matUnitSum,deductMatUnits,beastDrops,beastMatIds,furnaceMats,makeSpirit,QUALITY_RANK};`);
eval(code);
const T=globalThis.__T;
const S=T.S;

/* ===== A. onlyKill 零残留（index.html 去注释） ===== */
console.log('A. onlyKill 零残留');
const bodyNC = CODE.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
const okRes = (bodyNC.match(/onlyKill/g)||[]).length;
assert('onlyKill 代码引用 0（注释除外）', okRes===0, '残留 '+okRes);

/* ===== B. MATS 表：bone/gale/chaos 删除、SC_none_fine_000001 保留 ===== */
console.log('B. MATS 妖兽素材');
const mKeys = Object.keys(T.MATS);
assert('MATS 条目 546（v1.16.6：545 专属 + SC_none_fine_000001）', mKeys.length===546, '实际 '+mKeys.length);
assert('bone/gale/chaos 定义零残留', !('bone' in T.MATS) && !('gale' in T.MATS) && !('chaos' in T.MATS));
assert('SC_none_fine_000001 保留（type=beast，唯一妖兽素材）', !!T.MATS['SC_none_fine_000001'] && T.MATS['SC_none_fine_000001'].type==='beast');
assert('SC_none_fine_000001 count=0（无初始持有）', T.MATS['SC_none_fine_000001'].count===0, T.MATS['SC_none_fine_000001'].count);
const beastOnly = mKeys.filter(k=>T.MATS[k].type==='beast');
assert('type=beast 546 条（545 专属 + SC_none_fine_000001）', beastOnly.length===546 && beastOnly.includes('SC_none_fine_000001'), 'beast '+beastOnly.length);

/* ===== C. beastDrops 三 mode 新逻辑（全量取，仅靠数量/种类区分） ===== */
console.log('C. beastDrops 三 mode');
S.customMats['tst_a']={id:'tst_a',name:'测试素材A',elem:'fire',quality:'good',type:'beast',tags:[],count:0,desc:'t'};
S.customMats['tst_b']={id:'tst_b',name:'测试素材B',elem:'time',quality:'rare',type:'beast',tags:[],count:0,desc:'t'};
S.customSpecies['tstb']={id:'tstb',name:'测试普通',elem:'fire',rarity:'normal',speed:50,stats:{hp:50,atk:50,def:50,spa:50,sdef:50},desc:'',drops:['tst_a','tst_b']};
const gk=T.beastDrops('tstb','kill'), gc=T.beastDrops('tstb','calm'), gf=T.beastDrops('tstb','catchFail');
assert('kill：全量两种、数量 round(2*1)=2', gk['tst_a']===2 && gk['tst_b']===2, JSON.stringify(gk));
assert('calm：全量两种、数量 round(2*1*.3)=1', gc['tst_a']===1 && gc['tst_b']===1, JSON.stringify(gc));
assert('catchFail：种类减半按品质降序（2→1 留 rare tst_b）', Object.keys(gf).length===1 && gf['tst_b']===2 && !gf['tst_a'], JSON.stringify(gf));
S.customSpecies['tst_empty']={id:'tst_empty',name:'空池测试',elem:'fire',rarity:'normal',speed:50,stats:{hp:50,atk:50,def:50,spa:50,sdef:50},desc:'',drops:[]};
assert('空池 kill/calm/catchFail 全 {}', Object.keys(T.beastDrops('tst_empty','kill')).length===0 && Object.keys(T.beastDrops('tst_empty','calm')).length===0 && Object.keys(T.beastDrops('tst_empty','catchFail')).length===0, JSON.stringify(T.beastDrops('tst_empty','kill')));
delete S.customSpecies['tst_empty'];
assert('elite 1.5x：kill=round(2*1.5)=3', (S.customSpecies['tstb'].rarity='elite', T.beastDrops('tstb','kill')['tst_a']===3), '');
S.customSpecies['tstb'].rarity='normal';
delete S.customSpecies['tstb']; delete S.customMats['tst_a']; delete S.customMats['tst_b'];

/* ===== D. beastMatIds 防御段已删（函数本体保留） ===== */
console.log('D. beastMatIds');
assert('beastMatIds 函数存在', typeof T.beastMatIds==='function');
const bmi = T.beastMatIds();
assert('beastMatIds 返回 546（545 专属 + SC_none_fine_000001）', bmi.length===546 && bmi.includes('SC_none_fine_000001'), 'len '+bmi.length);
// 防御段特征：旧实现会对"自定义妖兽素材未挂 drops"做 filter 保留可见；新实现只 MATS beast + drops 关联
const bmSrc = CODE.slice(CODE.indexOf('function beastMatIds'), CODE.indexOf('function beastMatIds')+300);
assert('beastMatIds 无防御兼容段（不引用 customMats 可见性逻辑）', !/customMats/.test(bmSrc), bmSrc.slice(0,200));

/* ===== E. matState 新档无妖兽素材初始数 ===== */
console.log('E. matState 新档初始');
assert('matState 无 bone/gale/chaos（已删定义）', T.matState['bone']===undefined && T.matState['gale']===undefined && T.matState['chaos']===undefined);
assert('matState SC_none_fine_000001=0（count 0）', T.matState['SC_none_fine_000001']===0, T.matState['SC_none_fine_000001']);

/* ===== F. 旧档幽灵：bone/gale/chaos matInfo=null、不计入 ===== */
console.log('F. 旧档幽灵兼容');
assert('matInfo(bone)=null', T.matInfo('bone')===null);
assert('matInfo(gale)=null', T.matInfo('gale')===null);
assert('matInfo(chaos)=null', T.matInfo('chaos')===null);
assert('matAny(bone)=null', T.matAny('bone')===null);
for(const k in T.matState) delete T.matState[k];
T.matState['SC_fire_normal_000014']=10; T.matState['bone']=999;
assert('matUnitSum 计新素材不计幽灵（fire,0=10）', T.matUnitSum('fire',0)===10, T.matUnitSum('fire',0));
T.deductMatUnits('fire',0,10);
assert('deductMatUnits 扣新素材、跳过幽灵 bone 不报错', T.matState['SC_fire_normal_000014']===0 && T.matState['bone']===999, JSON.stringify(T.matState));
for(const k in T.matState) delete T.matState[k];

/* ===== G. 编辑器 beast 标签页只有 SC_none_fine_000001（静态：素材分组遍历 MATS beast） ===== */
console.log('G. 编辑器 beast 分组（v1.16.6 全 beast）');
const byType = (()=>{ const o={}; mKeys.forEach(k=>{ const t=T.MATS[k].type; (o[t]=o[t]||[]).push(k); }); return o; })();
assert('编辑器素材分组 beast 546 / 无 plant ore', byType.beast.length===546 && !byType.plant && !byType.ore, JSON.stringify(Object.keys(byType)));

/* ===== H. 炼化投妖兽伴生不动 ===== */
console.log('H. 炼化投妖兽伴生');
S.beasts.push({id:'t1',speciesId:'JL_fire_normal_0001',lvl:10,hp:50,maxHp:50,aff:{},name:'烬烬狼'});
S.furnace.push('beast:t1');
const fm = T.furnaceMats();
S.furnace = S.furnace.filter(x=>x!=='beast:t1');
S.beasts = S.beasts.filter(x=>x.id!=='t1');
const leIn = fm.filter(m=>m.id==='SC_none_fine_000001');
assert('投妖兽入炉：SC_none_fine_000001×1 伴生（机制不动）', leIn.length===1 && leIn[0].unitN===1, JSON.stringify(leIn));
assert('投妖兽入炉：专属掉落 5 种全带出（v1.16.6 drops 挂载）', fm.filter(m=>m.id!=='SC_none_fine_000001').length===5, JSON.stringify(fm.map(x=>x.id).slice(0,8)));

console.log('\nv1.16.4 妖兽素材残留清理 验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
