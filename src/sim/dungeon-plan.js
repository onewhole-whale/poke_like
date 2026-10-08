
function addBuildMat(id){
  const m = matInfo(id); if(!m) return;
  if((matState[id]||0) <= (S.buildMats[id]||0)){ toast('「'+m.name+'」库存不足','bad'); return; }
  S.buildMats[id] = (S.buildMats[id]||0)+1;
}
function subBuildMat(id){
  if((S.buildMats[id]||0)<=0) return;
  S.buildMats[id]--;
  if(S.buildMats[id]<=0) delete S.buildMats[id];
}