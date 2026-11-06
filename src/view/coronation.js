
/* 灵根突破：消耗对应属性元素萌芽 + 同系元素微粒 ×2，等级上限 +1（最多 +10；额外等级仍须正常修炼） */
function renderBreakthrough(s){
  const maxCap = BASE_LVL_CAP + 10;
  const cur = s.bonusLv||0;
  const done = cur>=10;
  const row = el('div','submit-field');
  row.appendChild(el('span','sf-k','灵根'));
  row.appendChild(el('span','sf-v', cur+'/10'));
  const btn = el('button','btn sm','提交');
  btn.type = 'button';
  btn.disabled = done;
  if(done) btn.title = '额外等级上限最多 +10';
  btn.onclick = ()=>{
    if(done) return;
    const needSpr = s.elem;
    const needMicro = 'micro-'+s.elem;
    const sprMap = sproutsOf();
    openSubmitDialog({
      title:'灵根突破',
      desc:'等级上限 +1。升上去仍要攒够经验。',
      costs:[
        {name:elemName(needSpr)+'元素萌芽', need:1, have:(sprMap[needSpr]||0)+(sprMap.any||0), note:'同系或无主'},
        {name:elemName(needSpr)+'元素微粒', need:2, have:matState[needMicro]||0}
      ],
      onCancel(){ openDetail(s.id); },
      onOk(){
        const spr = sproutsOf();
        if((spr[needSpr]||0)>=1) sproutsTake(needSpr,1);
        else if((spr.any||0)>=1) sproutsTake('any',1);
        else { toast('元素萌芽不足','bad'); return; }
        if((matState[needMicro]||0)<2){ toast('元素微粒不足','bad'); return; }
        matState[needMicro]-=2;
        s.bonusLv = (s.bonusLv||0)+1;
        s.log = s.log||[];
        s.log.unshift('以 '+elemName(needSpr)+' 元素萌芽突破灵根：等级上限 +1（现 '+(BASE_LVL_CAP+s.bonusLv)+'/'+maxCap+'）');
        saveDraft();
        toast('灵根突破：等级上限 +1','gold');
        openDetail(s.id);
      }
    });
  };
  row.appendChild(btn);
  return row;
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
    const btn = el('button','btn sm','提交');
    btn.type = 'button';
    btn.onclick = ()=> openSubmitDialog({
      title:'传说加冕',
      desc:'消耗灵息结晶，检查是否达成任一加冕条件。命中后开启晋升任务链。',
      costs:[{name:'灵息结晶', need:10, have:S.aura}],
      onCancel(){ openDetail(s.id); },
      onOk(){ tryCoronation(s); }
    });
    box.appendChild(btn);
    return box;
  }
  if(status.stage==='trials'){
    const chain = status.chain;
    box.appendChild(el('div','cp-row hit','<span class="cp-dot">✓</span><span class="cp-name">'+status.cp.name+'</span><span class="tiny">'+chain.hint+'</span>'));
    box.appendChild(el('div','tiny','<b>晋升任务链 · '+chain.name+'</b>（'+status.idx+'/'+chain.steps.length+'）'));
    chain.steps.forEach((stp,i)=>{
      box.appendChild(el('div','cp-row'+(i<status.idx?' hit':(i===status.idx?' cur':'')), '<span class="cp-dot">'+(i<status.idx?'✓':(i===status.idx?'▶':'·'))+'</span><span class="cp-name">'+(i<status.idx?'<s>':i===status.idx?'': '')+stp+(i<status.idx?'</s>':i===status.idx?'':'')+'</span>'));
    });
    const btn = el('button','btn sm','提交');
    btn.type = 'button';
    btn.onclick = ()=> openSubmitDialog({
      title:'推进任务',
      desc: chain.steps[status.idx] || '推进晋升任务链一步。',
      costs:[{name:'灵息结晶', need:5, have:S.aura}],
      onCancel(){ openDetail(s.id); },
      onOk(){ coronationStep(s); }
    });
    box.appendChild(btn);
    return box;
  }
  if(status.stage==='kp'){
    box.appendChild(el('div','cp-row hit','<span class="cp-dot">✓</span><span class="cp-name">任务链完成</span><span class="tiny">可以生成称号</span>'));
    const btn = el('button','btn sm primary','生成称号方案');
    btn.onclick = ()=> kpGenerate(s);
    box.appendChild(btn);
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