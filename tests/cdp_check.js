/* headless 交互验证：折叠 / 未持有开关（连接已启动的 CDP 9334） */
const { execSync } = require('child_process');
const port = 9334;
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function main(){
  const list = JSON.parse(execSync(`curl -s http://127.0.0.1:${port}/json`).toString());
  const page = list.find(p=>p.type==='page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = {};
  ws.onmessage = ev => {
    const m = JSON.parse(ev.data);
    if(m.id && pending[m.id]){ pending[m.id](m); delete pending[m.id]; }
  };
  const send = (method, params={}) => new Promise(res=>{ const i=++id; pending[i]=res; ws.send(JSON.stringify({id:i, method, params})); });
  await new Promise(r=>ws.onopen=r);
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', {url:'http://127.0.0.1:8765/spirit-refinery/index.html?x='+Date.now()+'#/refine'});
  await sleep(1500);
  const evalJs = async (expr) => {
    const r = await send('Runtime.evaluate', {expression: expr, returnByValue: true});
    return r.result && r.result.result ? r.result.result.value : undefined;
  };
  let pass=0, fail=0;
  const check = (name, cond, extra='') => { if(cond){pass++;console.log('  ok - '+name);}else{fail++;console.log('FAIL - '+name+'  '+extra);} };

  let dom = await evalJs(`document.querySelector('#shelf').innerText`);
  check('初始未持有隐藏（有灵铁矿无玄铁精）', dom.includes('灵铁矿') && !dom.includes('玄铁精'));

  await evalJs(`[...document.querySelectorAll('.shelf-head h4')][0].click()`);
  await sleep(150);
  dom = await evalJs(`document.querySelector('#shelf').innerText`);
  check('点标题折叠矿石组', !dom.includes('灵铁矿'));

  await evalJs(`[...document.querySelectorAll('.shelf-head h4')][0].click()`);
  await sleep(150);
  dom = await evalJs(`document.querySelector('#shelf').innerText`);
  check('再点标题展开矿石组', dom.includes('灵铁矿'));

  await evalJs(`document.querySelectorAll('.shelf-zero')[0].click()`);
  await sleep(150);
  dom = await evalJs(`document.querySelector('#shelf').innerText`);
  check('勾选后显示未持有（玄铁精出现）', dom.includes('玄铁精'));
  const sep = await evalJs(`[...document.querySelectorAll('.shelf-zero-sep')].some(s=>s.innerText==='未持有')`);
  check('未持有分隔条存在', sep);

  await evalJs(`[...document.querySelectorAll('.shelf-head h4')][3].click()`);
  await sleep(150);
  dom = await evalJs(`document.querySelector('#shelf').innerText`);
  check('精魄组折叠（烬烬狼精魄隐藏）', !dom.includes('烬烬狼精魄'));

  await evalJs(`[...document.querySelectorAll('.shelf-head h4')][3].click()`);   // 先展开精魄组
  await sleep(150);
  await evalJs(`document.querySelectorAll('.shelf-zero')[3].click()`);
  await sleep(150);
  dom = await evalJs(`document.querySelector('#shelf').innerText`);
  check('精魄组显示未持有（咕嘟龟精魄出现）', dom.includes('咕嘟龟精魄') && dom.includes('烬烬狼精魄'));

  console.log(`\nCDP 交互验证 PASS ${pass} / ${pass+fail}`);
  process.exit(fail?1:0);
}
main().catch(e=>{ console.error('ERR', e.message); process.exit(1); });
