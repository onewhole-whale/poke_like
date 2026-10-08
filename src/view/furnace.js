
/* 素材投入详情弹窗：查看描述/词条/来源，控制投入数量（支持同素材多份） */
function openFurnaceDetail(id){
  const m = matInfo(id); if(!m) return;
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  const q = QUALITY[m.quality]||QUALITY.normal;
  mb.appendChild(el('h2',null, m.name));
  const sub = [q.name, (m.elem&&m.elem!=='none'?elemName(m.elem):'无属性'), (MAT_TYPE[m.type]?MAT_TYPE[m.type].name+'素材':''), (m.from?('掉落自『'+allSpeciesDef(m.from).name+'』'):'')].filter(Boolean).join(' · ');
  mb.appendChild(el('div','m-sub', sub+' · 持有 <b>'+matState[id]+'</b>'));
  if(m.tags&&m.tags.length) mb.appendChild(el('div','tiny','词条：'+m.tags.map(t=>'【'+t+'】').join('')));
  if(m.desc) mb.appendChild(el('div','furnace-desc', m.desc));
  const cur = S.furnace.filter(x=>x===id).length;
  const qty = el('div','furnace-qty','');
  qty.innerHTML = '炉中已投 <b class="fq">'+cur+'</b> 单位 / 库存 '+matState[id]+' 单位';
  const refreshQty = ()=>{
    const c = S.furnace.filter(x=>x===id).length;
    qty.innerHTML = '炉中已投 <b class="fq">'+c+'</b> 单位 / 库存 '+matState[id]+' 单位';
    const minus = ctl.querySelector('.fq-minus'), plus = ctl.querySelector('.fq-plus'), clr = ctl.querySelector('.fq-clear');
    minus.disabled = c<=0;
    plus.disabled = c>=matState[id];
    clr.disabled = c<=0;
  };
  const ctl = el('div','furnace-ctl','');
  const minus = el('button','btn sm fq-minus','取出 1'); minus.disabled = cur<=0;
  minus.onclick = ()=>{ removeFromFurnace(id); refreshQty(); };
  const plus = el('button','btn sm fq-plus','投入 1'); plus.disabled = cur>=matState[id];
  plus.onclick = ()=>{ addToFurnace(id); refreshQty(); };
  ctl.appendChild(minus); ctl.appendChild(plus);
  const clr = el('button','btn sm danger fq-clear','全部取出'); clr.disabled = cur<=0;
  clr.onclick = ()=>{ removeAllFromFurnace(id); refreshQty(); };
  ctl.appendChild(clr);
  mb.appendChild(qty); mb.appendChild(ctl);
  const ma = el('div','modal-actions','');
  const done = el('button','btn primary','完成');
  done.onclick = ()=>{ closeOverlay(); renderRefine(); };
  ma.appendChild(done);
  mb.appendChild(ma);
  ov.classList.add('open');
}
/* 妖兽投入详情弹窗：看属性再决定投炉 */
function openBeastDetail(id){
  const b = S.beasts.find(x=>'beast:'+x.id===id);
  if(!b) return;
  const sp = allSpeciesDef(b.speciesId);
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  mb.appendChild(el('h2',null, (b.shiny?'<span class="tag shiny">异色</span> ':'')+sp.name));
  const biv = ivSummary(b).map(([k,v])=>IV_NAME[k]+'+'+v).join(' ');
  const sub = '品级 '+gradeName(sp)+' · '+elemTag(sp.elem)+' · Lv.'+(b.lvl||1)+' · 性格 '+natureDesc(b.nature)+(biv?' · 个体值 '+biv:'');
  mb.appendChild(el('div','m-sub', sub));
  mb.appendChild(el('div','tiny','捕获于 '+b.caught+(b.shiny?' · 异色妖兽承接飞升 → 必得异色灵兽':'')));
  mb.appendChild(el('div','furnace-desc', '投入炼化：展开为杀死它的全部掉落物（'+beastDropsNames(b.speciesId)+'），并伴生 1 单位精良生命精华。投入后妖兽本体出库。'));
  const ma = el('div','modal-actions','');
  const cancel = el('button','btn','取消');
  cancel.onclick = closeOverlay;
  ma.appendChild(cancel);
  const go = el('button','btn primary','投入炼化');
  go.onclick = ()=>{
    addBeastToFurnace(b.id);
    closeOverlay(); renderRefine();
    toast('已将「'+sp.name+'」投入炼化');
  };
  ma.appendChild(go);
  mb.appendChild(ma);
  ov.classList.add('open');
}