
function affBarRow(s, e){
  const v = affOf(s, e);
  const cap = 200 + ((perkEffects(s).affCap)||0);
  const pct = cap>0 ? Math.min(100, v/cap*100) : 0;
  const text = Math.abs(v-Math.round(v))<0.05 ? String(Math.round(v)) : String(Math.round(v*10)/10);
  const row = el('div','beta-row');
  row.innerHTML = '<span class="be">'+ELEM[e].name+'</span><span class="bb"><i style="width:'+pct+'%"></i></span><span class="bv">'+text+'</span>';
  return row;
}
function skillSheet(s, sk){
  const def = skillById(sk.id) || {};
  const type = def.type || sk.type || '-';
  const power = type==='攻击' ? (def.power!=null ? def.power : (sk.power!=null ? sk.power : 0)) : '-';
  const energy = def.energy!=null ? def.energy : (sk.energy!=null ? sk.energy : 0);
  const cost = sk.cost!=null ? sk.cost : def.cost;
  let cap = '-';
  if(cost===0) cap = 0;
  else if(cost!=null){
    const cc = skillCapCost(s, {elem: sk.elem||def.elem, cost: cost});
    cap = cc==null ? '-' : cc;
  }
  return '<span class="sk-meta">'+type+'　威力 '+power+'　能耗 '+energy+'　容量 '+cap+'</span>';
}
function renderSkillPool(s){
  const box = el('div','','');
  box.appendChild(el('h3',null,'待装配技能'));
  const pool = s.skillPool||[];
  const capLeft = capacityOf(s) - usedCap(s);
  if(pool.length===0){
    box.appendChild(el('div','muted','技能库空空。副本与奇遇习得的技能先入此处，装配后才可出战。'));
    return box;
  }
  const filt = el('select','inp');
  [['all','全系'],...Object.entries(ELEM).map(([k,v])=>[k,v.name])].forEach(([k,v])=>{
    const op=document.createElement('option'); op.value=k; op.textContent=v; filt.appendChild(op);
  });
  filt.onchange = ()=>{ openDetail(s.id); box._f = filt.value; applyFilter(); };
  const wrap = el('div','','');
  box.appendChild(filt);
  function applyFilter(){
    wrap.innerHTML='';
    const f = filt.value;
    const list = pool.filter(x=>f==='all'||x.elem===f);
    if(list.length===0){ wrap.appendChild(el('div','muted','该系没有待装配技能。')); return; }
    list.forEach(sk=>{
      const cc = skillCapCost(s, sk);
      const row = el('div','skill-row');
      const pct = Math.min(100, sk.mastery/s.masteryCap*100);
      row.innerHTML = '<span class="sk-main"><span class="sk-name">'+(sk.star?'★ ':'')+sk.name+' <span class="tiny">'+(ELEM[sk.elem]?ELEM[sk.elem].name:sk.elem)+'系</span></span>'+skillSheet(s, sk)+'</span><span class="sk-mastery"><i style="width:'+pct+'%"></i></span><span class="sk-val">'+sk.mastery+'</span>';
      const eq = el('button','btn sm'+(cc!=null && usedCap(s)+cc<=capacityOf(s)?'':' ghost'),'装');
      if(cc==null) eq.title = '亲和力过低，禁带该系';
      else if(usedCap(s)+cc>capacityOf(s)) eq.title = '容量不足（剩余 '+capLeft+'）';
      eq.disabled = (cc==null) || (usedCap(s)+cc>capacityOf(s));
      eq.onclick = ()=> equipSkill(s, sk);
      row.appendChild(eq);
      wrap.appendChild(row);
    });
  }
  applyFilter();
  box.appendChild(wrap);
  return box;
}
function openDetail(id){
  let s = spById(id);
  const isBeast = !s;
  if(isBeast){
    s = S.beasts.find(x=>x.id===id);
    if(!s) return;
    const def = allSpeciesDef(s.speciesId);
    if(def){
      if(!s.name) s.name = def.name;
      if(!s.elem) s.elem = def.elem;
    }
  }
  if(!s) return;
  const st = spiritStats(s);
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  mb.classList.add('is-detail');
  const spDef = allSpeciesDef(s.speciesId);
  const crownOn = (coronationStatus(s).stage && coronationStatus(s).stage!=='none') || checkpointState(s).some(x=>x.hit);
  const tabDefs = [
    {id:'base', name:'基础信息'},
    {id:'lore', name:'来历'},
    {id:'aff', name:'亲和'},
    {id:'skill', name:'技能'},
    {id:'evo', name:'进化'}
  ];
  if(crownOn) tabDefs.push({id:'crown', name:'加冕'});
  const shell = el('div','detail-shell');
  const tabBar = el('div','detail-tabs');
  const main = el('div','detail-main');
  const panes = {};
  tabDefs.forEach(t=>{
    const b = el('button','detail-tab'+(t.id==='base'?' on':''), t.name);
    b.type = 'button';
    b.onclick = ()=>{
      tabBar.querySelectorAll('.detail-tab').forEach(x=>x.classList.toggle('on', x===b));
      Object.keys(panes).forEach(id=>{ panes[id].style.display = id===t.id ? 'block' : 'none'; });
    };
    tabBar.appendChild(b);
    panes[t.id] = el('div','detail-pane');
    panes[t.id].style.display = t.id==='base' ? 'block' : 'none';
  });
  const closeBtn = el('button','btn ghost sm','收起');
  closeBtn.type = 'button';
  closeBtn.onclick = closeOverlay;
  tabBar.appendChild(closeBtn);
  shell.appendChild(tabBar);
  shell.appendChild(main);
  mb.appendChild(shell);
  const base = panes.base;
  base.appendChild(el('h2',null, s.name+(s.shiny?' <span class="tag shiny">异色</span>':'')+' <span class="tag src">'+(isBeast?(s.shiny?'异色妖兽':'妖兽'):(s.shiny?'异色灵兽':'灵兽'))+'</span>'+(s.coronation&&s.coronation.stage==='done'?' <span class="tag gold">已加冕</span>':'')));
  const face = el('div','species-sheet','');
  fillPortrait(face, s.speciesId, (spDef&&spDef.elem)||s.elem, '🐾', 'sheet', !!s.shiny);
  base.appendChild(face);
  const lvlNow = s.lvl||1;
  const lvlCap = lvlCapOf(s);
  const atCap = lvlNow >= lvlCap;
  const expNeedNow = expToNext(lvlNow);
  const expNow = s.exp||0;
  const expPct = atCap ? 100 : (expNeedNow>0 ? Math.min(100, expNow/expNeedNow*100) : 0);
  const expRow = el('div','exp-row');
  expRow.innerHTML = '<span>Lv.'+lvlNow+' / '+lvlCap+'</span><span class="exp-track"><i style="width:'+expPct+'%"></i></span><span class="exp-val">'+(atCap?'已满级':expNow+' / '+expNeedNow)+'</span>';
  base.appendChild(expRow);
  const caps = statCeilings();
  const bars = el('div','stat-bars');
  [['生命', st.hp, caps.hp], ['攻击', st.atk, caps.atk], ['防御', st.def, caps.def], ['特攻', st.spa, caps.spa], ['特防', st.sdef, caps.sdef], ['速度', st.spd, caps.spd]].forEach(([name, cur, max])=>{
    const pct = max>0 ? Math.min(100, cur/max*100) : 0;
    const row = el('div','beta-row');
    row.title = name+' '+cur+'，理论上限 '+max+(name==='生命'?'（满级、个体 20）':'（满级、个体 20、有利性格）');
    row.innerHTML = '<span class="be">'+name+'</span><span class="bb"><i style="width:'+pct+'%"></i></span><span class="bv">'+cur+'</span>';
    bars.appendChild(row);
  });
  base.appendChild(bars);
  const fields = el('div','submit-fields');
  const ivSum = ivSummary(s);
  const natRow = el('div','submit-field');
  natRow.appendChild(el('span','sf-k','性格'));
  natRow.appendChild(el('span','sf-v', natureDesc(s.nature)));
  const natBtn = el('button','btn sm','提交');
  natBtn.type = 'button';
  natBtn.onclick = ()=> openSubmitDialog({
    title:'更换性格',
    desc:'性格修正攻击、防御、特攻、特防、速度中的两项 ±10%。生命不受影响。',
    costs:[{name:'灵息结晶', need:1, have:S.aura}],
    mount(box){
      const sel = document.createElement('select');
      sel.className = 'inp';
      NATURES.forEach(n=>{ const op=document.createElement('option'); op.value=n.id; op.textContent=natureDesc(n.id); if(n.id===s.nature) op.selected=true; sel.appendChild(op); });
      box.appendChild(sel);
      return ()=>({value:sel.value});
    },
    onCancel(){ openDetail(s.id); },
    onOk(extra){
      if(S.aura<1){ toast('灵息结晶不足','bad'); return; }
      S.aura--;
      s.nature = extra.value;
      saveDraft();
      openDetail(s.id);
      toast('性格改为 '+natureDesc(s.nature));
    }
  });
  natRow.appendChild(natBtn);
  const ivRow = el('div','submit-field');
  ivRow.appendChild(el('span','sf-k','个体值'));
  ivRow.appendChild(el('span','sf-v', ivSum.length? ivSum.map(([k,v])=>IV_NAME[k]+'+'+v).join(' '):'无'));
  const ivBtn = el('button','btn sm','提交');
  ivBtn.type = 'button';
  ivBtn.onclick = ()=> openSubmitDialog({
    title:'洗髓',
    desc:'重定先天资质。最多 3 个面板属性有个体值，单项 1–20。',
    costs:[{name:'洗髓露', need:1, have:S.ivElixir||0}],
    mount(box){ return buildIVEditor(box, s.iv); },
    onCancel(){ openDetail(s.id); },
    onOk(extra){
      if(extra.err){ toast(extra.err,'bad'); return; }
      if((S.ivElixir||0)<1){ toast('洗髓露不足','bad'); return; }
      S.ivElixir--;
      s.iv = extra.iv;
      saveDraft();
      openDetail(s.id);
      toast('洗髓完成：'+ (ivSummary(s).length? ivSummary(s).map(([k,v])=>IV_NAME[k]+'+'+v).join(' '):'无个体值'));
    }
  });
  ivRow.appendChild(ivBtn);
  fields.appendChild(natRow);
  fields.appendChild(ivRow);
  fields.appendChild(renderBreakthrough(s));
  base.appendChild(fields);
  panes.lore.appendChild(el('h3',null,'精灵来历'));
  if(isBeast && s.caught) panes.lore.appendChild(el('div','muted','捕获于 '+esc(s.caught)));
  if(spDef && spDef.desc) panes.lore.appendChild(el('div','muted', esc(spDef.desc)));
  if(spDef && spDef.ecology) panes.lore.appendChild(el('div','muted', esc(spDef.ecology)));
  const lg = el('div','log-list');
  (s.log||[]).forEach(l=> lg.appendChild(el('div','log-line imp', l)));
  if(!(s.log||[]).length && !(spDef && (spDef.desc || spDef.ecology)) && !(isBeast && s.caught)) panes.lore.appendChild(el('div','muted','尚无来历。'));
  panes.lore.appendChild(lg);
  panes.aff.appendChild(el('h3',null,'属性亲和 <button type="button" class="help-q" data-tip="各系当前亲和，未训练为 50，通常上限 200。亲和越高，同系技能占用越低。进化与加冕也会要求亲和达标。">?</button>'));
  const bbox = el('div','','');
  betaElems().forEach(e=> bbox.appendChild(affBarRow(s, e)));
  panes.aff.appendChild(bbox);
  const right = panes.skill;
  if(isBeast){
    right.appendChild(el('h3',null,'出战技能 <span class="sub">按等级解锁的直接攻击</span>'));
    const moves = directUnlocked(s.elem, s.lvl||1);
    if(!moves.length) right.appendChild(el('div','muted','这一级还没有解锁直接攻击。'));
    moves.forEach(sk=>{
      const row = el('div','skill-row');
      row.innerHTML = '<span class="sk-main"><span class="sk-name">'+sk.name+' <span class="tiny">'+(ELEM[sk.elem]?ELEM[sk.elem].name:sk.elem)+'系</span></span>'+skillSheet(s, sk)+'</span>';
      right.appendChild(row);
    });
    right.appendChild(el('div','muted','妖兽出战用这些已解锁的直接攻击。能不能进副本，在副本构建里已经拦住了。'));
  } else {
  right.appendChild(el('h3',null,'装配技能 <span class="sub">总 '+masteryTotal(s)+'/'+s.masteryCap+' · 容量 '+usedCap(s)+'/'+capacityOf(s)+'</span> <button type="button" class="help-q" data-tip="熟练度总容量 '+s.masteryCap+'，已装配和待装配的都计入。满容后修炼新技能，旧技能熟练度会均匀让出。技能容量随等级提高。亲和不提高容量，只降低同系技能的占用。">?</button>'));
  const sbox = el('div','','');
  s.skills.forEach(sk=>{
    const row = el('div','skill-row');
    const pct = Math.min(100, sk.mastery/s.masteryCap*100);
    row.innerHTML = '<span class="sk-main"><span class="sk-name">'+(sk.star?'★ ':'')+sk.name+' <span class="tiny">'+(ELEM[sk.elem]?ELEM[sk.elem].name:sk.elem)+'系</span></span>'+skillSheet(s, sk)+'</span><span class="sk-mastery"><i style="width:'+pct+'%"></i></span><span class="sk-val">'+sk.mastery+'</span>';
    if(sk.mastery<100){
      const train = el('button','btn sm','提交');
      train.onclick = ()=> openSubmitDialog({
        title:'修炼「'+sk.name+'」',
        desc:'熟练度 +10。若超过总上限，其余技能均匀让出。',
        costs:[{name:'灵息结晶', need:1, have:S.aura}],
        onCancel(){ openDetail(s.id); },
        onOk(){ trainSkill(s, sk, row); }
      });
      row.appendChild(train);
    }
    const un = el('button','btn sm ghost','卸');
    un.title = '卸下「'+sk.name+'」到技能库（熟练度与使用次数保留）';
    un.onclick = ()=> unequipSkill(s, sk);
    row.appendChild(un);
    sbox.appendChild(row);
  });
  right.appendChild(sbox);
  right.appendChild(renderSkillPool(s));
  }
  right.appendChild(el('h3',null,'专长 <button type="button" class="help-q" data-tip="秘境可获得。效果见各条说明，常见为提高亲和、熟练度上限或技能容量。">?</button>'));
  const pbox = el('div','','');
  const perkList = s.perks||[];
  if(perkList.length===0) pbox.appendChild(el('div','muted','尚无专长。'));
  perkList.forEach(pid=>{
    const pk = perkDef(pid);
    pbox.appendChild(el('div','perk-row','<span class="pk-name">'+(pk&&pk.star?'★ ':'')+(pk?pk.name:pid)+'</span><span class="tiny">'+(pk?pk.desc:'')+'</span><span class="pk-cost">'+(pk&&pk.quality?pk.quality:'')+'</span>'));
  });
  right.appendChild(pbox);
  panes.evo.appendChild(renderEvolveBox(s));
  if(crownOn) panes.crown.appendChild(renderCoronation(s));
  tabDefs.forEach(t=> main.appendChild(panes[t.id]));
  ov.classList.add('open');
}
/* 进化面板（M2-B）：列出可进化分支，条件满足高亮按钮，未满足置灰并显示缺失条件；点击弹确认弹窗 */
function renderEvolveBox(s){
  const box = el('div','breakthrough-box','');
  const branches = canEvolve(s);
  box.appendChild(el('h3',null,'精灵进化'));
  if(branches.length===0){
    box.appendChild(el('div','muted','此灵兽已达最终形态，或本物种未配置进化路线。'));
    return box;
  }
  function evoNum(n){
    const x = Math.round(n*10)/10;
    return Math.abs(x-Math.round(x))<0.05 ? String(Math.round(x)) : x.toFixed(1);
  }
  function evoCondBar(c){
    if(c.type==='lvl') return {name:'等级', cur:s.lvl||1, max:c.v||0};
    if(c.type==='aff') return {name:elemName(c.elem)+'亲和', cur:affOf(s, c.elem), max:c.v||0};
    if(c.type==='stat'){
      const name = {hp:'生命',atk:'攻击',def:'防御',spa:'特攻',sdef:'特防',spe:'速度'}[c.k]||c.k;
      const stt = spiritStats(s);
      return {name, cur:(c.k==='spe'?stt.spd:stt[c.k])||0, max:c.v||0};
    }
    if(c.type==='mat'){
      const qName = ['普通','优秀','精良','史诗','传说'][c.qRank||0]||'普通';
      return {name:elemName(c.elem)+'素材 '+qName+'+', cur:matUnitSum(c.elem, c.qRank||0), max:c.v||0};
    }
    return {name:'条件', cur:0, max:1};
  }
  branches.forEach(b=>{
    const curSp = allSpeciesDef(s.speciesId);
    const row = el('div','evolve-row');
    const base = speciesBase(b.targetSp);
    row.appendChild(el('div','evolve-line',
      '<span class="evolve-from">'+curSp.name+'</span> → <span class="evolve-to">'+b.targetSp.name+'</span>'+
      ' <span class="quality-tag '+(b.targetSp.rarity==='perfect'?'good':(b.targetSp.rarity==='elite'?'fine':'poor'))+'">'+gradeName(b.targetSp)+'</span>'+
      (b.targetSp.elem!==curSp.elem ? ' '+elemTag(b.targetSp.elem) : '')));
    (b.cond||[]).forEach(c=>{
      const p = evoCondBar(c);
      const pct = p.max>0 ? Math.min(100, p.cur/p.max*100) : 100;
      row.appendChild(el('div','evo-bar'+(p.cur>=p.max?' done':''),
        '<span class="eb-name">'+p.name+'</span><span class="eb-track"><i style="width:'+pct+'%"></i></span><span class="eb-val">'+evoNum(p.cur)+'/'+evoNum(p.max)+'</span>'));
    });
    row.appendChild(el('div','tiny evolve-stats','种族值　生命 '+base.hp+' · 攻击 '+base.atk+' · 防御 '+base.def+' · 特攻 '+base.spa+' · 特防 '+base.sdef+' · 速度 '+base.spe));
    const btn = el('button','btn sm'+(b.ok?' primary':''), b.ok ? '进化 → '+b.targetSp.name : (b.shinyBlocked ? '没有异色立绘' : '条件未达成'));
    btn.disabled = !b.ok;
    if(b.shinyBlocked) btn.title = '异色只能进化成有异色立绘的形态';
    else if(!b.ok) btn.title = '尚缺：'+evoCondText(b.cond, s);
    if(b.shinyBlocked) row.appendChild(el('div','tiny','异色只能进化成有异色立绘的形态，这一支还没放出。'));
    btn.onclick = ()=> openEvolveConfirm(s, b);
    row.appendChild(btn);
    box.appendChild(row);
  });
  return box;
}
/* 进化确认弹窗：目标形态/品级/种族值对比/条件清单；确认后二次校验并结算 */
function openEvolveConfirm(s, branch){
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  const curSp = allSpeciesDef(s.speciesId);
  const curSt = spiritStats(s);
  const nextSt = spiritStats(Object.assign({}, s, {speciesId:branch.to}));
  const fmtSt = st => 'HP '+st.hp+' · 攻 '+st.atk+' · 防 '+st.def+' · 特攻 '+st.spa+' · 特防 '+st.sdef+' · 速 '+st.spd;
  mb.appendChild(el('h2',null, '进化确认'));
  mb.appendChild(el('div','m-sub', curSp.name+' <span class="badge">'+gradeName(curSp)+'</span> → '+
    '<b>'+branch.targetSp.name+'</b> <span class="badge">'+gradeName(branch.targetSp)+'</span>'+(branch.targetSp.elem!==curSp.elem ? ' '+elemTag(branch.targetSp.elem) : '')));
  const tbl = el('div','','');
  tbl.style.cssText = 'margin:10px 0;line-height:1.9';
  tbl.innerHTML = '<div class="tiny"><b>当前面板</b>：'+fmtSt(curSt)+'</div>'+
    '<div class="tiny"><b>进化后面板</b>：'+fmtSt(nextSt)+'</div>'+
    '<div class="tiny"><b>进化条件</b>：'+evoCondText(branch.cond, s)+'</div>'+
    '<div class="tiny muted">保留：等级 '+ (s.lvl||1) +' · 个体值 '+ (ivSummary(s).length? ivSummary(s).map(([k,v])=>IV_NAME[k]+'+'+v).join('/') : '无') +' · 性格 '+natureDesc(s.nature)+' · 专长 '+(s.perks.length||0)+' 项 · 亲和力随灵兽保留</div>';
  mb.appendChild(tbl);
  const ma = el('div','modal-actions','');
  const ok = el('button','btn primary','确认进化');
  ok.onclick = ()=>{
    const r = evolveSpirit(s, branch.to);
    if(!r.ok){ toast(r.msg,'bad'); return; }
    saveDraft();
    toast('进化成功：'+r.oldName+' → '+r.targetSp.name,'gold');
    closeOverlay();
    renderStable();
    openDetail(s.id);
  };
  const cancel = el('button','btn ghost','再想想'); cancel.onclick = ()=> openDetail(s.id);
  ma.appendChild(ok); ma.appendChild(cancel);
  mb.appendChild(ma);
  ov.classList.add('open');
}