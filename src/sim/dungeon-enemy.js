
function buildEnemyList(mats, lvl){
  const list = [];
  const st = enemyStats(mats);
  st.beasts.forEach(b=>{
    const n = Math.ceil(b.n/5);
    for(let i=0;i<n;i++) list.push(dungeonBeast(b.speciesId, lvl));
  });
  if(st.plants>0){
    const n = Math.ceil(st.plants/5);
    const elems = ['fire_spirit','water_spirit','grass_spirit','earth_spirit','wind_spirit','thunder_spirit','ice_spirit','poison_spirit'];
    for(let i=0;i<n;i++) list.push(dungeonBeast(pick(elems), lvl));
  }
  if(st.ores>0){
    const n = Math.ceil(st.ores/5);
    const golems = ['stone_golem','iron_golem','crystal_golem','lava_golem','frost_golem'];
    for(let i=0;i<n;i++) list.push(dungeonBeast(pick(golems), lvl));
  }
  // 进入前随机洗牌
  for(let i=list.length-1;i>0;i--){ const j=Math.floor(Math.random()*(i+1)); const t=list[i]; list[i]=list[j]; list[j]=t; }
  return list;
}
/* 副本敌人：等级 = 出战灵兽等级（按野生妖兽生成逻辑） */
function dungeonBeast(speciesId, lvl){
  const sp = allSpeciesDef(speciesId);
  const base = speciesBase(sp);
  const mk = r => Math.floor(2*r*lvl/100);
  const hp = mk(base.hp) + lvl + 10;   // 敌人生成：hp 不带个体值（原设计保持）
  const nature = pick(NATURES).id;
  const iv = genRandomIV();
  const jitter = Math.floor(Math.random()*3);
  return {
    speciesId, name:sp.name, elem:sp.elem, hp, maxHp:hp, nature, iv,
    atk:  Math.round((mk(base.atk) + 5 + ivContribution(iv,'atk',lvl) + jitter) * natureMult(nature,'atk')),
    def:  Math.round((mk(base.def) + 5 + ivContribution(iv,'def',lvl)) * natureMult(nature,'def')),
    spa:  Math.round((mk(base.spa) + 5 + ivContribution(iv,'spa',lvl) + jitter) * natureMult(nature,'spa')),
    sdef: Math.round((mk(base.sdef) + 5 + ivContribution(iv,'sdef',lvl)) * natureMult(nature,'sdef')),
    spd:  Math.round((mk(base.spe) + 5 + ivContribution(iv,'spe',lvl) + Math.floor(Math.random()*9-4)) * natureMult(nature,'spe')),
    lvl,
  };
}