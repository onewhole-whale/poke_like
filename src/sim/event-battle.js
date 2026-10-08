
/* 事件链车轮战：按 enemies 数组顺序连战 */
function startChainBattle(idx){
  const w = S.wild;
  const p = w.chainPending;
  if(!p) return;
  if(idx >= p.enemies.length){
    // 全胜
    applyChainRewards(p.winRewards);
    const nxt = p.winNext;
    w.chainPending = null;
    w.chainNode = nxt;
    w.phase = 'move';
    renderWild();
    return;
  }
  const e = p.enemies[idx];
  const cfg = MAP_CONFIGS[w.mapId];
  const [mn, mx] = cfg.challengeLvl||[1,15];
  // 与 genSandbox beastLvl 同一套规则：boss=max，elite=rand[ceil((min+max)/2),max]，normal=rand[min,max]
  let lvl;
  if(e.template==='boss') lvl = mx;
  else if(e.template==='elite'){ const lo=Math.ceil((mn+mx)/2); lvl = lo + Math.floor(Math.random()*(mx-lo+1)); }
  else lvl = mn + Math.floor(Math.random()*(mx-mn+1));
  const beast = applyTemplate(wildBeast(e.speciesId, lvl), e.template);
  startBattle(beast, 'normal', [], {chainIdx:idx});
}