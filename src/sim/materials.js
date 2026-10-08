
/* 某精灵配置的掉落物（含自定义精灵 / 编辑覆盖） */
function dropsOf(speciesId){
  const sp = allSpeciesDef(speciesId);
  if(!sp) return [];
  return (sp.drops||[]).map(id=>allMatDef(id)).filter(Boolean);
}
/* 全部妖兽来源素材 id：通用妖兽素材 + 各精灵已配置的掉落物（保证与精灵编辑页一致） */
function beastMatIds(){
  const set = new Set(Object.keys(MATS).filter(id=>MATS[id].type==='beast'));
  allSpecies().forEach(sp=>{ (sp.drops||[]).forEach(id=>{ if(allMatDef(id)) set.add(id); }); });
  return [...set];
}
/* 精魄：按精灵区分（如 烬烬狼精魄），仅用于对应精灵的副本调整 */
function essenceName(speciesId){
  const sp = allSpeciesDef(speciesId);
  return (sp && sp.essenceName) ? sp.essenceName : (sp ? sp.name+'精魄' : '精魄');
}
function essenceOf(speciesId){ return S.essences[speciesId]||0; }
function allEssences(){
  return allSpecies().map(sp=>({speciesId:sp.id, name:essenceName(sp.id), elem:sp.elem, count:essenceOf(sp.id), from:sp.id}));
}

/* 素材解析：品质 → 能级（低阶垫材 / 中阶 / 高阶） */
function matInfo(id){
  const m = allMatDef(id);
  if(!m) return null;
  const qr = QUALITY_RANK[m.quality]!=null ? QUALITY_RANK[m.quality] : 0;
  const tier = qr>=3 ? 'high' : (qr>=1 ? 'mid' : 'low');
  return {...m, tier};
}