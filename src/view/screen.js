

/* ================= 渲染入口 ================= */
function render(){
  if(S.view==='home' && typeof renderHome==='function') renderHome();
  if(S.view==='refine') renderRefine();
  if(S.view==='wild') renderWild();
  if(S.view==='build'){ if(settleLive()) renderSettle(); else renderBuild(); }
  if(S.view==='train') { tickTrain(); renderTrain(); }
  if(S.view==='stable') renderStable();
  if(S.view==='skills') renderSkills();
  if(S.view==='codex') renderCodex();
  if(S.view==='dex') renderDex();
  if(S.view==='matdex') renderMatDex();
  if(S.view==='manual') renderManual();
  if(S.view==='settings' && typeof renderSettings==='function') renderSettings();
}

/* ================= 炼化视图 ================= */
/* 素材架 UI 状态：fold 折叠 / zero 是否显示未持有素材（默认 false） */
const shelfUI = {ore:{fold:false,zero:false}, plant:{fold:false,zero:false}, beast:{fold:false,zero:false}, essence:{fold:false,zero:false}, beastFurnace:{fold:false}};