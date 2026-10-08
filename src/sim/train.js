

/* ===== M2-A5 挂机修炼 =====
   只有灵兽可挂机；3 个槽位；挂机中该灵兽不可进野外/秘境。
   本质 = 自动挑战秘境：投入素材 + 10 体力，15min 等效一次关卡挑战，
   收获三选一（等级经验 / 属性亲和力 / 技能熟练度），完成时记录可复刻。
   演示模式 15 秒，真实模式 15 分钟。 */
const TRAIN_DURATION = () => S.demo ? 15000 : 900000;
function trainValue(mats){
  const qW = {normal:1, good:2, fine:3, rare:5, epic:8, legend:12};
  return matsToList(mats).reduce((a,id)=>{ const m = matInfo(id); return a + (m ? unitOf(m)*(qW[m.quality]||1) : 0); }, 0);
}
/* 单次挂机收益（按素材价值折算） */
function trainGain(sp, gainType, mats, skillId, elem){
  const value = trainValue(mats);
  const out = {value};
  if(gainType==='exp'){
    out.exp = Math.max(10, Math.round(value*60));
  } else if(gainType==='aff'){
    const e = elem && elem!=='none' ? elem : ((matInfo(matsToList(mats)[0]) && matInfo(matsToList(mats)[0]).elem && matInfo(matsToList(mats)[0]).elem!=='none') ? matInfo(matsToList(mats)[0]).elem : sp.elem);
    out.aff = {elem:e, val:Math.max(.002, +(value*.002).toFixed(3))};
  } else {
    const sk = sp.skills.find(x=>x.id===skillId) || sp.skills[0];
    if(sk) out.mastery = {skillId:sk.id, name:sk.name, val:Math.max(.5, +(value*.8).toFixed(1))};
  }
  return out;
}
/* 副本记录的三项收益档案（exp / aff / mastery 全算，供修炼三选一复刻） */
function trainGainAll(sp, mats){
  const value = trainValue(mats);
  const g = {value};
  g.exp = Math.max(10, Math.round(value*60));
  // v1.16.7: 亲和力按投入元素结晶（chr-）元素——取数量最多的结晶元素；未投结晶则不给 aff
  const chrTally = {};
  matsToList(mats).forEach(id=>{
    if(typeof id==='string' && id.startsWith('chr-')){
      const parts = id.split('-');
      const e = parts[1];
      if(e && ELEM[e]) chrTally[e] = (chrTally[e]||0)+1;
    }
  });
  let affElem = null, affCnt = 0;
  for(const e in chrTally){ if(chrTally[e]>affCnt){ affCnt = chrTally[e]; affElem = e; } }
  if(affElem){
    g.aff = {elem:affElem, val:Math.max(.002, +(value*.002).toFixed(3))};
  }
  const sk = sp.skills[0];
  if(sk) g.mastery = {skillId:sk.id, name:sk.name, val:Math.max(.5, +(value*.8).toFixed(1))};
  return g;
}
function isTraining(spId){ return S.trainSlots.some(t=>t.spiritId===spId); }
function trainSlotOf(spId){ return S.trainSlots.find(t=>t.spiritId===spId); }