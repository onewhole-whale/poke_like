

/* ================= M2-C 图鉴收集视图 ================= */
var dexMileOpen = false;
function dexChestSvg(){
  return '<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9.5h16V19a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V9.5z" fill="currentColor" opacity=".28" stroke="currentColor" stroke-width="1.4"/><path d="M3 9.5h18V8a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v1.5z" fill="currentColor" opacity=".5" stroke="currentColor" stroke-width="1.4"/><path d="M12 6v14M10.2 12.2h3.6v2.4h-3.6z" fill="none" stroke="currentColor" stroke-width="1.4"/></svg>';
}
function dexMileTrack(mss, prog){
  const track = el('div','dex-mile','');
  const rail = el('div','mile-rail','');
  rail.innerHTML = '<div class="mile-fill" style="width:'+(prog.pct*100)+'%"></div>';
  const scale = prog.total || 1;
  mss.forEach(ms=>{
    const st = dexMilestoneState(ms);
    const node = el('button','mile-node'+(st.claimed?' claimed':(st.met?' ready':'')));
    node.type = 'button';
    node.style.left = (ms.threshold / scale * 100) + '%';
    const status = st.claimed ? '已领取' : (st.met ? '可领取' : '未达成');
    node.setAttribute('data-tip', ms.label+' · 洗髓露 ×'+ms.reward.qty+' · '+status);
    node.setAttribute('aria-label', ms.label+' 洗髓露 ×'+ms.reward.qty+' '+status);
    node.innerHTML = '<span class="mile-box">'+dexChestSvg()+'</span><span class="mile-n">'+ms.threshold+'</span>';
    node.onclick = ()=>{ if(st.met && !st.claimed && claimDexMilestone(ms)) renderDex(); };
    rail.appendChild(node);
  });
  track.appendChild(rail);
  return track;
}
function renderDex(){
  const root = $('#dex-root'); root.innerHTML='';
  const prog = dexProgress();
  // —— 顶部进度卡 ——
  const head = el('div','card','');
  head.appendChild(el('h3',null,'收集进度 <span class="sub">已点亮 '+prog.owned+' / '+prog.total+' · '+(prog.pct*100).toFixed(1)+'%</span>'));
  const mss = dexMilestones();
  const readyN = mss.filter(ms=>{ const st = dexMilestoneState(ms); return st.met && !st.claimed; }).length;
  const bar = el('div','dex-progress','');
  bar.innerHTML = '<div class="dp-bar"><i style="width:'+(prog.pct*100)+'%"></i></div>';
  const chest = el('button','dp-chest'+(readyN?' ready':'')+(dexMileOpen?' open':''), dexChestSvg()+(readyN?'<span class="dp-badge">'+readyN+'</span>':''));
  chest.type = 'button';
  chest.setAttribute('aria-label','收集奖励');
  chest.onclick = ()=>{ dexMileOpen = !dexMileOpen; renderDex(); };
  bar.appendChild(chest);
  head.appendChild(bar);
  if(dexMileOpen) head.appendChild(dexMileTrack(mss, prog));
  root.appendChild(head);
  // —— 卡片网格：按全局图鉴顺序 001..N 连续渲染（贴合宝可梦式图鉴，不分组避免系内跳号） ——
  const grid = el('div','dex-grid');
  const list = dexSpeciesList();
  list.forEach((sp, idx)=>{
    const seen = S.dexSeen[sp.id];
    const shiny = hasShinySpecies(sp.id);
    const no = idx+1;
    const card = el('div','dex-card elem-'+sp.elem+(seen?'':' unseen')+(shiny?' has-shiny':''));
    // 编号 + 品级角标
    card.innerHTML = '<div class="dx-top"><span class="dx-no">'+String(no).padStart(3,'0')+'</span>'+
      '<span class="dx-grade">'+gradeName(sp)+'</span></div>'+
      '<div class="dx-body">'+
        (seen
          ? '<div class="dx-name">'+esc(sp.name)+'</div>'+
            (sp.tags&&sp.tags.length?'<div class="dx-tags">'+sp.tags.map(t=>'【'+esc(t)+'】').join(' ')+'</div>':'')
          : '<div class="dx-name">？？？</div><div class="dx-tags">尚未遇见</div>')+
      '</div>'+
      '<div class="dx-bot">'+
        (seen ? '<span class="elem-dot '+(ELEM[sp.elem]?ELEM[sp.elem].dot:'dot-rare')+'"></span>' : '<span class="dx-qmark">？</span>')+
        (shiny ? '<span class="dx-shiny" title="已获得异色">✦</span>' : '')+
      '</div>';
    card.onclick = ()=> openDexDetail(sp.id);
    grid.appendChild(card);
  });
  root.appendChild(grid);
}
/* 素材图鉴（#/matdex）：全素材按来源分组。获得过即点亮，用尽不熄灭。 */
function renderMatDex(){
  const root = $('#matdex-root'); root.innerHTML='';
  const all = [...new Set([...Object.keys(MATS), ...Object.keys(S.customMats)])]
    .map(allMatDef).filter(Boolean);
  const seenN = all.filter(m=>matEverSeen(m.id)).length;
  const head = el('div','card','');
  head.appendChild(el('h3',null,'素材图鉴 <span class="sub">共 '+all.length+' 种 · 已点亮 '+seenN+' 种</span>'));
  root.appendChild(head);
  ['ore','plant','beast'].forEach(tp=>{
    const list = all.filter(m=>m.type===tp);
    if(!list.length) return;
    const group = el('div','codex-group');
    group.appendChild(el('h4',null, MAT_TYPE[tp].name+'素材'));
    const grid = el('div','mat-grid');
    list.sort((a,b)=>(QUALITY_RANK[a.quality]||0)-(QUALITY_RANK[b.quality]||0)).forEach(m=>{
      const cell = matGridItem(m, null, ()=>openMatDexDetail(m.id));
      if(!matEverSeen(m.id)) cell.classList.add('unheld');
      grid.appendChild(cell);
    });
    group.appendChild(grid);
    root.appendChild(group);
  });
  const es = allEssences();
  if(es.length){
    const g = el('div','codex-group');
    g.appendChild(el('h4',null,'专属精魄 <span class="sub">重复灵兽所得 · 仅用于对应精灵的副本调整</span>'));
    es.forEach(e=>{
      const from = allSpeciesDef(e.from);
      const row = el('div','codex-row');
      row.innerHTML = '<div class="cr-name"><span class="elem-dot '+(ELEM[e.elem]?ELEM[e.elem].dot:'dot-rare')+'"></span>'+esc(e.name)+'<span class="quality-tag fine">专属</span></div>'+
        '<div class="cr-meta">持有 '+e.count+' · 重复炼化「'+(from?esc(from.name):'')+'」所得，投入副本只增强'+(from?esc(from.name):'')+'</div>';
      g.appendChild(row);
    });
    root.appendChild(g);
  }
}
/* 素材图鉴详情弹窗：元信息 + 描述 + 生态/外观（字段存在才显示，与精灵图鉴一致） */
function openMatDexDetail(id){
  const m = allMatDef(id); if(!m) return;
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  const q = QUALITY[m.quality]||QUALITY.normal;
  mb.appendChild(el('h2',null, esc(m.name)+' <span class="quality-tag '+(QUALITY_RANK[m.quality]>=3?'good':(QUALITY_RANK[m.quality]>=2?'fine':'poor'))+'">'+q.name+'</span>'));
  const meta = [];
  if(m.elem && m.elem!=='none') meta.push(elemName(m.elem)+'系');
  if(m.type) meta.push(MAT_TYPE[m.type].name+'素材');
  meta.push(matEverSeen(m.id) ? '已收录' : '尚未收录');
  if(m.from){ const from = allSpeciesDef(m.from); meta.push('掉落自「'+(from?esc(from.name):'?')+'」'); }
  if(S.customMats[id]) meta.push('自定义素材');
  mb.appendChild(el('div','m-sub', meta.join(' · ')));
  if(m.tags && m.tags.length) mb.appendChild(el('div','muted','词条：'+m.tags.map(t=>'【'+esc(t)+'】').join(' ')));
  if(m.desc) mb.appendChild(el('div','muted', esc(m.desc)));
  if(m.ecology){
    mb.appendChild(el('h3',null,'生态'));
    mb.appendChild(el('div','muted', esc(m.ecology)));
  }
  if(m.appearance){
    mb.appendChild(el('h3',null,'外观'));
    mb.appendChild(el('div','muted', esc(m.appearance)));
  }
  const ma = el('div','modal-actions','');
  ma.appendChild(el('button','btn ghost','收起'));
  mb.appendChild(ma);
  mb.querySelector('button').onclick = closeOverlay;
  ov.classList.add('open');
}
/* 图鉴卡片详情弹窗：种族值/描述/产出/炼化条件/进化链 */
function openDexDetail(speciesId){
  const sp = allSpeciesDef(speciesId);
  if(!sp) return;
  const seen = S.dexSeen[speciesId];
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  mb.appendChild(el('h2',null, (seen?esc(sp.name):'？？？') +
    (sp.rarity==='legend'?' <span class="quality-tag good">传说</span>':'')+
    (sp.rarity==='perfect'?' <span class="quality-tag good">完美</span>':'')+
    (sp.rarity==='elite'?' <span class="quality-tag fine">精英</span>':'')+
    (sp.rarity==='normal'?' <span class="quality-tag poor">普通</span>':'')));
  if(!seen){
    mb.appendChild(el('div','m-sub','尚未遇见此灵兽。在野外冒险、炼妖壶炼化或进化途中，它会留名于此。'));
    mb.appendChild(el('div','modal-actions','<button class="btn ghost" id="m-close">收起</button>'));
    $('#m-close').onclick = closeOverlay;
    ov.classList.add('open');
    return;
  }
  mb.appendChild(el('div','m-sub', ELEM[sp.elem]?ELEM[sp.elem].name:sp.elem+'系 · 速度 '+sp.speed+' · '+esc(sp.desc||'')));
  // 种族值
  const base = speciesBase(sp);
  const stTxt = 'HP '+base.hp+' · 攻 '+base.atk+' · 防 '+base.def+' · 特攻 '+base.spa+' · 特防 '+base.sdef+' · 速 '+base.spe;
  mb.appendChild(el('div','muted','种族值：'+stTxt));
  // 生态描述 / 外观描述（v1.16.2：长文本分区，字段缺省则隐藏区块）
  if(sp.ecology){
    mb.appendChild(el('h3',null,'生态'));
    mb.appendChild(el('div','muted', esc(sp.ecology)));
  }
  if(sp.appearance){
    mb.appendChild(el('h3',null,'外观'));
    mb.appendChild(el('div','muted', esc(sp.appearance)));
  }
  // 掉落物
  const drops = dropsOf(speciesId);
  if(drops.length){
    mb.appendChild(el('h3',null,'掉落素材'));
    const dl = el('div','','');
    drops.forEach(d=>{
      dl.appendChild(el('div','cr-meta','<span class="elem-dot '+(ELEM[d.elem]?ELEM[d.elem].dot:'')+'"></span>'+
        esc(d.name)+' <span class="quality-tag '+(QUALITY_RANK[d.quality]>=3?'good':(QUALITY_RANK[d.quality]>=2?'fine':'poor'))+'">'+QUALITY[d.quality].name+'</span>'));
    });
    mb.appendChild(dl);
  }
  // 炼化配方
  const rule = refineRules().find(r=>r.pool==='spirit' && (r.cond&&r.cond.spirits||[]).includes(speciesId));
  if(rule){
    mb.appendChild(el('h3',null,'炼化配方'));
    mb.appendChild(el('div','muted', ruleCondDesc(rule)+' → '+ruleOutDesc(rule)));
  }
  // 进化链
  const branches = evoBranchesOf(sp);
  const preds = allSpecies().filter(x=> evoBranchesOf(x).some(b=>b.to===speciesId));
  if(branches.length || preds.length){
    mb.appendChild(el('h3',null,'进化链'));
    if(preds.length){
      mb.appendChild(el('div','muted','进化自：'+preds.map(p=>esc(p.name)).join('、')));
    }
    if(branches.length){
      branches.forEach(b=>{
        const tgt = allSpeciesDef(b.to);
        mb.appendChild(el('div','muted','→ '+esc(tgt?tgt.name:b.to)+'（'+evoCondText(b.cond)+'）'));
      });
    }
  }
  // 若在灵兽仓，提供跳转
  const sid = spiritIdOfSpecies(speciesId);
  const ma = el('div','modal-actions','');
  if(sid){
    const go = el('button','btn primary','查看灵兽详情');
    go.onclick = ()=>{ closeOverlay(); openDetail(sid); };
    ma.appendChild(go);
  }
  const cancel = el('button','btn ghost','收起'); cancel.onclick = closeOverlay;
  ma.appendChild(cancel);
  mb.appendChild(ma);
  ov.classList.add('open');
}