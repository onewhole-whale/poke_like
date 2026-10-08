

/* M3-2 补丁：战斗结果弹框（野生 / 事件链统一出口） */
function battleResultModal(b, sp){
  const won = b.phase==='won';
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  mb.appendChild(el('h2',null, won ? '战斗胜利' : '战斗失败'));
  const ma = el('div','modal-actions','');
  if(won && b.chainCtx){
    const p = S.wild.chainPending;
    const more = p && p.idx+1 < p.enemies.length;
    mb.appendChild(el('div','m-sub','击破 <b>'+esc(b.beast.name)+'</b> Lv.'+(b.beast.lvl||1)+(more?' · 事件链还剩 '+(p.enemies.length-p.idx-1)+' 只待战':' · 事件链敌人尽数击破！')));
    const btn = el('button','btn primary', more ? '继续挑战' : '领取奖励');
    btn.onclick = ()=>{
      window.__modalLock=false; closeOverlay();
      if(more){
        gainExp(wildSpirit(), b.beast.lvl||1, b.beast.rarity, b.beast.template);
        S.wild.chainPending.idx++;
        startChainBattle(S.wild.chainPending.idx);
      } else {
        applyChainRewards(p && p.winRewards);
        const nxt = p ? p.winNext : null;
        S.wild.chainPending = null; S.wild.battle = null; S.wild.chainNode = nxt;
        S.wild.phase = 'chain'; renderWild();
      }
    };
    ma.appendChild(btn);
  } else if(won){
    mb.appendChild(el('div','m-sub','击破 <b>'+esc(b.beast.name)+'</b> —— 决定它的去留，随后返回地图：'));
    const killBtn = el('button','btn','杀死 · 剥取素材');
    killBtn.onclick = ()=>{
      window.__modalLock=false; closeOverlay();
      let drops = beastDrops(b.beast.speciesId, 'kill');
      if(b.template==='elite'||b.template==='boss'){
        // C3：基础掉落保留 + 额外解锁 bump 档同型素材（不筛掉基础）
        for(const k in drops){ const up=upMatFor(k,b.template); if(up!==k) drops[up]=(drops[up]||0)+drops[k]; }
      }
      applyLoot(drops);
      const g = gainExp(sp, b.beast.lvl||1, b.beast.rarity, b.beast.template);
      if(b.spHp>=b.spMax) sp.flawless=(sp.flawless||0)+1;
      wildLoot('你杀死了'+b.beast.name+'。'+(g.lvls>0?'<br>'+sp.name+' 升到 Lv.'+sp.lvl+'！':''), drops);
      wildNodeDone();
    };
    const catchBtn = el('button','btn primary','捕捉 · 留它活口');
    catchBtn.onclick = ()=>{
      window.__modalLock=false; closeOverlay();
      if(roll(.6)){
        const shiny = roll(S.demo? .15 : .03);
        S.beasts.push({id:uid(), speciesId:b.beast.speciesId, shiny, caught:MAP_CONFIGS[S.wild.mapId].name+' · 活捉', nature:b.beast.nature||pick(NATURES).id, iv:b.beast.iv||{}});
        markDexSeen(b.beast.speciesId);   // v1.20.5 P0-4：捕捉成功点亮图鉴
        if(!sp.beastKinds) sp.beastKinds=[];
        if(!sp.beastKinds.includes(b.beast.speciesId)) sp.beastKinds.push(b.beast.speciesId);
        gainExp(sp, b.beast.lvl||1, b.beast.rarity, b.beast.template);
        wildLoot('你制服了'+b.beast.name+'。'+(shiny?' 异色！':''), {});
        wildNodeDone();
      } else {
        const drops = beastDrops(b.beast.speciesId, 'catchFail');
        applyLoot(drops);
        gainExp(sp, b.beast.lvl||1, b.beast.rarity, b.beast.template);
        wildLoot('它宁死不从，你下了手。', drops);
        wildNodeDone();
      }
    };
    ma.appendChild(killBtn); ma.appendChild(catchBtn);
  } else {
    if(b.chainCtx && S.wild.chainPending){
      mb.appendChild(el('div','m-sub','<b>'+esc(sp.name)+'</b> 力竭败退，事件链中断，返回地图。'));
      const btn = el('button','btn primary','确认');
      btn.onclick = ()=>{
        window.__modalLock=false; closeOverlay();
        const p = S.wild.chainPending;
        S.wild.chainPending = null; S.wild.battle = null;
        applyChainEffects(p.loseEffects);
        S.wild.phase = 'move'; renderWild();
      };
      ma.appendChild(btn);
    } else {
      mb.appendChild(el('div','m-sub','<b>'+esc(sp.name)+'</b> 力竭败退，侥幸脱身，返回地图。'));
      const btn = el('button','btn primary','确认');
      btn.onclick = ()=>{
        window.__modalLock=false; closeOverlay();
        sp.losses=(sp.losses||0)+1;
        wildLoot(sp.name+' 力竭败退。', {});
        S.wild.state='done'; renderWild();
      };
      ma.appendChild(btn);
    }
  }
  mb.appendChild(ma);
  window.__modalLock = true;   // 结果弹框必须经按钮确认，不允许点遮罩关闭
  ov.classList.add('open');
}

