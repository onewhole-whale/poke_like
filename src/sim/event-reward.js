

/* 奇遇故事 */
/* M3-1-5a 事件链渲染（群星式：上文案下选项；check 自动判定；end 结算） */
function applyChainRewards(rewards){
  if(!rewards) return;
  rewards.forEach(r=>{
    if(r.id==='__wonder_perk__'){
      S.wonderQueue = S.wonderQueue || [];
      S.wonderQueue.push({elem:r.elem, kind:'perk', itemId:'blaze-affinity', desc:'火系亲和 +20'});
    } else if(r.id==='__wonder_skill__'){
      S.wonderQueue = S.wonderQueue || [];
      S.wonderQueue.push({elem:r.elem, kind:'skill', itemId:r.skillId, desc:'奇遇技能'});
    } else {
      matState[r.id] = (matState[r.id]||0) + (r.qty||1);
      markMatSeen(r.id);
      const m = matInfo(r.id);
      if(m) S.wild.loots.push({id:r.id, name:m.name, n:r.qty||1});
    }
  });
}
function applyChainEffects(effects){
  if(!effects) return;
  effects.forEach(e=>{
    if(e.type==='status' && e.status==='burn'){
      // 烫伤=复用灼伤，本次冒险内持续（写 w.burnScald）
      S.wild.burnScald = true;
    } else if(e.type==='stamina'){
      S.stamina = Math.max(0, (S.stamina||0) - (e.cost||0));
    }
  });
}