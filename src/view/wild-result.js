

/* 结果中继（result 态）：显示上个节点结果 + 继续 */
function renderWildResult(){
  const w = S.wild;
  if(w.phase!=='result') return null;
  const last = w.loots[w.loots.length-1];
  const card = el('div','wild-node-card','');
  card.innerHTML = '<div class="wn-tag">这处节点</div><div class="wn-desc">'+last.desc+'</div>'+
    (last.names?'<div class="loot-grid"><div class="loot-item"><span class="li-name">'+last.names+'</span></div></div>':'');
  const ar = el('div','action-row','');
  const nb = el('button','btn','继续前行');
  nb.onclick = wildNodeDone;
  ar.appendChild(nb);
  card.appendChild(ar);
  return card;
}

/* 冒险总结 */
function renderWildSummary(){
  const w = S.wild;
  const card = el('div','card','');
  card.appendChild(el('h3',null,'本次探索 · 收获盘点'));
  if(w.loots.length===0){
    card.appendChild(el('div','muted','一无所获。'));
  } else {
    w.loots.forEach(l=>{
      card.appendChild(el('div','log-item ling','<span class="lt">节点</span>'+l.desc+(l.names?'<br><b style="color:var(--gold)">'+l.names+'</b>':'')));
    });
  }
  if(S.wonderQueue.length){
    card.appendChild(el('div','log-item shiny','<span class="lt">奇遇囊（待副本结算兑现）</span>'+S.wonderQueue.map(x=>x.desc).join('；')));
  }
  const resetW = ()=>({mapId:w.mapId, state:'idle', grid:null, px:0, py:0, exitX:0, exitY:0, spiritId:w.spiritId, phase:'move', battle:null, story:null, storyIdx:0, storyNode:null, loots:[], log:[], fledFrom:null});
  const ma = el('div','modal-actions','');
  const again = el('button','btn','再探荒野');
  again.onclick = ()=>{ S.wild = resetW(); savePlay(); renderWild(); };
  const home = el('button','btn ghost','返回营地');
  home.onclick = ()=>{ S.wild = resetW(); savePlay(); location.hash='#/stable'; };
  ma.appendChild(again); ma.appendChild(home);
  card.appendChild(ma);
  return card;
}