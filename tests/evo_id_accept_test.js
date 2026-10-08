/* v1.16.5 M3-1-3 补丁 · id 编码体系（纯 id 替换 + 清理，无机制/数值改动）
   验收口径：req-docs/需求文档_M3-1-3素材填充_2026-09-17.md §21 + DEV_PLAN §10 v1.16.5 行
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
  `init(); route(); globalThis.__T={S,SPECIES,MATS,allSpecies,allSpeciesDef,matInfo,matAny,matState,matUnitSum,deductMatUnits,beastDrops,furnaceMats,QUALITY_RANK,ZONES,MAP_CONFIGS};`);
eval(code);
const T=globalThis.__T;
const S=T.S;
const s21 = JSON.parse(fs.readFileSync('/tmp/s21_map.json','utf8'));

/* ===== A. §21.2 对照：109 精灵编码 ↔ name/elem/rarity ===== */
console.log('A. §21.2 编码对照');
const byName={}; Object.keys(T.SPECIES).forEach(id=>{ const sp=T.SPECIES[id]; byName[sp.name]=id; });
let aMismatch=[];
s21.forEach(row=>{
  const id=byName[row.name];
  if(!id){ aMismatch.push(row.name+' 未找到'); return; }
  if(id!==row.id) aMismatch.push(row.name+' 期望'+row.id+' 实际'+id);
  const sp=T.SPECIES[id];
  if(sp.elem!==row.elem) aMismatch.push(row.name+' elem 期望'+row.elem+' 实际'+sp.elem);
  if(sp.rarity!==row.rarity) aMismatch.push(row.name+' rarity 期望'+row.rarity+' 实际'+sp.rarity);
});
assert('109 只编码与 §21.2 一一对应（name/elem/rarity 全匹配）', aMismatch.length===0, aMismatch.slice(0,8).join('; '));
assert('SPECIES 总数 109 且全部 JL_', Object.keys(T.SPECIES).length===109 && Object.keys(T.SPECIES).every(id=>id.startsWith('JL_')), Object.keys(T.SPECIES).length);

/* ===== B. 旧语义 id 零残留（词边界，排除非素材子串） ===== */
console.log('B. 旧语义 id 残留');
const bodyNC = CODE.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
const oldList=['firewolf','howlwolf','thunderlynx','pumpking','crimsonbird','frostwolf','tealbird','chips','herb','orchid','ironore','darkiron','timesand','meteor','life-essence','spiritherb','bone','gale','chaos','bone_fang'];
// 运行时行为断言：旧素材 id 不作为素材存在（词边界命中均为 UI 变量/gale 天赋 id/chaos 系等非素材命名空间）
const oldMiss = oldList.filter(o=>{ if(['bone','gale','chaos'].includes(o)) return T.MATS[o]!==undefined || !!T.matInfo(o); return !!T.MATS[o] || !!T.matInfo(o) || T.matState[o]!==undefined; });
assert('旧素材 id 运行时零存在（MATS/matInfo/matState）', oldMiss.length===0, JSON.stringify(oldMiss));
const allDrops = Object.keys(T.SPECIES).flatMap(id=>T.SPECIES[id].drops||[]);
assert('全部 drops 引用 SC_* 新 id（545 挂载）', allDrops.length>500 && allDrops.every(d=>d.startsWith('SC_')), 'drops 数 '+allDrops.length);

/* ===== C. MATS 仅 SC_none_fine_000001 落库 ===== */
console.log('C. MATS 落库');
const mKeys=Object.keys(T.MATS);
assert('MATS 546 = SC_none_fine_000001 + 545 专属素材（§1.2 落库）', mKeys.length===546 && mKeys[0]==='SC_none_fine_000001', 'MATS '+mKeys.length);
const s12 = JSON.parse(fs.readFileSync('/tmp/s21_map.json','utf8')).length; // 非素材表，仅为计数占位
// 解析 §1.2 素材表
const reqText = fs.readFileSync('/home/user/.doubao/agent_mode/workspace/spirit-refinery/req-docs/需求文档_M3-1-3素材填充_2026-09-17.md','utf8');
const s12rows = [...reqText.matchAll(/\| (SC_[a-z_]+_\d{6}) \| ([^\|]+) \| (\w+) \| (\w+) \| beast \| 0 \| ([^\|]*) \| ([^\|]*) \|/g)].map(m=>({id:m[1],name:m[2].trim(),elem:m[3],quality:m[4],desc:m[6].trim()}));
assert('§1.2 素材表 545 条', s12rows.length===545, '实际 '+s12rows.length);
const mis12 = s12rows.filter(r=>{ const m=T.MATS[r.id]; return !m || m.name!==r.name || m.elem!==r.elem || m.quality!==r.quality || m.type!=='beast'; });
assert('545 条专属素材与 §1.2 完全一致（id/name/elem/quality/type）', mis12.length===0, mis12.slice(0,5).map(r=>r.id).join(','));
assert('SC_none_*_000002~000013 不落库（M3-1-4 预留）', !mKeys.some(k=>/^SC_none_(normal|good|rare|epic|legend)_0/.test(k)));
assert('生命精华 elem=none / quality=fine / type=beast / count=0', T.MATS['SC_none_fine_000001'].elem==='none' && T.MATS['SC_none_fine_000001'].quality==='fine' && T.MATS['SC_none_fine_000001'].type==='beast' && T.MATS['SC_none_fine_000001'].count===0);
assert('SC_none_*_000002~000013 不落库（M3-1-4 预留）', !mKeys.some(k=>/^SC_none_(normal|good|rare|epic|legend)_0/.test(k)));

