

/* 素材方格：首字 + 品质底色。n 为数字时画数量角标；介绍/控制页传 null，不画数量。 */
function matGridItem(m, n, onClick){
  const q = QUALITY[m.quality]||QUALITY.normal;
  const cell = el('div','mg-cell');
  cell.style.background = 'linear-gradient(160deg, '+q.color+'2e 0%, '+q.color+'52 100%)';
  cell.style.borderColor = q.color;
  const badge = n==null ? '' : (n>0?'<div class="mg-n">×'+n+'</div>':'<div class="mg-n zero">×0</div>');
  cell.innerHTML = '<div class="mg-char">'+esc(m.name[0])+'</div><div class="mg-name">'+esc(m.name)+'</div>'+
    '<div class="mg-q">'+q.name+'</div>'+badge;
  if(onClick) cell.onclick = onClick;
  var vw = (m.tags||[]).find(function(t){ return VIRTUAL_WORDS[t]; });
  setTip(cell,
    '<div class="t-name">'+esc(m.name)+' · '+q.name+'</div>'+
    (m.elem&&m.elem!=='none'?'<div class="t-row"><span class="t-k">元素</span>'+elemName(m.elem)+'</div>':'')+
    (m.type?'<div class="t-row"><span class="t-k">来源</span>'+(m.type==='item'?'道具':(MAT_TYPE[m.type]?MAT_TYPE[m.type].name+'素材':m.type))+'</div>':'')+
    (m.tags&&m.tags.length?'<div class="t-row"><span class="t-k">词条</span>'+esc(m.tags.join('、'))+'</div>':'')+
    (vw?'<div class="t-row"><span class="t-k">虚量</span>'+vw+'（按 '+VIRTUAL_WORDS[vw]+' 单位折算）</div>':'')+
    (m.desc?'<div class="t-row">'+esc(m.desc)+'</div>':''));
  return cell;
}
function matGrid(box, mats, opts){
  opts = opts||{};
  box.innerHTML='';
  const ids = typeof mats==='object' && !Array.isArray(mats) ? Object.keys(mats).filter(id=>matState[id]>0||opts.zero) : mats;
  const list = ids.map(id=>({id, m:isItem(id)?itemInfo(id):matInfo(id), n:typeof mats==='object' && !Array.isArray(mats) ? (mats[id]||0) : (matState[id]||0)})).filter(x=>x.m);
  list.sort((a,b)=>(QUALITY_RANK[a.m.quality]||0)-(QUALITY_RANK[b.m.quality]||0) || a.m.name.localeCompare(b.m.name,'zh'));
  if(list.length===0 && opts.empty) box.appendChild(el('div','muted',opts.empty));
  list.forEach(x=>{
    const cell = matGridItem(x.m, x.n, opts.onPick ? ()=>opts.onPick(x.id) : null);
    if(opts.onRemove && x.n>0){
      const rm = el('div','mg-rm','×'); rm.onclick = (ev)=>{ ev.stopPropagation(); opts.onRemove(x.id); };
      cell.appendChild(rm);
    }
    box.appendChild(cell);
  });
  return box;
}
/* 统一悬浮提示：data-tip 委托（桌面增强，触屏不显示） */
(function(){
  var tipEl=null;
  function ensure(){ if(!tipEl){ tipEl=document.createElement('div'); tipEl.className='tip-f'; document.body.appendChild(tipEl);} return tipEl; }
  function hide(){ var t=ensure(); t.classList.remove('show'); }
  document.addEventListener('mouseover', function(ev){
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if(!el) return;
    var t=ensure(); t.innerHTML = el.getAttribute('data-tip')||''; t.classList.add('show');
    position(el,ev);
  });
  document.addEventListener('mousemove', function(ev){
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if(el) position(el,ev);
  });
  document.addEventListener('mouseout', function(ev){
    var el = ev.target && ev.target.closest ? ev.target.closest('[data-tip]') : null;
    if(el && !(ev.relatedTarget && el.contains(ev.relatedTarget))) hide();
  });
  function position(el,ev){
    var t=ensure(), pad=10, x=ev.clientX+14, y=ev.clientY+14, r=t.getBoundingClientRect();
    if(x+r.width>window.innerWidth-pad) x=ev.clientX-r.width-14;
    if(y+r.height>window.innerHeight-pad) y=ev.clientY-r.height-14;
    t.style.left=Math.max(pad,x)+'px'; t.style.top=Math.max(pad,y)+'px';
  }
})();