
/* ================= 数据 ================= */
const ELEM = {
  water:{name:'水',tag:'water',dot:'dot-water'},
  fire:{name:'火',tag:'fire',dot:'dot-fire'},
  grass:{name:'草',tag:'grass',dot:'dot-grass'},
  earth:{name:'土',tag:'earth',dot:'dot-earth'},
  wind:{name:'风',tag:'wind',dot:'dot-wind'},
  steel:{name:'钢',tag:'steel',dot:'dot-steel'},
  ice:{name:'冰',tag:'ice',dot:'dot-ice'},
  thunder:{name:'电',tag:'thunder',dot:'dot-thunder'},
  poison:{name:'毒',tag:'poison',dot:'dot-poison'},
  light:{name:'光',tag:'light',dot:'dot-light'},
  ghost:{name:'幽',tag:'ghost',dot:'dot-ghost'},
  fight:{name:'武',tag:'fight',dot:'dot-fight'},
  dark:{name:'恶',tag:'dark',dot:'dot-dark'},
  bug:{name:'虫',tag:'bug',dot:'dot-bug'},
  psy:{name:'灵',tag:'psy',dot:'dot-psy'},
  normal:{name:'普',tag:'normal',dot:'dot-normal'},   // v1.14.0：第16常驻系（无元素偏向，防御系起点）
  /* 表外属性（非常驻幻想，不参与克制；秘境素材/历史存档兼容显示用） */
  time:{name:'时空',tag:'time',dot:'dot-time'},
  star:{name:'星辉',tag:'star',dot:'dot-star'},
  chaos:{name:'混沌',tag:'chaos',dot:'dot-chaos'},
};
/* ===== 克制/抵抗网络（2026-09-16 定稿 · 16 常驻系 +普）=====
   克制 ×2：攻击方属性对目标属性形成压制（火克草钢虫冰…）
   抵抗 ×0.5：防御方属性对攻击方属性的稳定性（钢抵抗毒但钢不克毒）
   本系抵抗：攻击/均衡属性自抵抗（火打火半伤）；防御、自由属性不自抵抗
   表外属性（time/star/chaos）不参与任何克制/抵抗
   普：无克制面、不自抵抗、被武×2、与幽相互×0.5 */
const TYPE_CRUSH = {
  water:['fire','earth'], fire:['grass','steel','bug','ice'], grass:['water','earth'],
  earth:['fire','thunder'], wind:['grass','poison','bug'], steel:['ice','bug'],
  ice:['grass','wind','bug'], thunder:['water','wind'], poison:['grass','bug'],
  light:['ghost'], ghost:['fight'], fight:['earth','steel','normal'],
  dark:['psy','ghost'], bug:['grass','psy'], psy:['fight','earth'],
};
const TYPE_RESIST = {
  water:['fire','earth','water'], fire:['grass','steel','bug','ice','fire'],
  grass:['water','earth','thunder','grass'], earth:['fire','thunder','wind','ice','poison','grass'],
  wind:['grass','poison','bug','wind'], steel:['ice','bug','poison','thunder','water','wind','dark'],
  ice:['grass','wind','bug','ice'], thunder:['wind','thunder'], poison:['grass','bug','psy'],
  light:['ghost'], ghost:['fight','poison','normal'], fight:['earth','steel','fight'],
  dark:['psy','ghost','dark'], bug:['grass','psy','bug'], psy:['fight','earth','psy'],
  normal:['ghost'],   // v1.14.0：普被幽×0.5（与幽互抵）；不克任何、不自抵抗
};
/* 属性倍率：攻击方 atkElem 打 防御方 defElem */
function typeMult(atkElem, defElem){
  if(!atkElem || atkElem==='none' || !defElem || defElem==='none') return 1;
  if(!ELEM[atkElem] || !ELEM[defElem]) return 1;
  if(TYPE_CRUSH[atkElem] && TYPE_CRUSH[atkElem].includes(defElem)) return 2;
  if(TYPE_RESIST[defElem] && TYPE_RESIST[defElem].includes(atkElem)) return 0.5;
  return 1;
}
/* 素材属性名（life 等表外属性的安全回退） */
function elemName(e){ return ELEM[e] ? ELEM[e].name : (e==='none' ? '无' : '万灵'); }

/* 素材总表：id → 定义。
   来源 type：ore 矿石 / plant 植物 / beast 妖兽（妖兽素材池 M3-1-3 重建；专属精魄单列，不在常规素材表）
   品质 quality：普通/优秀/精良/稀有/史诗/传奇 六档（灰绿蓝紫黄红；低档垫材、中档可出灵兽、高档高概率与稀有候选）
   tags：额外功能标签，如【时空】【星辉】【地火】 */;

/* 合并素材查找：MATS + 自定义素材（DROPS/UP_MATS 已在 v1.16.1 推倒重来，M3-1-3 重建） */
function matAny(id){
  return MATS[id] || null;
}

/* 品质 → 能级（决定炼化概率档位） */
const QUALITY = {
  normal: {name:'普通', rank:0, color:'#8f939b'},
  good:   {name:'优秀', rank:1, color:'#6fbf73'},
  fine:   {name:'精良', rank:2, color:'#5b9bd5'},
  rare:   {name:'稀有', rank:3, color:'#9d6bd5'},
  epic:   {name:'史诗', rank:4, color:'#d9b53f'},
  legend: {name:'传奇', rank:5, color:'#d5605b'},
};
const QUALITY_RANK = {normal:0, good:1, fine:2, rare:3, epic:4, legend:5};

const MAT_TYPE = {
  ore:   {name:'矿石'},
  plant: {name:'植物'},
  beast: {name:'妖兽'},
};