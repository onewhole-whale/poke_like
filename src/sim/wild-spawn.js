

function wildSpirit(){
  const sid = S.wild.spiritId;
  if(typeof sid==='string' && sid.startsWith('beast:')){
    const b = S.beasts.find(x=>'beast:'+x.id===sid);
    if(!b) return null;
    const sp = allSpeciesDef(b.speciesId);
    return {id:b.id, sid:b.speciesId, speciesId:b.speciesId, name:sp.name, elem:sp.elem, lvl:b.lvl||10,
      shiny:b.shiny, nature:b.nature||pick(NATURES).id, iv:b.iv||{},
      skills: directUnlocked(sp.elem, b.lvl||1).map(s=>({...s})), energy:5, energyMax:10, isBeast:true};
  }
  return spById(sid);
}

/* 生成本次冒险节点 */
/* 野外遭遇按品级加权：普通 6 / 精英 3 / 完美 1.2 / 传说 0.25（传说极罕见） */
function wildPick(speciesList){
  const w = {normal:6, elite:3, perfect:1.2, legend:0.25};
  const total = speciesList.reduce((a,id)=>a+(w[allSpeciesDef(id).rarity]||1),0);
  let r = Math.random()*total;
  for(const id of speciesList){ r -= (w[allSpeciesDef(id).rarity]||1); if(r<=0) return id; }
  return speciesList[0];
}
function genWildNodes(zoneId){
  const z = ZONES[zoneId];
  const n = 3 + Math.floor(Math.random()*3);
  const nodes = [];
  for(let i=0;i<n;i++){
    const r = Math.random();
    if(r<.5){
      const speciesId = wildPick(z.species);
      nodes.push({type:'beast', speciesId, beast:wildBeast(speciesId), ambush:roll(.22)});
    } else if(r<.8){
      nodes.push({type:'event', kind:pick(['beast','gather','harvest']), harvest:pick(['mine','glean','spot'])});
    } else {
      const ws = WONDERS.filter(w=>w.elem===z.elem);
      const w = ws.length? pick(ws) : pick(WONDERS);
      nodes.push({type:'wonder', story:JSON.parse(JSON.stringify(w)), storyIdx:0});
    }
  }
  return nodes;
}
function wildBeast(speciesId, lvl){
  let sp = allSpeciesDef(speciesId);
  // 无效 id 时整只按 fallback 物种生成（含 speciesId），避免名字/立绘/掉落各走各的
  if(!sp){ speciesId = 'JL_fire_normal_0001'; sp = allSpeciesDef(speciesId); }
  const base = speciesBase(sp);
  if(typeof lvl!=='number') lvl = sp.rarity==='legend' ? 6 : (sp.rarity==='perfect' ? 5 : (sp.rarity==='elite' ? 3 : 1));
  const mk = r => Math.floor(2*r*lvl/100);
  const hp = mk(base.hp) + lvl + 10;   // 敌人生成：hp 不带个体值（原设计保持）
  const nature = pick(NATURES).id;   // 妖兽性格随机，随面板生效
  const iv = genRandomIV();           // 妖兽个体值随机：0-3 项、各 1-20（M2-A3）
  const jitter = Math.floor(Math.random()*3);
  return {
    speciesId, name:sp.name, elem:sp.elem, hp, maxHp:hp, nature, iv,
    atk:  Math.round((mk(base.atk) + 5 + ivContribution(iv,'atk',lvl) + jitter) * natureMult(nature,'atk')),
    def:  Math.round((mk(base.def) + 5 + ivContribution(iv,'def',lvl)) * natureMult(nature,'def')),
    spa:  Math.round((mk(base.spa) + 5 + ivContribution(iv,'spa',lvl) + jitter) * natureMult(nature,'spa')),
    sdef: Math.round((mk(base.sdef) + 5 + ivContribution(iv,'sdef',lvl)) * natureMult(nature,'sdef')),
    spd:  Math.round((mk(base.spe) + 5 + ivContribution(iv,'spe',lvl) + Math.floor(Math.random()*9-4)) * natureMult(nature,'spe')), lvl,
  };
}
/* M3-1 上位素材掉落：精英 +1 / 首领 +2，封顶传奇。
   从基础掉落 matId 取 up_<bump>_<matId>。 */
function upMatFor(matId, template){
  // C3：精英 +1 / 首领 +2 品质——按 matId 的 elem+type+tags 找 bump 档同型素材，找不到返回原 id
  const bump = template==='boss' ? 2 : (template==='elite' ? 1 : 0);
  if(bump===0) return matId;
  const m = MATS[matId]; if(!m || !m.quality) return matId;
  const cur = QUALITY_RANK[m.quality];
  if(cur==null) return matId;
  const targetRank = Math.min(5, cur+bump);
  if(targetRank===cur) return matId;
  const targetQ = Object.keys(QUALITY_RANK).find(q=>QUALITY_RANK[q]===targetRank);
  // 同 elem + 同 type + 同 tags 集合，目标品质
  const curTags = (m.tags||[]).join(',');
  for(const k in MATS){
    const x = MATS[k];
    if(x.elem===m.elem && x.type===m.type && x.quality===targetQ && (x.tags||[]).join(',')===curTags) return k;
  }
  return matId;
}

