

/* 炼化结果处理 */
function resolveRefine(o){
  if(o.kind==='mat'){
    S.aura += o.n;
    S.logs.unshift({t:o.stamp, cls:'ling', text:'投入「'+o.used+'」，炉中凝出 <b>灵息结晶 ×'+o.n+'</b>。灵息是开启秘境的门票。'});
    renderRefine();
    toast('炼出灵息结晶 ×'+o.n);
  } else if(o.kind==='mats'){
    // 常规产出落库
    o.gains.forEach(g=>{
      if(g.id==='__ling__'){ S.aura += g.n; }
      else if(g.id && g.id.startsWith('sprout-')){ sproutsAdd(g.elem, g.n); }
      else { matState[g.id] = (matState[g.id]||0)+g.n; markMatSeen(g.id); }
    });
    const names = o.gains.map(g=>'<b>'+g.name+' ×'+g.n+'</b>').join('、');
    S.logs.unshift({t:o.stamp, cls:'sprout', text:'投入「'+o.used+'」，壶中滚出 '+names+'。'});
    renderRefine();
    toast('炼出 '+o.gains.map(g=>g.name).join('、'),'gold');
  } else if(o.kind==='sprout'){
    sproutsAdd('any',1);
    S.logs.unshift({t:o.stamp, cls:'sprout', text:'投入「'+o.used+'」，壶中滚出一枚 <b>元素萌芽</b>。它是灵兽的分支，可养成，亦可化作灵息。'});
    renderRefine();
    toast('炼出元素萌芽','gold');
  } else {
    // 出灵兽 → 落地二选一
    const sp = allSpeciesDef(o.speciesId);
    openLandingModal(o, sp);
  }
}