/* 事件渲染 */
function renderWildEvent(node){
  const w = S.wild;
  if(w.phase==='result'){
    const card = el('div','wild-node-card','');
    card.innerHTML = '<div class="wn-tag">事件结果</div>';
    const last = w.loots[w.loots.length-1];
    card.innerHTML += '<div class="wn-desc">'+last.desc+'</div>'+(last.names?'<div class="loot-grid"><div class="loot-item"><span class="li-name">'+last.names+'</span></div></div>':'');
    const ar = el('div','action-row','');
    const nb = el('button','btn','继续前行');
    nb.onclick = wildNodeDone;
    ar.appendChild(nb);
    card.appendChild(ar);
    return card;
  }
  const card = el('div','wild-node-card','');
  let html = '';
  if(node.kind==='beast'){
    html = '<div class="wn-tag">妖兽事件</div><div class="wn-title">妖兽遗踪</div>'+
      '<div class="wn-desc">你发现一片妖兽争斗过的痕迹，散落着残羽与碎骨，还能捡到些有用的东西。</div>';
  } else if(node.kind==='gather'){
    html = '<div class="wn-tag">采集事件</div><div class="wn-title">灵草丛生</div>'+
      '<div class="wn-desc">一片无人打扰的灵草丛。你弯下腰，开始采撷。</div>';
  } else {
    const sub = {mine:'发现矿洞', glean:'捡漏妖兽', spot:'发现宝地'}[node.harvest];
    html = '<div class="wn-tag">大丰收</div><div class="wn-title">'+sub+'</div>';
    if(node.harvest==='mine') html += '<div class="wn-desc">山壁豁开一处矿洞，灵矿在深处闪光。</div>';
    if(node.harvest==='glean') html += '<div class="wn-desc">一只妖兽已气绝多时，许是争斗所伤——捡个现成。</div>';
    if(node.harvest==='spot') html += '<div class="wn-desc">一处灵力充沛的宝地，草木异常繁茂。</div>';
  }
  card.innerHTML = html;
  const ar = el('div','action-row','');
  const eb = el('button','btn primary','探查收获');
  eb.onclick = ()=>{
    let drops = {};
    const cfg = MAP_CONFIGS[S.wild.mapId] || MAP_CONFIGS.gentlebreeze;
    const pool = cfg.eventConfig.fightPools.fight_normal;
    if(node.kind==='beast'){
      drops = beastDrops(pickPoolSpecies(pool), 'calm');
    } else if(node.kind==='gather'){
      drops = {};
    } else {
      if(node.harvest==='mine'){
        wildLoot('矿脉就在眼前——使用工具采集（点击地块采集）。', {});
        return;
      }
      if(node.harvest==='glean'){
        drops = beastDrops(pickPoolSpecies(pool), 'calm');
      } else {
        drops = {};
      }
    }
    applyLoot(drops);
    wildLoot({beast:'你捡到不少妖兽残料。', gather:'你满载而归。', harvest:'这一趟收获颇丰。'}[node.kind], drops);
  };
  ar.appendChild(eb);
  card.appendChild(ar);
  return card;
}