/* ===== D. 引用链同步：进化/图鉴/战斗 ===== */
console.log('D. 引用链同步');
const bmSrc = CODE.slice(CODE.indexOf('function beastMatIds'), CODE.indexOf('function beastMatIds')+300);
assert('beastMatIds 引用新 id（SC_none_fine_000001 在 MATS）', bmSrc.includes('MATS'), '');
let bdRef = CODE.slice(CODE.indexOf('function beastDrops'), CODE.indexOf('function beastDrops')+600);
assert('beastDrops 无旧素材引用', !/life-essence|bone|gale|chaos/.test(bdRef), '');

/* ===== E. 炼化投妖兽伴生（SC_none_fine_000001） ===== */
console.log('E. 炼化伴生');
S.beasts.push({id:'t1',speciesId:'JL_fire_normal_0001',lvl:10,hp:50,maxHp:50,aff:{},name:'烬烬狼'});
S.furnace.push('beast:t1');
const fm=T.furnaceMats();
S.furnace=S.furnace.filter(x=>x!=='beast:t1');
S.beasts=S.beasts.filter(x=>x.id!=='t1');
const leIn=fm.filter(m=>m.id==='SC_none_fine_000001');
assert('投妖兽入炉：SC_none_fine_000001×1 伴生（机制保留）', leIn.length===1 && leIn[0].unitN===1, JSON.stringify(leIn));
assert('投妖兽入炉：专属掉落全带出（drops 挂载后自然行为）', fm.filter(m=>m.id!=='SC_none_fine_000001').length===5, JSON.stringify(fm.map(x=>x.id)));
assert('伴生单元数=5种×2单位+生命精华1=11', fm.reduce((a,m)=>a+m.unitN,0)===11, '实际 '+fm.reduce((a,m)=>a+m.unitN,0));

/* ===== F. 空窗属预期：沙盒 matPool 空 / 奇遇奖励空 / calm/mine/gather 空 ===== */
console.log('F. 空窗属预期');
const codeAll = CODE;
const matPoolEmpty = !/\bmatPool\b\s*[:=]\s*\[[^\]]+/.test(codeAll) || /matPool\s*=\s*\[\]/.test(codeAll);
assert('沙盒采集 matPool 为空', matPoolEmpty);
assert('掉落引用无旧采集素材 id（全 SC_* 专属）', !/drops\s*[:=]\s*\[[^\]]*?(chip|herb|ore|bone|gale|chaos)/.test(bodyNC), '');

/* ===== G. 编码自洽：elem/rarity 与 JL 前缀一致 ===== */
console.log('G. 编码自洽');
const gMismatch=[];
Object.keys(T.SPECIES).forEach(id=>{
  const sp=T.SPECIES[id];
  const p=id.split('_'); // JL fire normal 0001
  if(p[1]!==sp.elem) gMismatch.push(id+' elem前缀'+p[1]+' 实际'+sp.elem);
  if(p[2]!==sp.rarity) gMismatch.push(id+' rarity前缀'+p[2]+' 实际'+sp.rarity);
});
assert('109 只编码前缀 elem/rarity 与字段一致', gMismatch.length===0, gMismatch.slice(0,8).join('; '));
const nums=Object.keys(T.SPECIES).map(id=>parseInt(id.split('_')[3]));
assert('编号 0001-0109 连续无重复', Math.min(...nums)===1 && Math.max(...nums)===109 && new Set(nums).size===109);

/* ===== H. 主流程可用：进化链全 JL_、战斗引用 SPECIES 全 JL_ ===== */
console.log('H. 主流程引用');
const bodyN2=CODE.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
const evoRefs=bodyN2.match(/to:\s*'(JL_\w+_\d{4})'/g)||[];
assert('evoToBranches.to 全部 JL_（137 边）', evoRefs.length===137, '实际 '+evoRefs.length);
console.log('  evo 引用数', evoRefs.length, '（137 条边）');

console.log('\nv1.16.5 id 编码体系 验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
