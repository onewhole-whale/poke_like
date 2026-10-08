

/* ================= 绑定事件 ================= */
$('#btn-refine').onclick = doRefine;
$('#btn-depart').onclick = depart;
function applyModeButtons(){
  $('#mode-real').classList.toggle('on', !S.demo);
  $('#mode-demo').classList.toggle('on', !!S.demo);
}
$('#mode-real').onclick = ()=>{ S.demo=false; applyModeButtons(); toast('已切换真实概率：出灵兽约 1%，异色约 5%'); renderRefine(); };
$('#mode-demo').onclick = ()=>{
  const had = !!localStorage.getItem(PLAY_KEY);
  S.demo = true;
  if(!had) grantDemoKit();
  applyModeButtons();
  toast('已切换演示概率：出灵兽约 28%，异色约 18%');
  renderRefine();
};
document.querySelectorAll('#nav button').forEach(b=>{
  b.onclick = ()=>{ location.hash = '#/'+b.dataset.route; };
});
document.addEventListener('keydown', e=>{ if(e.key==='Escape') closeOverlay(); });

/* ================= 启动 ================= */
init();
route();
/* 挂机全局结算：任何视图下到期自动结算；修炼页时同步刷新进度 */
setInterval(()=>{ try{ tickTrain(); if(S.view==='train') renderTrain(); }catch(e){} }, 10000);
