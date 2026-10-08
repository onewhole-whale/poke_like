
/* 事件链主渲染 */
function renderEventChain(){
  const w = S.wild;
  const chain = EVENT_CHAINS[w.chainId];
  const card = el('div','wild-node-card','');
  const tag = chain.kind==='wonder' ? '奇遇' : '冒险';
  card.innerHTML = '<div class="wn-tag">'+tag+' · '+chain.name+'</div>';

  // loseMats 面板
  if(w.chainLose){
    const L = w.chainLose;
    card.appendChild(el('div','sl-text','你在混乱中丢了东西。挑出要舍弃的 '+L.qty+' 件素材：'));
    const bag = Object.keys(matState).filter(id=>(matState[id]||0)>0);
    if(!bag.length){
      // 背包无素材，直接结束
      w.chainLose = null;
      w.phase = 'move';
      renderWild();
      return el('div','');
    }
    const list = el('div','','');
    bag.forEach(id=>{
      const m = matInfo(id);
      const row = el('div','chain-lose-row','');
      const qm = QUALITY_MAT[m.quality]||{};
      row.innerHTML = '<label style="display:flex;justify-content:space-between;padding:6px 10px;border:1px solid var(--line);border-radius:4px;margin-bottom:4px;cursor:pointer">'+
        '<span><span class="dot" style="display:inline-block;width:8px;height:8px;border-radius:50%;background:'+(qm.color||'#999')+';margin-right:6px"></span>'+(m.name||id)+'</span>'+
        '<span class="muted">×'+(matState[id]||0)+'</span></label>';
      row.onclick = ()=>{
        const i = w.chainLose.picks.indexOf(id);
        if(i>=0) w.chainLose.picks.splice(i,1);
        else if(w.chainLose.picks.length < w.chainLose.qty) w.chainLose.picks.push(id);
        renderWild();
      };
      if(w.chainLose.picks.includes(id)) row.style.borderColor = 'var(--cinnabar)';
      list.appendChild(row);
    });
    card.appendChild(list);
    const btn = el('button','btn primary','确认损失（'+w.chainLose.picks.length+'/'+w.chainLose.qty+'）');
    btn.disabled = w.chainLose.picks.length < w.chainLose.qty && bag.length >= w.chainLose.qty;
    btn.onclick = ()=>{
      w.chainLose.picks.forEach(id=>{ matState[id] = Math.max(0, (matState[id]||0)-1); });
      w.chainLose = null;
      w.phase = 'move';
      renderWild();
    };
    card.appendChild(btn);
    return card;
  }

  let node = chain.nodes[w.chainNode];
  if(!node){ w.phase='move'; renderWild(); return el('div',''); }

  // check 节点：进入自动判定
  if(node.kind==='check'){
    const sp = wildSpirit();
    const panel = eventStatPanel(node.check.stat, node.check.race, node.check.iv, node.check.lvlRef);
    const pass = true; // 事件链判定基准：面板静态值 vs 阈值（阈值=面板公式同参数）
    // 实际判定：当前出战精灵面板 stat >= 阈值
    const my = sp ? (spiritStats(sp).spd||0) : 0;
    const ok = my >= panel;
    card.appendChild(el('div','sl-text', node.text));
    card.appendChild(el('div','story-line',''));
    const line = card.lastChild;
    line.appendChild(el('div','sl-tag','判定'));
    line.appendChild(el('div','sl-text', ok ? '你稳住了身形，翻了过去。' : '脚下一滑，你摔了下去，只能改道。'));
    const nxt = el('button','btn primary', ok ? '继续' : '改道');
    nxt.onclick = ()=>{
      if(!ok && node.failEffects) applyChainEffects(node.failEffects);
      w.chainNode = ok ? node.success : node.fail;
      renderWild();
    };
    card.appendChild(nxt);
    return card;
  }

  // end 节点
  if(node.kind==='end'){
    card.appendChild(el('div','sl-text', node.text));
    applyChainRewards(node.rewards);
    applyChainEffects(node.effects);
    if(node.rewards && node.rewards.length){
      const names = node.rewards.map(r=>{
        const m = matInfo(r.id);
        return (m ? m.name : r.id) + ' ×' + (r.qty||1);
      }).join('、');
      card.appendChild(el('div','hl2','收获：'+names));
    }
    const close = el('button','btn primary','收队');
    close.onclick = ()=>{
      // 标记当前格已 resolved
      const g = w.grid;
      const c = g && g.cells && g.cells[w.py] && g.cells[w.py][w.px];
      if(c) c.resolved = true;
      w.phase = 'move';
      renderWild();
    };
    card.appendChild(close);
    return card;
  }

  // choice 节点
  card.appendChild(el('div','sl-text', node.text));
  const row = el('div','action-row','');
  node.choices.forEach(ch=>{
    const b = el('button','action-btn'+(ch.good?' primary2':''), '<span class="ab-t">'+ch.label+'</span>');
    // cond 不满足置灰
    let disabled = false;
    if(ch.cond && !evalCond(ch.cond)) disabled = true;
    b.disabled = disabled;
    b.onclick = ()=>{
      if(ch.battle){
        // 战斗分支（车轮战）
        const params = (MAP_CONFIGS[w.mapId].eventConfig.eventParams||{})[ch.battle];
        if(!params || !params.enemies || !params.enemies.length){ return; }
        w.chainPending = {winNext:ch.battleWin, loseEffects:ch.battleLoseEffects, winRewards:ch.winRewards,
          enemies:params.enemies, idx:0};
        startChainBattle(0);
        return;
      }
      if(ch.check){
        // 内嵌 check（选项点击后判定）
        const sp = wildSpirit();
        const panel = eventStatPanel(ch.check.stat, ch.check.race, ch.check.iv, ch.check.lvlRef);
        const my = sp ? (spiritStats(sp).spd||0) : 0;
        const ok = my >= panel;
        if(ok){
          applyChainRewards(ch.successRewards);
          applyChainEffects(ch.successEffects);
          w.chainNode = ch.successNext;
        } else {
          applyChainEffects(ch.failEffects);
          if(ch.failEffects && ch.failEffects.some(e=>e.type==='loseMats')){
            w.chainLose = {qty:rollLoseQty(ch.failEffects.find(e=>e.type==='loseMats').qty), picks:[]};
          } else if(ch.end){
            // 直接结束
            const g = w.grid; const c = g && g.cells && g.cells[w.py] && g.cells[w.py][w.px];
            if(c) c.resolved = true;
            w.phase='move';
          }
        }
        renderWild();
        return;
      }
      if(ch.rewards) applyChainRewards(ch.rewards);
      if(ch.effects) applyChainEffects(ch.effects);
      if(ch.loseMats){
        w.chainLose = {qty:rollLoseQty(ch.loseMats), picks:[]};
      } else if(ch.end){
        const g = w.grid; const c = g && g.cells && g.cells[w.py] && g.cells[w.py][w.px];
        if(c) c.resolved = true;
        w.phase='move';
      } else if(ch.next){
        w.chainNode = ch.next;
      }
      renderWild();
    };
    row.appendChild(b);
  });
  card.appendChild(row);
  return card;
}