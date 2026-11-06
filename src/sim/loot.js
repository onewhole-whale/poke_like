

/* 掉落：按精灵配置的专属掉落物（v1.16.4：onlyKill 已删，三 mode 统一从 sp.drops 全量取，仅靠数量/种类区分）
   kill      → 全部素材满额数量，稀有度加成
   catchFail → 种类减半按品质降序（数量与 kill 一致）
   calm      → 少量（30%）
   mult：elite/perfect/legend ×1.5
   品质锁：模板 elite/boss 在击杀结算走 upMatFor（+1/+2 品质）
   当前素材池全空 → 返回 {}（无掉落）。 */
function beastDrops(speciesId, mode){
  const sp = allSpeciesDef(speciesId);
  const mult = (sp.rarity==='elite'||sp.rarity==='perfect'||sp.rarity==='legend') ? 1.5 : 1;
  const drops = dropsOf(speciesId);
  const out = {};
  if(mode==='calm'){
    drops.forEach(d=>{ out[d.id] = Math.max(1, Math.round(2*mult*.3)); });
  } else if(mode==='catchFail'){
    const sorted = drops.slice().sort((a,b)=> (QUALITY_RANK[b.quality]||0)-(QUALITY_RANK[a.quality]||0));
    const keep = Math.max(1, Math.floor(sorted.length/2));
    sorted.slice(0, keep).forEach(d=>{ out[d.id] = Math.max(1, Math.round(2*mult)); });
  } else {
    drops.forEach(d=>{ out[d.id] = Math.max(1, Math.round(2*mult)); });
  }
  return out;
}
function applyLoot(drops){
  Object.keys(drops).forEach(k=>{ matState[k] = (matState[k]||0)+drops[k]; markMatSeen(k); });
}
/* 地图 extraDrops：精英/首领击杀时按权重抽一件 DJ_ 进 toolInv（仅展示过的配置真正生效） */
function applyMapExtraDrops(template){
  const mid = S.wild && S.wild.mapId;
  const cfg = mid && MAP_CONFIGS[mid];
  const ec = cfg && cfg.eventConfig;
  if(!ec || !ec.extraDrops) return null;
  const key = template==='boss' ? 'fight_boss' : (template==='elite' ? 'fight_elite' : 'fight_normal');
  const pool = ec.extraDrops[key] || [];
  if(!pool.length) return null;
  const total = pool.reduce((a,e)=>a+(e.weight||1), 0);
  let r = Math.random() * total;
  let pick = pool[0];
  for(const e of pool){ r -= (e.weight||1); if(r<=0){ pick=e; break; } }
  if(!pick || !pick.itemId) return null;
  const id = pick.itemId;
  S.toolInv = S.toolInv||{};
  S.toolInv[id] = (S.toolInv[id]||0)+1;
  const it = (typeof ITEMS!=='undefined' && ITEMS[id]) || null;
  if(it && it.type==='tool'){
    S.toolDur = S.toolDur||{};
    if(S.toolDur[id]==null) S.toolDur[id] = it.durability||it.maxDurability||100;
  }
  return it ? it.name : id;
}