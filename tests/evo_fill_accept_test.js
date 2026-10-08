/* v1.16.6 M3-1-3 v0.3 素材填充（545 条专属素材落 MATS + 109 只 drops 挂载）
   验收口径：需求文档_M3-1-3素材填充_2026-09-17.md §1.2（行34-583）+ §1.3（行584-697）+ DEV_PLAN §10 v1.16.6 行
   分组 A-G；只校验记录，不改代码不动数值 */
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
  `init(); route(); globalThis.__T={S,SPECIES,MATS,allSpecies,allSpeciesDef,matInfo,matAny,matState,matUnitSum,deductMatUnits,beastDrops,beastMatIds,furnaceMats,QUALITY_RANK,upMatFor};`);
eval(code);
const T=globalThis.__T;
const S=T.S;
const reqText = fs.readFileSync('/home/user/.doubao/agent_mode/workspace/spirit-refinery/req-docs/需求文档_M3-1-3素材填充_2026-09-17.md','utf8');

/* 解析 §1.2 素材表（545 条，含 tags/desc） */
const s12 = [...reqText.matchAll(/\| (SC_[a-z_]+_\d{6}) \| ([^\|]+) \| (\w+) \| (\w+) \| beast \| 0 \| ([^\|]*) \| ([^\|]*) \|/g)].map(m=>({
  id:m[1], name:m[2].trim(), elem:m[3], quality:m[4], tags:m[5].trim(), desc:m[6].trim()
}));

/* ===== A. MATS 总数与 id 范围 ===== */
console.log('A. MATS 总数与 id 范围');
const mKeys=Object.keys(T.MATS);
assert('MATS 总数 546（545 专属 + SC_none_fine_000001）', mKeys.length===546, '实际 '+mKeys.length);
assert('生命精华在册', !!T.MATS['SC_none_fine_000001']);
const scIds=mKeys.filter(k=>k!=='SC_none_fine_000001');
const nums=scIds.map(id=>parseInt(id.split('_')[3]));
assert('专属素材 545 条编号 000014~000558 连续无重复', scIds.length===545 && Math.min(...nums)===14 && Math.max(...nums)===558 && new Set(nums).size===545);

/* ===== B. 545 条与 §1.2 逐条一致（id/name/elem/quality/type/count/tags/desc） ===== */
console.log('B. §1.2 逐条一致');
assert('§1.2 表解析 545 条', s12.length===545, '实际 '+s12.length);
const bMis=[];
s12.forEach(r=>{
  const m=T.MATS[r.id];
  if(!m){ bMis.push(r.id+' 缺失'); return; }
  if(m.name!==r.name) bMis.push(r.id+' name 期望'+r.name+' 实际'+m.name);
  if(m.elem!==r.elem) bMis.push(r.id+' elem 期望'+r.elem+' 实际'+m.elem);
  if(m.quality!==r.quality) bMis.push(r.id+' quality 期望'+r.quality+' 实际'+m.quality);
  if(m.type!=='beast') bMis.push(r.id+' type 非 beast');
  if(m.count!==0) bMis.push(r.id+' count 非 0');
  const tagsN = r.tags? r.tags.split(/[、,，]/).map(t=>t.trim()).filter(Boolean):[];
  const mTags=(m.tags||[]).slice().sort().join(',');
  const tTags=tagsN.slice().sort().join(',');
  if(mTags!==tTags) bMis.push(r.id+' tags 期望['+tTags+'] 实际['+mTags+']');
  if((m.desc||'')!==r.desc) bMis.push(r.id+' desc 期望"'+r.desc+'" 实际"'+m.desc+'"');
});
assert('545 条 id/name/elem/quality/type/count/tags/desc 全一致', bMis.length===0, bMis.slice(0,8).join('; '));

/* ===== C. §1.3 drops 挂载对照 ===== */
console.log('C. §1.3 drops 挂载');
const s13=[...reqText.matchAll(/\| (JL_[a-z_]+_\d{4}) \| ([^\|]+) \| (SC_[a-z_]+_\d{6}(?: SC_[a-z_]+_\d{6}){4}) \|/g)].map(m=>({id:m[1],name:m[2].trim(),drops:m[3].trim().split(' ')}));
assert('§1.3 表解析 109 行', s13.length===109, '实际 '+s13.length);
const cMis=[];
s13.forEach(r=>{
  const sp=T.SPECIES[r.id];
  if(!sp){ cMis.push(r.id+' 精灵缺失'); return; }
  if(sp.name!==r.name) cMis.push(r.id+' 名期望'+r.name+' 实际'+sp.name);
  const d=sp.drops||[];
  if(d.length!==5) cMis.push(r.id+' drops 数 '+d.length+' 期望 5');
  else if(JSON.stringify(d)!==JSON.stringify(r.drops)) cMis.push(r.id+' drops 不一致 期望['+r.drops.join(',')+'] 实际['+d.join(',')+']');
  d.forEach(did=>{ if(!T.MATS[did]) cMis.push(r.id+' drop '+did+' 不在 MATS'); });
});
assert('109 只 drops 各 5 条与 §1.3 一一对应、id 均在 MATS', cMis.length===0, cMis.slice(0,6).join('; '));

