
function closeOverlay(){ $('#overlay').classList.remove('open'); }
/* 点击弹窗外遮罩 → 自动取消弹窗（所有弹窗统一生效；战斗结果弹框除外，需按钮确认） */
(function(){
  const ov = document.querySelector('#overlay');
  if(ov && typeof ov.addEventListener==='function') ov.addEventListener('click', e=>{ if(e.target===ov && !window.__modalLock) closeOverlay(); });
})();