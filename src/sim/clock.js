
function stampNow(){
  const n = new Date();
  return n.getHours().toString().padStart(2,'0')+':'+n.getMinutes().toString().padStart(2,'0');
}