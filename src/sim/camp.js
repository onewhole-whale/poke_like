
function exchangeTool(){
  if(S.aura<2){ toast('灵息不足','bad'); return; }
  S.aura-=2;
  S.toolInv = S.toolInv||{};
  S.toolInv['DJ_none_002000'] = (S.toolInv['DJ_none_002000']||0)+1;   // 普通斧
  S.toolDur = S.toolDur||{};
  S.toolDur['DJ_none_002000'] = 100;
  toast('以灵息 ×2 换得标准斧（普通）×1');
  saveDraft();
  renderWild();
}