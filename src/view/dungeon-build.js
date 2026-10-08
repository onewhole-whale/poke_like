

/* ================= 副本构建视图（M2-A6 重构） ================= */
function renderBuild(){
  const spirits = S.spirits;
  if(!S.buildSpiritId || !spById(S.buildSpiritId)) S.buildSpiritId = spirits[0] ? spirits[0].id : null;
  const box = $('#build-spirits'); box.innerHTML='';
  if(spirits.length===0){
    box.appendChild(el('div','muted','尚无灵兽。先去炼妖壶炼化一尊，再来构建秘境。'));
    $('#build-basic').innerHTML='';
    $('#pool-view').innerHTML='';
    $('#enemy-preview').innerHTML='';
    $('#build-mats').innerHTML='';
    return;
  }
  spirits.forEach(s=>{
    const sp = allSpeciesDef(s.speciesId);
    const card = el('div','sp-card'+(s.id===S.buildSpiritId?' sel':''));
    card.innerHTML = '<div class="sp-name">'+sp.name+(s.shiny?' <span class="tag shiny">异色</span>':'')+'</div>'+
      '<div class="muted" style="margin-top:2px">'+elemTag(sp.elem)+' <span class="tiny">Lv.'+(s.lvl||1)+'</span></div>'+
      '<div class="tiny" style="margin-top:6px">'+essenceName(sp.id)+' ×'+essenceOf(sp.id)+'　冒险 '+s.adventures+' 次</div>';
    card.onclick = ()=>{ S.buildSpiritId = s.id; renderBuild(); };
    box.appendChild(card);
  });
  const sp = spById(S.buildSpiritId);
  // 开启消耗
  const base = $('#build-basic'); base.innerHTML='';
  base.appendChild(el('h3',null,'开启消耗'));
  base.appendChild(el('div','preview-line','<span>灵息结晶（库存 '+S.aura+'）</span><b>−1</b>'));
  base.appendChild(el('div','preview-line','<span>体力（库存 '+S.stamina+'/'+S.staminaMax+'）</span><b>−10</b>'));
  base.appendChild(el('div','muted','秘境由灵息维系。出发后素材即刻消耗，战败不返还。'));
  // 素材投入：标题 + 已选素材方格 + 行尾加号方格（未加入时仅一个加号方框）
  const bmCard = $('#build-mats'); bmCard.innerHTML='';
  const bmGrid = el('div','mat-grid');
  const selIds = Object.keys(S.buildMats).filter(id=>S.buildMats[id]>0);
  selIds.forEach(id=>{
    const m = matInfo(id); if(!m) return;
    bmGrid.appendChild(matGridItem(m, S.buildMats[id]||0, ()=>subBuildMat(id)));
  });
  const plus = el('div','mg-plus','<i>＋</i><span>添加素材</span>');
  plus.onclick = openMatPicker;
  bmGrid.appendChild(plus);
  bmCard.appendChild(bmGrid);
  const bmFoot = el('div','tiny', null);
  const cnt = matsCount(S.buildMats);
  if(cnt>0){
    bmFoot.innerHTML = '已投入 <b>'+cnt+'</b> 单位素材：'+wordsText(aggregateWords(S.buildMats))+'　<span class="muted">（点击方格撤回 1 单位）</span>';
    const clr = el('button','btn sm','全部撤回');
    clr.style.marginLeft='6px';
    clr.onclick = ()=>{ S.buildMats={}; renderBuild(); };
    bmFoot.appendChild(clr);
  } else {
    bmFoot.innerHTML = '尚未投入素材。存在分不足 1000，无法出发。';
  }
  bmCard.appendChild(bmFoot);
  // 精魄拓池：独立附加组件（四功能 × 定向属性）
  const exCard = el('div','expand-card','');
  exCard.appendChild(el('h3',null,'精魄拓池 <span class="sub">消耗 1 枚 '+essenceName(sp?sp.speciesId:'')+' · 为定向属性附加奖励功能</span>'));
  const EXPAND_MODES = [
    ['skills','附加高级技能','向该属性奖励池加入高级技能条目（侵占 250 分存在分）'],
    ['perks','附加高级专长','向该属性奖励池加入高级专长条目（侵占 250 分存在分）'],
    ['repeat','重复抽取','该属性结算时判定两次，最多可得两份收获'],
    ['boost','大幅增概率','该属性抽取概率翻倍（单条目命中上限仍 100%）'],
  ];
  EXPAND_MODES.forEach(([mode,label,desc])=>{
    const row = el('div','expand-row');
    const lbl = el('div','expand-label','<b>'+label+'</b><div class="tiny">'+desc+'</div>');
    row.appendChild(lbl);
    const ctl = el('div','expand-ctl');
    const sel = el('select',null);
    Object.keys(TYPE_CRUSH).forEach(e=>{ const op=el('option',null,ELEM[e].name); op.value=e; sel.appendChild(op); });
    ctl.appendChild(sel);
    const btn = el('button','btn sm','启用');
    btn.onclick = ()=>{
      if(!sp) return;
      const e = sel.value;
      S.buildExpand = S.buildExpand||{};
      const cur = S.buildExpand[e]===true ? {skills:true,perks:true} : (S.buildExpand[e]||{});
      if(cur[mode]){ toast('该属性已启用「'+label+'」','bad'); return; }
      if(essenceOf(sp.speciesId) < 1){ toast(essenceName(sp.speciesId)+'不足','bad'); return; }
      S.essences[sp.speciesId] = essenceOf(sp.speciesId) - 1;
      S.buildExpand[e] = {...cur, [mode]:true}; saveDraft(); renderBuild();
      toast('已为 '+ELEM[e].name+' 属性启用「'+label+'」');
    };
    ctl.appendChild(btn);
    row.appendChild(ctl);
    exCard.appendChild(row);
  });
  const onEx = Object.entries(S.buildExpand||{}).filter(([e,v])=>v && (v===true || v.skills||v.perks||v.repeat||v.boost));
  if(onEx.length){
    const desc = onEx.map(([e,v])=>{
      const o = v===true ? ['附加高级技能','附加高级专长'] : Object.keys(v).filter(k=>v[k]).map(k=>({skills:'高级技能',perks:'高级专长',repeat:'重复抽取',boost:'大幅增概率'}[k]));
      return ELEM[e].name+'：'+o.join('、');
    }).join('；');
    exCard.appendChild(el('div','tiny','已启用：'+desc));
  }
  bmCard.appendChild(exCard);
  // 存在分预览 + 敌人预览
  renderPool(sp);
  renderEnemyPreview(sp);
  // v1.16.7: 0 敌人副本提示
  const btnDepart = $('#btn-depart');
  btnDepart.disabled = !sp;
  if(sp){
    const en = buildEnemyList(S.buildMats, sp.lvl||1);
    if(en.length===0){
      const pl = scorePlan(S.buildMats);
      const total = Object.values(pl).reduce((a,p)=>a+p.total,0);
      if(total<1000){
        btnDepart.disabled = true;
        btnDepart.textContent = '起程入秘境（需存在分满 1000，当前 '+total+'）';
      } else {
        btnDepart.textContent = '起程入秘境（无敌人：直接结算抽奖）';
      }
    } else {
      btnDepart.textContent = '起程入秘境';
    }
  }
}
function openMatPicker(){
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  mb.appendChild(el('h2',null,'选择素材投入'));
  mb.appendChild(el('div','m-sub','点击方格加入副本（可重复点击累计数量，已投 '+matsCount(S.buildMats)+' 单位）。'));
  const holder = Object.keys(matState).filter(id=>matState[id]>0 && !id.startsWith('beast:'));
  const grid = el('div','mat-grid');
  if(holder.length===0){
    mb.appendChild(el('div','muted','背包没有素材。先去炼化或野外采集，才能构建副本。'));
  }
  holder.forEach(id=>{
    const m = isItem(id) ? itemInfo(id) : matInfo(id); if(!m) return;
    grid.appendChild(matGridItem(m, matState[id]||0, ()=>{
      addBuildMat(id);
      openMatPicker();
      renderBuild();
    }));
  });
  mb.appendChild(grid);
  const ma = el('div','modal-actions','');
  const done = el('button','btn primary','完成');
  done.onclick = ()=>{ closeOverlay(); renderBuild(); };
  ma.appendChild(done);
  mb.appendChild(ma);
  ov.classList.add('open');
}