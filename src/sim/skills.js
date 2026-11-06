
const SKILLS = {};
SKILLS.universal = [{id:'regen',name:'回能',kind:'mechanic',cost:0,energy:0,power:0,hits:0,elem:'none',type:'状态',desc:'凝神调息，回复 5 点能量。不占容量、无熟练度，默认携带。',effects:[{target:'self',type:'surge',layers:5}]}];
/* v1.14.0：普系（normal）防御技能——首个使用者。power 缺省（显示 -），按 effects.layers 减伤 */
SKILLS.normal = [{id:'n_guard',name:'防御',kind:'ult',cost:1,energy:1,power:0,hits:1,elem:'normal',type:'防御',track:'phys',cooldown:1,accuracy:100,desc:'凝神定势，本回合受到伤害减少 80%，随后进入 1 回合冷却。',effects:[{target:'self',type:'guard',layers:80}]}];
Object.keys(DIRECT_NAMES).forEach(elem=>{
  SKILLS[elem] = DIRECT_TPL.map((t,i)=>{
    const total = t.per*t.hits;
    return {id:elem+'-d'+i, name:DIRECT_NAMES[elem][i], kind:'direct', track:'phys',
      cost: 1+Math.max(0, Math.round((total-40)/20)),
      energy:t.energy, power:total, hits:t.hits, elem, type:'攻击', mech:'',
      desc:'每段 '+t.per+' · '+t.hits+' 段 · 总威力 '+total+' · 0 能耗'};
  }).concat(DIRECT_TPL.map((t,i)=>{
    const total = t.per*t.hits;
    return {id:elem+'-d'+(i+7), name:DIRECT_NAMES[elem][i+7], kind:'direct', track:'spec',
      cost: 1+Math.max(0, Math.round((total-40)/20)),
      energy:t.energy, power:total, hits:t.hits, elem, type:'攻击', mech:'',
      desc:'每段 '+t.per+' · '+t.hits+' 段 · 总威力 '+total+' · 0 能耗'};
  }));
});
/* 绝技纯攻击模板：容量固定1，代价由能耗承担（0/1/2/3 + 多段1） */;;
/* 纯攻绝技精简（v1.9.4）：同代价位已被「带效果绝技」占用的纯攻绝技删除；
   草系因 GRASS_POOL 带效果技能占位，删 4 门（nd0/nd2/nd9/nd10），
   剩余双版本档位（物/魔同档）各随机留一轨（确定性伪随机，刷新不变），最终保留 6 门：
   nd1 荆棘裂(60/1物) · nd3 森罗破(100/3物) · nd5 三藤破击(3段物) · nd7 叶轰(40/0魔) · nd11 叶轰连发(2段魔) · nd13 四叶轰珠(4段魔)
   其他 14 属性无带效果绝技占位，14 门纯攻绝技全部保留。 */
