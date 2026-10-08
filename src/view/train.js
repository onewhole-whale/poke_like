

/* ================= 路由 ================= */
function route(){
  if(typeof applyModeButtons==='function') applyModeButtons();
  const h = location.hash.replace(/^#\/?/,'') || 'refine';
  S.view = ['refine','wild','build','settle','train','stable','skills','codex','dex','matdex'].includes(h) ? h : 'refine';
  document.querySelectorAll('.view').forEach(v=>v.classList.remove('active'));
  $('#view-'+S.view).classList.add('active');
  document.querySelectorAll('#nav button').forEach(b=>{
    b.classList.toggle('active', b.dataset.route===S.view);
  });
  render();
}
window.addEventListener('hashchange', route);

/* ================= 修炼视图（M2-A5 挂机） ================= */
function renderTrain(){
  const root = $('#train-root'); root.innerHTML='';
  tickTrain();
  const st = staminaNow();
  // —— 体力卡 ——
  const stCard = el('div','card','');
  stCard.appendChild(el('h3',null,'体力 <span class="sub">每 6 分钟恢复 1 · 元素微粒可立即回复 20</span>'));
  const bar = el('div','train-stamina','');
  bar.innerHTML = '<div class="ts-bar"><i style="width:'+(st/S.staminaMax*100)+'%"></i></div>'+
    '<div class="ts-num">'+st+' / '+S.staminaMax+'</div>'+
    (st<S.staminaMax ? '<div class="ts-next">'+(staminaNextIn()>0 ? staminaNextIn()+' 分钟后 +1':'即将恢复')+'</div>' : '<div class="ts-next">体力已满</div>');
  stCard.appendChild(bar);
  const microHas = Object.keys(matState).filter(id=>id.startsWith('micro-') && matState[id]>0);
  if(microHas.length){
    const m = matInfo(microHas[0]);
    const fb = el('button','btn sm','喂食 '+m.name+' ×1 → 体力 +20');
    fb.onclick = ()=> feedMicroRecover(microHas[0]);
    stCard.appendChild(fb);
  } else {
    stCard.appendChild(el('div','tiny','背包中没有元素微粒（口粮）。炼化「元素微粒」规则可得。'));
  }
  root.appendChild(stCard);

  // —— 挂机槽 ——
  const slotsCard = el('div','card','');
  slotsCard.appendChild(el('h3',null,'挂机槽 <span class="sub">'+S.trainSlots.length+'/3 · 只有灵兽可挂机 · 挂机中不可进野外与秘境</span>'));
  if(S.trainSlots.length===0 && S.trainLogs.length===0){
    // 无副本记录：修炼未解锁（先副本后修炼）
    const lock = el('div','train-lock','');
    lock.innerHTML = '<div class="tl-title">修炼未解锁</div>'+
      '<div class="tl-desc">先完成一次秘境，这里才会留下可复刻的记录。</div>';
    slotsCard.appendChild(lock);
  } else {
    const slotsRow = el('div','train-slots','');
    for(let i=0;i<3;i++){
      const t = S.trainSlots[i];
      const box = el('div','train-slot'+(t?' busy':''));
      if(t){
        const sp = spById(t.spiritId);
        const spx = sp ? allSpeciesDef(sp.speciesId) : null;
        const left = Math.max(0, t.startAt + t.duration - Date.now());
        const pct = Math.min(100, Math.round((1 - left/t.duration)*100));
        const gainName = {exp:'经验', aff:'亲和力', mastery:'熟练度'}[t.gainType];
        const g = sp ? trainGain(sp, t.gainType, t.mats, t.skillId, t.elem) : null;
        box.innerHTML = '<div class="ts-name">'+(spx?spx.name:'?')+' <span class="tiny">Lv.'+(sp?sp.lvl||1:'?')+'</span></div>'+
          '<div class="ts-detail">修炼：'+gainName+(g&&g.aff?' · '+ELEM[g.aff.elem].name:(g&&g.mastery?' · '+g.mastery.name:''))+' · 素材 '+matsCount(t.mats)+' 种</div>'+
          '<div class="ts-progress"><i style="width:'+pct+'%"></i></div>'+
          '<div class="ts-time">'+(S.demo?'演示 ':'')+Math.ceil(left/1000)+' 秒后完成</div>';
      } else {
        box.innerHTML = '<div class="ts-empty">空槽位</div>';
        if(S.trainLogs.length>0){
          const btn = el('button','btn sm','从记录复刻');
          btn.onclick = ()=> openTrainForm(S.trainLogs[0]);
          box.appendChild(btn);
        } else {
          box.appendChild(el('div','tiny','先完成一次秘境冒险'));
        }
      }
      slotsRow.appendChild(box);
    }
    slotsCard.appendChild(slotsRow);
  }
  root.appendChild(slotsCard);

  // —— 复刻记录 ——
  const logCard = el('div','card','');
  logCard.appendChild(el('h3',null,'复刻记录 <span class="sub">副本 / 挂机完成留痕 · 复刻同样素材与收益（三选一）</span>'));
  if(S.trainLogs.length===0){
    logCard.appendChild(el('div','muted','尚无记录。'));
  } else {
    S.trainLogs.forEach((lg,li)=>{
      const row = el('div','train-log','');
      const parts = [];
      if(lg.exp) parts.push('经验 +'+lg.exp);
      if(lg.aff) parts.push(ELEM[lg.aff.elem].name+'亲和 +'+lg.aff.val);
      if(lg.mastery) parts.push(lg.mastery.name+' +'+lg.mastery.val);
      row.innerHTML = '<div class="ts-name">'+lg.stamp+' · 投入 '+wordsText(lg.words)+'</div>'+
        '<div class="ts-detail">产出：'+parts.join(' · ')+'</div>';
      const btn = el('button','btn sm','复刻');
      btn.onclick = ()=> openTrainForm(lg);
      row.appendChild(btn);
      logCard.appendChild(row);
    });
  }
  root.appendChild(logCard);
}

/* 挂机弹窗：只能从副本记录复刻进入（无记录不可修炼） */
function openTrainForm(log){
  if(!log){ toast('先完成一次秘境','bad'); return; }
  if(!log.words) log.words = aggregateWords(log.mats||[]);   // 旧记录兼容
  if(!log.value) log.value = trainValue(log.mats||[]);
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  mb.appendChild(el('h2',null,'复刻记录 · 挂机修炼'));
  mb.appendChild(el('div','m-sub','投入词条与品质 ≥ 参照的素材（允许多投、不能少投；多投自动清理），收获三选一，数值与参照记录一致。'));
  const f = el('div','','');

  // 参照要求卡片
  const req = el('div','train-req','');
  const parts = [];
  if(log.exp) parts.push('经验 +'+log.exp);
  if(log.aff) parts.push(ELEM[log.aff.elem].name+'亲和 +'+log.aff.val);
  if(log.mastery) parts.push(log.mastery.name+' +'+log.mastery.val);
  req.innerHTML = '<div class="tr-title">参照副本要求</div>'+
    '<div class="tr-words">'+wordsText(log.words)+'</div>'+
    '<div class="tr-out">产出：'+parts.join(' · ')+'</div>';
  f.appendChild(req);

  // 灵兽选择（未挂机的灵兽）
  const freeSpirits = S.spirits.filter(s=>!isTraining(s.id));
  const spSel = document.createElement('select'); spSel.className='inp';
  if(freeSpirits.length===0){ spSel.innerHTML = '<option>无空闲灵兽（都在挂机或不存在）</option>'; }
  freeSpirits.forEach(s=>{ const op=document.createElement('option'); op.value=s.id; op.textContent=allSpeciesDef(s.speciesId).name+(s.shiny?'（异色）':'')+' Lv.'+(s.lvl||1); spSel.appendChild(op); });
  f.appendChild(fld('挂机灵兽（3 槽 · 妖兽不可）', spSel));
  let sp = freeSpirits[0];

  // 收获类型
  const typeSel = document.createElement('select'); typeSel.className='inp';
  [['exp','等级经验'],['aff','属性亲和力'],['mastery','技能熟练度']].forEach(p=>{
    const op=document.createElement('option'); op.value=p[0]; op.textContent=p[1];
    typeSel.appendChild(op);
  });
  f.appendChild(fld('收获类型（三选一）', typeSel));
  // 亲和力目标系
  const affSel = document.createElement('select'); affSel.className='inp'; affSel.style.marginTop='6px';
  Object.keys(ELEM).forEach(e=>{ const op=document.createElement('option'); op.value=e; op.textContent=ELEM[e].name; affSel.appendChild(op); });
  affSel.style.display='none';
  f.appendChild(fld('亲和力目标系', affSel));
  // 熟练度目标技能
  const skillSel = document.createElement('select'); skillSel.className='inp'; skillSel.style.marginTop='6px';
  skillSel.style.display='none';
  function refreshSkillSel(){
    skillSel.innerHTML='';
    const s = spById(spSel.value); if(!s) return;
    let hasDefault = false;
    s.skills.forEach(sk=>{
      const op=document.createElement('option'); op.value=sk.id; op.textContent=sk.name;
      if(log && log.mastery && sk.id===log.mastery.skillId){ op.textContent += '（参照技能）'; hasDefault=true; }
      skillSel.appendChild(op);
    });
    if(log && log.mastery && !hasDefault && s.skills.length>0){
      skillSel.insertBefore(el('option','','— 未装配参照技能「'+log.mastery.name+'」，请选其他技能 —'), skillSel.firstChild);
    }
  }
  f.appendChild(fld('熟练度目标技能', skillSel));
  typeSel.onchange = ()=>{
    affSel.style.display = typeSel.value==='aff' ? '' : 'none';
    skillSel.style.display = typeSel.value==='mastery' ? '' : 'none';
    if(typeSel.value==='mastery') refreshSkillSel();
  };
  spSel.onchange = ()=>{ refreshSkillSel(); };
  refreshSkillSel();
  // 复刻模式：亲和力目标系锁定参照的系（产出的组成部分）
  if(log && log.aff){
    affSel.value = log.aff.elem;
    affSel.disabled = true;
    affSel.title = '复刻产出为 '+ELEM[log.aff.elem].name+' 亲和，目标系与参照一致';
  }

  // 素材选择（数量面板：允许多投不能少投，多投自动清理）
  f.appendChild(el('div','tiny','投入素材 <span class="sub">按参照词条与品质投入，可多投（多投自动清理）</span>'));
  const matWrap = el('div','train-mats','');
  f.appendChild(matWrap);
  const selMats = matsDict(log ? log.mats : {});
  const holder = Object.keys(matState).filter(id=>matState[id]>0 && !id.startsWith('beast:'));
  if(holder.length===0) matWrap.appendChild(el('div','muted','背包没有素材。先去炼化或野外采集。'));
  holder.forEach(id=>{
    const m = matInfo(id);
    if(!m) return;
    const cell = matGridItem(m, selMats[id]||0, ()=>{
      if((matState[id]||0) > (selMats[id]||0)){ selMats[id]=(selMats[id]||0)+1; updateCell(); refreshPrev(); }
      else { toast('「'+m.name+'」库存不足','bad'); }
    });
    updateCell();
    function updateCell(){
      cell.classList.toggle('on', (selMats[id]||0)>0);
      const n = cell.querySelector('.mg-n');
      n.textContent = '×'+(selMats[id]||0);
      n.classList.toggle('zero', !(selMats[id]||0));
    }
    const rm = el('div','mg-rm','−');
    rm.onclick = (ev)=>{ ev.stopPropagation(); if((selMats[id]||0)>0){ selMats[id]--; if(selMats[id]<=0) delete selMats[id]; updateCell(); refreshPrev(); } };
    cell.appendChild(rm);
    matWrap.appendChild(cell);
  });

  // 收益预览 + 复刻实时校验
  const prev = el('div','train-prev','');
  f.appendChild(prev);
  function refreshPrev(){
    const mats = matsToList(selMats);
    const s = spById(spSel.value);
    if(mats.length===0){ prev.innerHTML=''; return; }
    // 复刻：数值按参照记录
    const chk = refSatisfied(mats, log.words);
    const parts = [];
    if(log.exp) parts.push('经验 +'+log.exp);
    if(log.aff) parts.push(ELEM[log.aff.elem].name+'亲和 +'+log.aff.val);
    if(log.mastery) parts.push(log.mastery.name+' +'+log.mastery.val);
    prev.innerHTML = '<div class="tiny" style="margin-top:8px">'+
      (chk.ok
        ? '<span style="color:var(--verdigris)">✓ 满足参照（多投自动清理）</span>'
        : '<span style="color:var(--cinnabar)">✗ 不足：'+chk.lacks.join('；')+'</span>')+
      ' · 收益（按参照）：<b>'+parts.join(' · ')+'</b> · 消耗体力 10</div>';
  }
  typeSel.addEventListener('change', ()=> setTimeout(refreshPrev,0));
  spSel.addEventListener('change', ()=> setTimeout(refreshPrev,0));
  affSel.addEventListener('change', ()=> setTimeout(refreshPrev,0));
  skillSel.addEventListener('change', ()=> setTimeout(refreshPrev,0));

  mb.appendChild(f);
  const ok = el('button','btn primary','复刻挂机');
  ok.onclick = ()=>{
    const s = spById(spSel.value);
    if(!s){ toast('请选择灵兽','bad'); return; }
    if(typeSel.value==='mastery' && !s.skills.length){ toast('该灵兽没有已装配技能','bad'); return; }
    if(matsCount(selMats)<1){ toast('请选择素材','bad'); return; }
    if(S.trainSlots.length>=3){ toast('挂机槽已满','bad'); return; }
    const mats = matsDict(selMats);
    // 校验素材仍持有
    for(const id in mats){ if((matState[id]||0) < mats[id]){ toast('素材不足','bad'); return; } }
    const slot = {spiritId:s.id, mats, gainType:typeSel.value,
      skillId:typeSel.value==='mastery'?skillSel.value:null,
      elem:typeSel.value==='aff'?affSel.value:null};
    const chk = refSatisfied(mats, log.words);
    if(!chk.ok){ toast('复刻素材不足：'+chk.lacks.join('；'),'bad'); return; }
    slot.ref = log;
    if(startTrain(slot)){
      closeOverlay();
    }
  };
  mb.appendChild(ok);
  const cancel = el('button','btn ghost','取消'); cancel.onclick = closeOverlay;
  mb.appendChild(cancel);
  ov.classList.add('open');
  refreshPrev();
}