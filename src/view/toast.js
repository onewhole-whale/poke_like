
function toast(msg, cls){
  const t = el('div','toast'+(cls?' '+cls:''), msg);
  $('#toast-wrap').appendChild(t);
  setTimeout(()=>{ t.style.opacity='0'; t.style.transition='opacity .4s'; setTimeout(()=>t.remove(),420); }, 2600);
}