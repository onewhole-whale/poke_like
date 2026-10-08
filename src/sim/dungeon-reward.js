
/* 结算：副本记录（供挂机复刻）+ 存在分抽取（roll 且通关） */
function finalizeDungeon(won){
  const st = S.settle; const sp = spById(st.spiritId);
  if(!sp) return;
  // 至少击杀 1 只且投入素材 → 留下可复刻的副本记录
  if(st.kills>0 && matsCount(st.mats)>0){
    const g0 = trainGainAll(sp, st.mats);
    const rec = {mats:{...st.mats}, words:st.words, value:g0.value,
      exp:g0.exp, aff:g0.aff, mastery:g0.mastery, stamp:stampNow(), src:'副本 · '+(won?'通关':'败退')+' · 击杀 '+st.kills};
    S.trainLogs = S.trainLogs||[];
    S.trainLogs.unshift(rec);
    S.trainLogs = S.trainLogs.slice(0,10);
    st.record = rec;
  }
  // 存在分抽取（通关即抽，抽取与经验并行）
  if(won){
    st.rewards = [];
    const wonderUsed = {};
    Object.keys(st.plan).forEach(e=>{
      const wonder = st.wonders.find(x=>x.elem===e && !wonderUsed[x.itemId]);
      if(wonder){ wonderUsed[wonder.itemId]=true; st.rewards.push({elem:e, wonder, desc:'奇遇兑现：'+wonder.desc}); return; }
      const pe = st.plan[e];
      const draws = pe.repeat ? 2 : 1;                       // 重复抽取：该属性结算两次
      for(let d=0; d<draws; d++){
        let entries = elemEntries(pe);
        if(pe.boost) entries = entries.map(x=>({...x, score:x.score*2}));   // 大幅增概率
        const hit = rollEntry(entries);
        if(!hit) continue;
        if(hit.kind==='skill') st.rewards.push({elem:e, kind:'skill', item:dgSkillDef(hit.id)});
        else st.rewards.push({elem:e, kind:'perk', item:perkById(hit.id)});
      }
    });
    st.rewards.forEach(r=>{
      if(r.wonder){
        const w = r.wonder;
        sp.wonderGains = (sp.wonderGains||0)+1;
        if(w.kind==='skill') grantDgSkill(sp, Object.values(SKILLS).flat().find(s=>s.id===w.itemId) || SKILLS[w.elem][SKILLS[w.elem].length-1]);
        else grantDgPerk(sp, (PERKS[w.elem]||[]).find(p=>p.id===w.itemId) || PERKS[w.elem][0], w.elem);
      } else if(r.kind==='skill'){
        grantDgSkill(sp, r.item);
      } else if(r.kind==='perk'){
        grantDgPerk(sp, r.item, r.elem);
      }
    });
  }
  sp.adventures = (sp.adventures||0)+1;
  saveDraft();
}
function wonderToItem(w){
  if(w.kind==='skill'){
    const sk = Object.values(SKILLS).flat().find(s=>s.id===w.itemId);
    return {kind:'skill', skill: sk || SKILLS[w.elem][SKILLS[w.elem].length-1]};
  }
  const pk = (PERKS[w.elem]||[]).find(p=>p.id===w.itemId);
  return {kind:'perk', perk: pk || PERKS[w.elem][0]};
}
function skillById(id){
  if(S.skillEdits && S.skillEdits[id]) return S.skillEdits[id];
  return Object.values(SKILLS).flat().find(x=>x.id===id);
}
function perkById(id){ return Object.values(PERKS).flat().find(x=>x.id===id); }
function grantDgSkill(sp, sk){
  if(!sk) return;
  const exist = sp.skills.find(x=>x.id===sk.id);
  if(exist){
    exist.mastery = Math.min(100, exist.mastery + 10);
  } else {
    sp.skillPool = sp.skillPool||[];
    sp.skillPool.push({id:sk.id, name:sk.name, cost:sk.cost, elem:sk.elem, mastery:0, kind:sk.kind||'ult', energy:sk.energy||0, hits:sk.hits||1});
  }
}
function grantDgPerk(sp, perk, elem){
  if(!perk) return;
  const p = {...perk, elem};
  sp.perks = sp.perks||[];
  sp.perks.push(p.id || p);
  sp.used = (sp.used||0) + p.cost;
  if(p.capTotal) sp.masteryCap = (sp.masteryCap||0) + p.capTotal;
}