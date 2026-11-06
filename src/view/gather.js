
function collectTile(c){
  if(c.plant<=0 && c.ore<=0){ toast('此处无可采集资源','bad'); return; }
  if(c.looted){ toast('已采空','bad'); return; }
  if(!spendStamina(1)){ toast('体力不足（采集需 1 点）','bad'); return; }
  // 决定本次大类：plant>0 优先植物，ore>0 优先矿物；都有则随机
  let kind = (c.plant>0 && c.ore>0) ? (Math.random()<.5?'plant':'ore') : (c.plant>0?'plant':'ore');
  // 工具 kind 映射：plant→axe，ore→pick
  const toolKind = kind==='ore' ? 'pick' : 'axe';
  const tool = bestTool(toolKind);
  // 出货判定：有工具 100%；空手 50% 仅普通
  let quality;
  if(tool){
    // 品质锁：roll 品质 > 工具 rank → 重 roll（最多 5 次），仍超出则强制普通
    for(let tries=0; tries<5; tries++){
      quality = rollQuality(c.qualityDist);
      if((QUALITY_RANK[quality]||0) <= tool.rank) break;
      quality = 'normal';
    }
  } else {
    if(Math.random()>=.5){
      toast('空手采集一无所获（50% 出货率）','bad');
      renderWild();
      return;
    }
    quality = 'normal';
  }
  const matId = collectMatId(kind, quality);
  const m = matAny(matId);
  if(m){
    matState[matId] = (matState[matId]||0)+1;
    markMatSeen(matId);
    S.wild.loots.push({id:matId, name:m.name, n:1});
  }
  // 扣资源 = 1 + 2×品质档
  const cost = 1 + 2*(QUALITY_RANK[quality]||0);
  if(kind==='ore') c.ore = Math.max(0, c.ore - cost);
  else c.plant = Math.max(0, c.plant - cost);
  // 工具耐久 -1
  if(tool){
    S.toolDur = S.toolDur||{};
    S.toolDur[tool.id] = (S.toolDur[tool.id] ?? tool.item.durability) - 1;
    if(S.toolDur[tool.id] <= 0){
      S.toolInv[tool.id] = (S.toolInv[tool.id]||1) - 1;
      delete S.toolDur[tool.id];
      toast('工具耐久耗尽：'+tool.item.name+' 损坏了');
    }
  }
  c.looted = true;
  toast('采集完成：'+(m?m.name:'?')+' ×1');
  renderWild();
}

/* 节点渲染 */
function renderWildNode(node){
  const w = S.wild;
  if(w.phase==='battle') return renderWildBattle();
  if(node.type==='beast'){
    if(node.ambush){
      const card = el('div','wild-node-card','');
      card.innerHTML = '<div class="wn-tag">被突袭</div><div class="wn-title">'+node.beast.name+' 从暗处扑出</div>'+
        '<div class="wn-desc">你被 <b>'+node.beast.name+'</b> 突袭了！它先发制人，你来不及反应，只能应战。</div>';
      card.appendChild(el('div','action-row',''));
      const fb = el('button','action-btn primary2','<span class="ab-t">应战</span><span class="ab-d">妖兽突袭先手一击，再正常战斗</span>');
      fb.onclick = ()=> startBattle(node.beast, 'ambush', node.buffs);
      card.querySelector('.action-row').appendChild(fb);
      return card;
    }
    const card = el('div','wild-node-card','');
    card.innerHTML = '<div class="wn-tag">遭遇妖兽 · '+ELEM[node.beast.elem].name+'</div><div class="wn-title">'+node.beast.name+'</div>'+
      '<div class="wn-desc">它在'+MAP_CONFIGS[S.wild.mapId].name+'游荡，还没发现你。你可以正面接触，也可以悄悄靠近。</div>';
    const row = el('div','action-row','');
    const groupLabel = t => { const d=el('div','action-group-label',t); row.appendChild(d); };
    const opts = [
      {t:'正面 · 安抚', d:'40% 免战，掉落少量素材；失败则被发现并进入战斗', act:'calm', cls:''},
      {t:'正面 · 战斗', d:'正面对峙，按速度决定谁先手', act:'fight', cls:''},
      {t:'悄悄 · 离开', d:'算逃离：不完成战斗，退回上一格，妖兽还在', act:'leave', cls:''},
      {t:'悄悄 · 安抚', d:'成功率提高五成（60%）；失败仍会暴露', act:'calm-sneak', cls:''},
      {t:'悄悄 · 突袭', d:'突袭先手一击，再正常战斗', act:'sneak', cls:'primary2'},
    ];
    groupLabel('—— 正面接触 ——');
    ['calm','fight'].forEach(act=>{
      const o = opts.find(x=>x.act===act);
      const b = el('button','action-btn '+o.cls,'<span class="ab-t">'+o.t+'</span><span class="ab-d">'+o.d+'</span>');
      b.onclick = ()=>{
        if(o.act==='calm'){
          if(roll(0.4)){
            const drops = {...beastDrops(node.beast.speciesId, 'calm')};
            applyLoot(drops);
            wildLoot(node.beast.name+' 被安抚，低眉蹭了蹭你的手，留下一点心意。', drops);
            return;
          }
          const failText = '安抚失败了！'+node.beast.name+' 警觉地亮出爪牙，进入战斗。';
          startBattle(node.beast, 'normal', node.buffs);
          if(S.wild.battle){ S.wild.battle.log.unshift({who:'warn', text:'<b>安抚失败</b>：'+failText}); renderWild(); }
          return;
        }
        startBattle(node.beast, 'normal', node.buffs);
      };
      row.appendChild(b);
    });
    groupLabel('—— 悄悄行动 ——');
    ['leave','calm-sneak','sneak'].forEach(act=>{
      const o = opts.find(x=>x.act===act);
      const b = el('button','action-btn '+o.cls,'<span class="ab-t">'+o.t+'</span><span class="ab-d">'+o.d+'</span>');
      b.onclick = ()=>{
        if(o.act==='leave'){
          const w = S.wild;
          const back = w.cameFrom;
          if(back){ w.px = back.x; w.py = back.y; }
          w.phase = 'move';
          w.node = null;
          toast('你悄然离开，妖兽还在原处');
          renderWild();
          return;
        }
        if(o.act==='calm-sneak'){
          if(roll(0.6)){
            const drops = {...beastDrops(node.beast.speciesId, 'calm')};
            applyLoot(drops);
            wildLoot(node.beast.name+' 被安抚，低眉蹭了蹭你的手，留下一点心意。', drops);
            return;
          }
          const failText = '悄悄安抚失败了！'+node.beast.name+' 发现了你，亮出爪牙。';
          startBattle(node.beast, 'normal', node.buffs);
          if(S.wild.battle){ S.wild.battle.log.unshift({who:'warn', text:'<b>安抚失败</b>：'+failText}); renderWild(); }
          return;
        }
        startBattle(node.beast, 'sneak', node.buffs);
      };
      row.appendChild(b);
    });
    card.appendChild(row);
    return card;
  }
  if(node.type==='event'){
    return renderWildEvent(node);
  }
  return el('div','','');
}