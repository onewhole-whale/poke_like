
/* 素材投入统一字典化 {id:count}；兼容旧数组。 */
function matsToList(mats){
  if(Array.isArray(mats)) return mats;
  const out=[];
  Object.keys(mats||{}).forEach(id=>{ for(let i=0;i<(mats[id]||0);i++) out.push(id); });
  return out;
}
function matsDict(mats){
  if(!Array.isArray(mats)) return {...(mats||{})};
  const d={}; mats.forEach(id=> d[id]=(d[id]||0)+1); return d;
}
function matsCount(mats){ return matsToList(mats).length; }
/* 存在分计划：按属性聚合素材 extractInfo；每属性 1000 分容量，拓池占 250。
   返回 {elem: {skills:{id:score}, perks:{id:score}, total, cap, expand:bool, expandSkills:[id], expandPerks:[id]}} */
function scorePlan(mats){
  const list = matsToList(mats);
  const plan = {};
  list.forEach(id=>{
    // v1.16.7: DJ_ 道具（技能石/专长石）直接给绑定 skill/perk +100 分，不产生敌人
    if(isItem(id)){
      const it = itemInfo(id); if(!it) return;
      const e = (it.elem && it.elem!=='none' && GLOBAL_SKILL_POOL[it.elem]) ? it.elem : 'universal';
      if(!plan[e]) plan[e] = {skills:{}, perks:{}};
      if(it.skillId) plan[e].skills[it.skillId] = (plan[e].skills[it.skillId]||0)+100;
      if(it.perkId) plan[e].perks[it.perkId] = (plan[e].perks[it.perkId]||0)+100;
      return;
    }
    const m = matInfo(id); if(!m) return;
    const ei = extractInfoOf(m);
    const e = (m.elem && m.elem!=='none' && GLOBAL_SKILL_POOL[m.elem]) ? m.elem : 'universal';
    if(!plan[e]) plan[e] = {skills:{}, perks:{}};
    Object.keys(ei.skillScore||{}).forEach(sk=>{ plan[e].skills[sk] = (plan[e].skills[sk]||0) + ei.skillScore[sk]; });
    Object.keys(ei.talentScore||{}).forEach(pk=>{ plan[e].perks[pk] = (plan[e].perks[pk]||0) + ei.talentScore[pk]; });
  });
  Object.keys(plan).forEach(e=>{
    const p = plan[e];
    let ex = S.buildExpand && S.buildExpand[e];
    if(ex===true) ex = {skills:true, perks:true};          // 兼容旧存档布尔拓池
    p.expand = !!(ex && (ex.skills||ex.perks||ex.repeat||ex.boost));
    p.expandSkills = (ex && ex.skills) ? [...(ESSENCE_EXPAND.skills[e]||[])] : [];
    p.expandPerks  = (ex && ex.perks)  ? [...(ESSENCE_EXPAND.perks[e]||[])] : [];
    p.repeat = !!(ex && ex.repeat);
    p.boost  = !!(ex && ex.boost);
    p.occupies = p.expandSkills.length>0 || p.expandPerks.length>0;
    p.total = Object.values(p.skills).reduce((a,b)=>a+b,0) + Object.values(p.perks).reduce((a,b)=>a+b,0);
    const cap = p.occupies ? 750 : 1000;                    // 附加技能/专长侵占 250 分；纯 repeat/boost 不占
    p.cap = cap;
    if(p.total>cap){
      const k = cap/p.total;
      Object.keys(p.skills).forEach(sk=> p.skills[sk] = Math.max(1, Math.floor(p.skills[sk]*k)));
      Object.keys(p.perks).forEach(pk=> p.perks[pk] = Math.max(1, Math.floor(p.perks[pk]*k)));
      p.total = cap; p.scaled = true;
    }
  });
  return plan;
}
/* 单属性抽取：entries 为 [{kind,id,score}]，按 千分之一/分 概率。
   总存在分不足 1000 时可能抽空（未命中）。 */
function rollEntry(entries){
  const total = entries.reduce((a,b)=>a+b.score,0);
  if(total<=0) return null;
  let r = Math.random()*1000;   // 容量 1000
  if(r>=total) return null;     // 未构造满 → 抽空
  for(const e of entries){ r-=e.score; if(r<=0) return e; }
  return entries[entries.length-1];
}
function elemEntries(planElem){
  const entries = [];
  Object.keys(planElem.skills).forEach(id=> entries.push({kind:'skill', id, score:planElem.skills[id]}));
  Object.keys(planElem.perks).forEach(id=> entries.push({kind:'perk', id, score:planElem.perks[id]}));
  if(planElem.expandSkills && planElem.expandSkills.length>0){
    const escore = 250 / Math.max(1, planElem.expandSkills.length + planElem.expandPerks.length);
    planElem.expandSkills.forEach(id=>{ if(!entries.some(e=>e.id===id)) entries.push({kind:'skill', id, score:escore, expand:true}); });
  }
  if(planElem.expandPerks && planElem.expandPerks.length>0){
    const escore = 250 / Math.max(1, planElem.expandSkills.length + planElem.expandPerks.length);
    planElem.expandPerks.forEach(id=>{ if(!entries.some(e=>e.id===id)) entries.push({kind:'perk', id, score:escore, expand:true}); });
  }
  return entries;
}

/* ================= 状态 ================= */
let uidSeq = 100;
const uid = () => 'u' + (++uidSeq);