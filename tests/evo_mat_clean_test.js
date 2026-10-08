/* v1.16.1 M3-1-2 收尾修复·妖兽素材体系推倒重来 独立验收脚本
   验收口径：req-docs/DEVELOPMENT_PLAN.md §10 v1.16.1 行（唯一口径）+ 开发报告_v1.16.0（基线）
   变更点 7 项：DROPS/UP_MATS 删除 / drops 清空 / matAny·allMatDef·matState 只走 MATS /
   SC_none_fine_000001 保留+伴生 / upMatFor 框架 / beastDrops 三 mode+mult+onlyKill+空池 {} / 旧档幽灵兼容
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
const LS={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}};
global.document={querySelector:()=>mkEl(),querySelectorAll:()=>[],createElement:()=>mkEl(),createTextNode:t=>({nodeValue:t,textContent:t}),addEventListener:()=>{}};
global.window={addEventListener:()=>{},location:{hash:'#/stable'},renderSettle:()=>{},renderWild:()=>{}};
global.location={hash:'#/stable'};
global.localStorage=LS;
global.requestAnimationFrame=fn=>fn();
global.setTimeout=fn=>fn();
const CODE = require('./_load.js').loadGame();
let code=require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,SPECIES,MATS,allSpecies,allSpeciesDef,matAny,allMatDef,matInfo,matState,matUnitSum,deductMatUnits,unitOf,beastDrops,beastDropsNames,dropsOf,upMatFor,furnaceMats,makeSpirit,QUALITY_RANK};`);
eval(code);
const T=globalThis.__T;
const S=T.S;

/* ===== A. DROPS / UP_MATS 变量零残留（注释除外） ===== */
console.log('A. DROPS / UP_MATS 残留检查（静态）');
const srcBody = CODE.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
const dRes = (srcBody.match(/\bDROPS\b/g)||[]).length;
const uRes = (srcBody.match(/\bUP_MATS\b/g)||[]).length;
assert('DROPS 变量引用 0（注释除外）', dRes===0, '残留 '+dRes);
assert('UP_MATS 变量引用 0（注释除外）', uRes===0, '残留 '+uRes);
assert('MATS 表保留（flame/SC_none_fine_000001 在册）', !!T.MATS['SC_none_fine_000001'] && !!T.MATS['SC_none_fine_000001']);

/* ===== B. SPECIES.drops 全空 ===== */
console.log('B. SPECIES.drops 清空');
const all=T.allSpecies();
assert('精灵总数 109', all.length===109, '实际 '+all.length);
const nonEmpty = all.filter(sp=>sp.drops && sp.drops.length>0);
assert('全部精灵 drops 各 5 条（v1.16.6 填充）', nonEmpty.length===109 && all.every(sp=>sp.drops && sp.drops.length===5), '非空='+nonEmpty.length+'/109');
assert('dropsOf(精灵) 返回 5 条', T.dropsOf('JL_fire_normal_0001').length===5, JSON.stringify(T.dropsOf('JL_fire_normal_0001').map(m=>m.id)));

/* ===== C. matAny / allMatDef 只查 MATS + customMats + matEdits ===== */
console.log('C. 素材查找语义');
assert('matAny(flame) 可查（MATS）', !!T.matAny('SC_none_fine_000001'), T.matAny('SC_none_fine_000001')&&T.matAny('SC_none_fine_000001').name);
assert('matAny(SC_none_fine_000001) 可查（MATS）', !!T.matAny('SC_none_fine_000001'));
assert('matAny(fw_fang) = null（已删 DROPS 幽灵）', T.matAny('fw_fang')===null, T.matAny('fw_fang'));
assert('matAny(fw_ember) = null', T.matAny('fw_ember')===null);
assert('matInfo(fw_fang) = null（旧档兼容）', T.matInfo('fw_fang')===null);
S.customMats['tst_ghost']={id:'tst_ghost',name:'测试幽灵素材',elem:'fire',quality:'good',type:'beast',tags:[],count:0,desc:'t'};
assert('allMatDef 查 customMats（管理端注入可查）', !!T.allMatDef('tst_ghost'), 'null');
delete S.customMats['tst_ghost'];
S.matEdits['SC_none_fine_000001']={quality:'rare'};
assert('allMatDef 合并 matEdits（flame 品质被改 rare）', T.allMatDef('SC_none_fine_000001').quality==='rare', T.allMatDef('SC_none_fine_000001').quality);
delete S.matEdits['SC_none_fine_000001'];

/* ===== D. matState 初始化只遍历 MATS ===== */
console.log('D. matState 初始化范围');
assert('matState 含 MATS 素材（flame）', T.matState['SC_none_fine_000001']===T.MATS['SC_none_fine_000001'].count, T.matState['SC_none_fine_000001']);
assert('matState 不含已删妖兽素材（fw_fang）', T.matState['fw_fang']===undefined, 'fw_fang='+T.matState['fw_fang']);
assert('matState 不含 up1 上位素材', T.matState['up1_fw_fang']===undefined);