const PURE_ULT_GRASS_KEEP = (function(){
  const keep = {};
  [1,3,5,7,11,13].forEach(function(i){ keep['grass-nd'+i]=true; });
  return keep;
})();
Object.keys(PURE_ULT_NAMES).forEach(elem=>{
  const arr = PURE_ULT_TPL.map((t,i)=>{
    const total = t.per*t.hits;
    return {id:elem+'-nd'+i, name:PURE_ULT_NAMES[elem][i], kind:'ult', track:'phys',
      cost:1, energy:t.energy, power:total, hits:t.hits, elem, type:'攻击', mech:'',
      desc:'每段 '+t.per+' · '+t.hits+' 段 · 总威力 '+total+' · 能耗 '+t.energy};
  }).concat(PURE_ULT_TPL.map((t,i)=>{
    const total = t.per*t.hits;
    return {id:elem+'-nd'+(i+7), name:PURE_ULT_NAMES[elem][i+7], kind:'ult', track:'spec',
      cost:1, energy:t.energy, power:total, hits:t.hits, elem, type:'攻击', mech:'',
      desc:'每段 '+t.per+' · '+t.hits+' 段 · 总威力 '+total+' · 能耗 '+t.energy};
  })).filter(function(sk){
    if(elem==='grass') return !!PURE_ULT_GRASS_KEEP[sk.id];
    // v1.19.1 纯攻绝技收口：保留 nd0/nd1/nd2/nd4 物理+特殊（删 nd3/nd5/nd6）
    const m = sk.id.match(/-nd(\d+)$/);
    if(!m) return true;
    const n = parseInt(m[1],10);
    const physIdx = n<=6 ? n : n-7; // 物理索引（特殊同档位 physIdx=n-7）
    if(elem==='fire'){
      // 火系额外删 nd0/nd1（已被火花/火焰轮占用），只留 nd2/nd4
      return [2,4].includes(physIdx);
    }
    if(elem==='poison'){
      // v1.19.2 毒系纯攻收口：只留 nd1 物理、nd1 特殊、nd2 特殊
      if(n<=6) return n===1; // 物理：只 nd1
      return [1,2].includes(n-7); // 特殊：nd1(8)、nd2(9)
    }
    return [0,1,2,4].includes(physIdx);
  });
  SKILLS[elem] = SKILLS[elem].concat(arr);
});
/* 绝技（后天获取）：威力制（原倍率 ×60） */
const ULT_DEFS = {}; /* v1.19.0 旧模板绝技全清（108破甲/156斩杀 30门），后续按属性池重建 */;
/* 绝技/爆发技轨道：跟随属性默认轨；个别技能意象明确为接触/能量形态时手工覆盖（如冰牙=咬合物理、雷爪=爪击物理） */;
/* v1.19.0：ULT_DEFS 已全清；BURST_DEFS 独立注册（不再依赖 ULT_DEFS forEach） */
Object.keys(ULT_DEFS).forEach(elem=>{
  ULT_DEFS[elem].forEach(u=>{ SKILLS[elem].push({...u, kind:'ult', track:ULT_TRACK_OVERRIDE[u.id]||DIRECT_TRACK[elem]||'phys', hits:1, elem, type:'攻击'}); });
});
Object.keys(BURST_DEFS).forEach(elem=>{
  SKILLS[elem]=(SKILLS[elem]||[]);
  SKILLS[elem].push({...BURST_DEFS[elem], kind:'burst', track:DIRECT_TRACK[elem]||'phys', hits:1, elem, type:'攻击'});
});
/* —— M3-P0 草系完整技能池（宝可梦草系招式改造，与妖兽池 direct 并存，副本/奇遇后天获取）—— */
SKILLS.grass = (SKILLS.grass||[]).concat(GRASS_POOL);

/* —— v1.18.0 M3-1-5b：10 属性样板绝技（每属性 4 门，属性=打法风格）—— */;

/* 妖兽技能池查询：返回该属性按等级解锁的直接攻击 */
function directUnlocked(elem, lvl){
  const list = SKILLS[elem]||[];
  return list.filter(sk=>sk.kind==='direct' && DIRECT_UNLOCK[list.indexOf(sk)] <= (lvl||1));
}

/* 专长系统：四分类 × 五品质
   category  attr 属性专长（攻防速血魔的百分比/固定值/成长、亲和力修正）
             aptitude 资质专长（熟练度容量、技能容量等非常规属性）
             skill 技能专长（特定技能/属性技能增伤减伤、突破携带限制）
             special 特殊专长（掉落、突袭概率等面板外效果）
   quality   common 普通 / fine 优秀 / expert 专家 / epic 史诗 / legend 传奇
   effects   {atkPct, defPct, spdPct, hpPct, atkGrow, defGrow, aff:{elem:delta}, capBonus, capCostMult, masteryCapBonus, skillDmg:{elem:pct}, skillCostExempt, dropBonus, sneakResist}
   beta / capTotal 为副本结算兼容字段（副本相性/熟练度上限） */
