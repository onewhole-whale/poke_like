/* 修炼页 UI 实测：无记录禁修炼（解锁提示）→ 注入副本记录 → 复刻挂机全流程 */
const { execSync } = require('child_process');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function main(){
  const list = JSON.parse(execSync(`curl -s http://127.0.0.1:9334/json`).toString());
  const page = list.find(p=>p.type==='page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pending={};
  ws.onmessage = ev=>{ const m=JSON.parse(ev.data); if(m.id&&pending[m.id]){pending[m.id](m);delete pending[m.id];} };
  const send=(method,params={})=>new Promise(res=>{const i=++id;pending[i]=res;ws.send(JSON.stringify({id:i,method,params}));});
  await new Promise(r=>ws.onopen=r);
  await send('Page.enable'); await send('Runtime.enable');
  let pass=0, fail=0;
  const check=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
  const ev = async expr => { const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true}); if(r.result&&r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception.description); return r.result&&r.result.result?r.result.result.value:undefined; };

  await send('Page.navigate',{url:'http://127.0.0.1:8765/spirit-refinery/index.html?t='+Date.now()+'#/train'});
  await sleep(2000);
  await ev(`localStorage.clear(); location.reload();`); await sleep(2000);
  await ev(`S.demo=true;`);   // v1.15 demo 默认 false；测试用演示 15s 结算路径

  // 1. 无副本记录 → 修炼未解锁
  const view = await ev(`(()=>{ const r=document.querySelector('#train-root');
    return JSON.stringify({
      hasRoot: !!r,
      stamina: (document.querySelector('.ts-num')||{}).textContent||'',
      lock: !!r.querySelector('.train-lock'),
      lockTitle: (r.querySelector('.tl-title')||{}).textContent||'',
      slots: document.querySelectorAll('.train-slot').length,
      hasStart: !!r.querySelector('.train-slot .btn'),
      logHint: (r.querySelector('#train-root .card:last-child .muted')||{}).textContent||''
    }); })()`);
  const v=JSON.parse(view);
  check('修炼页有根节点', v.hasRoot);
  check('体力面板显示', /^\d+\s*\/\s*120$/.test(v.stamina), v.stamina);
  check('无记录时显示修炼未解锁卡', v.lock && /未解锁/.test(v.lockTitle), v.lockTitle);
  check('无记录时无任何开始按钮', v.hasStart===false);
  check('无记录时不渲染空槽位', v.slots===0, 'slots='+v.slots);
  check('复刻记录区有解锁指引', /副本/.test(v.logHint), v.logHint.slice(0,60));
  console.log('  页面快照:', JSON.stringify(v).slice(0,240));

  // 2. 注入一条副本记录（垫材×1 普通）→ 解锁修炼
  await ev(`(()=>{ S.trainLogs.unshift({mats:['chips'], words:{垫材:{unit:1,q:'普通'}}, value:1, exp:60,
    aff:{elem:'fire',val:0.002}, mastery:{skillId:'',name:'',val:0.8}, stamp:'测试副本记录'}); renderTrain(); return true; })()`);
  await sleep(400);
  const unlocked = await ev(`(()=>{ const r=document.querySelector('#train-root');
    return JSON.stringify({
      lock: !!r.querySelector('.train-lock'),
      slots: document.querySelectorAll('.train-slot').length,
      hasBtn: !!r.querySelector('.train-slot .btn'),
      logs: r.querySelectorAll('.train-log').length,
      btnText: (r.querySelector('.train-slot .btn')||{}).textContent||''
    }); })()`);
  const u=JSON.parse(unlocked);
  check('注入记录后解锁（无锁定卡）', u.lock===false);
  check('解锁后渲染 3 空槽', u.slots===3, 'slots='+u.slots);
  check('空槽出现「从记录复刻」按钮', u.hasBtn && /复刻/.test(u.btnText), u.btnText);
  check('复刻记录列出', u.logs===1, 'logs='+u.logs);

  // 3. 点击「从记录复刻」打开弹窗
  await ev(`document.querySelector('.train-slot .btn').click()`); await sleep(400);
  const form = await ev(`(()=>{ const mb=document.querySelector('#modal-box');
    return JSON.stringify({
      title:(mb.querySelector('h2')||{}).textContent||'',
      hasReq: !!mb.querySelector('.train-req'),
      reqText:(mb.querySelector('.tr-words')||{}).textContent||'',
      hasSpirit: !!mb.querySelector('select'),
      hasType: mb.querySelectorAll('select').length>=2,
      mats: mb.querySelectorAll('.train-mats .mg-cell').length,
      prev:(mb.querySelector('.train-prev')||{}).textContent||''
    }); })()`);
  const f=JSON.parse(form);
  check('弹窗标题为复刻记录', /复刻记录/.test(f.title), f.title);
  check('参照要求卡片显示', f.hasReq && /垫材/.test(f.reqText), f.reqText);
  check('灵兽选择下拉', f.hasSpirit);
  check('收获类型下拉', f.hasType);
  check('素材候选列出', f.mats>0, 'mats='+f.mats);

  // 4. 预填素材（参照记录 chips）已勾选；再点一个未选中素材 → 预览仍满足参照
  const prefill = await ev(`(()=>{ const cs=[...document.querySelectorAll('.train-mats .mg-cell')];
    return JSON.stringify({on: cs.filter(x=>x.classList.contains('on')).length,
      prev:(document.querySelector('.train-prev')||{}).textContent||''}); })()`);
  const pf=JSON.parse(prefill);
  check('预填素材已勾选', pf.on>=1, 'on='+pf.on);
  check('预填后预览满足参照', /满足参照/.test(pf.prev), pf.prev.slice(0,140));
  await ev(`(()=>{ const cs=[...document.querySelectorAll('.train-mats .mg-cell:not(.on)')]; if(cs[0]) cs[0].click(); })()`); await sleep(300);
  const prev = await ev(`(document.querySelector('.train-prev')||{}).textContent||''`);
  check('追加未选中素材后仍满足参照', /满足参照/.test(prev), prev.slice(0,140));

  // 5. 提交复刻挂机
  await ev(`[...document.querySelectorAll('#modal-box .btn')].find(b=>b.textContent.includes('复刻挂机')).click()`); await sleep(500);
  const after = await ev(`(()=>{ const r=document.querySelector('#train-root');
    return JSON.stringify({
      busy: document.querySelectorAll('.train-slot.busy').length,
      stamina: (document.querySelector('.ts-num')||{}).textContent||'',
      time: (document.querySelector('.ts-time')||{}).textContent||''
    }); })()`);
  const a=JSON.parse(after);
  check('挂机槽进入进行态', a.busy===1, 'busy='+a.busy);
  check('体力被扣 10', /^110\s*\/\s*120$/.test(a.stamina), a.stamina);
  check('倒计时显示', /秒后完成/.test(a.time), a.time);

  // 6. 挂机中禁野外
  await ev(`location.hash='#/wild';`); await sleep(600);
  const gate = await ev(`(()=>{ const btn=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('出发探索')); if(!btn) return 'no-btn'; btn.click(); return 'clicked'; })()`);
  await sleep(300);
  const state = await ev(`S.wild.state`);
  check('挂机中出发被拦截', state==='idle', 'state='+state);
  const toastTxt = await ev(`[...document.querySelectorAll('.toast')].map(t=>t.textContent).join('|')`);
  check('拦截提示', /挂机修炼/.test(toastTxt), toastTxt.slice(0,80));

  // 7. 等待演示结算（15s）→ 切回修炼页 → 复刻记录出现
  await sleep(16000);
  await ev(`location.hash='#/train';`); await sleep(800);
  const done = await ev(`(()=>{ const r=document.querySelector('#train-root');
    return JSON.stringify({
      busy: document.querySelectorAll('.train-slot.busy').length,
      logs: r.querySelectorAll('.train-log').length,
      firstLog:(r.querySelector('.train-log .ts-name')||{}).textContent||'',
      stamina: (document.querySelector('.ts-num')||{}).textContent||''
    }); })()`);
  const d=JSON.parse(done);
  check('挂机自动结算完成', d.busy===0, 'busy='+d.busy);
  check('复刻记录写入（含注入记录）', d.logs>=1, 'logs='+d.logs);

  // 8. 复刻按钮打开弹窗（预填素材）
  await ev(`document.querySelector('.train-log .btn').click()`); await sleep(400);
  const repl = await ev(`(()=>{ const mb=document.querySelector('#modal-box');
    return JSON.stringify({title:(mb.querySelector('h2')||{}).textContent||'', mats: mb.querySelectorAll('.train-mats .mg-cell.on').length}); })()`);
  const rp=JSON.parse(repl);
  check('复刻弹窗预填素材', /复刻记录/.test(rp.title) && rp.mats>=1, JSON.stringify(rp));

  console.log('\n'+pass+' 通过, '+fail+' 失败');
  process.exit(fail?1:0);
}
main().catch(e=>{ console.error('ERR',e); process.exit(2); });
