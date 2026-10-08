
/* 存在分预览：每属性 1000 分容量（拓池 750），展示技能/专长条目与总分 */
function renderPool(sp){
  const plan = scorePlan(S.buildMats);
  const view = $('#pool-view'); view.innerHTML='';
  let any = false;
  Object.keys(plan).forEach(e=>{
    const p = plan[e];
    const entries = elemEntries(p);
    if(entries.length===0) return;
    any = true;
    const row = el('div','pool-row');
    const items = entries.map(x=>{
      const nm = x.kind==='skill' ? skillById(x.id) : perkById(x.id);
      return '<span class="pool-item '+(x.expand?'special':'base')+'">'+(nm?nm.name:x.id)+(x.expand?' · 拓池':'')+'</span>';
    }).join('');
    const marks = [];
    if(p.repeat) marks.push('重复抽取');
    if(p.boost) marks.push('概率×2');
    if(marks.length) marks.push('');
    row.innerHTML = '<div class="pr-head"><span class="pr-title">'+elemTag(e)+' 收获池</span>'+
      (marks.length?('<span class="pr-round">'+marks.join(' · ')+'</span>'):'')+
      '<span class="pr-round">'+(p.scaled?'压缩至':'共')+' '+p.total+'/'+p.cap+' 分</span></div>'+
      '<div class="pr-items">'+items+'</div>';
    view.appendChild(row);
  });
  if(!any) view.appendChild(el('div','muted','尚无收获池。存在分满 1000 后，才会抽出技能与专长。'));
}