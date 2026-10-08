/* v1.20.5 验收测试：P0-1 妖兽出战 / P0-2 编辑器即时生效 / P0-3 遭遇策略 / P0-4 捕捉点亮图鉴 */
/* 需求：需求文档_M3-2补丁a_P0流程修复_2026-09-21.md §四（17 条验收标准） */
/* 数据来源：index.html 真实代码；随机用固定 Math.random 保证确定性 */
const WebSocket = require('/opt/runtime/nodejs/node_modules/ws');
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
    if(r.result.exceptionDetails) throw new Error('EVAL_ERR: '+JSON.stringify(r.result.exceptionDetails.exception||r.result.exceptionDetails));
    return r.result.result.value; };

  const URL='http://127.0.0.1:8765/spirit-refinery/index.html?v='+Date.now();
  await cmd('Page.navigate',{url:URL}); await new Promise(r=>setTimeout(r,1800));
  await ev(`localStorage.removeItem('refine-proto-codex'); location.reload(); 'reload'`);
  await new Promise(r=>setTimeout(r,1800));

  const results = [];
  const T = (num, name, res) => results.push({num, name, ok:!!res.ok, detail: res.detail||res});

  /* ---------- 初始化 ---------- */
  const init = await ev(`(()=>{
    S.beasts = S.beasts||[]; S.dexSeen = S.dexSeen||{}; S.skillEdits = S.skillEdits||{};
    S.stamina = 100; S.staminaMax = 100;
    const sid = 'JL_fire_normal_0001';
    return {spirits:S.spirits.length, beasts:S.beasts.length, stamina:S.stamina, sid,
      spirit0Skills:(S.spirits[0]||{}).skills ? S.spirits[0].skills.map(s=>s.id) : null,
      hasInit: typeof wildSpirit==='function' && typeof startBattle==='function' && typeof moveTo==='function'};
  })()`);
  if(!init.hasInit || !init.spirits) { console.log('FATAL init failed', JSON.stringify(init)); process.exit(1); }

  /* ---------- P0-1 ---------- */
  T('1','P0-1 妖兽出战：wildSpirit 注入 directUnlocked 浅拷贝技能（含回能卡前提）', await ev(`(()=>{
    S.beasts.push({id:'tb1', speciesId:'JL_fire_normal_0001', lvl:10, nature:'brave', iv:{}});
    S.wild = S.wild||{}; S.wild.spiritId='beast:tb1';
    const sp = wildSpirit();
    if(!sp || !sp.isBeast) return {ok:false, detail:'wildSpirit 未返回妖兽对象'};
    const direct = sp.skills.filter(s=>s.kind==='direct');
    const poolRef = Object.values(SKILLS).flat().find(x=>x.id===(direct[0]||{}).id);
    return {ok: sp.skills.length>=1 && direct.length>=1 && sp.energy===5 && sp.energyMax===10 && direct[0]!==poolRef,
      detail:{nSkills:sp.skills.length, nDirect:direct.length, energy:sp.energy, energyMax:sp.energyMax,
        shallowCopy:(direct[0]!==poolRef), ids:sp.skills.map(s=>s.id)}};
  })()`));

  T('2','P0-1 妖兽出战：技能卡 ≥2（直接攻击+回能）、不显示占容、头部无容量提示', await ev(`(()=>{
    const beast = wildBeast('JL_fire_normal_0001', 1);
    S.wild.phase='battle'; S.wild.battle=null;
    startBattle(beast, 'normal', []);
    renderWild();
    const root=document.getElementById('wild-root');
    const cards=root.querySelectorAll('.bt-skill-card');
    const html=root.innerHTML;
    return {ok: cards.length>=2 && html.includes('妖兽出战 · 无容量体系') && !html.includes('占容'),
      detail:{nCards:cards.length, capInfo:html.includes('妖兽出战 · 无容量体系'), hasZhanRong:html.includes('占容')}};
  })()`));

  T('3','P0-1 妖兽出战：普通 1v1 可获胜（敌方掉血 + phase=won）', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      const beast = wildBeast('JL_fire_normal_0001', 1);
      S.wild.phase='battle'; S.wild.battle=null;
      startBattle(beast, 'normal', []);
      const b=S.wild.battle; const sp=wildSpirit();
      const hpBefore=b.beast.hp; let dmgObserved=false;
      for(let i=0;i<80 && b.phase==='fight';i++){
        const sk = sp.skills.find(x=>{const d=skillById(x.id); return d && d.kind==='direct' && skillUsable(sp,d);});
        if(sk){ battleSkill(sk.id); if(b.beast.hp<hpBefore) dmgObserved=true; }
        else battleSkill('regen');
      }
      return {ok: dmgObserved && b.phase==='won', detail:{dmgObserved, phase:b.phase, beastHp:b.beast.hp, beastMax:b.beast.maxHp, rounds:b.round, logTail:b.log.slice(-3).map(l=>l.text)}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  T('4','P0-1 副本构建仍不可选妖兽（列表=灵兽数）', await ev(`(()=>{
    const spCount=S.spirits.length; const beCount=S.beasts.length;
    S.buildSpiritId=null;
    renderBuild();
    const cards=document.querySelectorAll('#build-spirits .sp-card').length;
    return {ok: cards===spCount, detail:{spiritCards:cards, spirits:spCount, beasts:beCount}};
  })()`));

  T('5','P0-1 灵兽出战零回归：技能卡=原技能+回能', await ev(`(()=>{
    const sp=S.spirits[0];
    S.wild.spiritId=sp.id;
    const expectN = wildSpirit().skills.length + 1;
    const beast=wildBeast('JL_fire_normal_0001',1);
    S.wild.phase='battle'; S.wild.battle=null;
    startBattle(beast,'normal',[]);
    renderWild();
    const cards=document.querySelectorAll('#wild-root .bt-skill-card').length;
    return {ok: cards===expectN, detail:{expectN, cards, spiritSkills:sp.skills.length}};
  })()`));

  /* ---------- P0-2 ---------- */
  T('6','P0-2 编辑器 power 999 → 野外伤害显著提升', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      const sp=S.spirits[0];
      const skId = sp.skills.map(s=>s.id).map(id=>skillById(id)).find(d=>d&&d.kind==='direct');
      const skId2 = sp.skills.find(s=>{const d=skillById(s.id); return d&&d.kind==='direct';}).id;
      const def0 = skillById(skId2);
      // 基准伤害
      const beast0=wildBeast('JL_fire_normal_0001',1);
      S.wild.phase='battle'; S.wild.battle=null; S.wild.spiritId=sp.id;
      startBattle(beast0,'normal',[]);
      const b0=S.wild.battle; const hpA=b0.beast.hp;
      battleSkill(skId2);
      const baseDmg = hpA - b0.beast.hp;
      // 编辑 power=999 后
      S.skillEdits[skId2] = {...def0, power:999};
      const beast1=wildBeast('JL_fire_normal_0001',1);
      S.wild.phase='battle'; S.wild.battle=null;
      startBattle(beast1,'normal',[]);
      const b1=S.wild.battle; const hpB=b1.beast.hp;
      battleSkill(skId2);
      const editedDmg = hpB - b1.beast.hp;
      return {ok: editedDmg > baseDmg*2, detail:{skId:skId2, baseDmg, editedDmg, defPower:def0.power, editedPower:S.skillEdits[skId2].power}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  T('7','P0-2 编辑器新增自定义攻击技能：卡片显示（非—）且点击生效', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      S.skillEdits['test_atk_1']={id:'test_atk_1',name:'测试斩',power:40,energy:0,kind:'direct',elem:'fire',track:'phys',hits:1,desc:'自定义测试技'};
      const sp=S.spirits[0];
      sp.skills.push({id:'test_atk_1',name:'测试斩',cost:0,elem:'fire',mastery:30,kind:'direct',energy:0,hits:1});
      const beast=wildBeast('JL_fire_normal_0001',1);
      S.wild.phase='battle'; S.wild.battle=null; S.wild.spiritId=sp.id;
      startBattle(beast,'normal',[]);
      renderWild();
      const html=document.getElementById('wild-root').innerHTML;
      const cardShown = html.includes('测试斩') && !/bt-skill-elem">—</.test(html);
      const b=S.wild.battle; const hp0=b.beast.hp;
      battleSkill('test_atk_1');
      const logHit=b.log.some(l=>l.text.includes('测试斩'));
      return {ok: cardShown && b.beast.hp<hp0 && logHit, detail:{cardShown, dmg:hp0-b.beast.hp, logHit}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  T('8','P0-2 副本 dgSkillDef 路径不回归（同编辑技能可用且按编辑 def）', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      const sp=S.spirits[0];
      S.settle={spiritId:sp.id, enemies:[wildBeast('JL_fire_normal_0001',1)], idx:0, kills:0, buffs:[], logs:[], phase:'fight'};
      startDgFight();
      const def=dgSkillDef('test_atk_1');
      const b=S.settle.battle; const hp0=b.beast.hp;
      dgBattleSkill('test_atk_1');
      return {ok: def===S.skillEdits['test_atk_1'] && b.beast.hp<hp0, detail:{sameDef:(def===S.skillEdits['test_atk_1']), dmg:hp0-b.beast.hp, power:def&&def.power, logHit:b.log.some(l=>l.text.includes('测试斩'))}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  /* ---------- P0-3 ---------- */
  const setupNode = `(()=>{
    const g={size:5,startX:0,startY:0,cells:[]};
    for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
    S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
    S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
    return g;
  })`;

  const r9 = await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      const beast=wildBeast('JL_fire_normal_0001',1); beast.template='normal';
      const g={size:5,startX:0,startY:0,cells:[]};
      for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
      g.cells[1][1].event={kind:'fight', beast, ambush:false, buffs:[], template:'normal'};
      S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
      S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
      moveTo(1,1);
      const w=S.wild;
      let html='';
      if(w.phase==='node'){ renderWild(); html=document.getElementById('wild-root').innerHTML; }
      const opts=['正面 · 安抚','正面 · 战斗','悄悄 · 离开','悄悄 · 安抚','悄悄 · 突袭'];
      const has=opts.every(t=>html.includes(t));
      return {ok: w.phase==='node' && has, detail:{phase:w.phase, hasAllOpts:has, hasAmbushCard:html.includes('被突袭')}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`);
  T('9','P0-3 非 boss 非被突袭 fight → 五选项卡', r9);

  T('10','P0-3 正面安抚：成功=免战+calm 掉落+回网格+resolved；失败=进战斗', await ev(`(()=>{
    const origRandom=Math.random;
    function setup(){
      const beast=wildBeast('JL_fire_normal_0001',1); beast.template='normal';
      const g={size:5,startX:0,startY:0,cells:[]};
      for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
      g.cells[1][1].event={kind:'fight', beast, ambush:false, buffs:[], template:'normal'};
      S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
      S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
      return g;
    }
    try{
      // 成功（Math.random .3 → roll(.4) true）
      Math.random=()=>0.3;
      setup();
      moveTo(1,1);
      renderWild();
      [...document.querySelectorAll('#wild-root .action-btn')].find(b=>b.innerHTML.includes('正面 · 安抚')).click();
      const after=S.wild;
      const calmLoot=after.loots[after.loots.length-1];
      renderWild();
      [...document.querySelectorAll('#wild-root button')].find(b=>b.innerHTML.includes('继续前行')).click();
      const cell=after.grid.cells[1][1];
      const succ={phase:after.phase, resolved:cell.resolved, hasCalmDrop:!!(calmLoot&&calmLoot.names), desc:(calmLoot&&calmLoot.desc)||''};
      // 失败（Math.random .5 → roll(.4) false）
      Math.random=()=>0.5;
      setup();
      moveTo(1,1);
      renderWild();
      [...document.querySelectorAll('#wild-root .action-btn')].find(b=>b.innerHTML.includes('正面 · 安抚')).click();
      const fail={phase:S.wild.phase, inBattle:S.wild.phase==='battle', mode:S.wild.battle&&S.wild.battle.mode};
      return {ok: succ.phase==='move' && succ.resolved===true && succ.hasCalmDrop && fail.inBattle && fail.mode==='normal',
        detail:{succ, fail}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  T('11','P0-3 悄悄安抚：成功=免战+calm 掉落；失败=进战斗（无先手）', await ev(`(()=>{
    const origRandom=Math.random;
    function setup(){
      const beast=wildBeast('JL_fire_normal_0001',1); beast.template='normal';
      const g={size:5,startX:0,startY:0,cells:[]};
      for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
      g.cells[1][1].event={kind:'fight', beast, ambush:false, buffs:[], template:'normal'};
      S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
      S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
    }
    try{
      Math.random=()=>0.3;
      setup(); moveTo(1,1); renderWild();
      [...document.querySelectorAll('#wild-root .action-btn')].find(b=>b.innerHTML.includes('悄悄 · 安抚')).click();
      const succ={phase:S.wild.phase, hasCalmDrop:!!(S.wild.loots[S.wild.loots.length-1]&&S.wild.loots[S.wild.loots.length-1].names)};
      Math.random=()=>0.7;
      setup(); moveTo(1,1); renderWild();
      [...document.querySelectorAll('#wild-root .action-btn')].find(b=>b.innerHTML.includes('悄悄 · 安抚')).click();
      const fail={phase:S.wild.phase, inBattle:S.wild.phase==='battle', mode:S.wild.battle&&S.wild.battle.mode, hitSelf:!!(S.wild.battle&&S.wild.battle.hitSelf), hitBeast:!!(S.wild.battle&&S.wild.battle.hitBeast)};
      return {ok: succ.phase==='result' && succ.hasCalmDrop && fail.inBattle && fail.mode==='normal' && !fail.hitSelf && !fail.hitBeast,
        detail:{succ, fail}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  T('12','P0-3 悄悄突袭 → 玩家先手一击（hitBeast=true 且敌方掉血）', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      const beast=wildBeast('JL_fire_normal_0001',1); beast.template='normal';
      const g={size:5,startX:0,startY:0,cells:[]};
      for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
      g.cells[1][1].event={kind:'fight', beast, ambush:false, buffs:[], template:'normal'};
      S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
      S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
      moveTo(1,1); renderWild();
      [...document.querySelectorAll('#wild-root .action-btn')].find(b=>b.innerHTML.includes('悄悄 · 突袭')).click();
      const b=S.wild.battle;
      return {ok: b && b.hitBeast===true && b.beast.hp<b.beast.maxHp, detail:{mode:b&&b.mode, hitBeast:!!(b&&b.hitBeast), hitSelf:!!(b&&b.hitSelf), dmg:(b&&b.beast.maxHp-b.beast.hp), log:(b&&b.log[0]&&b.log[0].text)}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  T('13','P0-3 悄悄离开 → 无掉落、回网格、事件格 resolved', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      const beast=wildBeast('JL_fire_normal_0001',1); beast.template='normal';
      const g={size:5,startX:0,startY:0,cells:[]};
      for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
      g.cells[1][1].event={kind:'fight', beast, ambush:false, buffs:[], template:'normal'};
      S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
      S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
      moveTo(1,1); renderWild();
      [...document.querySelectorAll('#wild-root .action-btn')].find(b=>b.innerHTML.includes('悄悄 · 离开')).click();
      const midState = {phase:S.wild.phase, lootNames:(S.wild.loots[S.wild.loots.length-1]||{}).names||''};
      renderWild();
      [...document.querySelectorAll('#wild-root button')].find(b=>b.innerHTML.includes('继续前行')).click();
      return {ok: midState.phase==='result' && !midState.lootNames && S.wild.phase==='move' && S.wild.grid.cells[1][1].resolved===true,
        detail:{mid:midState, finalPhase:S.wild.phase, resolved:S.wild.grid.cells[1][1].resolved}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  T('14','P0-3 被突袭 → 应战卡；应战 → 敌方先手一击（hitSelf=true）', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      const beast=wildBeast('JL_fire_normal_0001',1); beast.template='normal';
      const g={size:5,startX:0,startY:0,cells:[]};
      for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
      g.cells[1][1].event={kind:'fight', beast, ambush:true, buffs:[], template:'normal'};
      S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
      S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
      moveTo(1,1);
      const nodePhase = S.wild.phase;
      renderWild();
      const html=document.getElementById('wild-root').innerHTML;
      const hasCard=html.includes('被突袭')&&html.includes('应战');
      [...document.querySelectorAll('#wild-root button')].find(b=>b.innerHTML.includes('应战')).click();
      const b=S.wild.battle;
      return {ok: nodePhase==='node' && hasCard && b && b.hitSelf===true && b.spHp<b.spMax,
        detail:{nodePhase, hasAmbushCard:hasCard, mode:b&&b.mode, hitSelf:!!(b&&b.hitSelf), dmg:(b&&b.spMax-b.spHp), log:(b&&b.log[0]&&b.log[0].text)}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  T('15','P0-3 boss 事件 → 直接正面对峙，不弹遭遇卡', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.5;
    try{
      const beast=wildBeast('JL_fire_normal_0001',3); beast.template='boss';
      const g={size:5,startX:0,startY:0,cells:[]};
      for(let y=0;y<5;y++){g.cells[y]=[];for(let x=0;x<5;x++)g.cells[y][x]={x,y,type:'grass',event:null,resolved:false,isExit:false};}
      g.cells[1][1].event={kind:'fight', beast, ambush:false, buffs:[], template:'boss'};
      S.wild.mapId='gentlebreeze'; S.wild.grid=g; S.wild.px=0; S.wild.py=0; S.wild.phase='move'; S.wild.state='grid';
      S.wild.spiritId=S.spirits[0].id; S.wild.loots=[]; S.wild.battle=null; S.wild.node=null;
      moveTo(1,1);
      const w=S.wild;
      return {ok: w.phase==='battle' && !w.node, detail:{phase:w.phase, hasNode:!!w.node, battleMode:w.battle&&w.battle.mode, template:w.battle&&w.battle.template}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  /* ---------- P0-4 ---------- */
  const mkWinModal = ()=>`(()=>{
    const beast=wildBeast('JL_fire_normal_0001',1);
    S.wild.mapId='gentlebreeze'; S.wild.spiritId=S.spirits[0].id;
    S.wild.phase='battle'; S.wild.battle=null;
    startBattle(beast,'normal',[]);
    S.wild.battle.phase='won';
    battleResultModal(S.wild.battle, wildSpirit());
    return true;
  })()`;

  T('16','P0-4 捕捉成功 → dexSeen 点亮', await ev(`(()=>{
    const origRandom=Math.random; Math.random=()=>0.1;
    try{
      const sid='JL_fire_normal_0001';
      delete S.dexSeen[sid];
      const beastsBefore=S.beasts.length;
      const beast=wildBeast(sid,1);
      S.wild.mapId='gentlebreeze'; S.wild.spiritId=S.spirits[0].id;
      S.wild.phase='battle'; S.wild.battle=null;
      startBattle(beast,'normal',[]);
      S.wild.battle.phase='won';
      battleResultModal(S.wild.battle, wildSpirit());
      [...document.querySelectorAll('#modal-box button')].find(b=>b.innerHTML.includes('捕捉')).click();
      const dex=S.dexSeen[sid]===true;
      return {ok: dex, detail:{dexSeen:!!S.dexSeen[sid], beastsDelta:S.beasts.length-beastsBefore, beastsAfter:S.beasts.length}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  T('17','P0-4 重复捕捉同物种不报错、幂等；捕捉失败不点亮', await ev(`(()=>{
    const origRandom=Math.random;
    const sid='JL_fire_normal_0001';
    try{
      // 重复捕捉
      Math.random=()=>0.1;
      let dupErr=null;
      try{
        const beast=wildBeast(sid,1);
        S.wild.phase='battle'; S.wild.battle=null; S.wild.mapId='gentlebreeze'; S.wild.spiritId=S.spirits[0].id;
        startBattle(beast,'normal',[]);
        S.wild.battle.phase='won';
        battleResultModal(S.wild.battle, wildSpirit());
        [...document.querySelectorAll('#modal-box button')].find(b=>b.innerHTML.includes('捕捉')).click();
      }catch(e){ dupErr=String(e); }
      const afterDup={err:dupErr, dexSeen:!!S.dexSeen[sid]};
      // 捕捉失败
      delete S.dexSeen[sid];
      Math.random=()=>0.7;
      const beastsBefore=S.beasts.length;
      const beast2=wildBeast(sid,1);
      S.wild.phase='battle'; S.wild.battle=null;
      startBattle(beast2,'normal',[]);
      S.wild.battle.phase='won';
      battleResultModal(S.wild.battle, wildSpirit());
      [...document.querySelectorAll('#modal-box button')].find(b=>b.innerHTML.includes('捕捉')).click();
      const afterFail={dexSeen:!!S.dexSeen[sid], beastsDelta:S.beasts.length-beastsBefore};
      return {ok: !dupErr && afterDup.dexSeen && !afterFail.dexSeen && afterFail.beastsDelta===0,
        detail:{dup:afterDup, fail:afterFail}};
    }catch(e){ return {ok:false, detail:'ERR '+e}; }
    finally{ Math.random=origRandom; }
  })()`));

  /* ---------- 汇总 ---------- */
  const pass = results.filter(r=>r.ok).length;
  console.log('=== v1.20.5 ACCEPT RESULTS ===');
  results.forEach(r=> console.log((r.ok?'PASS':'FAIL')+' #'+r.num+' '+r.name+' :: '+JSON.stringify(r.detail)));
  console.log('SUMMARY '+pass+'/'+results.length);
  ws.close();
  process.exit(pass===results.length?0:2);
})();
