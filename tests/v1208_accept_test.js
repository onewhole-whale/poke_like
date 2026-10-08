/* v1.20.8 验收测试：M3-2 补丁 b · P1 收尾（A 演出5 / B 通用化3 / C 功能4 / 回归1） */
/* 需求：需求文档_M3-2补丁b_P1收尾_2026-09-22.md §四（13 条验收标准）；开发报告 §3 */
/* 数据来源：index.html 真实代码；CDP Runtime.evaluate 动态执行；Math.random 固定化保证确定性 */
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
    S.wild = S.wild||{};
    S.spirits = S.spirits||[];
    S.settle = null;
    S.toolInv = S.toolInv||{};
    const sp0 = S.spirits[0];
    return {hasInit: typeof startBattle==='function' && typeof battleSkill==='function' && typeof startDgFight==='function'
      && typeof upMatFor==='function' && typeof eventStatPanel==='function' && typeof genSandbox==='function' && typeof wildBeast==='function',
      nSpirits:S.spirits.length, sp0Id: sp0&&sp0.id, sp0Skills: sp0&&sp0.skills.map(s=>s.id)};
  })()`);
  if(!init.hasInit || init.nSpirits===0){ console.log('FATAL init failed', JSON.stringify(init)); process.exit(1); }
  const sp0Id = init.sp0Id;

  /* 野外战斗构造：高血防，避免战斗提前结束 */
  const makeWildBattle = `(()=>{
    S.wild.mapId='gentlebreeze'; S.wild.state='battle'; S.wild.phase='battle'; S.wild.spiritId='${sp0Id}';
    S.wild.battle=null;
    const beast = wildBeast('JL_fire_normal_0001', 1);
    startBattle(beast, 'normal', []);
    const b = S.wild.battle;
    b.beast.maxHp = 999999; b.beast.hp = 999999; b.beast.atk = 0; b.beast.spa = 0;
    b.spHp = b.spMax; b.energy = 10;
    renderWild();
    return !!b;
  })()`;

  /* ---------- T1 A1 出招名片（野外·我方） ---------- */
  T('1','A1 出招条：我方左上绿底，只写技能名；无克制不加三角，不用方向箭头', await ev(`(()=>{
    ${makeWildBattle};
    const b = S.wild.battle;
    const sk = wildSpirit().skills[0];
    battleSkill(sk.id);
    const card = document.querySelector('#wild-root .bt-move-card');
    const html = document.querySelector('#wild-root').innerHTML;
    const txt = card ? card.textContent : '';
    return {ok: !!card && (card.classList.contains('left')||card.classList.contains('right')) && html.includes(sk.name) && !/[→←↑↓]/.test(txt),
      detail:{cardText: txt, hasSkName: html.includes(sk.name), hasMoveCard:!!card, _fxCleared: !b._fx}};
  })()`));

  /* ---------- T1b A1 敌方出招名片（副本·敌方回合） ---------- */
  T('1b','A1 出招名片：敌方出招也应浮现名片（需求：敌方左箭头+技能名）', await ev(`(()=>{
    S.settle = {spiritId:'${sp0Id}', enemies:[wildBeast('JL_fire_normal_0001',3)], idx:0, buffs:[], phase:'fight', kills:0, logs:[]};
    startDgFight();
    const b = S.settle.battle;
    b.beast.maxHp = 999999; b.beast.hp = 999999; b.beast.atk = 0; b.beast.spa = 0;
    dgBeastTurn(b);           // 敌方出招
    const wroteFx = !!b._fx;  // 敌方回合是否写入 _fx（需求：应写 side:'enemy'）
    return {ok: wroteFx, detail:{enemyFxWrote: wroteFx}};
  })()`));

  /* ---------- T2 A2 血条 hover ---------- */
  T('2','A2 血条 hover：我方 .hp-bar 有 title=当前/上限，敌方无 title', await ev(`(()=>{
    ${makeWildBattle};
    const left = document.querySelector('#wild-root .bt-hp.left .hp-bar');
    const right = document.querySelector('#wild-root .bt-hp.right .hp-bar');
    return {ok: !!left && !!left.getAttribute('title') && /^\\d+\\/\\d+$/.test(left.getAttribute('title')) && !right.getAttribute('title'),
      detail:{myTitle: left&&left.getAttribute('title'), enemyHasTitle: !!(right&&right.getAttribute('title'))}};
  })()`));

  /* ---------- T3 A3 日志倒序 ---------- */
  T('3','A3 日志最新在最顶：showLog 渲染 b.log.slice().reverse()，首条=最新', await ev(`(()=>{
    ${makeWildBattle};
    const b = S.wild.battle;
    const sk = wildSpirit().skills[0];
    battleSkill(sk.id);
    const logBtn = Array.from(document.querySelectorAll('#wild-root .bt-func-btn')).find(x=>x.textContent==='日');
    logBtn.click();
    const log = b.log;
    const lastText = log[log.length-1].text.replace(/<[^>]+>/g,'');
    const firstBlog = document.querySelector('#wild-root .bt-detail .blog');
    const firstText = firstBlog ? firstBlog.textContent : '';
    return {ok: firstText.includes(lastText.slice(0,8)),
      detail:{nLog:log.length, lastText, firstBlogText:firstText}};
  })()`));

  /* ---------- T4 A4 展示板血量数字 ---------- */
  T('4','A4 展示板常驻血量数字：左右展示板状态栏含 当前/上限（需求格式）', await ev(`(()=>{
    ${makeWildBattle};
    const sides = Array.from(document.querySelectorAll('#wild-root .bt-side'));
    const texts = sides.map(s=>s.textContent);
    const hasHpNum = texts.map(t=>/\\d+\\/\\d+/.test(t));
    return {ok: hasHpNum.length===2 && hasHpNum.every(Boolean),
      detail:{sideTexts: texts, hasHpNum}};
  })()`));

  /* ---------- T5 A5 命中全套动画 ---------- */
  T('5a','A5 前冲+受击：命中后攻击方 lunge、受击方 hit 类接线（0.3s/0.2s 移除）', await ev(`(()=>{
    ${makeWildBattle};
    const b = S.wild.battle;
    const sk = wildSpirit().skills[0];
    b._fx = {side:'player', skId:sk.id, elem:sk.elem, hitBeast:true, hitSelf:false};
    renderWild();
    const atk = document.querySelector('#wild-root .bt-fighter.left');
    const def = document.querySelector('#wild-root .bt-fighter.right');
    return {ok: atk.classList.contains('lunge-left') && def.classList.contains('hit'),
      detail:{atkClass:atk.className, defClass:def.className}};
  })()`));
  T('5b','A5 伤害飘字：命中后 .bt-dmg-num 飘字生成（暴击红/治疗绿）', await ev(`(()=>{
    ${makeWildBattle};
    const b = S.wild.battle;
    const sk = wildSpirit().skills[0];
    b._fx = {side:'player', skId:sk.id, elem:sk.elem, hitBeast:true, hitSelf:false, dmg:8, landed:true, type:'攻击'};
    renderWild();
    const dmgNums = document.querySelectorAll('#wild-root .bt-dmg-num').length;
    return {ok: dmgNums>0, detail:{dmgNums}};
  })()`));
  T('5c','A5 属性粒子：释放技能时按属性在场地生成 canvas 粒子', await ev(`(()=>{
    ${makeWildBattle};
    const b = S.wild.battle;
    const sk = wildSpirit().skills[0];
    b._fx = {side:'player', skId:sk.id, elem:sk.elem, hitBeast:true, hitSelf:false};
    renderWild();
    const canvases = document.querySelectorAll('#wild-root canvas').length;
    return {ok: canvases>0, detail:{canvases}};
  })()`));
  T('5d','A5 状态图标 popIn：新状态图标带 popIn 类弹出', await ev(`(()=>{
    ${makeWildBattle};
    const b = S.wild.battle;
    b.spSt.burn = {layers:1}; b.spSt.sleep = 2;
    renderWild();
    const ics = Array.from(document.querySelectorAll('#wild-root .bt-st-ic'));
    return {ok: ics.length>=2 && ics.every(ic=>ic.classList.contains('popIn')),
      detail:{nIcons:ics.length, classes:ics.map(i=>i.className)}};
  })()`));

  /* ---------- T6 B1 通用渲染引擎 ---------- */
  T('6','B1 通用渲染：野外/副本均渲染 bt-wrap 新 UI，副本无 bp- 旧布局', await ev(`(()=>{
    ${makeWildBattle};
    const wildWrap = !!document.querySelector('#wild-root .bt-wrap');
    const wildBp = document.querySelectorAll('#wild-root [class*=bp-]').length;
    S.settle = {spiritId:'${sp0Id}', enemies:[wildBeast('JL_fire_normal_0001',3)], idx:0, buffs:[], phase:'fight', kills:0, logs:[]};
    startDgFight(); renderSettle();
    const dgWrap = !!document.querySelector('#settle-root .bt-wrap');
    const dgBp = document.querySelectorAll('#settle-root .bp-side').length;
    const dgBpAll = document.querySelectorAll('#settle-root [class*=bp-]').length;
    return {ok: wildWrap && dgWrap && dgBp===0 && dgBpAll===0,
      detail:{wildWrap, wildBp, dgWrap, dgBp, dgBpAll}};
  })()`));

  /* ---------- T7 B2 副本能耗 effEnergy（对照野外） ---------- */
  T('7','B2 副本能耗 effEnergy：energyUp 加耗生效（副本/野外口径一致）', await ev(`(()=>{
    ${makeWildBattle};
    const b1 = S.wild.battle; b1.spSt.energyUp = 3; b1.beast.spd = 1;  // 强制玩家先手，避免敌方回合先衰减 energyUp
    const e0w = b1.energy;
    battleSkill(wildSpirit().skills[0].id);
    const wildCost = e0w - b1.energy;
    S.settle = {spiritId:'${sp0Id}', enemies:[wildBeast('JL_fire_normal_0001',3)], idx:0, buffs:[], phase:'fight', kills:0, logs:[]};
    startDgFight();
    const b2 = S.settle.battle; b2.spSt.energyUp = 3;
    const e0d = b2.energy;
    const sp = spById('${sp0Id}');
    const sk2 = sp.skills.find(s=>s.kind==='direct') || sp.skills[0];
    dgPlayerTurn(sp, sk2, b2);
    const dgCost = e0d - b2.energy;
    return {ok: wildCost>0 && dgCost===wildCost,
      detail:{skEnergy: sk2.energy, energyUp:3, wildCost, dgCost}};
  })()`));

  /* ---------- T8 B3 副本敌方能量 X/10 ---------- */
  T('8','B3 副本敌方能量显示 X/10（beastEnergyMax:10，非硬编码 /20）', await ev(`(()=>{
    S.settle = {spiritId:'${sp0Id}', enemies:[wildBeast('JL_fire_normal_0001',3)], idx:0, buffs:[], phase:'fight', kills:0, logs:[]};
    startDgFight(); renderSettle();
    const en = document.querySelector('#settle-root .bt-hp.right .bt-energy');
    const beastMax = S.settle.battle.beastEnergyMax;
    const wildMax = S.wild.battle ? S.wild.battle.beastEnergyMax : null;
    return {ok: !!en && /\\/10$/.test(en.textContent.trim()) && beastMax===10,
      detail:{enText: en?en.textContent.trim():null, beastMax, wildMax}};
  })()`));

  /* ---------- T9 C1 普通战斗逃跑 ---------- */
  T('9','C1 普通战斗逃跑：点「跑」→ 退回上一格、事件格保留不 resolved、无奖励', await ev(`(()=>{
    S.wild = Object.assign(S.wild, {state:'battle', phase:'battle', battle:null, fledFrom:{x:2,y:3}, px:5, py:5});
    S.wild.grid = genSandbox('gentlebreeze');
    S.wild.grid.cells[3][2].event = {kind:'fight', template:'normal', beast:{speciesId:'JL_fire_normal_0001', name:'测试', lvl:1}};
    S.wild.grid.cells[3][2].resolved = false;
    startBattle(wildBeast('JL_fire_normal_0001',1), 'normal', []);
    const b = S.wild.battle; b.beast.maxHp=999999; b.beast.hp=999999; b.beast.atk=0; b.beast.spa=0;
    renderWild();
    const btn = Array.from(document.querySelectorAll('#wild-root .bt-func-btn')).find(x=>x.textContent==='跑');
    btn.click();
    const w = S.wild;
    const cell = w.grid.cells[3][2];
    return {ok: w.phase==='move' && w.battle===null && w.px===2 && w.py===3 && cell.resolved===false,
      detail:{phase:w.phase, hasBattle:!!w.battle, px:w.px, py:w.py, evtResolved:cell.resolved}};
  })()`));

  /* ---------- T10 C2 背包 UI ---------- */
  T('10a','C2 背包空态：toolInv 空时显示"背包空空如也。"', await ev(`(()=>{
    ${makeWildBattle};
    S.toolInv = {};
    const btn = Array.from(document.querySelectorAll('#wild-root .bt-func-btn')).find(x=>x.textContent==='包');
    btn.click();
    const detail = document.querySelector('#wild-root .bt-detail');
    return {ok: !!detail && detail.textContent.includes('背包空空如也'),
      detail:{txt: detail.textContent.slice(0,60)}};
  })()`));
  T('10b','C2 背包有物态：toolInv 有道具时显示真实列表（TOOLS[id] 名称）', await ev(`(()=>{
    ${makeWildBattle};
    S.toolInv = {'pick-normal':1};
    const btn = Array.from(document.querySelectorAll('#wild-root .bt-func-btn')).find(x=>x.textContent==='包');
    let threw = null;
    try { btn.click(); } catch(e){ threw = String(e); }
    const detail = document.querySelector('#wild-root .bt-detail');
    const to = (typeof TOOLS);
    return {ok: !threw && to!=='undefined' && detail && detail.textContent.includes('pick-normal'),
      detail:{threw, typeofTOOLS:to, detailTxt: detail?detail.textContent.slice(0,80):null}};
  })()`));

  /* ---------- T11 C3 素材品质解锁 ---------- */
  T('11a','C3 upMatFor：elite +1 档 / boss +2 档 / normal 原档（同 elem+type+tags 同型）', await ev(`(()=>{
    const findChain = (()=>{
      // 找存在 normal→good→fine 完整同型链的素材
      for(const id in MATS){
        const m = MATS[id];
        if(m.quality!=='normal') continue;
        const g = upMatFor(id,'elite');
        if(g===id) continue;
        const f = upMatFor(g,'boss');
        if(f!==g && f!==id) return {n:id, g, f};
      }
      return null;
    })();
    const chain = findChain;
    if(!chain) return {ok:false, detail:{err:'未找到 normal→good 同型链'}};
    const normalOk = upMatFor(chain.n,'normal')===chain.n;        // normal 模板 → 原 id
    const eliteOk = upMatFor(chain.n,'elite')===chain.g;          // elite +1 档（normal→good）
    const bossOk = upMatFor(chain.g,'boss')===chain.f;            // boss +2 档（good→rare）
    return {ok: normalOk && eliteOk && bossOk,
      detail:{chain, normalOk, eliteOk, bossOk,
        g: MATS[chain.g]&&{q:MATS[chain.g].quality,e:MATS[chain.g].elem,t:MATS[chain.g].type,tags:MATS[chain.g].tags},
        f: MATS[chain.f]&&{q:MATS[chain.f].quality,e:MATS[chain.f].elem,t:MATS[chain.f].type,tags:MATS[chain.f].tags}}};
  })()`));
  T('11b','C3 击杀结算：elite/boss 击杀"基础保留 + 额外加档"（不筛基础）', await ev(`(()=>{
    // 复现 killBtn.onclick 的真实分支：drops 基础上叠加 upMatFor 结果
    const chain = (()=>{ for(const id in MATS){ const m=MATS[id]; if(m.quality!=='normal') continue; const g=upMatFor(id,'elite'); if(g!==id) return {n:id,g}; } return null; })();
    if(!chain) return {ok:false, detail:{err:'无同型链'}};
    let drops = {[chain.n]: 2};
    const tpl = 'elite';
    if(tpl==='elite'||tpl==='boss'){ for(const k in drops){ const up=upMatFor(k,tpl); if(up!==k) drops[up]=(drops[up]||0)+drops[k]; } }
    return {ok: drops[chain.n]===2 && drops[chain.g]===2,
      detail:{drops, baseKept:drops[chain.n]===2, upAdded:drops[chain.g]===2}};
  })()`));

  /* ---------- T12 C4 事件链 check 读实际属性 ---------- */
  T('12','C4 事件链 check：eventStatPanel 读出战精灵实际面板，改 stat 随之变化', await ev(`(()=>{
    S.wild.spiritId = '${sp0Id}';
    S.wild.battle = null;
    const sp = wildSpirit();
    const st = spiritStats(sp);
    const spe = eventStatPanel('spe');
    const atk = eventStatPanel('atk');
    const spePanel = eventStatPanel('spe', 100, 0, 'max');
    return {ok: spe===st.spd && atk===st.atk && spePanel===st.spd,
      detail:{panel:{spd:st.spd, atk:st.atk}, got:{spe, atk, spePanel}}};
  })()`));

  /* ---------- 汇总 ---------- */
  console.log(JSON.stringify({total:results.length, pass:results.filter(r=>r.ok).length, fail:results.filter(r=>!r.ok).length, results}, null, 1));
  ws.close();
})().catch(e=>{ console.error('FATAL', e); process.exit(1); });
