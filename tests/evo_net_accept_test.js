/* v1.16.0 M3-1-2 进化网络 + 精灵图鉴扩充 独立验收脚本
   验收标准：req-docs/需求文档_M3-1-2进化网络_2026-09-17.md（冻结版）
   §2 改名表 / §4.3 130 边 / §4.4 mat 消耗表 / §4.5 24 条 stat 边 / §5.2 45 只种族值 / §5.4 技能池 / §5.5 图鉴占位
   分组 A-L；只校验记录，不改代码不动数值 */
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
let code = require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,SPECIES,allSpecies,allSpeciesDef,evoBranchesOf,evoCondOk,evoCondText,matUnitSum,deductMatUnits,unitOf,matInfo,matAny,makeSpirit,evolveSpirit,spiritStats,QUALITY_RANK,matState};`);
eval(code);
const T=globalThis.__T;
const S=T.S;
const mkSp=(id)=>{ const sp=T.makeSpirit(id,false,'t'); sp.lvl=1; return sp; };

/* ===== A. 图鉴规模 ===== */
console.log('A. 图鉴规模');
const all=T.allSpecies();
assert('SPECIES 总数 109（66-删2+新45）', all.length===109, '实际 '+all.length);
const legends=all.filter(x=>x.rarity==='legend');
assert('传说 3 只（混沌兽/血月侯/南瓜王）', legends.length===3 && ['JL_dark_legend_0107','JL_dark_legend_0108','JL_fire_legend_0109'].every(id=>all.some(x=>x.id===id)), legends.map(x=>x.id).join(','));
assert('JL_water_perfect_0086 保留（寒岁）', all.some(x=>x.id==='JL_water_perfect_0086' && x.name==='寒岁'));
assert('coldjiao / coldjiao_p 已删除', !all.some(x=>x.id==='coldjiao'||x.id==='coldjiao_p'));
const NEW_IDS=['JL_ice_normal_0004','JL_ice_elite_0005','JL_water_normal_0012','JL_earth_normal_0013','JL_water_elite_0014','JL_earth_perfect_0015','JL_wind_normal_0019','JL_dark_normal_0020','JL_wind_elite_0021','JL_dark_perfect_0022','JL_ice_normal_0026','JL_dark_normal_0027','JL_fire_elite_0028','JL_fire_perfect_0029','JL_fire_normal_0036','JL_fire_elite_0037','JL_light_normal_0044','JL_light_elite_0045','JL_fire_normal_0049','JL_water_normal_0050','JL_light_elite_0051','JL_light_perfect_0052','JL_dark_normal_0059','JL_poison_normal_0060','JL_dark_elite_0061','JL_dark_perfect_0062','JL_dark_normal_0066','JL_poison_normal_0067','JL_poison_elite_0068','JL_dark_perfect_0069','JL_poison_normal_0073','JL_ice_normal_0074','JL_poison_elite_0075','JL_poison_perfect_0076','JL_wind_normal_0083','JL_dark_normal_0084','JL_water_elite_0085','JL_ice_normal_0090','JL_earth_normal_0091','JL_ice_elite_0092','JL_light_perfect_0093','JL_poison_normal_0097','JL_dark_normal_0098','JL_dark_elite_0099','JL_dark_perfect_0100'];
assert('新增 45 只精灵全部在册', NEW_IDS.every(id=>all.some(x=>x.id===id)), '缺失='+NEW_IDS.filter(id=>!all.some(x=>x.id===id)).join('/'));

/* ===== B. 45 只新精灵种族值（§5.2 全表） ===== */
console.log('B. 45 只新精灵种族值 §5.2');
/* name: [rarity, elem, hp, atk, def, spa, sdef, spe] */
const NEW_TABLE = {
  '霜霜狼':['normal','ice',52,70,45,45,42,80], '雪脊':['elite','ice',66,96,58,54,52,98],
  '滴答龟':['normal','water',78,48,88,50,62,22], '当当龟':['normal','earth',72,55,92,42,60,28],
  '息涛':['elite','water',95,60,112,55,78,24], '镇岳':['perfect','earth',115,75,145,45,95,32],
  '哨哨雀':['normal','wind',48,50,42,68,42,95], '影影雀':['normal','dark',48,48,42,72,44,92],
  '哨谷':['elite','wind',58,62,48,85,48,112], '落星':['perfect','dark',70,60,55,128,58,140],
  '雪雪狐':['normal','ice',52,48,46,74,58,72], '荧荧狐':['normal','dark',50,50,44,76,52,74],
  '化雪':['elite','fire',60,54,52,96,66,84], '九焰':['perfect','fire',72,58,58,128,80,112],
  '烙烙虎':['normal','fire',62,78,55,42,45,62], '吼山':['elite','fire',75,100,68,48,52,78],
  '晃晃雕':['normal','light',55,74,48,50,44,82], '鎏山':['elite','light',66,94,56,58,50,104],
  '噗噗犀':['normal','fire',74,72,80,40,52,28], '泡泡犀':['normal','water',82,55,85,42,58,20],
  '引矿':['elite','light',88,82,105,45,62,30], '驮日':['perfect','light',108,105,132,48,78,34],
  '忽忽蝠':['normal','dark',48,55,42,66,44,92], '嘶嘶蝠':['normal','poison',46,50,42,70,44,94],
  '穿影':['elite','dark',56,68,48,86,48,115], '长夜':['perfect','dark',66,85,52,122,55,140],
  '呜呜骨':['normal','dark',56,76,52,40,44,70], '绿绿骸':['normal','poison',54,72,50,48,52,62],
  '陷阵':['elite','poison',68,96,70,52,58,82], '葬龙':['perfect','dark',100,122,118,45,72,48],
  '麻麻蛛':['normal','poison',50,52,46,74,48,68], '晶晶蛛':['normal','ice',48,48,46,76,48,68],
  '三日':['elite','poison',58,58,52,96,56,82], '噬梦':['perfect','poison',70,62,60,132,68,108],
  '飘飘蛇':['normal','wind',50,48,44,70,46,88], '黢黢蛇':['normal','dark',52,50,46,72,48,76],
  '分水':['elite','water',70,52,70,90,68,58],
  '簌簌鹿':['normal','ice',54,48,46,72,56,82], '静静鹿':['normal','earth',70,58,78,42,58,44],
  '引雪':['elite','ice',64,54,54,94,66,100], '白泽':['perfect','light',80,55,62,138,88,90],
  '滋滋灵':['normal','poison',50,48,46,72,52,70], '游魂':['normal','dark',48,44,44,86,50,66],
  '引灯':['elite','dark',58,54,50,94,58,92], '无常':['perfect','dark',70,54,52,140,68,126],
};
let miss=0, bad=[];
for(const nm in NEW_TABLE){
  const sp = all.find(x=>x.name===nm);
  if(!sp){ miss++; bad.push(nm+'（缺）'); continue; }
  const [rarity,elem,hp,atk,def,spa,sdef,spe]=NEW_TABLE[nm];
  if(sp.rarity!==rarity||sp.elem!==elem||sp.stats.hp!==hp||sp.stats.atk!==atk||sp.stats.def!==def||sp.stats.spa!==spa||sp.stats.sdef!==sdef||sp.speed!==spe){
    bad.push(nm+' (rarity:'+sp.rarity+'/'+rarity+' elem:'+sp.elem+'/'+elem+' hp:'+sp.stats.hp+'/'+hp+' atk:'+sp.stats.atk+'/'+atk+' def:'+sp.stats.def+'/'+def+' spa:'+sp.stats.spa+'/'+spa+' sdef:'+sp.stats.sdef+'/'+sdef+' spe:'+sp.speed+'/'+spe+')');
  }
}
assert('45 只种族值/属性/品级/速度与 §5.2 全表一致', miss===0 && bad.length===0, '不一致 '+bad.slice(0,6).join('; '));

/* ===== C. 9 只改名 + 旧名零残留 ===== */
console.log('C. 9 只改名');
const RENAME = {'JL_fire_perfect_0003':'烬霄','JL_fire_perfect_0008':'吞月','JL_thunder_perfect_0032':'霆君','JL_earth_perfect_0048':'山行','JL_fire_perfect_0055':'南瓜大君','JL_light_perfect_0089':'启明','JL_poison_perfect_0103':'万毒巫后','JL_fire_elite_0017':'燎山','JL_fire_perfect_0018':'烧云'};
let rnBad=[];
for(const id in RENAME){ const sp=all.find(x=>x.id===id); if(!sp||sp.name!==RENAME[id]) rnBad.push(id+':'+(sp&&sp.name)); }
assert('9 只改名后 name 正确', rnBad.length===0, rnBad.join(';'));
const OLD_NAMES = ['焚天魔狼','血月狼神','天雷神豹','大地岩魔','南瓜魔主','圣辉天鹿','万毒魔女','火羽凤','焚天凰'];
const oldHits = OLD_NAMES.filter(n=>code.includes(n));
assert('旧名全文件零残留', oldHits.length===0, '残留 '+oldHits.join('/'));
assert('改名不改变 speciesId', ['JL_fire_perfect_0003','JL_fire_perfect_0008','JL_thunder_perfect_0032','JL_earth_perfect_0048','JL_fire_perfect_0055','JL_light_perfect_0089','JL_poison_perfect_0103','JL_fire_elite_0017','JL_fire_perfect_0018'].every(id=>all.some(x=>x.id===id)));

/* ===== D. 寒岁升级 ===== */
console.log('D. 寒岁（JL_water_perfect_0086 升级 perfect 终端）');
const cjn = all.find(x=>x.id==='JL_water_perfect_0086');
assert('JL_water_perfect_0086 品级 perfect', cjn && cjn.rarity==='perfect', cjn&&cjn.rarity);
assert('JL_water_perfect_0086 属性水', cjn && cjn.elem==='water', cjn&&cjn.elem);
assert('JL_water_perfect_0086 名寒岁', cjn && cjn.name==='寒岁');
assert('JL_water_perfect_0086 有进化入边（蛇族三段终端）', all.some(x=>(x.evoToBranches||[]).some(b=>b.to==='JL_water_perfect_0086')), '');

/* ===== E. evoToBranches 130 条 ===== */
console.log('E. 进化边（§4.3 表求和 137；文档标题 130 为笔误，以表为准）');
let total=0, dangling=[];
for(const sp of all){
  for(const b of (sp.evoToBranches||[])){
    total++;
    if(!all.some(x=>x.id===b.to)) dangling.push(sp.id+'→'+b.to);
  }
}
assert('进化边总数 = §4.3 表求和 137', total===137, '实际 '+total);
assert('无悬空目标（全部 to 存在）', dangling.length===0, dangling.join(';'));
const statEdges=[];
for(const sp of all) for(const b of (sp.evoToBranches||[])){
  for(const c of (b.cond||[])) if(c.type==='stat') statEdges.push({from:sp.id,to:b.to,k:c.k,v:c.v});
}
assert('stat 边全量（所有进化边都挂 stat，v1.16.7 新口径）', statEdges.length===137, '实际 '+statEdges.length);
/* 规则化全量检查 137 条：lvl/aff 按 §4.2 档位（主线 N→E 30/60、E→P 45/80；异变 35/70、50/90），
   mat 按 §4.4 档位（主线 10/5 q0、20/10 q1；异变 20/8 q1、35/12 q2） */
const ruleBad=[];
for(const sp of all){
  for(const b of (sp.evoToBranches||[])){
    const tg=all.find(x=>x.id===b.to);
    const same = sp.elem===tg.elem;
    const stage = sp.rarity==='normal' ? 'NE' : 'EP';
    const wantLvl = same ? (stage==='NE'?30:45) : (stage==='NE'?35:50);
    const wantAffElem = same ? sp.elem : tg.elem;
    const wantAff = same ? (stage==='NE'?60:80) : (stage==='NE'?70:90);
    const wantMat = same
      ? (stage==='NE' ? [[10,0],[5,0]] : [[20,1],[10,1]])
      : (stage==='NE' ? [[20,1],[8,1]] : [[35,2],[12,2]]);
    const lc=(b.cond||[]).find(c=>c.type==='lvl'), ac=(b.cond||[]).find(c=>c.type==='aff');
    const mats=(b.cond||[]).filter(c=>c.type==='mat');
    const m1=mats[0], m2=mats[1];
    if(!lc||lc.v!==wantLvl) ruleBad.push(sp.id+'→'+b.to+' lvl:'+(lc&&lc.v)+'(want'+wantLvl+')');
    if(!ac||ac.elem!==wantAffElem||ac.v!==wantAff) ruleBad.push(sp.id+'→'+b.to+' aff:'+(ac&&(ac.elem+'/'+ac.v))+'(want'+wantAffElem+'/'+wantAff+')');
    const mStr = mats.map(function(m){return m.elem+'/'+m.v+'/'+m.qRank;}).join(',');
    const wStr = wantMat.map(function(m){return wantAffElem+'/'+m[0]+'/'+m[1];}).join(',');
    if(!m1||!m2||m1.elem!==wantAffElem||m1.v!==wantMat[0][0]||m1.qRank!==wantMat[0][1]||m2.elem!==wantAffElem||m2.v!==wantMat[1][0]||m2.qRank!==wantMat[1][1])
      ruleBad.push(sp.id+'>'+b.to+' mat:['+mStr+'] want['+wStr+']');
  }
}
assert('137 条边 lvl/aff/mat 全量符合 §4.2/§4.4 档位规则', ruleBad.length===0, ruleBad.slice(0,6).join('; '));

/* ===== F. 24 条 stat 边数值（§4.5 表） ===== */
console.log('F. 24 条跨偏向边 stat 数值 §4.5');
const STAT_TABLE = [
  ['JL_fire_normal_0001','JL_ice_elite_0005','spe',65], ['JL_fire_normal_0006','JL_ice_elite_0005','spe',65],
  ['JL_ice_normal_0004','JL_fire_elite_0002','atk',94], ['JL_ice_normal_0004','JL_fire_elite_0007','atk',90],
  ['JL_ice_elite_0005','JL_fire_perfect_0003','atk',121], ['JL_ice_elite_0005','JL_fire_perfect_0008','atk',119],
  ['JL_fire_normal_0036','JL_thunder_elite_0031','spe',108], ['JL_fire_elite_0037','JL_thunder_perfect_0032','spe',139],
  ['JL_fire_elite_0037','JL_thunder_perfect_0035','spe',143],
  ['JL_earth_normal_0063','JL_poison_elite_0068','atk',64], ['JL_dark_normal_0066','JL_earth_elite_0064','def',90], ['JL_poison_normal_0067','JL_earth_elite_0064','def',90],
  ['JL_earth_elite_0064','JL_dark_perfect_0069','atk',114], ['JL_poison_elite_0068','JL_earth_perfect_0065','def',117],
  ['JL_wind_normal_0083','JL_poison_elite_0081','spa',99], ['JL_wind_normal_0083','JL_water_elite_0085','spa',85],
  ['JL_dark_normal_0084','JL_water_elite_0085','spa',85], ['JL_dark_normal_0084','JL_poison_elite_0081','spa',99],
  ['JL_light_normal_0087','JL_ice_elite_0092','spe',67], ['JL_ice_normal_0090','JL_light_elite_0088','spa',99],
  ['JL_earth_normal_0091','JL_light_elite_0088','spa',99], ['JL_earth_normal_0091','JL_ice_elite_0092','spe',94],
  ['JL_ice_elite_0092','JL_light_perfect_0093','spa',128], ['JL_ice_elite_0092','JL_light_perfect_0089','spa',132],
];
let stBad=[];
for(const [f,to,k,v] of STAT_TABLE){
  const sp=all.find(x=>x.id===f);
  const b=sp&&(sp.evoToBranches||[]).find(x=>x.to===to);
  const c=b&&(b.cond||[]).find(x=>x.type==='stat'&&x.k===k);
  if(!c||c.v!==v) stBad.push(f+'→'+to+' '+k+'='+(c&&c.v)+'(期望'+v+')');
}
assert('24 条 stat 边数值与 §4.5 表一致', stBad.length===0, stBad.slice(0,8).join('; '));

/* ===== G. mat 条件判定（matUnitSum / unitOf / 品质门槛） ===== */
console.log('G. mat 条件判定');
const clr=()=>{ for(const k in T.matState) delete T.matState[k]; };
clr();
// v1.16.5: 旧 flame/terra 已删，注册临时 fire/fine 与 earth/fine 素材
T.S.customMats['tst_fine_fire']={id:'tst_fine_fire',name:'测试火材精良',elem:'fire',quality:'fine',type:'plant',tags:[],count:0,desc:'t'};
T.S.customMats['tst_earth_fine']={id:'tst_earth_fine',name:'测试土材精良',elem:'earth',quality:'fine',type:'plant',tags:[],count:0,desc:'t'};
T.matState['tst_fine_fire']=10;
assert('matUnitSum(fire,0) 统计 flame 10 单位', T.matUnitSum('fire',0)===10, T.matUnitSum('fire',0));
assert('matUnitSum(fire,2) 统计 fine+ 素材', T.matUnitSum('fire',2)===10, T.matUnitSum('fire',2));
clr();
/* 找一个带巨量 tag 的素材：直接构造进 matInfo 不可行，改测 unitOf 语义 */
const mTest = {tags:['巨量']};
assert('unitOf 巨量=5', T.unitOf(mTest)===5, T.unitOf(mTest));
const mTest2 = {tags:['大量']};
assert('unitOf 大量=3', T.unitOf(mTest2)===3, T.unitOf(mTest2));
const mTest3 = {tags:['少量']};
assert('unitOf 少量=0.5', T.unitOf(mTest3)===0.5, T.unitOf(mTest3));
const mTest4 = {tags:[]};
assert('unitOf 默认=1', T.unitOf(mTest4)===1, T.unitOf(mTest4));

/* ===== H. deductMatUnits 从低品质到高品质扣 ===== */
console.log('H. 进化素材扣减');
clr();
T.matState['tst_fine_fire']=5; T.matState['tst_earth_fine']=2;   // terra earth/fine, flame fire/fine（不同 elem）
// 只扣 fire：flame 5 全扣
T.deductMatUnits('fire',0,6);
assert('扣 6 单位：flame 5 全扣（库存不足扣完即止）', T.matState['tst_fine_fire']===0, JSON.stringify(T.matState));
clr();
T.matState['tst_fine_fire']=3;
T.deductMatUnits('fire',0,10);
assert('库存不足时扣完即止不报错', T.matState['tst_fine_fire']===0, JSON.stringify(T.matState));
clr();

/* ===== I. evolveSpirit 进化结算 ===== */
console.log('I. 进化结算（条件/扣素材/切换）');
const evSp = T.makeSpirit('JL_fire_normal_0001',false,'t');
evSp.lvl=30; evSp.aff={fire:60}; evSp.iv={atk:31}; evSp.nature='hardy';
clr(); T.matState['tst_fine_fire']=15;   // fire/fine 15 ≥ 10+5（qRank0/1 都满足）
const r1 = T.evolveSpirit(evSp,'JL_fire_elite_0002');
assert('条件满足→进化成功', r1.ok===true, JSON.stringify(r1));
assert('进化扣素材（15→0）', T.matState['tst_fine_fire']===0, JSON.stringify(T.matState));
assert('speciesId 切换 JL_fire_elite_0002', evSp.speciesId==='JL_fire_elite_0002', evSp.speciesId);
assert('name 切换 老烬', evSp.name==='老烬', evSp.name);
assert('elem 保持火', evSp.elem==='fire', evSp.elem);
const evSp2 = T.makeSpirit('JL_fire_normal_0001',false,'t');
evSp2.lvl=20; evSp2.aff={fire:60};
clr(); T.matState['tst_fine_fire']=15;
const r2 = T.evolveSpirit(evSp2,'JL_fire_elite_0002');
assert('等级不足→拒绝', r2.ok===false && r2.msg==='进化条件未满足', JSON.stringify(r2));
assert('拒绝时素材不扣', T.matState['tst_fine_fire']===15, JSON.stringify(T.matState));
const evSp3 = T.makeSpirit('JL_fire_normal_0001',false,'t');
evSp3.lvl=30; evSp3.aff={fire:60}; evSp3.iv={atk:31}; evSp3.nature='hardy';
clr(); T.matState['tst_fine_fire']=3;    // 不足 15
const r3 = T.evolveSpirit(evSp3,'JL_fire_elite_0002');
assert('素材不足→拒绝', r3.ok===false && r3.msg==='进化条件未满足', JSON.stringify(r3));
assert('素材不足拒绝不扣', T.matState['tst_fine_fire']===3, JSON.stringify(T.matState));
const evSp4 = T.makeSpirit('JL_fire_normal_0001',false,'t');
evSp4.lvl=30; evSp4.aff={fire:60}; evSp4.iv={atk:31}; evSp4.nature='hardy';
clr(); T.matState['tst_fine_fire']=30;
const r4 = T.evolveSpirit(evSp4,'JL_ice_elite_0005');   // 异变：需冰系
assert('异变缺目标系素材→拒绝（冰 0）', r4.ok===false, JSON.stringify(r4));
assert('异变拒绝不扣火素材', T.matState['tst_fine_fire']===30, JSON.stringify(T.matState));
clr();

/* ===== J. 技能池清空 ===== */
console.log('J. 专属技能池清空（字段保留为空）');
let skBad=[];
for(const sp of all){
  if(sp.skills!==undefined && (!Array.isArray(sp.skills) || sp.skills.length>0)) skBad.push(sp.id);
}
assert('SPECIES 全条目 skills 字段为空（无配置）', skBad.length===0, skBad.join(','));

/* ===== K. 新精灵图鉴 desc 占位 ===== */
console.log('K. 新精灵 desc 占位');
const newNames=Object.keys(NEW_TABLE);
const emptyDesc = newNames.filter(nm=>{ const sp=all.find(x=>x.name===nm); return sp && (sp.desc||'')!==''; });
assert('45 只新精灵 desc 全部填充（v1.16.3 已补）', emptyDesc.length===45, emptyDesc.length+'/45');

/* ===== L. 命名黑名单 ===== */
console.log('L. 命名黑名单（圣/神/魔）');
const banned=['圣','神','魔'];
const bannedHits = all.filter(sp=>banned.some(b=>sp.name.includes(b))).map(sp=>sp.name);
assert('全图鉴名称不含 圣/神/魔', bannedHits.length===0, bannedHits.join(','));

console.log('\nv1.16.0 进化网络+图鉴扩充验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
