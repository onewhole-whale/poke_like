

/* 正式落库/飞升 */
function landSpirit({speciesId, shiny, source, fromRefine, beastId, rainbow, nature, iv}){
  // 飞升承接：异色妖兽承接，无论本次炼化之姿，终得异色灵兽
  let beast = null;
  if(beastId){
    beast = S.beasts.find(b=>b.id===beastId);
    if(beast && beast.shiny) shiny = true;
  }
  // M2-B 上游校验：承接 elite/perfect 灵兽时，妖兽必须来自其进化链上游形态
  const tgtSp = allSpeciesDef(speciesId);
  if(beast && tgtSp && (tgtSp.rarity==='elite' || tgtSp.rarity==='perfect')){
    if(!isEvoAncestor(speciesId, beast.speciesId)){
      toast('该妖兽形态无法承接「'+tgtSp.name+'」：需使用其进化链上游形态的妖兽承接','bad');
      S.logs.unshift({t:stampNow(), cls:'bad', text:'飞升承接失败：<b>'+tgtSp.name+'</b> 需要进化链上游形态的妖兽，而不是 <b>'+(allSpeciesDef(beast.speciesId)?allSpeciesDef(beast.speciesId).name:beast.speciesId)+'</b>。'});
      renderRefine();
      return;
    }
  }
  if(!shiny && hasNormal(speciesId)){
    // 重复普通 → 该精灵的专属精魄
    const en = essenceName(speciesId);
    S.essences[speciesId] = (S.essences[speciesId]||0)+1;
    saveDraft();
    S.logs.unshift({t:stampNow(), cls:'spirit', text:'同种普通灵兽唯一，'+(fromRefine?'新炼化出的':'')+' '+allSpeciesDef(speciesId).name+' 化作 <b>'+en+' ×1</b>，供养仓库中那只。'});
    renderRefine();
    toast(allSpeciesDef(speciesId).name+' 已有一尊，化作'+en,'gold');
    return;
  }
  const sp = makeSpirit(speciesId, shiny, source);
  if(nature) sp.nature = nature;              // 落库自选 / 飞升继承妖兽性格（M2-A1）
  if(iv) sp.iv = iv;                          // 落库自选个体值（M2-A3）
  else if(beast) sp.iv = beast.iv||{};        // 飞升承接：个体值随旧魂继承
  if(rainbow) sp.rainbowAscended = true;   // 异色妖兽承接飞升：出身即传奇
  if(beast){ S.beasts = S.beasts.filter(b=>b.id!==beast.id); }
  S.spirits.push(sp);
  markDexSeen(speciesId);   // M2-C：灵兽入仓点亮图鉴
  S.logs.unshift({t:stampNow(), cls: shiny?'shiny':'spirit', text:'（'+(shiny?'异色':'普通')+'）<b>'+sp.name+'</b> 入仓。'+(shiny?' 天生异色，独此一尊。':'')+(rainbow?' <span class="tag shiny">由异色妖兽承接飞升</span>':'')});
  renderRefine();
  toast((shiny?'异色 ':'')+sp.name+' 入仓'+(shiny?' · 天生异色':''));
}