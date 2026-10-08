
function renderSkills(){
  const root = $('#skills-root'); root.innerHTML='';
  const seenSk = {}; const all = Object.values(SKILLS).flat().concat(Object.values(S.skillEdits||{})).filter(function(x){ if(!x||!x.id||seenSk[x.id]) return false; seenSk[x.id]=true; return true; });
  const flt = S.skillFilter||{};
  // —— 总览 + 新增 ——
  const head = el('div','card','');
  const h3 = el('h3',null,'');
  h3.innerHTML = '技能总览 <span class="sub" style="display:block;margin-left:0;margin-top:2px;font-size:12px;">'+all.length+' 门 · 点击标签可筛选 · 编辑即时生效并持久化</span>';
  head.appendChild(h3);
  const byKind = {direct:0,ult:0,burst:0,mechanic:0};
  const byElem = {};
  all.forEach(s=>{ byKind[s.kind]=(byKind[s.kind]||0)+1; byElem[s.elem]=(byElem[s.elem]||0)+1; });
  const fltTag = function(axis, val, label){
    const on = axis==='type' ? ((flt.type||[]).includes(val)) : (flt[axis]===val);
    return '<button class="tag flt'+(on?' sel':'')+'" onclick="toggleSkillFlt(\''+axis+'\',\''+val+'\')">'+label+'</button>';
  };
  // v1.19.3：技能类型标签行（多选，与属性 AND；数量基于当前属性筛选后）
  const typeFiltered = all.filter(x=>{ if(flt.elem && (x.elem||'none')!==flt.elem) return false; return true; });
  const typeCnt = {'物理':0,'特殊':0,'防御':0,'状态':0};
  typeFiltered.forEach(x=>{ const t=skillBattleType(x); if(typeCnt[t]!=null) typeCnt[t]++; });
  const typeRow = el('div','',null); typeRow.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:6px 0';
  typeRow.innerHTML =
    fltTag('type','物理','物理 '+typeCnt['物理'])+
    fltTag('type','特殊','特殊 '+typeCnt['特殊'])+
    fltTag('type','防御','防御 '+typeCnt['防御'])+
    fltTag('type','状态','状态 '+typeCnt['状态']);
  const kindRow = el('div','',null); kindRow.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:6px 0';
  kindRow.innerHTML = fltTag('kind','direct','直接攻击 '+byKind.direct)+fltTag('kind','ult','绝技 '+byKind.ult)+fltTag('kind','burst','爆发技 '+byKind.burst)+fltTag('kind','mechanic','机制 '+byKind.mechanic);
  const chips = el('div','',null); chips.style.cssText='display:flex;flex-wrap:wrap;gap:8px;margin:6px 0';
  chips.innerHTML = Object.keys(byElem).sort().map(function(e){ return fltTag('elem', e, (e==='none'?'通用':(ELEM[e]?ELEM[e].name:e))+' '+byElem[e]); }).join('');
  head.appendChild(typeRow);
  head.appendChild(kindRow);
  head.appendChild(chips);
  const btnRow = el('div','','');
  const addBtn = el('button','btn sm primary','＋ 新增技能');
  addBtn.onclick = ()=> openSkillForm(null);
  btnRow.appendChild(addBtn);
  head.appendChild(btnRow);
  root.appendChild(head);
  // —— 技能列表（公共渲染 + 筛选）——
  const listCard = el('div','card','');
  const kinds = {direct:'直接攻击',ult:'绝技',burst:'爆发技',mechanic:'机制'};
  const fltDesc = [];
  if(flt.kind) fltDesc.push(kinds[flt.kind]||flt.kind);
  if(flt.elem) fltDesc.push(flt.elem==='none'?'通用':(ELEM[flt.elem]?ELEM[flt.elem].name+'系':flt.elem));
  if(flt.type && flt.type.length) fltDesc.push('类型:'+flt.type.join('/'));
  const cnt = filterSkills(flt).length;
  const lh = el('h3',null,'');
  lh.innerHTML = fltDesc.length ? ('筛选：'+fltDesc.join(' · ')+' <span class="sub">'+cnt+' / '+all.length+' 门</span>') : ('全部技能 <span class="sub">点击行编辑 · 点击上方标签筛选</span>');
  listCard.appendChild(lh);
  if(fltDesc.length){
    const clear = el('button','btn sm ghost','清除筛选');
    clear.onclick = clearSkillFlt;
    listCard.appendChild(clear);
  }
  const box = el('div','',''); listCard.appendChild(box);
  renderSkillPoolInto(box, flt, {directCollapsed:true});
  root.appendChild(listCard);
  // —— 属性存在分池 ——
  const poolCard = el('div','card','');
  poolCard.appendChild(el('h3',null,'素材存在分 · 属性技能池 <span class="sub">素材构建副本时，对应属性素材从下列池子抽取技能（已并入草系完整池）</span>'));
  const grid = el('div','','');
  Object.keys(GLOBAL_SKILL_POOL).forEach(function(e){
    const ids = GLOBAL_SKILL_POOL[e]||[];
    const names = ids.map(function(id){ const s=skillById(id); return s?s.name:id; }).join('、');
    const row = el('div','codex-row');
    row.innerHTML = '<div class="cr-name"><span class="elem-dot '+(ELEM[e]?(ELEM[e].dot||'dot-rare'):'dot-rare')+'"></span>'+(e==='universal'?'通用':(ELEM[e]?ELEM[e].name:e))+' <span class="sub">'+ids.length+' 门</span></div>'+
      '<div class="cr-meta">'+esc(names)+'</div>';
    grid.appendChild(row);
  });
  poolCard.appendChild(grid);
  root.appendChild(poolCard);
}