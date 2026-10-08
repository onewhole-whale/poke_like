
function renderCodex(){
  const mbox = $('#codex-mats'); mbox.innerHTML='';
  const sbox = $('#codex-species'); sbox.innerHTML='';
  // —— 素材库：按来源分组，组内按品质排序 ——
  ['ore','plant','beast'].forEach(tp=>{
    const ids = tp==='beast' ? beastMatIds() : Object.keys(MATS).filter(id=> MATS[id].type===tp);
    if(ids.length===0) return;
    const group = el('div','codex-group');
    group.appendChild(el('h4',null, MAT_TYPE[tp].name+'素材'+(tp==='beast'?' <span class="sub">精灵专属掉落物 · 可编辑</span>':'')));
    const grid = el('div','mat-grid');
    ids.map(id=>allMatDef(id)).filter(Boolean)
      .sort((a,b)=> (QUALITY_RANK[a.quality]||0)-(QUALITY_RANK[b.quality]||0))
      .forEach(m=>{
        const cell = matGridItem(m, null, ()=>openMatForm(m.id, false));
        setTip(cell, ((cell.getAttribute&&cell.getAttribute('data-tip'))||cell.title||'')+
          (m.from&&allSpeciesDef(m.from)?'<div class="t-row"><span class="t-k">来源</span>掉落自『'+allSpeciesDef(m.from).name+'』</div>':'')+
          (S.customMats[m.id]?'<div class="t-row"><span class="t-k">备注</span>自定义素材</div>':''));
        grid.appendChild(cell);
      });
    group.appendChild(grid);
    mbox.appendChild(group);
  });
  // 专属精魄（单列，按精灵）
  const exGroup = el('div','codex-group');
  exGroup.appendChild(el('h4',null,'专属精魄 <span class="sub">重复灵兽所得 · 仅用于对应精灵的副本调整</span>'));
  allEssences().forEach(e=>{
    const from = allSpeciesDef(e.from);
    const ex = el('div','codex-row');
    ex.innerHTML = '<div class="cr-name"><span class="elem-dot '+(ELEM[e.elem]?ELEM[e.elem].dot:'dot-rare')+'"></span>'+e.name+'<span class="quality-tag fine">专属</span></div>'+
      '<div class="cr-meta">持有 '+e.count+' · 重复炼化「'+(from?from.name:'')+'」所得，投入副本只增强'+(from?from.name:'')+'</div>';
    exGroup.appendChild(ex);
  });
  mbox.appendChild(exGroup);
  // —— 精灵物种 ——
  allSpecies().forEach(sp=>{
    const hasDrops = (sp.drops||[]).length>0;
    const hasRule = refineRules().some(r=>r.pool==='spirit' && (r.cond&&r.cond.spirits||[]).includes(sp.id));
    const myBranches = evoBranchesOf(sp);                          // 本物种进化目标（网状兼容）
    const hasEvoTo = myBranches.length>0;
    const hasEvoFrom = allSpecies().some(x=> evoBranchesOf(x).some(b=>b.to===sp.id));  // 由进化而来
    const evoTxt = myBranches.map(b=>{
      const tgt = allSpeciesDef(b.to);
      return (tgt?tgt.name:b.to);
    }).join('、');
    const suiteMark = (hasDrops?'<span class="quality-tag fine">掉落✓</span>':'<span class="quality-tag poor">缺掉落</span>')
      + (hasRule?'<span class="quality-tag fine">配方✓</span>':'')
      + (hasEvoTo?'<span class="quality-tag fine">进化→'+esc(evoTxt)+'</span>':(hasRule?'':'<span class="quality-tag poor">'+(hasEvoFrom?'进化源':'缺配方')+'</span>'));
    const row = el('div','codex-row');
    row.innerHTML = '<div class="cr-name">'+sp.name+'<span class="tag '+ELEM[sp.elem].tag+'">'+ELEM[sp.elem].name+'</span>'+
      '<span class="quality-tag '+(sp.rarity==='legend'?'good':(sp.rarity==='perfect'?'good':(sp.rarity==='elite'?'fine':'poor')))+'">'+gradeName(sp)+'</span>'+
      (sp.tags&&sp.tags.length?'<span class="mat-tags">'+sp.tags.map(t=>'【'+t+'】').join('')+'</span>':'')+
      (S.customSpecies[sp.id]?' <span class="tag src">自定义</span>':'')+'</div>'+
      '<div class="cr-meta">'+suiteMark+' · 速度 '+sp.speed+' · 掉落物 '+(sp.drops||[]).length+' 种 · '+sp.desc+'</div>';
    const tipExtra = myBranches.map(b=>{
      const tgt = allSpeciesDef(b.to);
      return '<div class="t-row"><span class="t-k">进化→</span>'+(tgt?('<b>'+esc(tgt.name)+'</b> '+gradeName(tgt)):b.to)+'</div>';
    }).join('');
    setTip(row,
      '<div class="t-name">'+esc(sp.name)+'</div>'+
      '<div class="t-row"><span class="t-k">元素</span>'+ELEM[sp.elem].name+'</div>'+
      '<div class="t-row"><span class="t-k">稀有度</span>'+gradeName(sp)+'</div>'+
      '<div class="t-row"><span class="t-k">速度</span>'+sp.speed+'</div>'+
      tipExtra+
      (sp.tags&&sp.tags.length?'<div class="t-row"><span class="t-k">标签</span>'+esc(sp.tags.join('、'))+'</div>':'')+
      (sp.desc?'<div class="t-row">'+esc(sp.desc)+'</div>':''));
    row.onclick = ()=> openSpeciesForm(sp.id);
    sbox.appendChild(row);
  });
  if(allSpecies().length===0) sbox.appendChild(el('div','muted','暂无精灵物种。点击「新增精灵」创建。'));
  // —— 炼化映射表 ——
  const rbox = $('#codex-rules'); rbox.innerHTML='';
  refineRules().forEach(r=>{
    const row = el('div','codex-row');
    row.innerHTML = '<div class="cr-name">'+r.name+
      (r.pool==='spirit'?'<span class="quality-tag good">灵兽</span>':'<span class="quality-tag '+(r.pool==='sprout'?'fine':'poor')+'">'+({micro:'微粒',chr:'结晶',gel:'凝胶',ling:'凝材',sprout:'萌芽'})[r.pool]||r.pool+'</span>')+
      (r.chance<1?'<span class="quality-tag fine">'+(r.chance*100).toFixed(r.chance<.1?0:0)+'%</span>':'')+
      (S.refineRules&&S.refineRules.some(x=>x.id===r.id)?' <span class="tag src">已改</span>':'')+'</div>'+
      '<div class="cr-meta">'+ruleCondDesc(r)+' → '+ruleOutDesc(r)+'</div>';
    row.onclick = ()=> openRuleForm(r.id, false);
    rbox.appendChild(row);
  });
  $('#btn-add-mat').onclick = ()=> openMatForm(null, false);
  $('#btn-add-sp').onclick = ()=> openSpeciesForm(null);
  $('#btn-add-rule').onclick = ()=> openRuleForm(null, false);
  // —— 技能池（M3-P0）—— 独立「技能」视图见 renderSkills
  renderSkillPoolInto($('#codex-skills'));
  $('#btn-add-skill').onclick = ()=> openSkillForm(null);
  // —— 管理员道具（调试发放，不进入玩家获取链）——
  const abox = $('#codex-admin'); abox.innerHTML='';
  const adminRow = el('div','codex-row');
  const ivl = el('button','btn sm','＋ 洗髓露 ×1');
  ivl.title = '重选灵兽个体值（详情页「洗髓」消耗）——管理员测试用';
  ivl.onclick = ()=>{ S.ivElixir = (S.ivElixir||0)+1; toast('洗髓露 +1（当前 '+S.ivElixir+'）'); renderCodex(); };
  adminRow.innerHTML = '<div class="cr-name">洗髓露 <span class="quality-tag good">管理员</span><span class="mat-tags">详情页洗髓 · 重选个体值</span></div>'+
    '<div class="cr-meta">当前持有 '+((S.ivElixir||0))+'</div>';
  adminRow.appendChild(ivl);
  abox.appendChild(adminRow);
}