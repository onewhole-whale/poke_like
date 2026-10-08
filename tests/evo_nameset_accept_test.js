/* v1.16.3 精灵全设定落地（改名+三字段填充）独立验收脚本
   验收口径：req-docs/需求文档_M3-1-2进化网络_2026-09-17.md 第 7 章 §0 对照表（87 改 + 22 保留）
   + DEV_PLAN §10 v1.16.3 行。分组 A-E；只校验记录，不改代码不动数值 */
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
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,'init(); route(); globalThis.__T={allSpecies};');
eval(code);
const all=globalThis.__T.allSpecies();
const byId = {}; all.forEach(sp=>byId[sp.id]=sp);
const nameSet = new Set(all.map(sp=>sp.name));

/* ===== 第 7 章 §0 对照表（87 条 旧名→新名） ===== */
const RENAME = {
  '炎狼':'烬烬狼','炽焰狼王':'老烬','焚天狼皇':'烬霄','血月天狼':'吞月','霜狼':'霜霜狼','霜鬃狼王':'雪脊',
  '熔岩龟':'咕嘟龟','熔岩巨龟':'沸河','炎狱龙龟':'不周','玄水龟':'滴答龟','镇水玄龟':'息涛','镇岳玄龟':'镇岳','金甲龟':'当当龟',
  '赤羽雀':'燎雀','赤翎雉':'燎山','锦焰雉王':'烧云','青羽雀':'哨哨雀','翎青雉':'哨谷','玄羽雀':'影影雀','玄翎雉皇':'落星',
  '水灵狐':'露露狐','潮汐狐':'潮歌','沧海灵狐':'沧海谣','雪狐':'雪雪狐','赤尾狐':'化雪','妖狐':'荧荧狐','九尾狐':'九焰',
  '电灵猫':'嗞嗞猫','夜瞳猫':'灯灯猫','焰纹虎':'烙烙虎','雷光豹':'逐雷','夜煞猫':'无影','炎鬃虎':'吼山','天雷豹皇':'霆君','夜渊噬影猫':'噬夜',
  '雷枭':'轰枭','雷鹰王':'巢雷','万雷天枭':'霆穹','风隼':'嗖隼','疾风隼王':'穿风','罡风天隼':'停风','金羽雕':'晃晃雕','鎏金鹰王':'鎏山',
  '岩甲犀':'咚咚犀','铁甲犀王':'开山','大地岩皇':'山行','蛮火犀':'噗噗犀','辉角犀':'引矿','泞泽犀':'泡泡犀','曜日犀':'驮日',
  '幽蝠':'悄悄蝠','暗夜蝠王':'月刃','血翼幽蝠':'蔽月','影蝠':'忽忽蝠','冥影蝠':'穿影','毒蝠':'嘶嘶蝠','冥夜蝠皇':'长夜',
  '枯骨侍':'咔咔骨','枯骨骑士':'断旗','骨龙骑士':'同归','骨狼':'呜呜骨','骸骨战将':'陷阵','怨骸':'绿绿骸','渊骨龙皇':'葬龙',
  '毒牙蛛':'麻麻蛛','银霜蛛':'晶晶蛛','影蛛后':'牵影','毒丝蛛后':'三日','暗影蛛皇':'网夜','噬魂蛛皇':'噬梦',
  '雾瘴蛇':'晕晕蛇','腾蛇':'飘飘蛇','玄蛇':'黢黢蛇','时空蛇':'噬年','玄水蟒':'分水','寒潭蛟':'寒岁',
  '星尘鹿':'莹莹鹿','星辉鹿':'踏星','辉光天鹿':'启明','霜角鹿':'簌簌鹿','霜翎鹿':'引雪','林麋鹿':'静静鹿',
  '夜哭灵':'呜呜灵','哭丧灵':'烛泪','幽冥哭主':'哭尽','怨灵':'滋滋灵','引渡使':'引灯'};
const KEEP = ['月嚎狼','狼嚎客','织影蛛','蚀时之蛇','白泽','游魂','无常',
  '南瓜妖','南瓜巫灵','南瓜大君','拾穗人','丰收使者','麦田守望者',
  '药童巫','扫帚巫','万毒巫后','木乃伊童','缠纱使','不朽法老',
  '混沌兽','血月侯','南瓜王'];

/* ===== A. name 对照表（87 改 + 22 保留） ===== */
console.log('A. 名称对照表');
assert('改名条数=87、保留条数=22（合计 109）', Object.keys(RENAME).length===87 && KEEP.length===22);
const newNames = Object.values(RENAME);
const missing = newNames.filter(n=>!nameSet.has(n));
assert('87 个新名全部出现在 SPECIES', missing.length===0, '缺失='+missing.join('/'));
const oldLeft = Object.keys(RENAME).filter(o=>nameSet.has(o));
assert('87 个旧名在 SPECIES.name 中零残留', oldLeft.length===0, '残留='+oldLeft.join('/'));
const keepMissing = KEEP.filter(k=>!nameSet.has(k));
assert('22 个保留名全部存在', keepMissing.length===0, '缺失='+keepMissing.join('/'));
const allNames = new Set([...newNames, ...KEEP]);
const total = all.filter(sp=>allNames.has(sp.name)).length;
assert('109 只 name 全部 ∈ {87 新名 + 22 保留名}（无表外名）', total===109, '匹配='+total);
assert('name 无重复（一一对应）', new Set(all.map(sp=>sp.name)).size===109);
const ids = all.map(sp=>sp.id);
assert('speciesId 109 个无重复', new Set(ids).size===109, '重复='+ids.filter((x,i)=>ids.indexOf(x)!==i).join(','));

/* ===== B. 三字段填充（desc/ecology/appearance） ===== */
console.log('B. 三字段填充');
const noDesc = all.filter(sp=>!sp.desc || !sp.desc.trim());
const noEco = all.filter(sp=>!sp.ecology || !sp.ecology.trim());
const noApp = all.filter(sp=>!sp.appearance || !sp.appearance.trim());
assert('109 只 ecology 全非空', noEco.length===0, '缺='+noEco.map(x=>x.id).join(','));
assert('109 只 appearance 全非空', noApp.length===0, '缺='+noApp.map(x=>x.id).join(','));
assert('109 只 desc 全非空（v1.16.3 应替换空占位）', noDesc.length===0, '缺='+noDesc.length+'只: '+noDesc.slice(0,10).map(x=>x.id).join(','));

/* ===== C. 旧名在代码文本中 grep 归零（词边界，防新名子串误报） ===== */
console.log('C. 旧名 grep 归零');
const bodyNC = CODE.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'');
const re = new RegExp('(?<![\\u4e00-\\u9fff])('+Object.keys(RENAME).join('|')+')(?![\\u4e00-\\u9fff])','g');
const hits = [...new Set(bodyNC.match(re)||[])];
assert('87 个旧名（词边界）在代码中零残留', hits.length===0, '残留='+hits.join('/'));

console.log('\nv1.16.3 精灵全设定落地 验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
