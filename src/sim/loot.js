

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