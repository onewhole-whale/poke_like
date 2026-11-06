
/* 主页面：存读与开局解耦；每次打开先到这里 */
function renderHome(){
  const root = $('#home-root'); if(!root) return;
  root.innerHTML = '';
  const card = el('div','home-card','');
  card.appendChild(el('div','home-kicker','炼妖壶 · 本机进度'));
  card.appendChild(el('h1',null,'炼妖壶'));
  card.appendChild(el('p','home-lead','进度靠「存档」留在本浏览器。开始一局不会自动写入任何槽；读档才会选槽载入。正式开局素材很少；要测功能请用「体验开局」。'));
  const acts = el('div','home-actions','');
  const start = el('button','btn','正式开局');
  start.onclick = ()=>{
    clearPlayMemoryToNewGame();
    S.demo = false;
    if(typeof applyModeButtons==='function') applyModeButtons();
    S.sessionLive = true;
    location.hash = '#/refine';
    toast('正式开局（素材从零，尚未存档）');
  };
  const playtest = el('button','btn primary','体验开局');
  playtest.title = '演示概率 + 斧镐/药剂/素材/灵息，方便测流程';
  playtest.onclick = ()=>{
    clearPlayMemoryToNewGame();
    S.demo = true;
    grantDemoKit();
    if(typeof applyModeButtons==='function') applyModeButtons();
    S.sessionLive = true;
    location.hash = '#/refine';
    toast('体验开局：已开演示概率并发放补给');
  };
  const loadBtn = el('button','btn','读档');
  loadBtn.onclick = ()=> openLoadSlotModal(true);
  acts.appendChild(playtest);
  acts.appendChild(start);
  acts.appendChild(loadBtn);
  card.appendChild(acts);
  const slots = listPlaySlots();
  const sum = el('div','home-slots','');
  sum.appendChild(el('h3',null,'本机五槽'));
  slots.forEach(s=>{
    const row = el('div','home-slot'+(s.empty?' empty':''),'');
    if(s.empty) row.innerHTML = '<b>槽 '+s.slot+'</b><span class="muted">空</span>';
    else {
      const t = s.savedAt ? new Date(s.savedAt).toLocaleString() : '';
      row.innerHTML = '<b>槽 '+s.slot+'</b><span>'+esc(s.leadName||'')+' · 灵兽 '+(s.spiritCount||0)+(t?' · '+t:'')+'</span>';
    }
    sum.appendChild(row);
  });
  card.appendChild(sum);
  root.appendChild(card);
}
function openSaveSlotModal(){
  if(inAdventure()){ toast('冒险途中不能存档','bad'); return; }
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  mb.appendChild(el('h2',null,'存档'));
  mb.appendChild(el('div','m-sub','选择一个槽，把当前进度写入本机。覆盖前会再确认。'));
  listPlaySlots().forEach(s=>{
    const row = el('div','choice-block', '');
    row.innerHTML = s.empty
      ? '<div class="cb-title">槽 '+s.slot+' · 空</div><div class="cb-desc">写入新档</div>'
      : '<div class="cb-title">槽 '+s.slot+' · '+esc(s.leadName||'有档')+'</div><div class="cb-desc">灵兽 '+(s.spiritCount||0)+' · 将覆盖</div>';
    row.onclick = ()=>{
      if(!s.empty && !confirm('覆盖槽 '+s.slot+' 的存档？')) return;
      if(savePlayToSlot(s.slot)){ closeOverlay(); toast('已存入槽 '+s.slot); }
      else toast('存档失败','bad');
    };
    mb.appendChild(row);
  });
  const cancel = el('button','btn','取消'); cancel.onclick = closeOverlay;
  mb.appendChild(cancel);
  ov.classList.add('open');
}
function openLoadSlotModal(fromHome){
  if(!fromHome && inAdventure()){ toast('冒险途中不能读档','bad'); return; }
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  mb.appendChild(el('h2',null,'读档'));
  mb.appendChild(el('div','m-sub','选择槽载入。当前未存进槽的内存进度会丢掉。'));
  let any = false;
  listPlaySlots().forEach(s=>{
    if(s.empty){
      const row = el('div','choice-block disabled','');
      row.innerHTML = '<div class="cb-title">槽 '+s.slot+' · 空</div>';
      mb.appendChild(row);
      return;
    }
    any = true;
    const row = el('div','choice-block','');
    const t = s.savedAt ? new Date(s.savedAt).toLocaleString() : '';
    row.innerHTML = '<div class="cb-title">槽 '+s.slot+' · '+esc(s.leadName||'')+'</div><div class="cb-desc">灵兽 '+(s.spiritCount||0)+(t?' · '+t:'')+'</div>';
    row.onclick = ()=>{
      if(!loadPlayFromSlot(s.slot)){ toast('读档失败','bad'); return; }
      S.sessionLive = true;
      closeOverlay();
      toast('已读入槽 '+s.slot);
      location.hash = '#/refine';
      route();
    };
    mb.appendChild(row);
  });
  if(!any) mb.appendChild(el('div','muted','还没有存档。开始游戏后点「存档」写入槽位。'));
  const cancel = el('button','btn','取消'); cancel.onclick = closeOverlay;
  mb.appendChild(cancel);
  ov.classList.add('open');
}
