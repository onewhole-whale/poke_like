

/* ================= 详情弹层 ================= */
/* 技能装卸：卸下 → 技能库（熟练度/使用次数保留）；装配 → 校验容量与禁带 */
function unequipSkill(s, sk){
  const idx = s.skills.indexOf(sk);
  if(idx<0) return;
  s.skills.splice(idx,1);
  if(!s.skillPool) s.skillPool=[];
  s.skillPool.push(sk);
  saveDraft(); toast('卸下「'+sk.name+'」，熟练度保留'); openDetail(s.id);
}
function equipSkill(s, sk){
  const cc = skillCapCost(s, sk);
  if(cc==null){ toast('亲和力过低，禁带该系技能','bad'); return; }
  if(usedCap(s)+cc > capacityOf(s)){ toast('技能容量不足','bad'); return; }
  const idx = s.skillPool.indexOf(sk);
  if(idx<0) return;
  s.skillPool.splice(idx,1);
  s.skills.push(sk);
  saveDraft(); toast('装配「'+sk.name+'」'); openDetail(s.id);
}