
/* ================= M2-C 图鉴收集进度 =================
   dexSeen：曾拥有/捕获/进化过的物种 id（放生不熄灭）。
   里程碑奖励：每收集 10 只 → 洗髓露 ×1。
   编号：按 allSpecies() 顺序 1-based。 */
function markDexSeen(speciesId){
  if(!speciesId) return;
  if(!S.dexSeen) S.dexSeen = {};
  S.dexSeen[speciesId] = true;
}
/* 素材图鉴：获得过即点亮，用掉之后不熄灭。 */
function markMatSeen(id){
  if(!id) return;
  if(!S.matSeen) S.matSeen = {};
  S.matSeen[id] = true;
}
function matEverSeen(id){ return !!(S.matSeen && S.matSeen[id]); }
/* 可收集图鉴列表 = SPECIES + customSpecies（不含 DUNGEON_SPECIALS 副本专供敌人） */
function dexSpeciesList(){ return allSpecies(); }
function dexProgress(){
  const list = dexSpeciesList();
  const owned = list.filter(sp => S.dexSeen && S.dexSeen[sp.id]);
  return { total: list.length, owned: owned.length, pct: list.length? owned.length/list.length : 0 };
}
/* 里程碑奖励定义：每 10 只一档，洗髓露 ×1。动态生成到当前总数。 */
function dexMilestones(){
  const total = dexProgress().total;
  const arr = [];
  for(let n=10; n<=total; n+=10){
    arr.push({ id:'ms_'+n, threshold:n, reward:{type:'ivElixir', qty:1}, label:'收集 '+n+' 只' });
  }
  return arr;
}
function dexMilestoneState(ms){
  const owned = dexProgress().owned;
  return { met: owned >= ms.threshold, claimed: (S.dexClaimed||[]).includes(ms.id) };
}
function claimDexMilestone(ms){
  const st = dexMilestoneState(ms);
  if(!st.met){ toast('尚未达成收集条件','bad'); return false; }
  if(st.claimed){ toast('已领取过','bad'); return false; }
  S.ivElixir = (S.ivElixir||0) + ms.reward.qty;
  S.dexClaimed = S.dexClaimed||[];
  S.dexClaimed.push(ms.id);
  saveDraft();
  toast('图鉴奖励：洗髓露 ×'+ms.reward.qty+(S.activeSlot?'':'（记得存档到槽位）'),'gold');
  return true;
}
/* 某物种是否已被捕获过异色（用于卡片 ✦ 标记） */
function hasShinySpecies(speciesId){
  return S.spirits.some(s=>s.speciesId===speciesId && s.shiny)
      || S.beasts.some(b=>b.speciesId===speciesId && b.shiny);
}
/* 某物种当前在灵兽仓中的实例 id（点击卡片跳转用） */
function spiritIdOfSpecies(speciesId){
  const s = S.spirits.find(x=>x.speciesId===speciesId);
  return s ? s.id : null;
}