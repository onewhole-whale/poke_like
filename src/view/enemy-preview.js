
function renderEnemyPreview(sp){
  const view = $('#enemy-preview'); view.innerHTML='';
  const st = enemyStats(S.buildMats);
  const rows = [];
  st.beasts.forEach(b=>{
    const spd = allSpeciesDef(b.speciesId);
    if(spd) rows.push('<div class="preview-line"><span>'+spd.name+'（妖兽）</span><b>'+Math.ceil(b.n/5)+' 只</b></div>');
  });
  if(st.plants>0) rows.push('<div class="preview-line"><span>元素灵（植物素材）</span><b>'+Math.ceil(st.plants/5)+' 只</b></div>');
  if(st.ores>0) rows.push('<div class="preview-line"><span>巨像（矿石素材）</span><b>'+Math.ceil(st.ores/5)+' 只</b></div>');
  if(rows.length===0){
    view.appendChild(el('div','muted','当前没有敌人。存在分满 1000 可直接结算，不满则不能出发。'));
  } else {
    view.innerHTML = rows.join('');
    view.appendChild(el('div','tiny','敌人等级 = '+sp.name+' 当前等级（'+(sp.lvl||1)+'）；出场顺序进入前随机。'));
  }
}