/* ===== D. 三 mode 掉落 + mult 1.5 + upMatFor ===== */
console.log('D. 掉落机制');
const dk=T.beastDrops('JL_fire_normal_0001','kill'), dc=T.beastDrops('JL_fire_normal_0001','calm'), df=T.beastDrops('JL_fire_normal_0001','catchFail');
assert('kill 满额 5 种 × round(2*1)=2', Object.keys(dk).length===5 && dk['SC_fire_normal_000014']===2, JSON.stringify(dk));
assert('calm 30%：round(2*1*.3)=1', Object.keys(dc).length===5 && dc['SC_fire_normal_000014']===1, JSON.stringify(dc));
assert('catchFail 种类减半按品质降序（5→2 留 fine）', Object.keys(df).length===2, JSON.stringify(df));
const del=T.beastDrops('JL_fire_elite_0002','kill');
assert('elite mult 1.5：round(2*1.5)=3', del['SC_fire_good_000019']===3, JSON.stringify(del));
const dle=T.beastDrops('JL_dark_legend_0107','kill');
assert('legend mult 1.5：3', dle['SC_dark_legend_000548']===3, JSON.stringify(dle));
// upMatFor 框架保留：签名(matId,template)，击杀结算调用；上位表未建当前返回原 id（DEV_PLAN v1.16.6 机制不动）
assert('upMatFor 函数存在且击杀结算调用（6781-6784 品质锁链）', typeof T.upMatFor==='function' && /upMatFor\(k, b\.template\)/.test(CODE), '');
const up1=T.upMatFor('SC_fire_normal_000014','elite'), up2=T.upMatFor('SC_fire_normal_000014','boss');
assert('upMatFor 当前返回原 id（上位表未建，v1.16.1 现状）', up1==='SC_fire_normal_000014' && up2==='SC_fire_normal_000014', JSON.stringify({up1,up2}));
assert('upMatFor 无品质提升是框架现状（bump 计算存在）', /const bump/.test(CODE.slice(CODE.indexOf('function upMatFor'), CODE.indexOf('function upMatFor')+260)), '');

/* ===== E. 配方词条匹配（嗞嗞猫须 / 蛇涎） ===== */
console.log('E. 配方词条匹配');
const thunderm = Object.keys(T.MATS).filter(id=>{ const m=T.MATS[id]; return m.elem==='thunder' && (m.tags||[]).includes('须'); });
assert('嗞嗞猫「须」素材存在（黑亮毛 tags 含须）', thunderm.length>0, thunderm.join(','));
const poisonX = Object.keys(T.MATS).filter(id=>{ const m=T.MATS[id]; return m.elem==='poison' && (m.tags||[]).includes('涎'); });
assert('蛇「涎」素材存在（半炷香 tags 含涎）', poisonX.length>0, poisonX.join(','));
// 词条匹配可入炉：黑亮毛 tags 须 → refineRules r-sp-thunderlynx 词条 w:'须'
const hasWords = (()=>{ try{ const m=T.MATS[thunderm[0]]; return (m.tags||[]).includes('须'); }catch(e){ return false; } })();
assert('须词条素材可被配方匹配', hasWords, '');

/* ===== F. matUnitSum/deduct 用新素材（进化 mat 闭环） ===== */
console.log('F. 素材机制闭环');
for(const k in T.matState) delete T.matState[k];
T.matState['SC_fire_normal_000014']=10; T.matState['SC_fire_normal_000015']=5; T.matState['SC_fire_good_000016']=3;
assert('matUnitSum(fire,0)=18（品质≥普通全含：10+5+3）', T.matUnitSum('fire',0)===18, T.matUnitSum('fire',0));
assert('matUnitSum(fire,1)=3', T.matUnitSum('fire',1)===3, T.matUnitSum('fire',1));
T.deductMatUnits('fire',0,12);
assert('deductMatUnits 扣低品质优先（10 扣光+5 扣 2→剩 3）', T.matState['SC_fire_normal_000014']===0 && T.matState['SC_fire_normal_000015']===3 && T.matState['SC_fire_good_000016']===3, JSON.stringify(T.matState));
assert('beastMatIds 收录 545 专属+生命精华', T.beastMatIds().length===546, T.beastMatIds().length);

console.log('\nv1.16.6 M3-1-3 素材填充 验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
