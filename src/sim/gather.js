

/* M3-1 采集：校验→出货→扣资源/耐久/体力 */
/* M3-1-4：找背包中某 kind 最高品质工具（axe=植物 / pick=矿物） */
function bestTool(kind){
  let best = null;
  for(const tid in (S.toolInv||{})){
    const cnt = S.toolInv[tid];
    if(!cnt || cnt<=0) continue;
    const it = ITEMS[tid];
    if(!it || it.type!=='tool' || it.kind!==kind) continue;
    if(!best || (it.rank||0) > (best.rank||0)){
      best = {id:tid, item:it, rank:it.rank||0};
    }
  }
  return best;
}
/* 按 qualityDist roll 品质 */
function rollQuality(dist){
  dist = dist||{normal:1};
  let r = Math.random(), acc = 0;
  for(const q in dist){ acc += dist[q]; if(r<=acc) return q; }
  return 'normal';
}
/* M3-1-4：采集测试素材 id（植物 000002~000007 / 矿物 000008~000013） */
function collectMatId(kind, quality){
  const off = kind==='ore' ? 8 : 2;
  const idx = off + (QUALITY_RANK[quality]||0);
  return 'SC_none_' + quality + '_' + String(idx).padStart(6,'0');
}