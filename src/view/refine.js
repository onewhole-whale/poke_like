
function shelfHead(title, ui, rerender, showZero, desc){
  const head = el('div','shelf-head');
  const h = el('h4',null, title);
  h.onclick = ()=>{ ui.fold = !ui.fold; rerender(); };
  head.appendChild(h);
  const ctl = el('div','shelf-ctl');
  if(desc){
    const qd = el('span','shelf-qd','?');
    qd.style.cssText='display:inline-block;width:14px;height:14px;border-radius:50%;background:#4a6fa5;color:#fff;font-size:10px;text-align:center;line-height:14px;cursor:help;margin-left:4px';
    qd.title = desc;
    ctl.appendChild(qd);
  }
  if(showZero!==false){
    const q = el('span','shelf-q','?');
    q.style.cssText='display:inline-block;width:14px;height:14px;border-radius:50%;background:#555;color:#fff;font-size:10px;text-align:center;line-height:14px;cursor:help;margin-left:4px';
    q.title = '未持有（×0）的素材排在本组底部（点击切换显示）';
    if(ui.zero) q.style.background='#4a6fa5';
    q.onclick = ()=>{ ui.zero = !ui.zero; rerender(); };
    ctl.appendChild(q);
  }
  const fold = el('span','shelf-fold', ui.fold?'▸':'▾');
  fold.title = ui.fold?'展开本组':'收起本组';
  fold.onclick = ()=>{ ui.fold = !ui.fold; rerender(); };
  ctl.appendChild(fold);
  head.appendChild(ctl);
  return head;
}
function renderShelf(){
  const shelf = $('#shelf'); shelf.innerHTML='';
  ['ore','plant','beast'].forEach(tp=>{
    const ids = tp==='beast' ? beastMatIds() : Object.keys(MATS).filter(id=> MATS[id].type===tp);
    const defs = ids.map(id=>allMatDef(id)).filter(Boolean)
      .sort((a,b)=> (QUALITY_RANK[a.quality]||0)-(QUALITY_RANK[b.quality]||0));
    if(defs.length===0) return;
    const ui = shelfUI[tp];
    const has = defs.filter(m=>(matState[m.id]||0)>0);
    const zero = defs.filter(m=>(matState[m.id]||0)<=0);
    const wrap = el('div','shelf-group'+(ui.fold?' collapsed':''));
    wrap.appendChild(shelfHead(MAT_TYPE[tp].name+'素材', ui, renderShelf, true, tp==='beast'?'多为精灵专属掉落物':null));
    const body = el('div','shelf-body');
    const grid = el('div','mat-grid');
    has.forEach(m=> grid.appendChild(matGridItem(m, matState[m.id]||0, ()=>openFurnaceDetail(m.id))));
    if(ui.zero && zero.length){
      const sep = el('div','shelf-zero-sep','未持有');
      grid.appendChild(sep);                       // 分隔线插在持有方格与未持有方格之间
      zero.forEach(m=> grid.appendChild(matGridItem(m, 0, ()=>openFurnaceDetail(m.id))));
    }
    body.appendChild(grid);
    wrap.appendChild(body);
    shelf.appendChild(wrap);
  });
  // 专属精魄：精魄按精灵单列，不参与炼化
  const ui = shelfUI.essence;
  const wrap = el('div','shelf-group'+(ui.fold?' collapsed':''));
  wrap.appendChild(shelfHead('专属精魄', ui, renderShelf, true, '重复同种灵兽所得 · 仅用于对应精灵的副本调整'));
  const body = el('div','shelf-body');
  const ess = allEssences().map(e=>{
    const item = el('div','mat-item');
    item.innerHTML = '<span><span class="elem-dot '+(ELEM[e.elem]?ELEM[e.elem].dot:'dot-rare')+'"></span><span class="mname">'+e.name+'</span></span><span class="mcount">×<b>'+e.count+'</b></span>';
    item.title = '重复炼化「'+allSpeciesDef(e.from).name+'」所得，投入副本时只增强'+allSpeciesDef(e.from).name;
    if(e.count<=0) item.style.opacity='.3';
    return {e, item};
  });
  ess.filter(x=>x.e.count>0).forEach(x=> body.appendChild(x.item));
  if(ui.zero){
    body.appendChild(el('div','shelf-zero-sep','未持有'));
    ess.filter(x=>x.e.count<=0).forEach(x=> body.appendChild(x.item));
  }
  const sprItem = el('div','mat-item');
  sprItem.innerHTML = '<span><span class="elem-dot dot-rare"></span><span class="mname">元素萌芽</span><span class="mat-tags">'+Object.entries(sproutsOf()).map(([e,n])=>'【'+(e==='any'?'无主':elemName(e))+'×'+n+'】').join('')+'</span></span><span class="mcount">×<b>'+sproutsTotal()+'</b></span>';
  sprItem.title = '炼化副产品：按属性区分，用于对应系灵兽的灵根突破（+1 等级上限，最多 +10）';
  if(sproutsTotal()<=0) sprItem.style.opacity='.3';
  if(sproutsTotal()>0) body.appendChild(sprItem);
  else if(ui.zero) body.appendChild(sprItem);
  wrap.appendChild(body);
  shelf.appendChild(wrap);
  // 妖兽投炉：妖兽本体可直接投入炼化（视为杀死掉落 + 1 精良生命精华）
  const uiB = shelfUI.beastFurnace;
  const wrapB = el('div','shelf-group'+(uiB.fold?' collapsed':''));
  wrapB.appendChild(shelfHead('妖兽（投入炼化）', uiB, renderShelf, false, '视为投入杀死之全部掉落 + 精良生命精华 ×1'));
  const bodyB = el('div','shelf-body');
  if(S.beasts.length===0){
    bodyB.appendChild(el('div','muted','仓库中没有妖兽。野外冒险可捕获妖兽。'));
  }else{
    S.beasts.forEach(b=>{
      const spd = allSpeciesDef(b.speciesId);
      const row = el('div','mat-item pickable');
      row.innerHTML = '<span><span class="elem-dot '+(ELEM[spd.elem]?ELEM[spd.elem].dot:'dot-rare')+'"></span><span class="mname">'+(b.shiny?'<span class="tag shiny">异色</span> ':'')+spd.name+'</span><span class="muted">Lv.'+(b.lvl||1)+' · 捕获于 '+b.caught+'</span></span>';
      row.onclick = ()=> openBeastDetail('beast:'+b.id);
      row.title = '投入炼化：展开为杀死它的全部掉落物，并伴生 1 单位精良生命精华';
      bodyB.appendChild(row);
    });
  }
  wrapB.appendChild(bodyB);
  shelf.appendChild(wrapB);
}
function renderRefine(){
  renderShelf();
  // 炉膛
  const furnace = $('#furnace'); furnace.innerHTML='';
  if(S.furnace.length===0){
    furnace.appendChild(el('span','furnace-hint','炉膛空空，投入素材开始炼化'));
  }else{
    const cnt = {};
    S.furnace.forEach(id=>{ cnt[id]=(cnt[id]||0)+1; });
    Object.keys(cnt).forEach(id=>{
      const n = cnt[id];
      let chip;
      if(id.startsWith('beast:')){
        chip = el('span','chip', '<span class="elem-dot dot-rare" style="margin-right:2px"></span>妖兽「'+beastNameById(id)+'」');
        const x = el('button','chip-ctr','×');
        x.title='取出'; x.onclick = ()=>{ removeFromFurnace(id); };
        chip.appendChild(x);
        chip.onclick = ()=> openBeastDetail(id);
      } else {
        const m = (ITEMS[id] && ITEMS[id].type==='blueprint') ? ITEMS[id] : matInfo(id);
        chip = matGridItem(m, n, ()=>openFurnaceDetail(id));
        chip.classList.add('mg-in-furnace');
        const plus = el('button','chip-ctr mg-fbtn plus','+');
        plus.title='再投 1 单位';
        plus.onclick = (ev)=>{ ev.stopPropagation(); addToFurnace(id); };
        const minus = el('button','chip-ctr mg-fbtn minus','−');
        minus.title='取出 1 单位';
        minus.onclick = (ev)=>{ ev.stopPropagation(); removeFromFurnace(id); };
        chip.appendChild(plus); chip.appendChild(minus);
      }
      furnace.appendChild(chip);
    });
  }
  $('#btn-refine').disabled = S.furnace.length===0;
  // 预览
  renderPreview();
  // 手札
  const log = $('#refine-log'); log.innerHTML='';
  if(S.logs.length===0) log.appendChild(el('div','muted','尚无记录'));
  S.logs.forEach(l=>{
    log.appendChild(el('div','log-item '+l.cls, '<span class="lt">'+l.t+'</span>'+l.text));
  });
}