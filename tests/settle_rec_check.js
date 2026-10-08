/* M2-A6 一次性验证：构建（投素材）→ 出发 → 单挑连战 → 通关 → 副本记录 + 存在分抽取链路 */
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

  await send('Page.navigate',{url:'http://127.0.0.1:8765/spirit-refinery/index.html?t='+Date.now()+'#/build'});
  await sleep(2000);
  await ev(`localStorage.clear(); location.reload();`); await sleep(2000);

  // 出发：投入 1 单位自定义妖兽素材（beast/from JL_fire_normal_0001）→ 生成 1 只 Lv=我方等级的烬烬狼妖兽
  const setup = await ev(`(()=>{
    const sp = S.spirits[0]; if(!sp) return {err:'no spirit'};
    S.customMats = S.customMats||{};
    S.customMats['custom_fang'] = {id:'custom_fang', name:'测试狼牙', elem:'fire', quality:'fine', type:'beast', tags:['牙'], count:0, from:'JL_fire_normal_0001'};
    S.customMats['flame'] = {id:'flame', name:'测试火材', elem:'fire', quality:'fine', type:'ore', tags:[], count:0, desc:'t'};
    S.buildSpiritId = sp.id;
    matState['custom_fang'] = 6;
    S.buildMats = {custom_fang:5};
    S.aura = 5; S.stamina = 50; S.staminaAt = Date.now();
    const before = matState['custom_fang'];
    depart();
    if(!S.settle) return {err:'depart no settle'};
    const st = S.settle;
    return {sp:sp.speciesId, elem:sp.elem, enemyN:st.enemies.length,
      enemy: st.enemies[0] ? {name:st.enemies[0].name, lvl:st.enemies[0].lvl} : null,
      before, after:matState['custom_fang'], plan:Object.keys(st.plan).join(','),
      gainType:st.gainType};
  })()`);
  console.log('  setup:', JSON.stringify(setup));
  check('有灵兽且出发成功', !setup.err && setup.sp);
  check('5 单位妖兽素材 → 1 只妖兽敌人（5 换 1）', setup.enemyN===1, 'n='+setup.enemyN);
  check('敌人为烬烬狼妖兽且等级=我方等级', setup.enemy && setup.enemy.name==='烬烬狼' && setup.enemy.lvl===1, JSON.stringify(setup.enemy));
  check('构建素材出发时已消耗（custom_fang 库存 6→1）', setup.before===6 && setup.after===1, 'before='+setup.before+' after='+setup.after);
  check('收获偏好默认抽取', setup.gainType==='roll', setup.gainType);

  await ev(`location.hash='#/settle';`); await sleep(600);
  // 战斗视图渲染
  const view = await ev(`(()=>{ const r=document.querySelector('#settle-root');
    return JSON.stringify({txt:(r.textContent||'').slice(0,60), fight: S.settle.phase==='fight', btnN: r.querySelectorAll('button').length}); })()`);
  const v=JSON.parse(view);
  check('战斗视图渲染（战斗阶段）', v.fight && /对/.test(v.txt), view.slice(0,120));
  check('技能区渲染（含技能+回能按钮）', v.btnN>=2, 'btnN='+v.btnN);

  // 战斗：压低敌方攻击，用装配技能连打直到胜利
  const battle = await ev(`(()=>{
    const st = S.settle;
    const sp = spById(st.spiritId);
    st.battle.beast.atk = 1; st.battle.beast.spa = 1;
    let guard = 0;
    while(st.phase==='fight' && guard++ < 200){
      const sk = sp.skills[0];
      dgBattleSkill(sk ? sk.id : 'regen');
    }
    return {phase: st.phase, kills: st.kills, exp: st.exp, spHp: st.battle.spHp};
  })()`);
  console.log('  battle:', JSON.stringify(battle));
  check('战斗胜利（等待推进）', battle.phase==='won', JSON.stringify(battle));
  check('击杀尚未结算（推进时 +1）', battle.kills===0, 'kills='+battle.kills);
  check('我方仍有生命', battle.spHp>0, 'hp='+battle.spHp);

  // 点「通关结算」（M3-2 补丁：胜利按钮已改为结果弹框内）→ 通关结算
  const cont = await ev(`(()=>{ const b=[...document.querySelectorAll('#settle-root button, #modal-box button')].find(x=>x.textContent.includes('继续前进')||x.textContent.includes('通关结算')); if(!b) return 'no-btn'; b.click(); return 'ok'; })()`);
  check('通关按钮可点击', cont==='ok', cont);
  await sleep(1200);
  const expAfter = await ev(`S.settle.exp`);
  check('经验为 5 倍（基础 max(5,1×8)=8 → ×5=40）', expAfter===40, 'exp='+expAfter);
  const after = await ev(`(()=>{
    const st = S.settle;
    const rec = S.trainLogs[0];
    return JSON.stringify({
      phase: st.phase, won: st.won, rewards: (st.rewards||[]).map(r=>r.desc),
      logs: S.trainLogs.length,
      rec: rec ? {mats:rec.mats, words:rec.words, exp:rec.exp, aff:rec.aff, mastery:rec.mastery, src:rec.src} : null,
      src: (document.querySelector('#settle-root')||{}).textContent||''
    }); })()`);
  const a=JSON.parse(after);
  console.log('  结算后:', JSON.stringify(a).slice(0,320));
  check('副本通关', a.phase==='done' && a.won===true, a.phase);
  check('副本完成写入记录', a.logs>=1, 'logs='+a.logs);
  check('记录素材为构建投入 custom_fang×5', a.rec && a.rec.mats && a.rec.mats.custom_fang===5, JSON.stringify(a.rec&&a.rec.mats));
  check('记录收益 exp+mastery 齐全（未投 chr- 结晶无 aff）', a.rec && a.rec.exp>0 && !a.rec.aff && a.rec.mastery && a.rec.mastery.val>0, JSON.stringify(a.rec&&{exp:a.rec.exp,aff:a.rec.aff,mastery:a.rec.mastery}));
  check('记录来源标注通关', a.rec && /通关/.test(a.rec.src||''), a.rec&&a.rec.src);

  // 收获：存在分计划（flame 火系素材 → 火属性池有分）
  const poolInfo = await ev(`(()=>{ const plan = scorePlan({flame:1});
    const e = Object.keys(plan)[0];
    const en = elemEntries(plan[e]);
    return JSON.stringify({elem:e, total:plan[e].total, n:en.length, scaled:!!plan[e].scaled}); })()`);
  const pi=JSON.parse(poolInfo);
  check('存在分计划：flame 归火属性且非压缩', pi.elem==='fire' && !pi.scaled, JSON.stringify(pi));
  check('存在分条目 >0（技能/专长可抽取）', pi.n>0, 'n='+pi.n);

  console.log('\n'+pass+' 通过, '+fail+' 失败');
  process.exit(fail?1:0);
}
main().catch(e=>{ console.error('ERR',e); process.exit(2); });