/* ================= M3-1 秘境沙盒（三层架构） ================= */
/* 层1 · 全局地块库：地形基类 */
/* ================= M3-1-4 地形表（基类 18 地块） =================
   基类只记录"存在哪些地形 + 地理风貌"；产出/精灵下沉到派生地形表（MAP_CONFIGS[map].tileMats）。 */;
/* M3-1-4 事件基类（3 类型）：难度效果在基类定义，模版占比不在基类（派生层按数量撒布） */
const FIGHT_EVENT_BASE = {
  id:'fight', kind:'fight', size:1,
  difficultyEffects:{
    easy:   {desc:'简单：玩家增益/敌方减益'},
    normal: {desc:'普通：双方持平'},
    hard:   {desc:'困难：玩家减益/敌方增益'},
  },
};
const ADVENTURE_EVENT_BASE = {id:'adventure', kind:'adventure', size:1};
const WONDER_EVENT_BASE    = {id:'wonder',    kind:'wonder',    size:1};
/* M3-1-4 事件条目：3 条战斗 + 4 条奇遇（冒险本版空池，M3-1-5 填充） */
const FIGHT_EVENTS = {
  fight_normal:{id:'fight_normal', kind:'fight', template:'normal'},
  fight_elite:  {id:'fight_elite',  kind:'fight', template:'elite'},
  fight_boss:   {id:'fight_boss',   kind:'fight', template:'boss'},
};

/* 层2 · 战斗全程 buff 表（固定数值，难度只控 side） */
const BATTLE_BUFFS = {
  'b-regen':     {id:'b-regen',     name:'再生',     effectType:'buff',   desc:'每回合回复 12% 最大生命', params:{pct:.12}},
  'b-energy-5':   {id:'b-energy-5',  name:'能量激流', effectType:'neutral',desc:'每回合结束 +5 能量',       params:{energy:5}},
  'b-harden':     {id:'b-harden',    name:'铁皮',     effectType:'buff',   desc:'受到伤害降低 8%',          params:{dmgDown:.08}},
  'b-swift':      {id:'b-swift',    name:'迅捷',     effectType:'buff',   desc:'速度 +20%',                params:{spdMul:1.2}},
  'b-fury':       {id:'b-fury',     name:'狂暴',     effectType:'buff',   desc:'攻击 +25%',                params:{atkMul:1.25}},
  'b-thorn':      {id:'b-thorn',    name:'荆棘',     effectType:'buff',   desc:'受击反弹 8% 伤害',         params:{reflect:.08}},
  'b-vuln':       {id:'b-vuln',     name:'易伤',     effectType:'debuff', desc:'受到伤害 +20%',            params:{vuln:.2}},
  'b-drain':      {id:'b-drain',    name:'能量流失', effectType:'debuff', desc:'每回合结束 -1 能量',       params:{energy:-1}},
  'b-berserk':    {id:'b-berserk',  name:'血怒',     effectType:'buff',   desc:'血量<50% 时攻击 +30%',     params:{atkMul:1.3, hpThresh:.5}},
  'b-energy-3':   {id:'b-energy-3', name:'回能潮',   effectType:'neutral',desc:'每回合结束 +3 能量',       params:{energy:3}},
};
/* 层2 · 地图配置（本期 1 张 7×7 中图；按 zone elem 配敌人池+buffRule） */
/* M3-1-4 冒险地图表（派生）：本版 1 张微风平原 7×7 */;
/* 模版倍率（M3-1-4 拍板）：普通 ×1 / 精英 血×3 攻防×1.5 / 首领 血×4 攻防×2；速度不乘 */
function applyTemplate(beast, template){
  beast.template = template;
  if(template==='elite'){
    beast.hp = beast.maxHp = beast.maxHp*3;
    beast.atk = Math.round(beast.atk*1.5);
    beast.def = Math.round(beast.def*1.5);
    beast.spa = Math.round(beast.spa*1.5);
    beast.sdef = Math.round(beast.sdef*1.5);
  } else if(template==='boss'){
    beast.hp = beast.maxHp = beast.maxHp*4;
    beast.atk = Math.round(beast.atk*2);
    beast.def = Math.round(beast.def*2);
    beast.spa = Math.round(beast.spa*2);
    beast.sdef = Math.round(beast.sdef*2);
  }
  beast.hp = beast.maxHp;
  return beast;
}
/* 从地图 fightPool 按品质权重选怪 */
function pickPoolSpecies(pool){
  const w = pool.weights||{normal:6, elite:3, perfect:1.2, legend:.25};
  const valid = (pool.species||[]).filter(sid=>allSpeciesDef(sid));
  if(!valid.length) return 'JL_fire_normal_0001';
  const total = valid.reduce((a,sid)=> a + (w[allSpeciesDef(sid).rarity]||1), 0);
  let r = Math.random()*total;
  for(const sid of valid){
    r -= (w[allSpeciesDef(sid).rarity]||1);
    if(r<=0) return sid;
  }
  return valid[0];
}