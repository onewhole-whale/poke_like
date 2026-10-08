
/* 开始挂机：校验 → 扣素材扣体力 → 入槽
   slot.ref 存在 = 复刻模式：投入素材的词条单位与品质 ≥ 参照记录（多投自动清理，收益按记录结算） */
function startTrain(slot){
  const sp = spById(slot.spiritId);
  if(!sp){ toast('灵兽不存在','bad'); return false; }
  if(isTraining(sp.id)){ toast('该灵兽已在挂机','bad'); return false; }
  if(S.trainSlots.length>=3){ toast('挂机槽已满（3 个）','bad'); return false; }
  if(!slot.ref){ toast('修炼必须复刻副本记录——请先在「副本构建」完成一次秘境冒险','bad'); return false; }
  if(matsCount(slot.mats)<1){ toast('未投入素材','bad'); return false; }
  const need = matsDict(slot.mats);
  for(const id in need){ if((matState[id]||0) < need[id]){ toast('素材不足：「'+(matInfo(id)?matInfo(id).name:id)+'」×'+need[id]+'（持有 '+((matState[id]||0))+'）','bad'); return false; } }
  if(slot.ref){
    const chk = refSatisfied(slot.mats, slot.ref.words);
    if(!chk.ok){ toast('复刻素材不足（词条/品质须≥参照）：'+chk.lacks.join('；'),'bad'); return false; }
  }
  if(!spendStamina(10)){ toast('体力不足（需要 10 点）','bad'); return false; }
  for(const id in need) matState[id] -= need[id];
  slot.startAt = Date.now();
  slot.duration = TRAIN_DURATION();
  S.trainSlots.push(slot);
  saveDraft(); renderTrain();
  toast('开始挂机修炼：'+sp.name+'（复刻副本记录）');
  return true;
}
/* 结算到期槽位 */
function tickTrain(){
  if(!S.trainSlots.length) return;
  const now = Date.now();
  const done = S.trainSlots.filter(t=> now >= t.startAt + t.duration);
  if(!done.length) return;
  S.trainSlots = S.trainSlots.filter(t=> now < t.startAt + t.duration);
  done.forEach(t=>{
    const sp = spById(t.spiritId); if(!sp) return;
    /* 复刻模式：收益按参照记录结算（数值与目标产出来自参照）；否则按本次素材现算 */
    let gain;
    if(t.ref){
      gain = {value:t.ref.value};
      if(t.gainType==='exp') gain.exp = t.ref.exp;
      if(t.gainType==='aff' && t.ref.aff) gain.aff = {elem:t.elem||t.ref.aff.elem, val:t.ref.aff.val};
      if(t.gainType==='mastery' && t.ref.mastery) gain.mastery = {skillId:t.skillId||t.ref.mastery.skillId, name:t.ref.mastery.name, val:t.ref.mastery.val};
    } else {
      gain = trainGain(sp, t.gainType, t.mats, t.skillId, t.elem);
    }
    const notes = [];
    if(gain.exp){
      sp.exp = (sp.exp||0) + gain.exp;
      let lvls=0;
      while(sp.exp >= expToNext(sp.lvl) && sp.lvl < lvlCapOf(sp)){
        sp.exp -= expToNext(sp.lvl); sp.lvl++; lvls++;
        const st = spiritStats(sp);
        sp.hp = Math.min(st.hp, sp.hp + st.hp);
        sp.capacity = capacityOf(sp);
        sp.skillPool = sp.skillPool||[];
        directUnlocked(sp.elem, sp.lvl).forEach(sk=>{
          if(!sp.skills.some(x=>x.id===sk.id) && !sp.skillPool.some(x=>x.id===sk.id)){
            sp.skillPool.push({id:sk.id, name:sk.name, kind:'direct', cost:sk.cost, elem:sk.elem, mastery:0});
          }
        });
      }
      notes.push('经验 +'+gain.exp+(lvls?' · 升到 Lv.'+sp.lvl:''));
    }
    if(gain.aff){
      const cur = (sp.aff&&sp.aff[gain.aff.elem]!=null) ? sp.aff[gain.aff.elem] : 50;
      sp.aff = sp.aff||{};
      sp.aff[gain.aff.elem] = Math.min(200, cur + gain.aff.val);
      notes.push(ELEM[gain.aff.elem].name+'亲和 +'+gain.aff.val);
    }
    if(gain.mastery){
      const sk = sp.skills.find(x=>x.id===gain.mastery.skillId);
      if(sk){
        const total = masteryTotal(sp);
        if(total + gain.mastery.val > (sp.masteryCap||100)){
          notes.push('熟练度已达总上限，'+sk.name+' 未能精进');
        } else {
          sk.mastery = Math.round((sk.mastery||0) + gain.mastery.val);
          notes.push(sk.name+' 熟练度 +'+gain.mastery.val);
        }
      }
    }
    // 记录可复刻：复刻挂机继承参照的词条组合与收益（链稳定）；普通挂机按本次实际投入
    const rec = t.ref ? {
      mats:[...t.ref.mats], words:{...t.ref.words}, value:t.ref.value,
      exp:t.ref.exp||0,
      aff:t.ref.aff?{elem:t.ref.aff.elem, val:t.ref.aff.val}:null,
      mastery:t.ref.mastery?{skillId:t.ref.mastery.skillId, name:t.ref.mastery.name, val:t.ref.mastery.val}:null,
    } : {
      mats:[...t.mats], words:aggregateWords(t.mats), value:gain.value,
      exp:gain.exp||0,
      aff:gain.aff?{elem:gain.aff.elem, val:gain.aff.val}:null,
      mastery:gain.mastery?{skillId:gain.mastery.skillId, name:gain.mastery.name, val:gain.mastery.val}:null,
    };
    rec.stamp = stampNow();
    S.trainLogs.unshift(rec);
    S.trainLogs = S.trainLogs.slice(0,10);
    saveDraft();
    S.logs.unshift({t:stampNow(), cls:'sprout', text:'挂机归来：<b>'+sp.name+'</b> 修炼完成（'+notes.join(' · ')+'）。'});
    toast('挂机完成：'+sp.name+' · '+notes.join('、'));
  });
}