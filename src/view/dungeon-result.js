
/* M3-2 补丁：副本战斗结果弹框（胜利 → 下一场/通关结算；失败 → 确认返回战报结算） */
function dgResultModal(b, st, sp){
  const won = b.phase==='won';
  const isLast = st.idx+1 >= st.enemies.length;
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  mb.appendChild(el('h2',null, won ? '战斗胜利' : '战斗失败'));
  mb.appendChild(el('div','m-sub', won
    ? '击破 <b>'+esc(b.beast.name)+'</b> Lv.'+(b.beast.lvl||1)+' · 第 '+(st.idx+1)+' / '+st.enemies.length+' 场'+(isLast?' · 敌影尽数击破！':'')+(st.kills%5===4?' · 下一场回满状态并获常驻增益':'')
    : '<b>'+esc(sp.name)+'</b> 力竭败退——只结算已击杀经验，不抽取技能专长。'));
  const ma = el('div','modal-actions','');
  const btn = el('button','btn primary', won ? (isLast ? '通关结算' : '继续前进') : '确认');
  btn.onclick = ()=>{
    window.__modalLock=false; closeOverlay();
    if(won) dgWinFight();
    else dgLose();
  };
  ma.appendChild(btn);
  mb.appendChild(ma);
  window.__modalLock = true;
  ov.classList.add('open');
}