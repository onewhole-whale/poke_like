
/* 灵根突破：消耗对应属性元素萌芽 + 同系元素微粒 ×2，等级上限 +1（最多 +10；额外等级仍须正常修炼） */
function renderBreakthrough(s){
  const box = el('div','breakthrough-box','');
  const maxCap = BASE_LVL_CAP + 10;
  box.appendChild(el('h3',null,'灵根突破 <span class="sub">'+(s.bonusLv||0)+'/10</span>'));
  const needSpr = s.elem, needMicro = 'micro-'+s.elem;
  const sprMap = sproutsOf();
  const hasSpr = (sprMap[needSpr]||0)>=1 || (sprMap.any||0)>=1;
  const hasMicro = (matState[needMicro]||0)>=2;
  const done = (s.bonusLv||0)>=10;
  const btn = el('button','btn'+(done||!hasSpr||!hasMicro?'':' gold'), done?'已达上限 · 灵根圆满':'灵根突破 +1 · '+elemName(needSpr)+'元素萌芽 ×1 + '+elemName(needSpr)+'元素微粒 ×2');
  btn.disabled = done || !hasSpr || !hasMicro;
  btn.title = done ? '额外等级上限最多 +10' : (!hasSpr ? '缺少 '+elemName(needSpr)+' 元素萌芽（炼化可得，属性必须对应）' : '') + (!hasMicro ? '；缺少 '+elemName(needSpr)+' 元素微粒' : '');
  btn.onclick = ()=>{
    if((sprMap[needSpr]||0)>=1) sproutsTake(needSpr,1); else sproutsTake('any',1);
    matState[needMicro]-=2;
    s.bonusLv = (s.bonusLv||0)+1;
    s.log = s.log||[];
    s.log.unshift('以 '+elemName(needSpr)+' 元素萌芽突破灵根：等级上限 +1（现 '+(BASE_LVL_CAP+s.bonusLv)+'/'+maxCap+'）');
    saveDraft(); toast('灵根突破：等级上限 +1','gold');
    openDetail(s.id);
  };
  box.appendChild(btn);
  return box;
}
/* 传说加冕面板：检查点进度 + 加冕/任务链/KP 审核流程 */
function renderCoronation(s){
  const box = el('div','coronation-box');
  box.appendChild(el('h3',null,'传说加冕 · 七重天堂'));
  const status = coronationStatus(s);
  if(status.stage==='none'){
    const cps = checkpointState(s);
    cps.forEach(({cp,hit})=>{
      box.appendChild(el('div','cp-row'+(hit?' hit':''), '<span class="cp-dot">'+(hit?'✓':'·')+'</span><span class="cp-name">'+cp.name+'</span><span class="tiny">'+cp.desc+'</span>'));
    });
    const anyHit = cps.some(x=>x.hit);
    const btn = el('button','btn sm '+(anyHit?'primary':'') ,'传说加冕 · 灵息 ×10');
    btn.title = '消耗灵息结晶 ×10，检查是否达成任一加冕条件；命中即开启晋升任务链';
    btn.onclick = ()=> tryCoronation(s);
    box.appendChild(el('div','modal-actions','')).appendChild(btn);
    return box;
  }
  if(status.stage==='trials'){
    const chain = status.chain;
    box.appendChild(el('div','cp-row hit','<span class="cp-dot">✓</span><span class="cp-name">'+status.cp.name+'</span><span class="tiny">'+chain.hint+'</span>'));
    box.appendChild(el('div','tiny','<b>晋升任务链 · '+chain.name+'</b>（'+status.idx+'/'+chain.steps.length+'）'));
    chain.steps.forEach((stp,i)=>{
      box.appendChild(el('div','cp-row'+(i<status.idx?' hit':(i===status.idx?' cur':'')), '<span class="cp-dot">'+(i<status.idx?'✓':(i===status.idx?'▶':'·'))+'</span><span class="cp-name">'+(i<status.idx?'<s>':i===status.idx?'': '')+stp+(i<status.idx?'</s>':i===status.idx?'':'')+'</span>'));
    });
    const btn = el('button','btn sm primary','推进一步 · 灵息 ×5');
    btn.onclick = ()=> coronationStep(s);
    box.appendChild(el('div','modal-actions','')).appendChild(btn);
    return box;
  }
  if(status.stage==='kp'){
    box.appendChild(el('div','cp-row hit','<span class="cp-dot">✓</span><span class="cp-name">任务链完成</span><span class="tiny">可以生成称号</span>'));
    const btn = el('button','btn sm primary','生成称号方案');
    btn.onclick = ()=> kpGenerate(s);
    box.appendChild(el('div','modal-actions','')).appendChild(btn);
    return box;
  }
  if(status.stage==='review'){
    const d = status.draft;
    box.appendChild(el('div','cp-row hit','<span class="cp-dot">✓</span><span class="cp-name">称号方案</span>'));
    box.appendChild(el('div','kp-draft','<div class="kp-title">称号：<b>【'+d.title+'】</b></div>'+
      '<div class="tiny">专属专长：'+d.perk.name+' — '+d.perk.desc+'</div>'+
      '<div class="tiny">专属技能：'+d.skill.name+' — '+d.skill.desc+'</div>'));
    if(d.advice) box.appendChild(el('div','tiny','<span class="badge">驳回意见</span>'+d.advice));
    const row = el('div','modal-actions','');
    const ok = el('button','btn sm primary','通过 · 落实');
    ok.onclick = ()=> kpReview(s, true);
    const no = el('button','btn sm','驳回 · 携建议重写');
    no.onclick = ()=> kpReview(s, false);
    row.appendChild(ok); row.appendChild(no);
    box.appendChild(row);
    return box;
  }
  // done
  box.appendChild(el('div','cp-row hit','<span class="cp-dot">★</span><span class="cp-name">已加冕：'+s.name+'</span><span class="tiny">名称、种族值、专长、技能、亲和力均已擢升</span>'));
  return box;
}