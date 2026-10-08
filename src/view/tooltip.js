
/* 写入悬浮提示：真实浏览器用 data-tip，测试 stub 回退 title */
function setTip(el, html){
  if(!el) return;
  if(el.setAttribute){ el.setAttribute('data-tip', html); }
  else { el.title = html; }
}