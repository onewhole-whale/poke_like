/* v1.17.1 CDP 冒烟：事件链弹窗 UI / wonder 渲染路径 / loseMats 面板 */
const WebSocket = require('/opt/runtime/nodejs/node_modules/ws');
const fs=require('fs');
(async()=>{
  const tabs = await (await fetch('http://127.0.0.1:9334/json/list')).json();
  let t = tabs.find(x=>x.type==='page') || tabs[0];
  const ws = new WebSocket(t.webSocketDebuggerUrl);
  let id=0; const pend={};
  ws.on('message', d=>{ const m=JSON.parse(d); if(m.id&&pend[m.id]){pend[m.id](m);delete pend[m.id];} });
  await new Promise(r=>ws.on('open',r));
  const cmd=(method,params={})=>new Promise(res=>{const i=++id;pend[i]=res;ws.send(JSON.stringify({id:i,method,params}));});
  await cmd('Page.enable'); await cmd('Runtime.enable');
  const ev=async expr=>{ const r=await cmd('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true});
    if(r.result.exceptionDetails) throw new Error(JSON.stringify(r.result.exceptionDetails.exception||r.result.exceptionDetails));
    return r.result.result.value; };

  const URL='http://127.0.0.1:8765/spirit-refinery/index.html?v='+Date.now();
  await cmd('Page.navigate',{url:URL}); await new Promise(r=>setTimeout(r,1500));
  await ev(`localStorage.removeItem('refine-proto-codex'); location.reload(); 'reload'`);
  await new Promise(r=>setTimeout(r,1500));

  // 检查 S 状态 + 路由进冒险 idle 列表
  const init = await ev(`(()=>{
    return { hasWonderOnce: typeof S.wonderOnce==='object', wonderOnce: S.wonderOnce,
      wild: S.wild ? {mapId:S.wild.mapId, phase:S.wild.phase} : null };
  })()`);
  console.log('INIT', JSON.stringify(init));

  // 进微风平原沙盒
  const sandbox = await ev(`(()=>{
    S.wonderOnce={};
    S.wild = S.wild || {};
    S.wild.mapId='gentlebreeze';
    const g = genSandbox('gentlebreeze');
    S.wild.grid = g; S.wild.phase='move'; S.wild.py=g.startY; S.wild.px=g.startX;
    // 找 wonder 地块（chainId 形式）
    const wonders=[]; const advs=[];
    for(let y=0;y<g.size;y++)for(let x=0;x<g.size;x++){
      const c=g.cells[y][x];
      if(c.event&&!c.event.isExit){
        if(c.event.kind==='wonder') wonders.push({x,y,chainId:c.event.chainId});
        if(c.event.kind==='adventure') advs.push({x,y,chainId:c.event.chainId});
      }
    }
    return {size:g.size, wonders, advs};
  })()`);
  console.log('SANDBOX', JSON.stringify(sandbox));

  // 走到 wonder 地块触发渲染
  if(sandbox.wonders.length){
    const w=sandbox.wonders[0];
    const rendered = await ev(`(()=>{
      S.wild.py=${w.y}; S.wild.px=${w.x};
      const cell = S.wild.grid.cells[${w.y}][${w.x}];
      // 模拟点击事件地块 → 打开事件链
      S.wild.chainId=cell.event.chainId;
      S.wild.chainNode='n0';
      S.wild.phase='event';
      renderWild();
      const root=document.getElementById('app')||document.body;
      const html=root.innerHTML;
      return { chainId:cell.event.chainId,
        hasActTag: html.includes('奇遇'),
        hasOldStorySeg: html.includes('第 1 幕')||html.includes('第1幕'),
        hasChoiceButtons: html.includes('抄近路')||html.includes('翻山')||html.includes('摸')||html.includes('选'),
        snippet: html.slice(0,600) };
    })()`);
    console.log('WONDER_RENDER', JSON.stringify(rendered).slice(0,800));
  }

  // 触发 adv_starfall 节点渲染（n0 三选项）
  const advR = await ev(`(()=>{
    S.wonderOnce={};
    const g=genSandbox('gentlebreeze');
    S.wild.grid=g; S.wild.py=g.startY; S.wild.px=g.startX;
    S.wild.chainId='adv_starfall'; S.wild.chainNode='n0'; S.wild.phase='event';
    renderWild();
    const html=(document.getElementById('app')||document.body).innerHTML;
    return { hasFanShan: html.includes('翻山'), hasShoudao: html.includes('兽道'), hasDeng: html.includes('消停'),
      hasSlTag: html.includes('翻山过去')||html.includes('混进兽道'),
      snippet: html.slice(0,500) };
  })()`);
  console.log('ADV_RENDER', JSON.stringify(advR).slice(0,700));

  // check 判定：高速精灵 spe≥38 → n4
  const checkR = await ev(`(()=>{
    S.spirits=[{id:'sp1', speciesId:'JL_thunder_normal_0038', elem:'thunder', lvl:15, iv:{spe:100}, nature:{}}];
    S.wild.spiritId='sp1';
    S.wild.chainNode='n1'; S.wild.phase='event';
    renderWild();
    const html=(document.getElementById('app')||document.body).innerHTML;
    return { hasPanic: html.includes('翻了过去')||html.includes('稳住'), hasFall: html.includes('摔了下去'),
      spe: Math.round(spiritStats(S.spirits[0]).spd) };
  })()`);
  console.log('CHECK_HI', JSON.stringify(checkR));

  // n5 打服 → startChainBattle 精英等级
  const battleR = await ev(`(()=>{
    S.wild.chainNode='n5'; S.wild.phase='event';
    renderWild();
    // 直接调 startChainBattle(0)
    S.wild.chainPending = { enemies: MAP_CONFIGS.gentlebreeze.eventConfig.eventParams.fight_beat.enemies.map(e=>({speciesId:e.speciesId,template:e.template})),
      winNext:'n7', winRewards:[{id:'SC_fire_rare_000559',qty:1}], loseEffects:[{type:'loseMats',qty:'1~2'}] };
    startChainBattle(0);
    return { hasBattle: !!S.battle, stage: S.battle? S.battle.stage:null };
  })()`);
  console.log('CHAIN_BATTLE', JSON.stringify(battleR).slice(0,300));

  // renderWonder 调用栈判定：当前页面 DOM 是否走了旧 story 段式
  const usesOld = await ev(`(()=>{
    // w_fire 走事件链 nodes 渲染还是旧 story？检查 renderWonder 内部依赖 w.story
    return { chainDef: typeof EVENT_CHAINS.w_fire, hasNodes: !!EVENT_CHAINS.w_fire.nodes,
      hasStory: !!EVENT_CHAINS.w_fire.story,
      wonderEntries: Object.keys(EVENT_CHAINS).filter(k=>EVENT_CHAINS[k].kind==='wonder') };
  })()`);
  console.log('WONDER_DEF', JSON.stringify(usesOld));

  ws.close();
})().catch(e=>{console.error('CDP_ERR',e.message);process.exit(1);});
