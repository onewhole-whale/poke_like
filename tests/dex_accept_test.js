// v1.13.0 图鉴收集进度 — CDP 验收脚本（只读校验 + 领奖流程模拟）
const { execSync } = require('child_process');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let pass=0, fail=0;
const ok=(name,cond,info)=>{ if(cond){pass++;console.log('  ok - '+name);} else {fail++;console.log('FAIL - '+name+(info?'  ['+info+']':''));} };

async function main(){
  const list = JSON.parse(execSync('curl -s http://127.0.0.1:9334/json').toString());
  const page = list.find(p=>p.type==='page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pending={};
  ws.onmessage = ev=>{ const m=JSON.parse(ev.data); if(m.id&&pending[m.id]){pending[m.id](m);delete pending[m.id];} };
  const send=(method,params={})=>new Promise(res=>{const i=++id;pending[i]=res;ws.send(JSON.stringify({id:i,method,params}));});
  const evl=async(expr)=>{ const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true,awaitPromise:true}); 
    if(r.result&&r.result.exceptionDetails) return {__err:r.result.exceptionDetails.text};
    return r.result&&r.result.result?r.result.result.value:undefined; };
  await new Promise(r=>ws.onopen=r);
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:8765/spirit-refinery/index.html?r='+Date.now()});
  await sleep(2500);
  // v1.16.5: 旧 flame 已删，注册临时 fire/fine 素材供 mat 进化条件测试
  await evl(`S.customMats['flame']={id:'flame',name:'测试火材',elem:'fire',quality:'fine',type:'ore',tags:[],count:0,desc:'t'};`);

  console.log('A. 导航与路由');
  const nav = await evl(`Array.from(document.querySelectorAll('nav button')).map(b=>b.textContent.trim()+'|'+b.dataset.route).join(',')`);
  ok('导航含「图鉴」(dex) 与「图鉴编辑」(codex)', /图鉴\|dex/.test(nav) && /图鉴编辑\|codex/.test(nav), nav);
  await evl(`location.hash='#/dex'`); await sleep(400);
  const dexView = await evl(`!!document.querySelector('#view-dex') && document.querySelector('#view-dex').style.display!=='none'`);
  ok('#/dex 路由正常渲染 view-dex', dexView===true);

  console.log('B. 初始收集状态与进度条');
  const init = await evl(`(function(){
    const seen = Object.keys(S.dexSeen).sort();
    const prog = dexProgress();
    const total = dexSpeciesList().length;
    const spec = Object.keys(SPECIES).length;
    const dg = Object.keys(DUNGEON_SPECIALS).length;
    const barW = document.querySelector('.dp-bar i')? document.querySelector('.dp-bar i').style.width : null;
    const headTxt = document.querySelector('#dex-root .card h3')? document.querySelector('#dex-root .card h3').textContent : null;
    return {seen, prog, total, spec, dg, barW, headTxt};
  })()`);
  ok('初始点亮 4 只（烬烬狼/水狐/轰枭/燎雀）', init.seen.length===4 && ['JL_fire_normal_0016','JL_fire_normal_0001','JL_thunder_normal_0038','JL_water_normal_0023'].every(id=>init.seen.includes(id)), init.seen.join(','));
  ok('收集分母=SPECIES 数（66），不含副本专供', init.total===init.spec && init.total===109, 'total='+init.total+' spec='+init.spec);
  ok('DUNGEON_SPECIALS 13 只在独立数组', init.dg===13, 'dg='+init.dg);
  ok('进度条宽度=4/109', Math.abs(parseFloat(init.barW)-4/109*100)<0.5, init.barW);
  ok('头部显示 X/109 与百分比', init.headTxt && /4\s*\/\s*109/.test(init.headTxt) && /3\.7%/.test(init.headTxt), init.headTxt);

  console.log('C. 卡片网格（未点亮???/编号/品级/元素点/异色✦）');
  const grid = await evl(`(function(){
    const cards = document.querySelectorAll('.dex-card');
    const unseen = document.querySelectorAll('.dex-card.unseen').length;
    const seenCards = document.querySelectorAll('.dex-card:not(.unseen)').length;
    const qmarks = document.querySelectorAll('.dx-qmark').length;
    const shiny = document.querySelectorAll('.dx-shiny').length;
    const shinyOnSeen = document.querySelectorAll('.dex-card.has-shiny .dx-shiny').length;
    const nos = Array.from(document.querySelectorAll('.dx-no')).map(e=>e.textContent);
    const grades = Array.from(document.querySelectorAll('.dx-grade')).map(e=>e.textContent);
    const firstCard = cards[0]? cards[0].innerHTML.slice(0,80) : '';
    return {n:cards.length, unseen, seenCards, qmarks, shiny, shinyOnSeen, nos, grades, firstCard};
  })()`);
  ok('网格卡片数=66（副本专供不计入）', grid.n===109, 'n='+grid.n);
  ok('未点亮格数=105、已点亮=4', grid.unseen===105 && grid.seenCards===4, grid.unseen+'/'+grid.seenCards);
  ok('未点亮显示？？？', grid.qmarks===105, 'qmarks='+grid.qmarks);
  ok('异色✦仅标记 JL_fire_normal_0016 已点亮格', grid.shiny===1 && grid.shinyOnSeen===1, 'shiny='+grid.shiny);
  ok('编号集合=001..109 全部出现且唯一', (function(){const s=new Set(grid.nos);return s.size===109 && s.has('001')&&s.has('109');})(), grid.nos[0]+'..'+grid.nos[109-1]);
  ok('品级角标存在', /普通|精英|完美|传说/.test(grid.grades.join(',')), grid.grades.slice(0,5).join(','));

  console.log('D. 详情弹窗（已点亮 vs 未点亮）');
  const seenId = 'JL_fire_normal_0001', unseenId = (await evl(`(function(){const l=dexSpeciesList();return (l.find(x=>!S.dexSeen[x.id])||{}).id})()`));
  await evl(`openDexDetail('${seenId}')`); await sleep(200);
  const seenD = await evl(`(function(){
    const t=document.querySelector('#modal-box h2').textContent;
    const body=document.querySelector('#modal-box').innerHTML;
    return {t, hasStat:/种族值/.test(body), hasDrop:/掉落素材/.test(body), hasEvo:/进化链/.test(body), hasRef:/炼化配方/.test(body)};
  })()`);
  ok('已点亮详情：名称+传说/品级标签', seenD.t.includes('烬烬狼'), seenD.t);
  ok('已点亮详情：种族值/进化链齐全（v1.16.1 素材池空，掉落区留空待 M3-1-3）', seenD.hasStat&&seenD.hasEvo, JSON.stringify(seenD));
  await evl(`closeOverlay()`);
  await evl(`openDexDetail('${unseenId}')`); await sleep(200);
  const unseenD = await evl(`(function(){
    const t=document.querySelector('#modal-box h2').textContent;
    const body=document.querySelector('#modal-box').innerHTML;
    return {t, onlyTip:/尚未遇见此灵兽/.test(body)&&!/种族值/.test(body)};
  })()`);
  ok('未点亮详情：只提示不显示数值', unseenD.t.includes('？？？') && unseenD.onlyTip===true, unseenD.t);
  await evl(`closeOverlay()`);

  console.log('E. 收集埋点（makeBeast/landSpirit/evolveSpirit/幂等）');
  const mk = await evl(`(function(){
    // 未点亮物种里避开进化目标 JL_fire_elite_0002，避免计数撞车
    const cands = dexSpeciesList().filter(x=>!S.dexSeen[x.id] && x.id!=='JL_fire_elite_0002');
    const unlit = cands[0], unlit2 = cands[1];
    const before = Object.keys(S.dexSeen).length;
    makeBeast(unlit.id, false, '测试');           // 新物种 → 点亮
    const after1 = Object.keys(S.dexSeen).length;
    makeBeast(unlit.id, false, '测试');           // 重复 → 幂等
    const after2 = Object.keys(S.dexSeen).length;
    const landBefore = Object.keys(S.dexSeen).length;
    landSpirit({speciesId:unlit2.id, shiny:false, source:'测试'});  // 灵兽入仓 → 点亮
    const landAfter = Object.keys(S.dexSeen).length;
    return {before, after1, after2, landBefore, landAfter, unlit:unlit.id, unlit2:unlit2.id};
  })()`);
  ok('makeBeast 新物种点亮（+1）', mk.after1===mk.before+1, mk.before+'→'+mk.after1+' ('+mk.unlit+')');
  ok('makeBeast 重复捕获幂等不报错', mk.after2===mk.after1, mk.after2);
  ok('landSpirit 灵兽入仓点亮（+1）', mk.landAfter===mk.landBefore+1, mk.landBefore+'→'+mk.landAfter+' ('+mk.unlit2+')');
  const evo = await evl(`(function(){
    const sp = makeSpirit('JL_fire_normal_0001', false, '测试'); sp.lvl=30; sp.aff={fire:60};
    matState['flame']=20;
    const before = Object.keys(S.dexSeen).length;
    const r = evolveSpirit(sp, 'JL_fire_elite_0002');
    return {before, after:Object.keys(S.dexSeen).length, to: r&&r.targetSp? r.targetSp.id : null, seen: S.dexSeen['JL_fire_elite_0002']};
  })()`);
  ok('evolveSpirit 进化点亮新形态', evo.to==='JL_fire_elite_0002' && evo.after===evo.before+1 && evo.seen===true, JSON.stringify(evo));
  const rel = await evl(`(function(){
    // 用户定稿口径1：点亮=曾拥有/曾捕获，放生/炼化不熄灭（会话内）
    const keep = S.dexSeen['JL_fire_elite_0002']===true;
    const n0 = S.spirits.length;
    S.spirits = []; S.beasts = [];   // 模拟放生/清空
    const still = S.dexSeen['JL_fire_elite_0002']===true && S.dexSeen['JL_fire_normal_0016']===true && S.dexSeen['JL_fire_normal_0001']===true;
    return {keep, still, n0};
  })()`);
  ok('放生/清空后 dexSeen 不熄灭（点亮=曾拥有）', rel.keep && rel.still, JSON.stringify(rel));

  console.log('F. 里程碑奖励（每10只洗髓露×1，防重，入库）');
  const ms = await evl(`(function(){
    const list = dexSpeciesList();
    list.forEach(sp=>{ if(!S.dexSeen[sp.id]) S.dexSeen[sp.id]=true; });   // 点亮全部
    const st = dexMilestones();
    const last = st[st.length-1];
    const st10 = dexMilestoneState(st[0]);
    const iv0 = S.ivElixir||0;
    const r = claimDexMilestone(st[0]);
    const iv1 = S.ivElixir||0;
    const r2 = claimDexMilestone(st[0]);   // 重复领取
    const iv2 = S.ivElixir||0;
    const claimed = (S.dexClaimed||[]).includes(st[0].id);
    return {n:st.length, first:st[0], last:last.id, lastN:last.threshold, st10, r, iv0, iv1, r2, iv2, claimed};
  })()`);
  ok('里程碑=每10只一档（109只→10档）', ms.n===10 && ms.first.threshold===10 && ms.lastN===100, 'n='+ms.n+' last='+ms.lastN);
  ok('奖励统一为洗髓露×1', ms.first.reward.type==='ivElixir' && ms.first.reward.qty===1, JSON.stringify(ms.first.reward));
  ok('满集后 ms_10 状态=可领取', ms.st10.met===true && ms.st10.claimed===false, JSON.stringify(ms.st10));
  ok('领取后洗髓露 +1', ms.iv1===ms.iv0+1, ms.iv0+'→'+ms.iv1);
  ok('重复点击无效（不重复加）', ms.r2===false && ms.iv2===ms.iv1, 'iv2='+ms.iv2);
  ok('领取记录写入 dexClaimed', ms.claimed===true);

  console.log('G. 存档兼容与刷新持久化（开发报告 §7.8）');
  // G1 旧存档兼容：写入 v1.12 时代格式草稿（无 dex 字段），刷新不报错、缺省为空
  await evl(`localStorage.setItem('refine-proto-codex', JSON.stringify({matEdits:{}, customMats:{}, speciesEdits:{}, customSpecies:{}, tagLib:[], essences:{}, refineRules:[]}))`);
  await send('Page.reload'); await sleep(2500);
  const legacy = await evl(`(function(){
    try{ return {ok:true, seen:Object.keys(S.dexSeen||{}).length, claimed:Array.isArray(S.dexClaimed)}; }
    catch(e){ return {ok:false, err:e.message}; }
  })()`);
  ok('旧存档（无 dexSeen/dexClaimed）读取不报错、缺省为空', legacy.ok===true && legacy.claimed===true && legacy.seen===4, JSON.stringify(legacy));
  // G2 持久化：点亮全部 + 领取 ms_10 + saveDraft → 刷新后 dexSeen/dexClaimed 保留、跨刷新防重
  await evl(`(function(){
    dexSpeciesList().forEach(sp=>{ S.dexSeen[sp.id]=true; });
    const st = dexMilestones(); claimDexMilestone(st[0]);
    saveDraft(); return true;
  })()`);
  await send('Page.reload'); await sleep(2500);
  const afterReload = await evl(`(function(){
    const seen = Object.keys(S.dexSeen).length;
    const claimed = (S.dexClaimed||[]).includes('ms_10');
    // 跨刷新防重：再次领取 ms_10 应被拒绝
    const st = dexMilestones(); const r = claimDexMilestone(st[0]);
    const iv = S.ivElixir||0;
    return {seen, claimed, dupRejected: r===false, iv};
  })()`);
  ok('刷新后 dexSeen 保留（曾拥有不熄灭）', afterReload.seen===109, 'seen='+afterReload.seen);
  ok('刷新后 dexClaimed 保留（已领取仍已领取）', afterReload.claimed===true, 'claimed='+afterReload.claimed);
  ok('跨刷新防重：重复领取被拒（不重复发奖）', afterReload.dupRejected===true && afterReload.iv===0, JSON.stringify(afterReload));

  console.log('\nv1.13.0 图鉴 CDP 验收 '+pass+' 项断言，失败 '+fail);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error('ERR',e.message);process.exit(1);});
