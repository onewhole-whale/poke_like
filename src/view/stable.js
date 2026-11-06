

/* ================= 灵兽仓视图 ================= */
function renderStable(){
  const normal = S.spirits.filter(s=>!s.shiny);
  const shinies = S.spirits.filter(s=>s.shiny);
  // 统计
  const stats = $('#stable-stats'); stats.innerHTML='';
  const statDefs = [
    {v:S.spirits.length, k:'灵兽总数'},
    {v:shinies.length, k:'异色灵兽'},
    {v:S.beasts.length, k:'妖兽（可承接）'},
    {v:sproutsTotal(), k:'元素萌芽'},
    {v:S.aura, k:'灵息结晶'},
    {v:allEssences().reduce((a,e)=>a+e.count,0), k:'精魄总数'},
    {v:Object.keys(S.toolInv||{}).reduce((a,k)=>a+(S.toolInv[k]||0),0), k:'工具'},
    {v:S.wonderQueue.length, k:'奇遇囊'},
  ];
  statDefs.forEach(d=>{
    stats.appendChild(el('div','stat-box', '<div class="sv">'+d.v+'</div><div class="sk">'+d.k+'</div>'));
  });
  // 普通灵兽
  const ns = $('#stable-spirits'); ns.innerHTML='';
  normal.forEach(s=> ns.appendChild(spiritCard(s)));
  const so = sproutsOf();
  Object.keys(so).filter(k=>so[k]>0).forEach(elem=> ns.appendChild(sproutCard(elem, so[elem])));
  if(normal.length===0 && sproutsTotal()===0) ns.appendChild(el('div','muted','仓库空空。去炼化一尊灵兽吧。'));
  // 异色
  const ss = $('#stable-shinies'); ss.innerHTML='';
  shinies.forEach(s=> ss.appendChild(spiritCard(s)));
  if(shinies.length===0) ss.appendChild(el('div','tiny','无'));
  // 妖兽：与灵兽同一套卡片
  const bs = $('#stable-beasts'); bs.innerHTML='';
  if(S.beasts.length===0){
    bs.appendChild(el('div','tiny','无'));
  }else{
    S.beasts.forEach(b=>{
      const sp = allSpeciesDef(b.speciesId);
      const card = el('div','s-card'+(b.shiny?' shiny-card':''));
      card.innerHTML = '<div class="sc-head"><div class="sc-name">'+elemTag(sp.elem)+sp.name+
        '<span class="sc-lv">Lv.'+(b.lvl||1)+'</span>'+
        (b.shiny?'<span class="tag shiny">异色</span>':'')+'</div></div>';
      const face = el('div','sc-face','');
      fillPortrait(face, b.speciesId, sp.elem, '🐾', 'card', !!b.shiny);
      card.appendChild(face);
      card.onclick = ()=> openDetail(b.id);
      bs.appendChild(card);
    });
  }
}
function spiritCard(s){
  const sp = allSpeciesDef(s.speciesId);
  const card = el('div','s-card'+(s.shiny?' shiny-card':''));
  card.innerHTML = '<div class="sc-head"><div class="sc-name">'+elemTag(sp.elem)+s.name+
    '<span class="sc-lv">Lv.'+(s.lvl||1)+'</span>'+
    (sp.rarity!=='normal'?'<span class="badge">'+gradeName(sp)+'</span>':'')+
    (s.coronation&&s.coronation.stage==='done'?'<span class="badge">已加冕</span>':'')+
    (s.shiny?'<span class="tag shiny">异色</span>':'')+
    '</div></div>';
  const face = el('div','sc-face','');
  fillPortrait(face, s.speciesId, sp.elem, '🐾', 'card', !!s.shiny);
  card.appendChild(face);
  card.onclick = ()=> openDetail(s.id);
  return card;
}
function sproutCard(elem, n){
  const name = (elem==='any'?'无主':elemName(elem))+'元素萌芽';
  const card = el('div','s-card');
  card.innerHTML = '<div class="sc-head"><div class="sc-name">'+name+
    '<span class="sc-lv">Lv.1</span></div><span class="tag">×'+n+'</span></div>';
  card.onclick = ()=> openSproutDetail(elem);
  return card;
}
function openSproutDetail(elem){
  const n = sproutsOf()[elem]||0;
  if(n<=0){ closeOverlay(); renderStable(); return; }
  const name = (elem==='any'?'无主':elemName(elem))+'元素萌芽';
  const s = {
    speciesId:'SPROUT_'+elem, name:name, nature:'serious', lvl:1, iv:{}, perks:[], aff:{},
    skills:[], masteryCap:100
  };
  if(elem!=='any' && SKILLS[elem] && SKILLS[elem][0]){
    const sk = SKILLS[elem][0];
    s.skills = [{id:sk.id, name:sk.name, kind:sk.kind, cost:sk.cost, elem:sk.elem, mastery:0}];
  }
  const st = spiritStats(s);
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  mb.appendChild(el('h2',null, name+' <span class="tag src">灵兽</span>'));
  mb.appendChild(el('div','m-sub', '持有 ×'+n));
  mb.appendChild(el('div','muted','性格：<b>'+natureDesc(s.nature)+'</b>'));
  mb.appendChild(el('div','muted','个体值：无'));
  mb.appendChild(el('div','muted','Lv.1 / '+lvlCapOf(s)+' · 生命 '+st.hp+' · 攻击 '+st.atk+' · 防御 '+st.def+' · 特攻 '+st.spa+' · 特防 '+st.sdef+' · 速度 '+st.spd));
  const grid = el('div','detail-grid');
  const left = el('div','');
  left.appendChild(el('h3',null,'属性亲和 <button type="button" class="help-q" data-tip="各系当前亲和，未训练为 50，通常上限 200。亲和越高，同系技能占用越低。进化与加冕也会要求亲和达标。">?</button>'));
  const bbox = el('div','','');
  if(elem!=='any') betaElems().forEach(e=> bbox.appendChild(affBarRow(s, e)));
  left.appendChild(bbox);
  const right = el('div','');
  right.appendChild(el('h3',null,'装配技能'));
  if(s.skills.length===0) right.appendChild(el('div','muted','无'));
  s.skills.forEach(sk=>{
    const row = el('div','skill-row');
    const pct = Math.min(100, sk.mastery/s.masteryCap*100);
    row.innerHTML = '<span class="sk-name">'+sk.name+' <span class="tiny">'+(ELEM[sk.elem]?ELEM[sk.elem].name:sk.elem)+'系</span></span><span class="sk-mastery"><i style="width:'+pct+'%"></i></span><span class="sk-val">'+sk.mastery+'</span>';
    right.appendChild(row);
  });
  grid.appendChild(left); grid.appendChild(right);
  mb.appendChild(grid);
  const act = el('div','modal-actions');
  const burn = el('button','btn sm','化为灵息 ×3');
  burn.onclick = ()=>{
    sproutsTake(elem,1); S.aura+=3; toast('元素萌芽化作灵息 ×3');
    renderStable();
    if((sproutsOf()[elem]||0)<=0) closeOverlay();
    else openSproutDetail(elem);
  };
  const close = el('button','btn ghost','收起');
  close.onclick = closeOverlay;
  act.appendChild(burn); act.appendChild(close);
  mb.appendChild(act);
  ov.classList.add('open');
}