const PERKS = {
  universal:[
    {id:'secondwind',name:'生生不息',quality:'common',category:'attr',desc:'生命上限 +10%。',effects:{hpPct:.10}},
    {id:'ironwill',name:'铁骨',quality:'fine',category:'attr',desc:'防御 +12%。',effects:{defPct:.12}},
    {id:'strikefirst',name:'先声夺人',quality:'fine',category:'attr',desc:'速度 +10%。',effects:{spdPct:.10}},
    {id:'growingspirit',name:'茁壮成长',quality:'expert',category:'attr',desc:'攻击成长 +1（每级额外 +1 攻击）。',effects:{atkGrow:1}},
    {id:'deepbreath',name:'气脉悠长',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +30。',capTotal:30,effects:{masteryCapBonus:30}},
    {id:'liberalmind',name:'博闻广记',quality:'expert',category:'aptitude',desc:'技能容量 +3。',effects:{capBonus:3}},
    {id:'affinitybloom',name:'万象亲和',quality:'epic',category:'attr',desc:'全系亲和力 +10。',effects:{affAll:10}},
    {id:'treasureeye',name:'聚宝之眼',quality:'fine',category:'special',desc:'战斗掉落素材 +20%。',effects:{dropBonus:.20}},
  ],
  fire:[
    {id:'blaze-affinity',name:'炽热亲和',quality:'fine',category:'attr',desc:'火系亲和力 +20。',beta:{fire:.3},effects:{aff:{fire:20}}},
    {id:'ember-stamina',name:'余烬之躯',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +15。',capTotal:15,effects:{masteryCapBonus:15}},
    {id:'pyromania',name:'焚心',quality:'epic',category:'skill',desc:'火系技能伤害 +20%。',effects:{skillDmg:{fire:.20}}},
    {id:'ashmaster',name:'灰烬掌控',quality:'legend',category:'skill',desc:'火系技能容量占用 −30%，突破部分亲和限制。',effects:{skillCostExempt:['fire']}},
  ],
  water:[
    {id:'tide-affinity',name:'潮汐亲和',quality:'fine',category:'attr',desc:'水系亲和力 +20。',beta:{water:.3},effects:{aff:{water:20}}},
    {id:'still-water',name:'静水心',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +15。',capTotal:15,effects:{masteryCapBonus:15}},
    {id:'riptide',name:'暗流',quality:'epic',category:'skill',desc:'水系技能伤害 +20%。',effects:{skillDmg:{water:.20}}},
  ],
  thunder:[
    {id:'storm-affinity',name:'雷云亲和',quality:'fine',category:'attr',desc:'雷系亲和力 +20。',beta:{thunder:.3},effects:{aff:{thunder:20}}},
    {id:'static',name:'静电体',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +15。',capTotal:15,effects:{masteryCapBonus:15}},
    {id:'lightningrod',name:'引雷之体',quality:'epic',category:'skill',desc:'雷系技能伤害 +20%。',effects:{skillDmg:{thunder:.20}}},
  ],
  wind:[
    {id:'gale-affinity',name:'长风亲和',quality:'fine',category:'attr',desc:'风系亲和力 +20。',beta:{wind:.3},effects:{aff:{wind:20}}},
    {id:'feather-touch',name:'羽轻身',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +15。',capTotal:15,effects:{masteryCapBonus:15}},
    {id:'galesong',name:'风语',quality:'epic',category:'skill',desc:'风系技能伤害 +20%。',effects:{skillDmg:{wind:.20}}},
  ],
  earth:[
    {id:'stone-affinity',name:'厚土亲和',quality:'fine',category:'attr',desc:'土系亲和力 +20。',beta:{earth:.3},effects:{aff:{earth:20}}},
    {id:'bedrock',name:'磐石心',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +15。',capTotal:15,effects:{masteryCapBonus:15}},
    {id:'continent',name:'不动如山',quality:'epic',category:'attr',desc:'防御 +25%。',effects:{defPct:.25}},
  ],
  time:[
    {id:'hourglass',name:'时之沙',quality:'fine',category:'attr',desc:'时空亲和力 +20。',beta:{time:.3},effects:{aff:{time:20}}},
    {id:'chronicle',name:'史官之眼',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +15。',capTotal:15,effects:{masteryCapBonus:15}},
    {id:'chronomaster',name:'时光行者',quality:'legend',category:'skill',desc:'时空系技能伤害 +35%。',effects:{skillDmg:{time:.35}}},
  ],
  star:[
    {id:'starlight',name:'星光眷顾',quality:'fine',category:'attr',desc:'星辉亲和力 +20。',beta:{star:.3},effects:{aff:{star:20}}},
    {id:'starcatcher',name:'捕星手',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +15。',capTotal:15,effects:{masteryCapBonus:15}},
    {id:'supernova',name:'超新星',quality:'legend',category:'skill',desc:'星辉系技能伤害 +35%。',effects:{skillDmg:{star:.35}}},
  ],
  chaos:[
    {id:'chaosheart',name:'混沌之心',quality:'fine',category:'attr',desc:'混沌亲和力 +20，不可控的亲和。',beta:{chaos:.3},effects:{aff:{chaos:20}}},
    {id:'voidwalker',name:'虚空行者',quality:'epic',category:'special',desc:'被突袭概率大幅降低。',effects:{sneakResist:.5}},
    {id:'primordial',name:'太初之力',quality:'legend',category:'skill',desc:'混沌系技能伤害 +40%。',effects:{skillDmg:{chaos:.40}}},
  ],
  poison:[
    {id:'venom-affinity',name:'蚀骨亲和',quality:'fine',category:'attr',desc:'毒系亲和力 +20。',beta:{poison:.3},effects:{aff:{poison:20}}},
    {id:'toxin-blood',name:'毒血',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +15。',capTotal:15,effects:{masteryCapBonus:15}},
    {id:'corrosion',name:'蚀世',quality:'epic',category:'skill',desc:'毒系技能伤害 +20%。',effects:{skillDmg:{poison:.20}}},
  ],
  light:[
    {id:'halo-affinity',name:'圣辉亲和',quality:'fine',category:'attr',desc:'光系亲和力 +20。',beta:{light:.3},effects:{aff:{light:20}}},
    {id:'clearheart',name:'澄明心',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +15。',capTotal:15,effects:{masteryCapBonus:15}},
    {id:'dawnbreak',name:'破晓',quality:'epic',category:'skill',desc:'光系技能伤害 +20%。',effects:{skillDmg:{light:.20}}},
  ],
  ghost:[
    {id:'wraith-affinity',name:'幽影亲和',quality:'fine',category:'attr',desc:'幽系亲和力 +20。',beta:{ghost:.3},effects:{aff:{ghost:20}}},
    {id:'nethermind',name:'幽冥心',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +15。',capTotal:15,effects:{masteryCapBonus:15}},
    {id:'souleater',name:'噬魂',quality:'epic',category:'skill',desc:'幽系技能伤害 +20%。',effects:{skillDmg:{ghost:.20}}},
  ],
  dark:[
    {id:'abyss-affinity',name:'暗渊亲和',quality:'fine',category:'attr',desc:'恶系亲和力 +20。',beta:{dark:.3},effects:{aff:{dark:20}}},
    {id:'nightblood',name:'夜行者',quality:'fine',category:'aptitude',desc:'技能熟练度总上限 +15。',capTotal:15,effects:{masteryCapBonus:15}},
    {id:'eclipse',name:'蚀月',quality:'epic',category:'skill',desc:'恶系技能伤害 +20%。',effects:{skillDmg:{dark:.20}}},
  ],
};

/* ============ M2-A6 副本构建数据层 ============
   通用技能池 / 通用专长池：素材「可提取信息」编辑时的白名单范围（中高阶条目）。
   只规范配置，不参与运行时概率计算——结算概率只读素材自身的 extractInfo。 */
const GLOBAL_SKILL_POOL = {
  universal:['regen'],
  fire:[ 'inferno'],
  water:[ 'maelstrom'],
  grass:[ 'verdantwrath'],
  earth:[ 'terraquake'],
  wind:[ 'aetherhowl'],
  steel:[ 'ironcataclysm'],
  ice:[ 'absolutezero'],
  thunder:[ 'thunderdoom'],
  poison:[ 'plaguepits'],
  light:[ 'creatio'],
  ghost:[ 'phantomgate'],
  fight:[ 'dragonfist'],
  dark:[ 'eternalnight'],
  bug:[ 'swarmwill'],
  psy:[ 'omnipresence'],
  normal:['n_guard'],
};
if(GLOBAL_SKILL_POOL.grass && typeof GRASS_POOL!=='undefined'){
  GLOBAL_SKILL_POOL.grass = GLOBAL_SKILL_POOL.grass.concat(GRASS_POOL.map(function(x){return x.id;}));
}
/* v1.18.0：10 属性样板技能注册进 SKILLS 与 GLOBAL_SKILL_POOL */
Object.keys(SAMPLE_SKILLS).forEach(function(elem){
  SKILLS[elem] = (SKILLS[elem]||[]).concat(SAMPLE_SKILLS[elem]);
  GLOBAL_SKILL_POOL[elem] = (GLOBAL_SKILL_POOL[elem]||[]).concat(SAMPLE_SKILLS[elem].map(function(x){return x.id;}));
});
const GLOBAL_PERK_POOL = {
  universal:['secondwind','ironwill','strikefirst','growingspirit','deepbreath','liberalmind','affinitybloom','treasureeye'],
  fire:['blaze-affinity','ember-stamina','pyromania','ashmaster'],
  water:['tide-affinity','still-water','riptide'],
  earth:['stone-affinity','bedrock','continent'],
  wind:['gale-affinity','feather-touch','galesong'],
  thunder:['storm-affinity','static','lightningrod'],
  poison:['venom-affinity','toxin-blood','corrosion'],
  light:['halo-affinity','clearheart','dawnbreak'],
  ghost:['wraith-affinity','nethermind','souleater'],
  dark:['abyss-affinity','nightblood','eclipse'],
  time:['hourglass','chronicle','chronomaster'],
  star:['starlight','starcatcher','supernova'],
  chaos:['chaosheart','voidwalker','primordial'],
};
/* v1.16.7 道具表：技能石/专长石（非素材，DJ_m_nnnnnn 全局连续编号） */
const ITEMS = (function(){
  function skName(sid){
    for(const k in SKILLS){ const s=(SKILLS[k]||[]).find(x=>x.id===sid); if(s) return s.name; } return sid;
  }
  function pkName(pid){
    for(const k in PERKS){ const p=(PERKS[k]||[]).find(x=>x.id===pid); if(p) return p.name; } return pid;
  }
  const it = {}; let n = 1;
  const pad = () => String(n).padStart(6,'0');
  for(const e of Object.keys(GLOBAL_SKILL_POOL)){
    for(const sid of GLOBAL_SKILL_POOL[e]){
      const elem = (e==='universal'||e==='normal') ? 'none' : e;
      const id = 'DJ_'+elem+'_'+pad();
      const sn = skName(sid);
      it[id] = {id, name:'技能石·'+sn, elem, skillId:sid, type:'item', tags:['技能石'], count:0,
        desc:'炼化凝出的定向技能石，投入秘境可为「'+sn+'」提供 100 存在分，不产生敌人。'};
      n++;
    }
  }
  /* 分段预留：技能石 000001~000999、专长石 001000~001999、工具/蓝图 002000~002999。
     各段独立递增，后续加技能/专长/工具不互相挤压。 */
  n = 1000;
  for(const e of Object.keys(GLOBAL_PERK_POOL)){
    for(const pid of GLOBAL_PERK_POOL[e]){
      const elem = e==='universal' ? 'none' : e;
      const id = 'DJ_'+elem+'_'+pad();
      const pn = pkName(pid);
      it[id] = {id, name:'专长石·'+pn, elem, perkId:pid, type:'item', tags:['专长石'], count:0,
        desc:'炼化凝出的定向专长石，投入秘境可为「'+pn+'」提供 100 存在分，不产生敌人。'};
      n++;
    }
  }
  return it;
})();
/* v1.17.0 M3-1-4：标准系列工具（斧/镐 × 6 品质）+ 蓝图（斧/镐 × 优秀/精良）
   号段 002000~002999（与技能石/专长石分段预留，互不挤压）。工具 type:'tool'，蓝图 type:'blueprint'。 */
(function(){
  const QUALS = [
    {id:'normal', rank:0, durability:100, cn:'普通'},
    {id:'good',   rank:1, durability:120, cn:'优秀'},
    {id:'fine',   rank:2, durability:140, cn:'精良'},
    {id:'rare',   rank:3, durability:160, cn:'稀有'},
    {id:'epic',   rank:4, durability:180, cn:'史诗'},
    {id:'legend', rank:5, durability:200, cn:'传奇'},
  ];
  let n = 2000;
  const pad = () => String(n).padStart(6,'0');
  // 12 工具：斧/镐 × 6 品质
  ['axe','pick'].forEach(kind=>{
    const kindName = kind==='axe' ? '斧' : '镐';
    QUALS.forEach(q=>{
      const id = 'DJ_none_'+pad();
      ITEMS[id] = {id, name:'标准系列·'+kindName, elem:'none', kind,
        type:'tool', quality:q.id, rank:q.rank, durability:q.durability, maxDurability:q.durability,
        tags:['工具'], count:0,
        desc:'标准系列'+kindName+'，耐久 '+q.durability+'。采集自动生效（持最高品质），每次采集 -1 耐久，归零损坏。'};
      n++;
    });
  });
  // 4 蓝图：斧/镐 × 优秀/精良
  ['axe','pick'].forEach(kind=>{
    const kindName = kind==='axe' ? '斧' : '镐';
    ['good','fine'].forEach(qid=>{
      const q = QUALS.find(x=>x.id===qid);
      const id = 'DJ_none_'+pad();
      ITEMS[id] = {id, name:'标准系列·'+kindName+'蓝图', elem:'none', kind,
        type:'blueprint', quality:q.id, rank:q.rank, tags:['蓝图'], count:0,
        desc:'锻造'+q.cn+kindName+'的蓝图，锻造时消耗 1 张。来源：精英/首领战其他掉落。'};
      n++;
    });
  });
  // 战斗消耗品（号段避开 002000–002015）
  ITEMS['DJ_none_002020'] = {id:'DJ_none_002020', name:'血瓶', elem:'none', type:'battle', battle:'hp',
    tags:['药剂'], count:0, desc:'战斗中使用：回复最大生命的 25%，占用一回合。'};
  ITEMS['DJ_none_002021'] = {id:'DJ_none_002021', name:'蓝瓶', elem:'none', type:'battle', battle:'energy',
    tags:['药剂'], count:0, desc:'战斗中使用：能量回满，占用一回合。'};
})();
/* 精魄拓池表：投入精魄侵占对应属性 250 分存在分后，奖励从本表抽取（常驻条目）。
   对应属性若有精灵专属精魄（如烬烬狼精魄），开启拓池时消耗 1 枚，只影响该属性。 */
const ESSENCE_EXPAND = {
  skills:{
    fire:['pyre','inferno'], water:['deluge','maelstrom'], grass:['bloomburst','verdantwrath'],
    earth:['landslide','terraquake'], wind:['typhoon','aetherhowl'], steel:['steelstorm','ironcataclysm'],
    ice:['glacier','absolutezero'], thunder:['stormfall','thunderdoom'], poison:['virulence','plaguepits'],
    light:['judgment','creatio'], ghost:['nethergate','phantomgate'], fight:['martialgod','dragonfist'],
    dark:['abyssecho','eternalnight'], bug:['hive','swarmwill'], psy:['nirvana','omnipresence'],
  },
  perks:{
    fire:['pyromania'], water:['riptide'], grass:['overgrowth'], earth:['landslideheart'], wind:['galesong'],
    steel:['coldsteel'], ice:['glacierheart'], thunder:['lightningrod'], poison:['toxiccloud'], light:['sunfire'],
    ghost:['soulreaper'], fight:['brawler'], dark:['shadowstep'], bug:['hivewill'], psy:['mindovermatter'],
  },
};
/* 副本专属敌人：植物素材 → 元素灵；矿石素材 → 巨像。
   全部完美品质，野外不刷新，只会在副本内遭遇；可进图鉴；副本战斗无掉落物。
   五换一：每 5 单位对应类型素材生成 1 只（向上取整）。 */;
/* 素材「可提取信息」：投入副本时该素材为各技能/专长提供存在分。
   默认按 素材元素 × 品质 确定性生成（可被素材定义里的 extractInfo 字段覆盖，管理员可编辑）。
   约束：只从通用池取对应属性的条目；品质越高能携带的高阶条目越多、分越高。 */
function matHash(str){ let h=0; for(const c of str){ h=(h*31 + c.charCodeAt(0))>>>0; } return h; }
function defaultExtract(m){
  const out = {skillScore:{}, talentScore:{}};
  const elem = (m.elem && m.elem!=='none' && GLOBAL_SKILL_POOL[m.elem]) ? m.elem : 'universal';
  const skills = GLOBAL_SKILL_POOL[elem] || [];
  const perks = (elem!=='universal' && GLOBAL_PERK_POOL[elem]) ? GLOBAL_PERK_POOL[elem] : GLOBAL_PERK_POOL.universal;
  const q = (QUALITY_RANK[m.quality]!=null ? QUALITY_RANK[m.quality] : 0) + 1;   // 1-6
  const h = matHash(m.id);
  const nSk = Math.min(skills.length, 1 + Math.ceil(q/2));                          // 低档 2 项、高档 4 项
  for(let i=0;i<nSk;i++){
    const id = skills[(h + i*3) % skills.length];
    out.skillScore[id] = Math.round((40 + (h%20) + q*40) / (i+1));
  }
  const nPk = Math.min(perks.length, q>=3 ? (q>=5?3:2) : 1);
  for(let i=0;i<nPk;i++){
    const id = perks[(h*7 + i*5) % perks.length];
    out.talentScore[id] = Math.round((30 + ((h>>3)%15) + q*45) / (i+1));
  }
  return out;
}
function extractInfoOf(m){
  if(m.extractInfo && (Object.keys(m.extractInfo.skillScore||{}).length || Object.keys(m.extractInfo.talentScore||{}).length)) return m.extractInfo;
  return defaultExtract(m);
}
function skillById(id){
  if(typeof S!=='undefined' && S.skillEdits && S.skillEdits[id]) return S.skillEdits[id];
  for(const k in SKILLS){ const s=(SKILLS[k]||[]).find(x=>x.id===id); if(s) return s; } return null;
}
function perkById(id){ for(const k in PERKS){ const p=(PERKS[k]||[]).find(x=>x.id===id); if(p) return p; } return null; }
function skillName(id){ const s=skillById(id); return s?s.name:id; }
function perkName(id){ const p=perkById(id); return p?p.name:id; }