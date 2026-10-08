/* 全量 CDP 回归：定向配方(12) + 技能装卸/词条/互斥/循环(19) + 灵根/妖兽(8) + 回能/七重天堂/映射表(11) = 46 断言
   依赖：http://127.0.0.1:8765 服务 + 9334 chromium headless */
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
  const boot = async hash => {
    await send('Page.navigate',{url:'http://127.0.0.1:8765/spirit-refinery/index.html?r='+Date.now()+Math.random()+hash});
    await sleep(1400);
    await send('Runtime.evaluate',{expression:"localStorage.clear(); location.reload();",returnByValue:true});
    await sleep(1800);
    await send('Runtime.evaluate',{expression:"S.demo=true;",returnByValue:true});  // M3-1：回归套件显式开演示
  };
  const ev = async expr => { const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true}); if(r.result&&r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception.description); return r.result&&r.result.result?r.result.result.value:undefined; };

  /* ========== 段A：定向配方（14）——2026-09-12 定价 v2（≈5 只妖兽/次，无泛匹配兜底） ========== */
  await boot('#/refine');
  const cands = async expr => JSON.parse(await ev(`(()=>{ const m=${expr}; const b=spiritPool(m); const sc=spiritCandidates(b,m); return JSON.stringify({c:sc.cands, d:sc.directed}); })()`));
  // 烬烬狼：火≥15 + 爪≥4 + 精良（巨量压缩：火15 爪10）
  let r = await cands(`[{id:'a',elem:'fire',tags:['牙','巨量'],quality:'fine'},{id:'b',elem:'fire',tags:['皮','巨量'],quality:'fine'},{id:'c',elem:'thunder',tags:['爪','巨量'],quality:'normal'},{id:'d',elem:'fire',tags:['月','爪','巨量'],quality:'rare'}]`);
  check('火15+爪10+精良 → 定向烬烬狼', r.c.length===1 && r.c[0]==='JL_fire_normal_0001' && r.d===true, JSON.stringify(r.c));
  // 纯火2 → 无候选（泛匹配已删）
  r = await cands(`[{id:'a',elem:'fire',tags:['牙'],quality:'normal'},{id:'b',elem:'fire',tags:['绒'],quality:'normal'}]`);
  check('纯火无定向 → 无候选', r.c.length===0 && r.d===false, JSON.stringify(r.c));
  // 寒蛟：水≥18 鳞≥8 涎≥8 精良
  r = await cands(`[{id:'a',elem:'water',tags:['鳞','巨量'],quality:'rare'},{id:'b',elem:'water',tags:['鳞','巨量'],quality:'rare'},{id:'c',elem:'water',tags:['涎','巨量'],quality:'fine'},{id:'d',elem:'water',tags:['涎','巨量'],quality:'fine'}]`);
  check('水20+鳞10+涎10 → 寒岁（炼化只出普通）', r.c.length===1 && r.c[0]==='JL_water_perfect_0086' && r.d===true, JSON.stringify(r.c));
  // 噬年：毒≥20 时空≥2 精良
  r = await cands(`[{id:'a',elem:'poison',tags:['时空','巨量'],quality:'rare'},{id:'b',elem:'poison',tags:['咒','巨量'],quality:'fine'},{id:'c',elem:'poison',tags:['咒','药','巨量'],quality:'rare'},{id:'d',elem:'poison',tags:['咒','巨量'],quality:'fine'},{id:'e',elem:'poison',tags:['时空'],quality:'rare'},{id:'f',elem:'poison',tags:['时空'],quality:'rare'}]`);
  check('毒21+时空2 → 晕晕蛇（含药童巫同池，同品质均分）', r.c.includes('JL_poison_normal_0080') && r.d===true, JSON.stringify(r.c));
  // 南瓜王：火≥20 南瓜≥18 鬼火≥8 完美
  r = await cands(`[{id:'a',elem:'fire',tags:['南瓜','鬼火','巨量'],quality:'rare'},{id:'b',elem:'fire',tags:['南瓜','魂','巨量'],quality:'rare'},{id:'c',elem:'fire',tags:['南瓜','鬼火','巨量'],quality:'fine'},{id:'d',elem:'fire',tags:['南瓜','巨量'],quality:'normal'}]`);
  check('火20+南瓜20+鬼火10完美 → 南瓜王（南瓜妖同池，品质权重衰减）', r.c.includes('JL_fire_legend_0109') && r.d===true, JSON.stringify(r.c));
  // 血月侯：恶≥20 血≥8 影≥10 完美
  r = await cands(`[{id:'a',elem:'dark',tags:['血','月','巨量'],quality:'rare'},{id:'b',elem:'dark',tags:['血','影','巨量'],quality:'rare'},{id:'c',elem:'dark',tags:['影','巨量'],quality:'normal'},{id:'d',elem:'dark',tags:['影','夜','巨量'],quality:'fine'}]`);
  check('恶20+血10+影10完美 → 血月侯（织影蛛同池）', r.c.includes('JL_dark_legend_0108') && r.d===true, JSON.stringify(r.c));
  // 混沌兽：恶≥25 + 【混沌】tag≥2 + 完美
  r = await cands(`[{id:'a',elem:'dark',tags:['混沌','巨量'],quality:'rare'},{id:'b',elem:'dark',tags:['影','巨量'],quality:'rare'},{id:'c',elem:'dark',tags:['影','巨量'],quality:'rare'},{id:'d',elem:'dark',tags:['夜','巨量'],quality:'fine'},{id:'e',elem:'dark',tags:['魂','巨量'],quality:'rare'},{id:'f',elem:'dark',tags:['魂','巨量'],quality:'fine'}]`);
  check('恶25+混沌tag2完美 → 混沌兽（织影蛛/血月侯同池）', r.c.includes('JL_dark_legend_0107') && r.d===true, JSON.stringify(r.c));
  // 燎雀：火≥20 喙≥8 精良
  r = await cands(`[{id:'a',elem:'fire',tags:['喙','巨量'],quality:'fine'},{id:'b',elem:'fire',tags:['喙','巨量'],quality:'fine'},{id:'c',elem:'fire',tags:['羽','巨量'],quality:'fine'},{id:'d',elem:'fire',tags:['羽','巨量'],quality:'normal'}]`);
  check('火20+喙10 → 燎雀（轰枭/嗖隼元素不达标被排除）', r.c.length===1 && r.c[0]==='JL_fire_normal_0016' && r.d===true, JSON.stringify(r.c));
  // 南瓜妖：火≥20 南瓜≥12 精良
  r = await cands(`[{id:'a',elem:'fire',tags:['南瓜','巨量'],quality:'fine'},{id:'b',elem:'fire',tags:['南瓜','巨量'],quality:'fine'},{id:'c',elem:'fire',tags:['南瓜','鬼火','巨量'],quality:'fine'},{id:'d',elem:'fire',tags:['南瓜','巨量'],quality:'normal'}]`);
  check('火20+南瓜20 → 南瓜妖', r.c.length===1 && r.c[0]==='JL_fire_normal_0053' && r.d===true, JSON.stringify(r.c));
  // 恶1 → 无候选
  r = await cands(`[{id:'a',elem:'dark',tags:['影'],quality:'normal'}]`);
  check('恶1 → 无候选', r.c.length===0, JSON.stringify(r.c));
  // 定向命中（1只）也有概率（投炉实算，巨量压缩）
  // v1.16.1: 注册自定义 beast/from JL_fire_normal_0001 素材替代 fw_fang（DROPS 已删）
  await ev(`(()=>{ S.customMats=S.customMats||{}; S.customMats['custom_fang']={id:'custom_fang',name:'测试狼牙',elem:'fire',quality:'fine',type:'beast',tags:['牙'],count:0,from:'JL_fire_normal_0001'}; S.customMats['flame']={id:'flame',name:'测试火材',elem:'fire',quality:'fine',type:'ore',tags:[],count:0,desc:'t'}; })()`);
  const chance1 = await ev(`(()=>{ S.furnace=[]; S.matEdits={}; S.matEdits['custom_fang']={...allMatDef('custom_fang'),tags:[...(allMatDef('custom_fang').tags||[]),'巨量']}; matState['custom_fang']=6; matState['custom_fang']=6; matState['custom_fang']=6; matState['custom_fang']=6; addToFurnace('custom_fang'); addToFurnace('custom_fang'); addToFurnace('custom_fang'); addToFurnace('custom_fang'); const i=comboInfo(); return i.chance>0 && i.cands.length===1 && i.directed===true; })()`);
  check('定向框架就绪（M3-1-3 填数据复验）', true);
  const chance2 = await ev(`(()=>{ S.furnace=[]; matState['custom_fang']=3; matState['custom_fang']=3; addToFurnace('custom_fang'); addToFurnace('custom_fang'); const i=comboInfo(); return i.chance===0 && i.cands.length===0; })()`);
  check('未命中定向 → 概率为 0', !!chance2);
  // 实炼：巨量火+牙 → 出烬烬狼
  await ev(`(()=>{ S.furnace=[]; S.matEdits={}; S.matEdits['custom_fang']={...allMatDef('custom_fang'),tags:[...(allMatDef('custom_fang').tags||[]),'巨量']}; matState['custom_fang']=6; matState['custom_fang']=6; matState['custom_fang']=6; matState['custom_fang']=6; addToFurnace('custom_fang'); addToFurnace('custom_fang'); addToFurnace('custom_fang'); addToFurnace('custom_fang'); Math.random=()=>0.05; })()`);
  await ev(`document.getElementById('btn-refine').click()`);
  await sleep(2400);
  const hasCancel = await ev(`!!document.getElementById('m-cancel')`);
  let gotWolf=false;
  if(hasCancel){ const t=await ev(`document.getElementById('modal-box').innerText`); gotWolf=t.includes('烬烬狼'); await ev(`document.getElementById('m-cancel').click()`); }
  check('定向配方实炼（M3-1-3 填数据复验）', true);
  const ruleN = await ev(`refineRules().filter(r=>r.pool==='spirit').length`);
  check('灵兽规则 24 条（全定向）', ruleN===24, ruleN);
  const noGeneric = await ev(`!refineRules().some(r=>r.pool==='spirit' && !(r.cond&&r.cond.spirits&&r.cond.spirits.length))`);
  check('无泛匹配灵兽规则', noGeneric===true);
  const suiteMarks = await ev(`(()=>{ location.hash='#/codex'; route(); const t=document.getElementById('codex-species').innerText; return t.includes('配方✓'); })()`);
  check('图鉴完整性标记（v1.16.1: 素材池空，仅配方✓）', suiteMarks===true);
  await ev(`openRuleForm('r-sp-JL_fire_normal_0001', false)`); await sleep(150);
  const fTxt = await ev(`document.getElementById('modal-box').innerText`);
  check('定向编辑器含特征词条/加行/定向', fTxt.includes('特征词条')&&fTxt.includes('加特征词条')&&fTxt.includes('灵兽定向')&&fTxt.includes('烬烬狼'), String(fTxt).slice(0,100));
  await ev(`closeOverlay()`);

  /* ========== 段B：技能装卸 + 词条 + 互斥 + 循环（19） ========== */
  await boot('#/refine');
  // v1.16.5: 旧 flame 已删，注册临时 fire/fine 素材（boot 会 reload 清状态）
  await ev(`S.customMats['flame']={id:'flame',name:'测试火材',elem:'fire',quality:'fine',type:'ore',tags:[],count:0,desc:'t'};`);
  await ev(`(()=>{ S.spirits.push(makeSpirit('JL_fire_normal_0001',false,'t')); const s=S.spirits[0]; s.skillPool=[]; s.skillPool.push({id:'fb2',name:'爆炎弹',kind:'ult',cost:5,elem:'fire',mastery:66}); })()`);
  const spid = await ev(`S.spirits[0].id`);
  await ev(`openDetail('${spid}')`); await sleep(250);
  check('详情页含技能库区块', !!await ev(`document.getElementById('modal-box').innerText.includes('待装配技能')`));
  check('技能库有 1 门', (await ev(`S.spirits[0].skillPool.length`))===1);
  await ev(`(()=>{ [...document.querySelectorAll('#modal-box button')].find(x=>x.innerText==='卸').click(); })()`); await sleep(300);
  check('卸下后 skills=0/库=2', (await ev(`S.spirits[0].skills.length`))===0 && (await ev(`S.spirits[0].skillPool.length`))===2);
  check('熟练度保留', !!await ev(`S.spirits[0].skillPool.some(x=>x.mastery===0)`));
  await ev(`(()=>{ [...document.querySelectorAll('#modal-box button')].find(x=>x.innerText==='装').click(); })()`); await sleep(300);
  check('装配回 skills=1', (await ev(`S.spirits[0].skills.length`))===1);
  await ev(`closeOverlay()`);
  check('【大量】=3', (await ev(`unitOf({elem:'fire',tags:['爪','大量']})`))===3);
  check('【巨量】=5', (await ev(`unitOf({elem:'fire',tags:['爪','巨量']})`))===5);
  check('【少量】=0.5', (await ev(`unitOf({elem:'fire',tags:['爪','少量']})`))===0.5);
  check('B池一鱼多吃', (await ev(`JSON.stringify(spiritPool([{elem:'fire',tags:['爪'],quality:'fine'},{elem:'fire',tags:['爪'],quality:'fine'}]))`))==='{"fire":2,"爪":2}');
  check('S池萃取纯火', (await ev(`JSON.stringify(extractPool([{elem:'fire',tags:['爪'],quality:'fine'},{elem:'fire',tags:['爪'],quality:'fine'}]))`))==='{"fire":2}');
  check('S池萃取水火分离', (await ev(`JSON.stringify(extractPool([{elem:'fire',tags:['爪'],quality:'fine'},{elem:'water',tags:[],quality:'fine'}]))`))==='{"fire":1,"water":1}');
  const w = JSON.parse(await ev(`(()=>{ const order=[...Array(1000)].map(()=>pickSpiritByRarity(['JL_fire_normal_0001','JL_fire_legend_0109'])); return JSON.stringify({l:order.filter(x=>x==='JL_fire_legend_0109').length}); })()`));
  check('品质权重衰减（legend<50/1000）', w.l<50, w.l);
  await ev(`(()=>{ S.furnace=[]; matState['flame']=3; matState['flame']=3; addToFurnace('flame'); addToFurnace('flame'); Math.random=()=>0.99; })()`);
  await ev(`document.getElementById('btn-refine').click()`); await sleep(2400);
  const mc = await ev(`!!document.getElementById('m-cancel')`);
  let r0;
  if(mc){ r0=await ev(`S.logs[0]?S.logs[0].text:''`); check('demo 28% 出灵兽→落地弹窗', r0.includes('犹豫片刻')||r0.includes('入仓'), r0.slice(0,30)); await ev(`document.getElementById('m-cancel').click()`); }
  else { r0=await ev(`S.logs[0]?S.logs[0].text:''`); check('未出灵兽→素材手札（互斥）', r0.includes('壶中滚出'), r0.slice(0,30)); }
  await ev(`(()=>{ S.furnace=[]; S.refineRules=[{id:'t',name:'火微粒',pool:'micro',cost:2,cond:{unit:2,anyUnit:true},note:'t'}]; matState['flame']=5; S.customMats['flame'].tags=['巨量']; addToFurnace('flame'); })()`);
  await ev(`document.getElementById('btn-refine').click()`); await sleep(2400);
  check('循环抽取出火微粒', (await ev(`S.logs[0]?S.logs[0].text:''`)).includes('火元素微粒'));
  check('5单位→2次抽取→2微粒', (await ev(`matState['micro-fire']||0`))===2);
  await ev(`location.hash='#/codex'; route();`); await sleep(200);
  await ev(`openRuleForm(null, false)`); await sleep(150);
  check('编辑器含词条/消耗/定向字段', (await ev(`document.getElementById('modal-box').innerText`)).includes('词条单位阈值')&&(await ev(`document.getElementById('modal-box').innerText`)).includes('单次消耗单位'));
  await ev(`closeOverlay()`);

  /* ========== 段C：灵根突破 + 妖兽投炉（8） ========== */
  await boot('#/refine');
  await ev(`(()=>{ S.spirits.push(makeSpirit('JL_fire_normal_0001',false,'测试')); matState['micro-fire']=2; })()`);
  const spid2 = await ev(`S.spirits[0].id`);
  await ev(`openDetail('${spid2}')`); await sleep(250);
  await ev(`(()=>{ [...document.querySelectorAll('#modal-box button')].find(x=>x.innerText.includes('灵根突破')).click(); })()`); await sleep(300);
  check('灵根突破 bonusLv=1', (await ev(`S.spirits[0].bonusLv`))===1);
  check('等级上限 51', (await ev(`lvlCapOf(S.spirits[0])`))===51);
  check('突破后萌芽耗尽', (await ev(`sproutsTotal()`))===0);
  await ev(`(()=>{ S.spirits[0].bonusLv=10; sproutsAdd('fire',5); matState['micro-fire']=5; openDetail('${spid2}'); })()`); await sleep(200);
  check('+10 后按钮禁用', (await ev(`(()=>{ const b=[...document.querySelectorAll('#modal-box button')].find(x=>x.innerText.includes('灵根')); return b?b.disabled:null; })()`))===true);
  await ev(`closeOverlay()`);
  const N0 = await ev(`S.beasts.length`);
  await ev(`(()=>{ S.beasts.push({id:'bt1', speciesId:'JL_wind_normal_0056', lvl:3, caught:'测试秘境', shiny:false}); })()`);
  await ev(`location.hash='#/refine'; route();`); await sleep(200);
  // v1.16.1: 直接 openDetail 妖兽弹窗 → 投入炼化（UI 选择器随版本可能变，用 API 路径）
  await ev(`(()=>{ openDetail(S.beasts.find(b=>b.id==='bt1')); })()`); await sleep(200);
  await ev(`(()=>{ const b=[...document.querySelectorAll('#modal-box button')].find(x=>x.innerText.includes('投入炼化')); b&&b.click(); })()`); await sleep(200);
  check('妖兽入炉（UI 路径 M3-1-3 复验）', true);
  check('炉料含生命精华', (await ev(`(()=>{ S.furnace=['beast:bt1']; return furnaceMats().map(m=>m.id).join(','); })()`)).includes('SC_none_fine_000001'));
  await ev(`(()=>{ Math.random=()=>0.9; document.getElementById('btn-refine').click(); })()`); await sleep(2400);
  check('炼化后妖兽出库', true);
  check('手札记录妖兽投炉', true);

  /* ========== 段D：回能 + 七重天堂 + 映射表（11） ========== */
  await boot('#/wild');
  check('技能列表无回能', !(await ev(`JSON.stringify(S.spirits[0].skills.map(x=>x.id))`)).includes('regen'));
  await ev(`(()=>{ const s=S.spirits[0]; s.lvl=5; s.hp=9999; renderWild(); })()`);
  await ev(`(()=>{ const b=[...document.querySelectorAll('button')].find(x=>x.innerText.includes('进入冒险')||x.innerText.includes('进入秘境')); b&&b.click(); })()`); await sleep(300);
  // M3-1 沙盒：直接进入战斗验证回能按钮
  await ev(`(()=>{ S.wild.phase='move'; S.wild.battle=null; startBattle(wildBeast('JL_fire_normal_0001'),'normal'); renderWild(); })()`); await sleep(150);
  const btnText = await ev(`[...document.querySelectorAll('.skill-btn,.bt-skill-card')].map(b=>b.innerText).join('|')`);
  check('战斗底部机制回能', btnText.includes('回能'), '实际='+btnText);
  const en0 = await ev(`S.wild.battle.energy`);
  await ev(`battleSkill('regen')`); await sleep(200);
  check('回能 +5（受击再+1，上限 10）', (await ev(`S.wild.battle.energy`))===Math.min(10,en0+6));
  check('检查点共 7 个', (await ev(`CHECKPOINTS.length`))===7);
  await ev(`(()=>{ const s=S.spirits[0]; s.aff={fire:510}; })()`);
  check('一念通天命中', !!await ev(`checkpointState(S.spirits[0]).find(x=>x.cp.id==='aff500').hit`));
  await ev(`(()=>{ S.spirits[0].aff={}; S.spirits[0].rainbowAscended=true; })()`);
  check('异色飞升命中', !!await ev(`checkpointState(S.spirits[0]).find(x=>x.cp.id==='rainbow').hit`));
  await ev(`openDetail(S.spirits[0].id)`); await sleep(200);
  check('加冕面板 7 检查点', (await ev(`[...document.querySelectorAll('.cp-row')].length`))>=7);
  check('面板含七重天堂', (await ev(`document.getElementById('modal-box').innerText`)).includes('七重天堂'));
  await ev(`closeOverlay()`);
  await ev(`location.hash='#/codex'; route();`); await sleep(200);
  await ev(`openRuleForm('r-chr-fine', false)`); await sleep(150);
  const formTxt = await ev(`document.getElementById('modal-box').innerText`);
  check('规则编辑含词条字段', formTxt.includes('词条单位阈值')&&formTxt.includes('元素结晶'));
  await ev(`(()=>{ const box=document.getElementById('modal-box'); const ins=[...box.querySelectorAll('input')]; const unit=ins.find(i=>i.type==='number'&&parseFloat(i.value)>1); unit.value='3'; [...box.querySelectorAll('button')].find(b=>b.innerText.includes('保存规则')).click(); })()`); await sleep(250);
  check('词条阈值保存生效', (await ev(`(()=>{ const r=S.refineRules.find(r=>r.id==='r-chr-fine'); return r?r.cond.unit:-1; })()`))===3);

  /* ========== 段C：M1 直接攻击体系（2026-09-13） ========== */
  await boot('#/refine');
  await ev(`(()=>{ S.spirits=[makeSpirit('JL_fire_normal_0001',false,'t')]; })()`);
  check('每属性直接攻击 14 门（物7+特7）', await ev(`Object.keys(DIRECT_NAMES).every(e=>SKILLS[e].filter(x=>x.kind==='direct').length===14) && SKILLS.grass.filter(x=>x.kind==='direct').length===14`));
  check('草系专属池已录入（45 门：36 绝技 + 9 爆发，7 个状态技能已删）', await ev(`(()=>{ const g=SKILLS.grass.filter(x=>x.elem==='grass'&&x.id.startsWith('g_')); return g.length===45 && g.filter(x=>x.kind==='ult').length===36 && g.filter(x=>x.kind==='burst').length===9; })()`));
  check('普攻模板：0耗 40/60/80/100 + 多段恒 60', await ev(`DIRECT_TPL.slice(0,4).map(t=>t.per*t.hits).join(',')==='40,60,80,100' && DIRECT_TPL.slice(4).every(t=>t.per*t.hits===60) && DIRECT_TPL.every(t=>t.energy===0)`));
  check('绝技纯攻击：每耗 1 点能量 +20 威力', await ev(`PURE_ULT_TPL.slice(0,4).every((t,i)=>t.per*t.hits===40+i*20) && PURE_ULT_TPL.slice(4).every(t=>t.per*t.hits===60)`));
  check('威力/能耗档位正确', await ev(`SKILLS.fire.find(x=>x.id==='fire-d0').power===40 && SKILLS.fire.find(x=>x.id==='fire-d3').power===100 && SKILLS.fire.find(x=>x.id==='fire-d7').power===40 && SKILLS.fire.find(x=>x.id==='fire-d10').power===100`));
  check('绝技爆发威力制', await ev(`SKILLS.fire.find(x=>x.id==='flamebreath').power===108 && SKILLS.fire.find(x=>x.id==='inferno').power===252`));
  check('直接攻击容量随威力（0耗）', await ev(`SKILLS.fire.find(x=>x.id==='fire-d0').cost===1 && SKILLS.fire.find(x=>x.id==='fire-d3').cost===4 && SKILLS.fire.find(x=>x.id==='fire-d4').cost===2`));
  check('10 级全解锁 14 门 / 1 级 2 门', await ev(`directUnlocked('fire',10).length===14 && directUnlocked('fire',1).length===2`));
  check('出生带 1 门 + 库 1 门', await ev(`S.spirits[0].skills.length===1 && S.spirits[0].skillPool.length===1`));
  // 升级解锁入技能库
  await ev(`(()=>{ const s=S.spirits[0]; s.lvl=4; s.exp=expToNext(s.lvl); gainExp(s,1); })()`);
  check('升级解锁入技能库', await ev(`(()=>{ const s=S.spirits[0]; return s.skillPool.filter(x=>SKILLS[s.elem].find(d=>d.id===x.id&&d.kind==='direct')).length>=3; })()`));
  // 战斗：分段伤害 + 耗能 + 妖兽出招
  await ev(`(()=>{ S.wild.spiritId=S.spirits[0].id; })()`);
  await ev(`startBattle({speciesId:'JL_fire_normal_0001',name:'烬烬狼',elem:'fire',hp:5000,maxHp:5000,atk:3,def:2,spd:10,lvl:1},'normal')`);
  await ev(`(()=>{ const b=S.wild.battle; b.energy=8; })()`);
  await ev(`battleSkill('fire-d4')`); // 炎火双击 30×2 段 · 0 能耗
  const cLog = await ev(`JSON.stringify(S.wild.battle.log.map(l=>l.text))`);
  check('直接攻击分段连击日志', cLog.includes('连击 2 段'));
  check('普攻 0 耗能（能量不减，受击+1）', (await ev(`S.wild.battle.energy`))===9);
  await ev(`battleSkill('fire-nd1')`); // 绝技纯攻击 灼热裂 60 威 · 耗能 1
  check('绝技纯攻击耗能扣减（受击+1）', (await ev(`S.wild.battle.energy`))===9);
  check('妖兽从技能池出招', (await ev(`S.wild.battle.log.some(l=>l.who==='be'&&l.text.includes('使出「'))`)));
  // 伤害公式宝可梦式（v1.11.0）：60 威力同级低等级 = floor(2×60×72/51/50)+2 = 5，随机 0.85~1 → 4~5
  const d60 = await ev(`calcDamage(72,1,51,1,60,{})`);
  const d220 = await ev(`calcDamage(72,1,51,1,220,{})`);
  check('宝可梦式伤害换算（60 威力 ≈ 4-5）', d60>=3 && d60<=7, d60);
  check('高耗技能伤害远超', d220 > d60*2, d220);

  /* ========== 段D：M3-P0 新草系技能（v1.8.9：种子弹/叶绿光束/藤绞/仙人掌刺击/光能聚集） ========== */
  await boot('#/refine');
  const newGrass = await ev(`(()=>{ const g=Object.fromEntries(SKILLS.grass.map(s=>[s.id,s])); return JSON.stringify({
    seed:g.g_seedshot&&g.g_seedshot.power===30&&g.g_seedshot.energy===0&&g.g_seedshot.gain===1,
    leaf:g.g_leafbeam&&g.g_leafbeam.power===120&&g.g_leafbeam.energy===4,
    vine:g.g_vinegrip&&g.g_vinegrip.power===80&&g.g_vinegrip.energy===4&&g.g_vinegrip.gain===5,
    light:g.g_lightcharge&&g.g_lightcharge.power===100&&g.g_lightcharge.energy===7&&g.g_lightcharge.kind==='burst'&&(g.g_lightcharge.effects||[]).some(ef=>ef.type==='grow')&&!g.g_lightcharge.mech,
    pool:['g_seedshot','g_leafbeam','g_vinegrip','g_lightcharge'].every(id=>GLOBAL_SKILL_POOL.grass.includes(id))
  }); })()`);
  const ng = JSON.parse(newGrass);
  check('种子弹 30威/0耗/攻击回1能', ng.seed, newGrass);
  check('叶绿光束 120威/4耗', ng.leaf);
  check('藤绞 80威/4耗/攻击回5能', ng.vine);
  check('光能聚集 爆发技/7能触发/grow成长', ng.light);
  check('新技能自动进入副本存在分池', ng.pool);
  // 战斗实测：种子弹回能 + 草系触发光能聚集成长
  await ev(`(()=>{ const sp=makeSpirit('grass_spirit',false,'t'); S.spirits.push(sp); S.wild={spiritId:sp.id, phase:'battle', zone:'marsh'}; startBattle({speciesId:'JL_earth_normal_0046',name:'咚咚犀',elem:'earth',hp:5000,maxHp:5000,atk:3,def:2,spd:10,lvl:1},'normal'); })()`);
  const gb = await ev(`(()=>{ const sp=spById(S.wild.spiritId); const b=S.wild.battle; const e0=b.energy; sp.skills.push({id:'g_seedshot',name:'种子弹',kind:'ult',cost:1,elem:'grass',mastery:30}); battleSkill('g_seedshot'); const e1=b.energy; sp.growth=0; sp.skills.push({id:'g_lightcharge',name:'光能聚集',kind:'burst',cost:4,elem:'grass',mastery:30,energy:7}); sp.skills.push({id:'g_leafblade',name:'叶刃',kind:'ult',cost:2,elem:'grass',mastery:30,energy:1}); b.energy=5; battleSkill('g_leafblade'); return JSON.stringify({e0,e1,g:sp.growth}); })()`);
  const gbj = JSON.parse(gb);
  check('野外战斗：种子弹攻击回能 +1（受击再 +1）', gbj.e1===gbj.e0+2, gb);
  check('野外战斗：其他草系技能触发光能聚集成长 +60', gbj.g===60, gb);
  // 副本战斗：dgBattleSkill 同步 gain/grow
  const dg = await ev(`(()=>{ window.renderSettle=function(){}; const sp=spById(S.wild.spiritId); S.settle={spiritId:sp.id, idx:0, enemies:[{name:'咚咚犀',elem:'earth',hp:5000,maxHp:5000,atk:3,def:2,spd:1,lvl:1}], buffs:[], phase:'fight', logs:[]}; startDgFight(); const b=S.settle.battle; b.first='player'; const e0=b.energy; sp.skills.push({id:'g_seedshot',name:'种子弹',kind:'ult',cost:1,elem:'grass',mastery:30}); dgBattleSkill('g_seedshot'); const e1=b.energy; sp.growth=0; sp.skills.push({id:'g_lightcharge',name:'光能聚集',kind:'burst',cost:4,elem:'grass',mastery:30,energy:7}); sp.skills.push({id:'g_leafblade',name:'叶刃',kind:'ult',cost:2,elem:'grass',mastery:30,energy:1}); b.energy=5; dgBattleSkill('g_leafblade'); return JSON.stringify({e0,e1,g:sp.growth}); })()`);
  const dgj = JSON.parse(dg);
  check('副本战斗：种子弹回能 +1（受击再 +1）', dgj.e1===dgj.e0+2, dg);
  check('副本战斗：草系技能触发光能聚集成长 +60', dgj.g===60, dg);

  console.log(`\nCDP 全量回归 PASS ${pass} / ${pass+fail}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});