/* ===== E. SC_none_fine_000001 保留 + 投妖兽入炉伴生 1 ===== */
console.log('E. SC_none_fine_000001 伴生');
const le = T.MATS['SC_none_fine_000001'];
assert('SC_none_fine_000001 定义在 MATS（name=生命精华）', !!le && le.name==='生命精华');
assert('SC_none_fine_000001 elem=none（v1.16.5 归普通系）', le.elem==='none', le.elem);
assert('SC_none_fine_000001 quality=fine', le.quality==='fine', le.quality);
// 构造投妖兽入炉：beasts 里加一只，furnace 挂 beast:
const bdId='beast:tstb';
S.beasts.push({id:'tstb', speciesId:'JL_fire_normal_0001', lvl:10, hp:50, maxHp:50, aff:{}, name:'烬烬狼'});
S.furnace.push(bdId);
const fm = T.furnaceMats();
S.furnace = S.furnace.filter(x=>x!==bdId);
S.beasts = S.beasts.filter(x=>x.id!=='tstb');
const leIn = fm.filter(m=>m.id==='SC_none_fine_000001');
assert('投妖兽入炉：素材列表含 SC_none_fine_000001×1', leIn.length===1 && leIn[0].unitN===1, JSON.stringify(leIn));
assert('投妖兽入炉：素材列表除生命精华外含 drops 素材（v1.16.6）', fm.filter(m=>m.id!=='SC_none_fine_000001').length>=5, JSON.stringify(fm.map(x=>x.id)));

/* ===== F. upMatFor 框架保留（签名 + bump，当前返回原 id） ===== */
console.log('F. upMatFor 框架');
assert('upMatFor 保留签名且返回原 id（elite）', T.upMatFor('SC_none_fine_000001','elite')==='SC_none_fine_000001');
assert('upMatFor 返回原 id（boss）', T.upMatFor('SC_none_fine_000001','boss')==='SC_none_fine_000001');
assert('upMatFor 返回原 id（无模版）', T.upMatFor('SC_none_fine_000001','normal')==='SC_none_fine_000001');
const fnSrc = code.slice(code.indexOf('function upMatFor'), code.indexOf('function upMatFor')+400);
assert('upMatFor 含 elite+1/boss+2 bump 逻辑', /boss.*2|template==='boss'\s*\?\s*2/.test(fnSrc) && /elite.*1|template==='elite'\s*\?\s*1/.test(fnSrc), fnSrc.slice(0,120));

/* ===== G. beastDrops 框架：三 mode + mult + 空池 {}（v1.16.4：onlyKill 已删） ===== */
console.log('G. beastDrops 框架');
const e0 = T.beastDrops('JL_fire_normal_0001','kill');
const e1 = T.beastDrops('JL_fire_normal_0001','calm');
const e2 = T.beastDrops('JL_fire_normal_0001','catchFail');
assert('v1.16.6 填充后 kill 返回非空（5 条 drops）', Object.keys(e0).length===5, JSON.stringify(e0));
assert('v1.16.6 填充后 calm 返回非空', Object.keys(e1).length>=1, JSON.stringify(e1));
assert('v1.16.6 填充后 catchFail 返回非空', Object.keys(e2).length>=1, JSON.stringify(e2));
// 自定义 drops 验证框架逻辑：三 mode 统一全量取，仅靠数量/种类区分；elite 1.5x
S.customMats['tst_ok']={id:'tst_ok',name:'测试素材',elem:'fire',quality:'good',type:'beast',tags:[],count:0,desc:'t'};
S.customSpecies['tstb2']={id:'tstb2',name:'测试精英',elem:'fire',rarity:'elite',speed:50,stats:{hp:50,atk:50,def:50,spa:50,sdef:50},desc:'',drops:['tst_ok','SC_none_fine_000001']};
const gk = T.beastDrops('tstb2','kill');
const gc = T.beastDrops('tstb2','calm');
const gf = T.beastDrops('tstb2','catchFail');
assert('kill：两种全出', gk['tst_ok']>0 && gk['SC_none_fine_000001']>0, JSON.stringify(gk));
assert('elite 1.5x：数量=round(2*1.5)=3', gk['tst_ok']===3 && gk['SC_none_fine_000001']===3, JSON.stringify(gk));
assert('calm：两种全出，数量=round(2*1.5*.3)=1', gc['tst_ok']===1 && gc['SC_none_fine_000001']===1, JSON.stringify(gc));
assert('catchFail：种类减半（2→1，按品质降序留 fine 的 SC_none_fine_000001）', Object.keys(gf).length===1 && gf['SC_none_fine_000001']>0 && !gf['tst_ok'], JSON.stringify(gf));
assert('普通 rarity mult=1（2*1=2）', (S.customSpecies['tstb2'].rarity='normal', T.beastDrops('tstb2','kill')['SC_none_fine_000001']===2), '');
S.customSpecies['tstb2'].rarity='elite';
delete S.customSpecies['tstb2']; delete S.customMats['tst_ok'];

/* ===== H. 旧档兼容：幽灵素材不计入、不崩 ===== */
console.log('H. 旧档幽灵素材兼容');
const clr=()=>{ for(const k in T.matState) delete T.matState[k]; };
clr(); T.matState['SC_none_fine_000001']=10; T.matState['fw_fang']=999;   // 旧档残留 fw_fang
assert('matUnitSum 不计幽灵素材（none,0 = 10 非 1009）', T.matUnitSum('none',0)===10, T.matUnitSum('none',0));
T.deductMatUnits('none',0,10);
assert('deductMatUnits 跳过幽灵素材（SC_none_fine_000001 扣空不报错）', T.matState['SC_none_fine_000001']===0 && T.matState['fw_fang']===999, JSON.stringify(T.matState));
clr();

console.log('\nv1.16.1 妖兽素材体系推倒重来 验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
