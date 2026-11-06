
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

/* —— 本机多槽玩法存档（与开局无关；图鉴编辑 codex 另键公用）—— */
const PLAY_KEY_LEGACY = 'refine-proto-play';
const PLAY_SLOT_COUNT = 5;
const PLAY_KEY = PLAY_KEY_LEGACY; // 兼容旧引用名
function playSlotKey(slot){ return 'refine-proto-play-slot-'+slot; }
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
  try{
    localStorage.setItem('refine-proto-codex', JSON.stringify({
      matEdits:S.matEdits, customMats:S.customMats, speciesEdits:S.speciesEdits, customSpecies:S.customSpecies,
      tagLib:S.tagLib, essences:S.essences, refineRules:S.refineRules, skillEdits:S.skillEdits,
      dexSeen:S.dexSeen, dexClaimed:S.dexClaimed, matSeen:S.matSeen, refineFate:S.refineFate
    }));
  }catch(e){}
}
function snapshotPlay(){
  return {
    savedAt: Date.now(),
    spirits:S.spirits, beasts:S.beasts, sprouts:S.sprouts, aura:S.aura,
    stamina:S.stamina, staminaAt:S.staminaAt, logs:S.logs,
    matState:JSON.parse(JSON.stringify(matState)), furnace:S.furnace, wonderQueue:S.wonderQueue,
    trainSlots:S.trainSlots, trainLogs:S.trainLogs,
    toolInv:JSON.parse(JSON.stringify(S.toolInv||{})),
    toolDur:JSON.parse(JSON.stringify(S.toolDur||{})),
    blueprintInv:JSON.parse(JSON.stringify(S.blueprintInv||{})),
    ivElixir:S.ivElixir||0,
    wild: idleWild(S.wild && S.wild.mapId, S.wild && S.wild.spiritId)
  };
}
function applyPlayData(d){
  if(!d || !Array.isArray(d.spirits)) return false;
  S.spirits = d.spirits;
  S.beasts = Array.isArray(d.beasts) ? d.beasts : [];
  S.sprouts = (d.sprouts && typeof d.sprouts==='object') ? d.sprouts : {};
  if(typeof d.aura==='number') S.aura = d.aura;
  if(typeof d.stamina==='number') S.stamina = d.stamina;
  if(typeof d.staminaAt==='number') S.staminaAt = d.staminaAt;
  S.logs = Array.isArray(d.logs) ? d.logs : [];
  Object.keys(matState).forEach(k=>{ matState[k]=0; });
  if(d.matState && typeof d.matState==='object'){
    Object.keys(d.matState).forEach(k=>{ matState[k]=d.matState[k]; });
  }
  S.furnace = Array.isArray(d.furnace) ? d.furnace : [];
  S.wonderQueue = Array.isArray(d.wonderQueue) ? d.wonderQueue : [];
  S.trainSlots = Array.isArray(d.trainSlots) ? d.trainSlots : [];
  S.trainLogs = Array.isArray(d.trainLogs) ? d.trainLogs : [];
  S.toolInv = (d.toolInv && typeof d.toolInv==='object') ? d.toolInv : {};
  S.toolDur = (d.toolDur && typeof d.toolDur==='object') ? d.toolDur : {};
  S.blueprintInv = (d.blueprintInv && typeof d.blueprintInv==='object') ? d.blueprintInv : {};
  S.ivElixir = typeof d.ivElixir==='number' ? d.ivElixir : 0;
  S.wild = idleWild(d.wild && d.wild.mapId, d.wild && d.wild.spiritId);
  S._advSnap = null;
  return true;
}
function migrateLegacyPlaySlots(){
  try{
    const legacy = localStorage.getItem(PLAY_KEY_LEGACY);
    if(!legacy) return;
    if(!localStorage.getItem(playSlotKey(1))) localStorage.setItem(playSlotKey(1), legacy);
  }catch(e){}
}
function listPlaySlots(){
  const out = [];
  try{ migrateLegacyPlaySlots(); }catch(e){}
  for(let i=1;i<=PLAY_SLOT_COUNT;i++){
    let raw = null;
    try{ raw = (typeof localStorage!=='undefined') ? localStorage.getItem(playSlotKey(i)) : null; }catch(e){}
    if(!raw){ out.push({slot:i, empty:true}); continue; }
    try{
      const d = JSON.parse(raw);
      const n = (d.spirits&&d.spirits[0]) ? d.spirits[0].name : '有存档';
      out.push({
        slot:i, empty:false, savedAt:d.savedAt||0,
        spiritCount:(d.spirits||[]).length, leadName:n,
        aura:d.aura, stamina:d.stamina
      });
    }catch(e){ out.push({slot:i, empty:true}); }
  }
  return out;
}
function anyPlaySlotFilled(){
  return listPlaySlots().some(s=>!s.empty);
}
function savePlayToSlot(slot){
  if(inAdventure()) return false;
  slot = slot|0;
  if(slot<1 || slot>PLAY_SLOT_COUNT) return false;
  try{
    localStorage.setItem(playSlotKey(slot), JSON.stringify(snapshotPlay()));
    S.activeSlot = slot;
  }catch(e){ return false; }
  writeCodex();
  return true;
}
function loadPlayFromSlot(slot){
  slot = slot|0;
  if(slot<1 || slot>PLAY_SLOT_COUNT) return false;
  try{
    const raw = localStorage.getItem(playSlotKey(slot));
    if(!raw) return false;
    const d = JSON.parse(raw);
    if(!applyPlayData(d)) return false;
    S.activeSlot = slot;
    return true;
  }catch(e){ return false; }
}
/* 自动检查点：仅当本局已绑定槽（读过或存过）时写入该槽 */
function savePlay(){
  if(inAdventure()) return;
  if(S.activeSlot) savePlayToSlot(S.activeSlot);
  else writeCodex();
}
function loadPlay(){
  migrateLegacyPlaySlots();
  if(S.activeSlot) return loadPlayFromSlot(S.activeSlot);
  if(localStorage.getItem(playSlotKey(1))) return loadPlayFromSlot(1);
  const legacy = localStorage.getItem(PLAY_KEY_LEGACY);
  if(!legacy) return false;
  try{
    const d = JSON.parse(legacy);
    if(!applyPlayData(d)) return false;
    S.activeSlot = 1;
    return true;
  }catch(e){ return false; }
}
function clearPlayMemoryToNewGame(){
  S.activeSlot = null;
  S._advSnap = null;
  S.spirits = [];
  S.beasts = [];
  S.sprouts = {fire:1};
  S.aura = 6;
  S.ivElixir = 0;
  S.furnace = [];
  S.logs = [];
  S.wonderQueue = [];
  S.trainSlots = [];
  S.trainLogs = [];
  S.toolInv = {};
  S.toolDur = {};
  S.blueprintInv = {};
  S.stamina = 120;
  S.staminaAt = Date.now();
  S.wild = idleWild();
  S.settle = {spiritId:null, enemies:[], idx:0, kills:0, buffs:[], phase:'idle', battle:null, exp:0, plan:{}, gainType:'roll', logs:[], mats:{}, words:{}};
  S.buildSpiritId = null;
  S.buildMats = {};
  S.buildExpand = {};
  Object.keys(matState).forEach(k=>{ matState[k]=0; });
  S.spirits.push(makeSpirit('JL_fire_normal_0001', false, '由「焰髓石 ×2」炼化而生，先天资质圆满'));
  markDexSeen('JL_fire_normal_0001');
  S.beasts.push(makeBeast('JL_fire_normal_0001', false, '落日坡 · 巡猎'));
  S.beasts.push(makeBeast('JL_water_normal_0023', false, '夜雨溪谷 · 垂钓'));
  S.beasts.push(makeBeast('JL_thunder_normal_0038', false, '雷殛岭 · 伏击'));
  S.beasts.push(makeBeast('JL_fire_normal_0016', true, '焚风谷深处 · 仅此一只'));
  S.logs.unshift({t:'初入山门', cls:'', text:'你从师父手中接过炼妖壶。壶身温热，像在等第一炉火。'});
}
/* 体验补给：够测炼化/药剂/采集/换斧/战斗用药，不靠肝 */
function grantDemoKit(){
  S.toolInv = S.toolInv||{};
  S.toolDur = S.toolDur||{};
  function addTool(id, n){
    S.toolInv[id] = (S.toolInv[id]||0)+n;
    const it = (typeof ITEMS!=='undefined' && ITEMS[id]) || null;
    if(it && it.type==='tool' && S.toolDur[id]==null) S.toolDur[id] = it.durability||100;
  }
  function addMat(id, n){
    matState[id] = (matState[id]||0)+n;
    if(typeof markMatSeen==='function') markMatSeen(id);
  }
  addTool('DJ_none_002000', 1);           // 普通斧
  addTool('DJ_none_002006', 1);           // 普通镐
  S.toolInv['DJ_none_002020'] = (S.toolInv['DJ_none_002020']||0)+5; // 血瓶
  S.toolInv['DJ_none_002021'] = (S.toolInv['DJ_none_002021']||0)+5; // 蓝瓶
  addMat('SC_fire_fine_000022', 20);      // 爪牙之炉素材
  addMat('SC_none_fine_000001', 8);       // 生命精华
  addMat('SC_none_normal_000002', 12);    // 普通植物 → 血瓶/斧
  addMat('SC_none_normal_000008', 12);    // 普通矿物 → 蓝瓶/镐
  S.aura = Math.max(S.aura||0, 30);
  S.ivElixir = Math.max(S.ivElixir||0, 2);
  S.stamina = S.staminaMax||120;
  S.staminaAt = Date.now();
  if(S.spirits && S.spirits[0] && (S.spirits[0].lvl||1)<8){
    S.spirits[0].lvl = 8;
    S.spirits[0].exp = 0;
    if(typeof capacityOf==='function'){ S.spirits[0].capacity = capacityOf(S.spirits[0]); S.spirits[0].used = usedCap(S.spirits[0]); }
  }
  savePlay();
}
function saveDraft(){
  writeCodex();
  if(!inAdventure()) savePlay();
}
