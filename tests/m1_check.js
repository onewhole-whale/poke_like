// M1 UI 实测：炼灵兽 → 技能库装配 → 战斗（直接攻击显示/分段/妖兽出招/能量）→ 截图
// 依赖：http://127.0.0.1:8765 服务 + 9334 chromium headless（Node>=22 内置 WebSocket）
const { execSync } = require('child_process');
const fs = require('fs');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async ()=>{
  const list = JSON.parse(execSync(`curl -s http://127.0.0.1:9334/json`).toString());
  const page = list.find(p=>p.type==='page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pending={};
  ws.onmessage = ev=>{ const m=JSON.parse(ev.data); if(m.id&&pending[m.id]){pending[m.id](m);delete pending[m.id];} };
  const send=(method,params={})=>new Promise(res=>{const i=++id;pending[i]=res;ws.send(JSON.stringify({id:i,method,params}));});
  await new Promise(r=>ws.onopen=r);
  const ev = async expr => (await send('Runtime.evaluate',{expression:expr,returnByValue:true})).result.result.value;
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:8765/spirit-refinery/index.html?r='+Date.now()+'#/refine'});
  await sleep(1200);
  await ev(`localStorage.clear(); location.reload()`); await sleep(1500);
  // 制造一只 10 级灵兽并装配直接攻击
  const skills = await ev(`(()=>{
    const s = makeSpirit('JL_fire_normal_0001', false, '测试炉');
    s.lvl = 10;
    directUnlocked(s.elem, 10).forEach(sk=>{
      if(!s.skills.some(x=>x.id===sk.id) && !s.skillPool.some(x=>x.id===sk.id)){
        s.skillPool.push({id:sk.id, name:sk.name, kind:'direct', cost:sk.cost, elem:sk.elem, mastery:40});
      }
    });
    ['fire-d6','fire-d8','fire-d11'].forEach(id=>{
      const i = s.skillPool.findIndex(x=>x.id===id);
      if(i>=0){ const sk = s.skillPool[i]; s.skillPool.splice(i,1); s.skills.push(sk); }
    });
    s.energy = 20;
    S.spirits.push(s);
    S.wild.spiritId = s.id;
    return s.skills.map(x=>x.name).join(',');
  })()`);
  console.log('装配技能:', skills);
  // 进入战斗（先点出发探索，再注入妖兽节点）
  await ev(`location.hash='#/wild'; route();`); await sleep(300);
  await ev(`(()=>{ const s=S.spirits[0]; s.lvl=10; s.hp=9999; renderWild(); })()`);
  await ev(`(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('出发探索')); b&&b.click(); })()`); await sleep(300);
  await ev(`(()=>{ S.wild.nodes=[{type:'beast',ambush:false,beast:wildBeast('JL_fire_normal_0001')}]; S.wild.idx=0; S.wild.phase='encounter'; S.wild.state='adventure'; renderWild(); })()`); await sleep(300);
  await ev(`(()=>{ const b=[...document.querySelectorAll('.action-btn')].find(x=>x.querySelector('.ab-t')&&x.querySelector('.ab-t').innerText==='正面 · 战斗'); b&&b.click(); })()`);
  await sleep(400);
  await ev(`(()=>{ const el=document.querySelector('.battle-skills')||document.querySelector('.battle-panel'); el&&el.scrollIntoView({block:'start'}); })()`); await sleep(300);
  console.log('--- 战斗技能区 ---');
  console.log(await ev(`document.querySelector('.battle-skills').innerText`));
  let shot = await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('/tmp/m1_battle.png', Buffer.from(shot.result.data,'base64'));
  console.log('截图1 /tmp/m1_battle.png');
  // 第一轮：炎龙双击（2段）
  await ev(`battleSkill('fire-d6')`); await sleep(400);
  console.log('--- 第一轮日志 ---');
  console.log(await ev(`document.querySelector('.battle-log').innerText`));
  // 回能 + 奥义
  await ev(`battleSkill('regen')`); await sleep(300);
  await ev(`battleSkill('fire-d11')`); await sleep(400);
  console.log('--- 奥义轮日志（末4行） ---');
  const lg = await ev(`document.querySelector('.battle-log').innerText`);
  console.log(lg.split('\n').slice(-4).join('\n'));
  shot = await send('Page.captureScreenshot',{format:'png'});
  fs.writeFileSync('/tmp/m1_battle2.png', Buffer.from(shot.result.data,'base64'));
  console.log('截图2 /tmp/m1_battle2.png');
  process.exit(0);
})().catch(e=>{ console.error('ERR', e); process.exit(1); });
