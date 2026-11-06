
function closeOverlay(){ $('#overlay').classList.remove('open'); const mb=$('#modal-box'); if(mb) mb.classList.remove('is-detail'); }
/* 通用提交弹窗。costs: [{name, need, have, note}]。材料不够时确认不可用。
   mount(box) 可选，返回读取函数，确认时得到 {err} 或其它字段。 */
function openSubmitDialog(opt){
  const ov = $('#overlay');
  const mb = $('#modal-box');
  mb.innerHTML = '';
  mb.classList.remove('is-detail');
  const head = el('h2','submit-title');
  head.appendChild(document.createTextNode(opt.title || '提交'));
  if(opt.desc){
    const q = document.createElement('button');
    q.type = 'button';
    q.className = 'help-q';
    q.textContent = '?';
    q.setAttribute('data-tip', opt.desc);
    head.appendChild(q);
  }
  mb.appendChild(head);
  const list = el('div','submit-costs');
  let short = false;
  (opt.costs||[]).forEach(c=>{
    const have = c.have||0;
    const ok = have >= c.need;
    if(!ok) short = true;
    const row = el('div','submit-cost'+(ok?'':' short'));
    row.innerHTML = '<span class="sc-name">'+esc(c.name)+'</span><span class="sc-num">×'+c.need+'</span>'+
      (c.note?'<span class="sc-note">'+esc(c.note)+'</span>':'')+
      '<span class="sc-have">'+(ok?'持有 '+have:'持有 '+have+'，还差 '+(c.need-have))+'</span>';
    list.appendChild(row);
  });
  mb.appendChild(list);
  const read = opt.mount ? opt.mount(mb) : null;
  const act = el('div','modal-actions');
  const cancel = el('button','btn ghost','取消');
  cancel.type = 'button';
  cancel.onclick = ()=>{ if(opt.onCancel) opt.onCancel(); };
  const ok = el('button','btn primary','提交');
  ok.type = 'button';
  ok.disabled = short;
  ok.onclick = ()=>{
    if(ok.disabled) return;
    let extra = null;
    if(read){
      extra = read();
      if(extra && extra.err){ toast(extra.err,'bad'); return; }
    }
    opt.onOk(extra||{});
  };
  act.appendChild(cancel);
  act.appendChild(ok);
  mb.appendChild(act);
  ov.classList.add('open');
}
/* 点击弹窗外遮罩 → 自动取消弹窗（所有弹窗统一生效；战斗结果弹框除外，需按钮确认） */
(function(){
  const ov = document.querySelector('#overlay');
  if(ov && typeof ov.addEventListener==='function') ov.addEventListener('click', e=>{ if(e.target===ov && !window.__modalLock) closeOverlay(); });
})();