
function feedMicroRecover(id){
  const m = matInfo(id);
  if(!m || !id.startsWith('micro-') || (matState[id]||0)<=0) return false;
  matState[id]--;
  S.stamina = Math.min(S.staminaMax, staminaNow() + 20);
  S.staminaAt = Date.now();
  saveDraft(); renderTrain();
  S.logs.unshift({t:stampNow(), cls:'sprout', text:'喂食 <b>'+m.name+' ×1</b>，体力回复 20 点。口粮入腹，精力如常。'});
  toast('体力 +20（'+m.name+'）');
  return true;
}