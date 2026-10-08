
/* 元素萌芽：按属性计数（legacy 数字 → {any:n} 兼容） */
function sproutsOf(){ if(typeof S.sprouts==='number'){ const v=S.sprouts; S.sprouts = v>0?{any:v}:{}; } return S.sprouts; }
function sproutsTotal(){ return Object.values(sproutsOf()).reduce((a,b)=>a+b,0); }
function sproutsAdd(elem,n){ sproutsOf()[elem]=(sproutsOf()[elem]||0)+n; }
function sproutsTake(elem,n){ sproutsOf()[elem]=Math.max(0,(sproutsOf()[elem]||0)-n); }
/* 妖兽投炉：furnace 项 'beast:<id>'，结算时展开为「杀死该妖兽的全部掉落物 + 1 精良生命精华」 */
function addBeastToFurnace(bid){
  const id = 'beast:'+bid;
  if(S.furnace.includes(id)){ toast('此妖兽已在炉中'); return; }
  S.furnace.push(id);
  renderRefine();
}
function beastNameById(id){
  const b = S.beasts.find(x=>'beast:'+x.id===id);
  return b ? allSpeciesDef(b.speciesId).name : '无名妖兽';
}
function furnaceMats(){
  const out = [];
  S.furnace.forEach(id=>{
    if(id.startsWith('beast:')){
      const b = S.beasts.find(x=>'beast:'+x.id===id);
      if(!b) return;
      const drops = beastDrops(b.speciesId,'kill');
      Object.keys(drops).forEach(mid=>{ const m = matInfo(mid); if(m) out.push({...m, unitN:drops[mid]}); });
      const le = matInfo('SC_none_fine_000001'); if(le) out.push({...le, unitN:1});
    } else {
      const m = matInfo(id); if(m) out.push(m);   // 同素材多份 → 自然展开多单位
    }
  });
  return out;
}
const PLAY_KEY = 'refine-proto-play';
function inAdventure(){
  const w = S.wild;
  return !!(w && (w.state==='grid' || w.state==='done'));
}
function idleWild(mapId, spiritId){
  return {mapId:mapId||'gentlebreeze', state:'idle', grid:null, px:0, py:0, exitX:0, exitY:0, spiritId:spiritId||null, battle:null, story:null, storyIdx:0, loots:[], log:[], fledFrom:null, chainId:null, chainNode:null, chainLose:null, chainPending:null, burnScald:false, phase:'move'};
}
function takeAdvSnap(){
  S._advSnap = {
    mat: JSON.parse(JSON.stringify(matState)),
    toolInv: JSON.parse(JSON.stringify(S.toolInv||{})),
    toolDur: JSON.parse(JSON.stringify(S.toolDur||{})),
    blueprintInv: JSON.parse(JSON.stringify(S.blueprintInv||{}))
  };
}
function revertAdvGains(){
  const sn = S._advSnap; if(!sn) return;
  Object.keys(matState).forEach(id=>{
    const base = sn.mat[id]||0;
    if((matState[id]||0) > base) matState[id] = base;
  });
  ['toolInv','blueprintInv'].forEach(key=>{
    const cur = S[key]||{};
    const base = sn[key]||{};
    Object.keys(cur).forEach(id=>{
      const b = base[id]||0;
      if((cur[id]||0) > b) cur[id] = b;
      if(!cur[id]) delete cur[id];
    });
  });
  Object.keys(S.toolDur||{}).forEach(id=>{
    const base = sn.toolDur[id];
    if(base!=null && S.toolDur[id] > base) S.toolDur[id] = base;
    if(!S.toolInv[id]) delete S.toolDur[id];
  });
  S._advSnap = null;
}
function writeCodex(){
  const snap = (inAdventure() && S._advSnap) ? S._advSnap : null;
  const toolInv = snap ? snap.toolInv : S.toolInv;
  const toolDur = snap ? snap.toolDur : S.toolDur;
  const blueprintInv = snap ? snap.blueprintInv : S.blueprintInv;
  try{
    localStorage.setItem('refine-proto-codex', JSON.stringify({matEdits:S.matEdits, customMats:S.customMats, speciesEdits:S.speciesEdits, customSpecies:S.customSpecies, tagLib:S.tagLib, essences:S.essences, refineRules:S.refineRules, skillEdits:S.skillEdits, dexSeen:S.dexSeen, dexClaimed:S.dexClaimed, matSeen:S.matSeen, refineFate:S.refineFate, toolInv:toolInv, toolDur:toolDur, blueprintInv:blueprintInv}));
  }catch(e){}
}
function savePlay(){
  if(inAdventure()) return;
  try{
    localStorage.setItem(PLAY_KEY, JSON.stringify({
      spirits:S.spirits, beasts:S.beasts, sprouts:S.sprouts, aura:S.aura,
      stamina:S.stamina, staminaAt:S.staminaAt, logs:S.logs,
      matState:JSON.parse(JSON.stringify(matState)), furnace:S.furnace, wonderQueue:S.wonderQueue,
      trainSlots:S.trainSlots, trainLogs:S.trainLogs,
      toolInv:JSON.parse(JSON.stringify(S.toolInv||{})),
      toolDur:JSON.parse(JSON.stringify(S.toolDur||{})),
      blueprintInv:JSON.parse(JSON.stringify(S.blueprintInv||{})),
      wild: idleWild(S.wild && S.wild.mapId, S.wild && S.wild.spiritId)
    }));
  }catch(e){}
  writeCodex();
}
function loadPlay(){
  try{
    const raw = localStorage.getItem(PLAY_KEY);
    if(!raw) return false;
    const d = JSON.parse(raw);
    if(!d || !Array.isArray(d.spirits)) return false;
    S.spirits = d.spirits;
    if(Array.isArray(d.beasts)) S.beasts = d.beasts;
    if(d.sprouts && typeof d.sprouts==='object') S.sprouts = d.sprouts;
    if(typeof d.aura==='number') S.aura = d.aura;
    if(typeof d.stamina==='number') S.stamina = d.stamina;
    if(typeof d.staminaAt==='number') S.staminaAt = d.staminaAt;
    if(Array.isArray(d.logs)) S.logs = d.logs;
    if(d.matState && typeof d.matState==='object'){
      Object.keys(matState).forEach(k=>{ matState[k]=0; });
      Object.keys(d.matState).forEach(k=>{ matState[k]=d.matState[k]; });
    }
    if(Array.isArray(d.furnace)) S.furnace = d.furnace;
    if(Array.isArray(d.wonderQueue)) S.wonderQueue = d.wonderQueue;
    if(Array.isArray(d.trainSlots)) S.trainSlots = d.trainSlots;
    if(Array.isArray(d.trainLogs)) S.trainLogs = d.trainLogs;
    if(d.toolInv && typeof d.toolInv==='object') S.toolInv = d.toolInv;
    if(d.toolDur && typeof d.toolDur==='object') S.toolDur = d.toolDur;
    if(d.blueprintInv && typeof d.blueprintInv==='object') S.blueprintInv = d.blueprintInv;
    S.wild = idleWild(d.wild && d.wild.mapId, d.wild && d.wild.spiritId);
    return true;
  }catch(e){ return false; }
}
function grantDemoKit(){
  S.toolInv['DJ_none_002000'] = (S.toolInv['DJ_none_002000']||0)+1;
  S.toolInv['DJ_none_002006'] = (S.toolInv['DJ_none_002006']||0)+1;
  S.toolDur['DJ_none_002000'] = S.toolDur['DJ_none_002000'] || 100;
  S.toolDur['DJ_none_002006'] = S.toolDur['DJ_none_002006'] || 100;
  matState['SC_fire_fine_000022'] = (matState['SC_fire_fine_000022']||0)+15;
  if(typeof markMatSeen==='function') markMatSeen('SC_fire_fine_000022');
  savePlay();
}
function saveDraft(){
  writeCodex();
  if(!inAdventure()) savePlay();
}