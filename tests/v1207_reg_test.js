/* v1.20.7 回归测试：R1 安抚失败开场日志 / R2 妖兽技能栏一屏可见 / R3 五选项分组与文案 */
/* 验收依据：开发报告_v1.20.7_产品验收跑偏项修复_2026-09-21.md §3（4 条） */
const WebSocket = require('/opt/runtime/nodejs/node_modules/ws');
(async()=>{
  const tabs = await (await fetch('http://127.0.0.1:9334/json/list')).json();
  const ws = new WebSocket((tabs.find(x=>x.type==='page')||tabs[0]).webSocketDebuggerUrl);
  let id=0; const pend={};
  ws.on('message', d=>{ const m=JSON.parse(d); if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id];} });
  await new Promise(r=>ws.on('open',r));
  const cmd=(method,params={})=>new Promise(res=>{const i=++id;pend[i]=res;ws.send(JSON.stringify({id:i,method,params}));});
  await cmd('Page.enable'); await cmd('Runtime.enable');
  const ev=async expr=>{ const r=await cmd('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
    if(r.result.exceptionDetails) return {__exc:JSON.stringify(r.result.exceptionDetails.exception||r.result.exceptionDetails)};
    return r.result.result.value; };

  const URL='http://127.0.0.1:8765/spirit-refinery/index.html?v='+Date.now();
  await cmd('Page.navigate',{url:URL}); await new Promise(r=>setTimeout(r,1800));
  await ev(`localStorage.removeItem('refine-proto-codex'); location.reload(); 'reload'`);
  await new Promise(r=>setTimeout(r,1800));

  const results=[];
  const T=(num,name,res)=>results.push({num,name,ok:!!res.ok,detail:res.detail||res});

  const init = await ev(`(()=>{ S.beasts=S.beasts||[]; S.dexSeen=S.dexSeen||{}; S.stamina=100; S.staminaMax=100;
    return {spirits:S.spirits.length, ok: typeof renderWildNode==='function' && typeof startBattle==='function'}; })()`);
  if(!init.ok) { console.log('FATAL', JSON.stringify(init)); process.exit(1); }

  /* ---- R1 安抚失败开场日志 ---- */
  T('R1.1','正面安抚失败 → 战斗日志第一条含"安抚失败了！X 警觉地亮出爪牙"（who=warn）', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      const beast=wildBeast('JL_fire_normal_0001',1); beast.template='normal';
      const g={size:5,startX:0,startY:0,cells:[]};
      for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
      g.cells[1][1].event={kind:'fight', beast, ambush:false, buffs:[], template:'normal'};
      S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
      S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
      moveTo(1,1); renderWild();
      [...document.querySelectorAll('#wild-root .action-btn')].find(b=>b.innerHTML.includes('正面 · 安抚')).click();
      const b=S.wild.battle;
      const first=b&&b.log[0];
      return {ok: !!(b && first && first.who==='warn' && first.text.includes('安抚失败了！') && first.text.includes('警觉地亮出爪牙')),
        detail:{phase:S.wild.phase, firstLog:first?{who:first.who,text:first.text}:null, logLen:b&&b.log.length}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  T('R1.2','悄悄安抚失败 → 战斗日志第一条含"悄悄安抚失败了！X 发现了你"（who=warn）', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.7;
    try{
      const beast=wildBeast('JL_fire_normal_0001',1); beast.template='normal';
      const g={size:5,startX:0,startY:0,cells:[]};
      for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
      g.cells[1][1].event={kind:'fight', beast, ambush:false, buffs:[], template:'normal'};
      S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
      S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
      moveTo(1,1); renderWild();
      [...document.querySelectorAll('#wild-root .action-btn')].find(b=>b.innerHTML.includes('悄悄 · 安抚')).click();
      const b=S.wild.battle;
      const first=b&&b.log[0];
      return {ok: !!(b && first && first.who==='warn' && first.text.includes('悄悄安抚失败了！') && first.text.includes('发现了你')),
        detail:{phase:S.wild.phase, firstLog:first?{who:first.who,text:first.text}:null}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  /* ---- R2 妖兽技能栏一屏可见 ---- */
  T('R2.1','妖兽出战（14 技能）→ detail maxHeight=520px（一屏可见）', await ev(`(()=>{
    S.beasts.push({id:'tb7', speciesId:'JL_fire_normal_0001', lvl:10, nature:'brave', iv:{}});
    S.wild.spiritId='beast:tb7';
    const sp=wildSpirit();
    const beast=wildBeast('JL_fire_normal_0001',1);
    S.wild.phase='battle'; S.wild.battle=null;
    startBattle(beast,'normal',[]);
    renderWild();
    const detail=document.querySelector('#wild-root .bt-detail');
    return {ok: !!(sp.isBeast && detail && detail.style.maxHeight==='520px' && sp.skills.length>=14),
      detail:{isBeast:sp.isBeast, nSkills:sp.skills.length, maxHeight:detail&&detail.style.maxHeight}};
  })()`));

  T('R2.2','灵兽出战 → 技能栏限高仍 240px（CSS 默认，无 inline 覆盖）', await ev(`(()=>{
    const sp=S.spirits[0];
    S.wild.spiritId=sp.id;
    const beast=wildBeast('JL_fire_normal_0001',1);
    S.wild.phase='battle'; S.wild.battle=null;
    startBattle(beast,'normal',[]);
    renderWild();
    const detail=document.querySelector('#wild-root .bt-detail');
    const cssMax = getComputedStyle(detail).maxHeight;
    return {ok: !detail.style.maxHeight && cssMax==='240px',
      detail:{inlineMax:detail.style.maxHeight||'(空)', cssMax, isBeast:sp.isBeast}};
  })()`));

  /* ---- R3 五选项分组与文案 ---- */
  T('R3.1','五选项卡分组：「正面接触」「悄悄行动」两组标题 + 分组顺序', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      const beast=wildBeast('JL_fire_normal_0001',1); beast.template='normal';
      const g={size:5,startX:0,startY:0,cells:[]};
      for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
      g.cells[1][1].event={kind:'fight', beast, ambush:false, buffs:[], template:'normal'};
      S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
      S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
      moveTo(1,1); renderWild();
      const html=document.getElementById('wild-root').innerHTML;
      const labels=[...document.querySelectorAll('#wild-root .action-group-label')].map(x=>x.textContent);
      const idx1=html.indexOf('正面接触'), idx2=html.indexOf('悄悄行动');
      const orderOk = labels.length===2 && labels[0].includes('正面接触') && labels[1].includes('悄悄行动') && idx1<idx2 && idx1>=0 && idx2>=0;
      const fiveOpts=['正面 · 安抚','正面 · 战斗','悄悄 · 离开','悄悄 · 安抚','悄悄 · 突袭'].every(t=>html.includes(t));
      return {ok: orderOk && fiveOpts, detail:{labels, fiveOpts, orderOk}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  T('R3.2','文案：正面·战斗"正面对峙，按速度决定谁先手"；悄悄·离开"不发生战斗，本格标记为已探索"', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      const beast=wildBeast('JL_fire_normal_0001',1); beast.template='normal';
      const g={size:5,startX:0,startY:0,cells:[]};
      for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
      g.cells[1][1].event={kind:'fight', beast, ambush:false, buffs:[], template:'normal'};
      S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
      S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
      moveTo(1,1); renderWild();
      const html=document.getElementById('wild-root').innerHTML;
      return {ok: html.includes('正面对峙，按速度决定谁先手') && html.includes('不发生战斗，本格标记为已探索'),
        detail:{fightTxt:html.includes('正面对峙，按速度决定谁先手'), leaveTxt:html.includes('不发生战斗，本格标记为已探索')}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  const pass=results.filter(r=>r.ok).length;
  console.log('=== v1.20.7 REG RESULTS ===');
  results.forEach(r=>console.log((r.ok?'PASS':'FAIL')+' #'+r.num+' '+r.name+' :: '+JSON.stringify(r.detail)));
  console.log('SUMMARY '+pass+'/'+results.length);
  ws.close();
  process.exit(pass===results.length?0:2);
})();
