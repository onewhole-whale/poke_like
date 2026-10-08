/* v1.12.0 战斗机制专项：先制 / 命中 / 蓄力 / 连舞+混乱 / 力竭 / 反震 / 寄生衰减 / 状态栏
   依赖：http://127.0.0.1:8765 服务 + 9334 chromium headless
   约定：boot('#/wild') 后 S.wild.spiritId 有默认精灵；每用例 startBattle 后把玩家血调厚（防妖兽提前击杀干扰结算）。 */
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
  };
  const ev = async expr => { const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true}); if(r.result&&r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception.description); return r.result&&r.result.result?r.result.result.value:undefined; };
  const BEAST = `{speciesId:'JL_earth_normal_0046',name:'咚咚犀',elem:'earth',hp:2000,maxHp:2000,atk:0,def:3,spa:0,sdef:3,spd:1,lvl:5}`;

  /* ===== 1. 先制：青草滑梯场地内无视速度先手 ===== */
  await boot('#/wild');
  let r = await ev(`(()=>{
    const sp=wildSpirit(); if(!sp) return 'NO_SP';
    startBattle(${BEAST},'normal');
    const b=S.wild.battle; b.spMax=500; b.spHp=500;
    sp.skills.push({id:'g_grassyglide',name:'青草滑梯',kind:'ult',cost:2,energy:1,power:65,elem:'grass',track:'phys',mastery:30});
    b.field={elem:'grass',turns:5}; b.first='beast';   // 速度慢
    battleSkill('g_grassyglide');
    const plIdx=b.log.findIndex(l=>l.who==='pl'), beIdx=b.log.findIndex(l=>l.who==='be');
    // 对照：不开场地 → 敌方先手（重新 startBattle 后取新 battle）
    startBattle(${BEAST},'normal');
    const b2=S.wild.battle; b2.spMax=500; b2.spHp=500;
    b2.first='beast';
    battleSkill('g_grassyglide');
    const plIdx2=b2.log.findIndex(l=>l.who==='pl'), beIdx2=b2.log.findIndex(l=>l.who==='be');
    return JSON.stringify({p:plIdx>=0&&beIdx>=0&&plIdx<beIdx, n:plIdx2>=0&&beIdx2>=0&&plIdx2>beIdx2});
  })()`);
  r = JSON.parse(r);
  check('先制：场地内青草滑梯无视速度先手', r.p===true, JSON.stringify(r));
  check('先制：无场地时速度慢则敌方先手', r.n===true, JSON.stringify(r));

  /* ===== 2. 蓄力：日光束蓄力回合不攻击、下回合发射 ===== */
  r = await ev(`(()=>{
    const sp=wildSpirit();
    startBattle(${BEAST},'normal');
    const b=S.wild.battle; b.spMax=500; b.spHp=500;
    sp.skills.push({id:'g_solabeam',name:'日光束',kind:'burst',cost:4,energy:5,power:120,elem:'grass',track:'spec',mastery:30});
    b.energy=5;
    const hp0=b.beast.hp;
    battleSkill('g_solabeam');                 // 第1回合蓄力
    const c1={hp:b.beast.hp, charged:!!b.charge};
    battleSkill('g_solabeam');                 // 第2回合强制发射
    const c2={hp:b.beast.hp, charged:!!b.charge};
    return JSON.stringify({hp0,c1,c2});
  })()`);
  r = JSON.parse(r);
  check('蓄力：释放回合不造成伤害', r.c1.hp===r.hp0 && r.c1.charged===true, JSON.stringify(r.c1));
  check('蓄力：下一回合自动发射造成伤害并清标记', r.c2.hp<r.hp0 && r.c2.charged===false, JSON.stringify(r.c2));

  /* ===== 3. 连舞+混乱：花瓣舞连打 3 回合后附加混乱 ===== */
  r = await ev(`(()=>{
    const sp=wildSpirit();
    startBattle(${BEAST},'normal');
    const b=S.wild.battle; b.spMax=500; b.spHp=500;
    sp.skills.push({id:'g_petaldance',name:'花瓣舞',kind:'burst',cost:4,energy:4,power:120,elem:'grass',track:'spec',mastery:30});
    b.energy=4;
    battleSkill('g_petaldance');   // 首击 + 写 lock(remain 2)
    const r1={locked:!!b.lock, remain:b.lock&&b.lock.remain, hp:b.beast.hp};
    battleSkill('g_petaldance');   // 强制连打（remain 2→1）
    const r2={locked:!!b.lock, remain:b.lock&&b.lock.remain, hp:b.beast.hp};
    battleSkill('g_petaldance');   // 最后一击 → 附加混乱 3（回合末 tickStatus −1）
    const r3={locked:!!b.lock, remain:b.lock&&b.lock.remain, hp:b.beast.hp, confusion:b.spSt.confusion};
    return JSON.stringify({r1,r2,r3});
  })()`);
  r = JSON.parse(r);
  check('连舞：首击后锁定 2 个额外回合', r.r1.locked===true && r.r1.remain===2, JSON.stringify(r.r1));
  check('连舞：连打期间持续锁定并造成伤害', r.r2.locked===true && r.r2.remain===1 && r.r2.hp<r.r1.hp, JSON.stringify(r.r2));
  check('连舞：结束后附加混乱（3 层当回合末衰减为 2）', r.r3.locked===false && r.r3.confusion===2, JSON.stringify(r.r3));

  /* ===== 4. 力竭：疯狂植物释放后下一回合无法行动 ===== */
  r = await ev(`(()=>{
    const sp=wildSpirit();
    startBattle(${BEAST},'normal');
    const b=S.wild.battle; b.spMax=500; b.spHp=500;
    sp.skills.push({id:'g_frenzyplant',name:'疯狂植物',kind:'burst',cost:5,energy:6,power:150,elem:'grass',track:'spec',mastery:30});
    b.energy=6;
    const hp0=b.beast.hp;
    battleSkill('g_frenzyplant');   // 伤害 + 写 recharge
    const r1={hp:b.beast.hp, rech:!!b.recharge};
    const hp1=b.beast.hp;
    sp.skills.push({id:'g_seedshot',name:'种子弹',kind:'ult',cost:1,energy:1,power:60,elem:'grass',track:'spec',mastery:30});
    b.energy=5;
    battleSkill('g_seedshot');      // 力竭：玩家本回合无法行动
    const r2={hp:b.beast.hp, rech:!!b.recharge, logHasFali:b.log.some(l=>l.text.indexOf('力竭')>=0)};
    return JSON.stringify({hp0,r1,hp1,r2});
  })()`);
  r = JSON.parse(r);
  check('力竭：释放回合正常造成伤害并写标记', r.r1.hp<r.hp0 && r.r1.rech===true, JSON.stringify(r.r1));
  check('力竭：下一回合玩家行动被替换（无伤害、清标记）', r.r2.hp===r.hp1 && r.r2.rech===false && r.r2.logHasFali===true, JSON.stringify(r.r2));

  /* ===== 5. 命中：魔法叶必中；accuracy<100 存在落空分支 ===== */
  r = await ev(`(()=>{
    const sp=wildSpirit();
    startBattle(${BEAST},'normal');
    const b=S.wild.battle; b.spMax=500; b.spHp=500;
    sp.skills.push({id:'g_magicalleaf',name:'魔法叶',kind:'ult',cost:2,energy:1,power:65,elem:'grass',track:'spec',mastery:30});
    b.energy=5;
    const hp0=b.beast.hp;
    battleSkill('g_magicalleaf');
    const afterHit={hp:b.beast.hp, missed:b.log.some(l=>l.text.indexOf('落空')>=0)};
    const hp1=b.beast.hp;
    // 构造 accuracy 60 技能（v1.12.1：accuracy 为技能顶层字段）+ Math.random 固定 0.99 → 强制落空
    const _r=Math.random; Math.random=()=>0.99;
    const fake={id:'g_fake',name:'假技能',kind:'ult',cost:2,energy:1,power:65,hits:1,elem:'grass',track:'spec',accuracy:60};
    playerTurn(sp,fake,b,()=>{});
    const afterMiss={hp:b.beast.hp, missed:b.log.some(l=>l.text.indexOf('落空')>=0)};
    Math.random=_r;
    return JSON.stringify({hp0,hp1,afterHit,afterMiss});
  })()`);
  r = JSON.parse(r);
  check('命中：魔法叶（accuracy 100）必中', r.afterHit.hp<r.hp0 && r.afterHit.missed===false, JSON.stringify(r.afterHit));
  check('命中：accuracy<100 且随机失败 → 落空无伤害', r.afterMiss.hp===r.hp1 && r.afterMiss.missed===true, JSON.stringify({hp1:r.hp1, afterMiss:r.afterMiss}));

  /* ===== 6. 反震：叶绿爆震自伤 33% ===== */
  r = await ev(`(()=>{
    const sp=wildSpirit();
    startBattle(${BEAST},'normal');
    const b=S.wild.battle; b.spMax=500; b.spHp=500;
    sp.skills.push({id:'g_verdantquake',name:'叶绿爆震',kind:'burst',cost:5,energy:6,power:150,elem:'grass',track:'spec',mastery:30});
    b.energy=6;
    const spHp0=b.spHp;
    battleSkill('g_verdantquake');
    const recoilLogs=b.log.filter(l=>l.text.indexOf('反震')>=0).length;
    return JSON.stringify({spHp0,spHp:b.spHp,recoilLogs});
  })()`);
  r = JSON.parse(r);
  check('反震：叶绿爆震命中后自身受反震伤害', r.spHp<r.spHp0 && r.recoilLogs>=1, JSON.stringify(r));

  /* ===== 7. 寄生：永续状态（层数=数值）；茁茁炸弹 = 伤害 + 2 层永续寄生（v1.14.2 修正） ===== */
  r = await ev(`(()=>{
    const sp=wildSpirit();
    startBattle(${BEAST},'normal');
    const b=S.wild.battle; b.spMax=500; b.spHp=500;
    sp.skills.push({id:'g_bloomdoom',name:'茁茁炸弹',kind:'ult',cost:2,energy:2,power:67,elem:'grass',track:'phys',mastery:30});
    b.energy=5;
    battleSkill('g_bloomdoom');      // 命中附加 2 层寄生（永续），回合末寄生结算
    const p1=b.beSt.parasitic;
    tickStatus(b); const p2=b.beSt.parasitic;
    tickStatus(b); const p3=b.beSt.parasitic;
    return JSON.stringify({p1,p2,p3,hpDrop:b.beast.hp<2000});
  })()`);
  r = JSON.parse(r);
  check('寄生：茁茁炸弹造成伤害并附加 2 层（层数=数值，命中回合末不衰减）', r.p1===2 && r.hpDrop===true, JSON.stringify(r));
  check('寄生：茁茁炸弹 2 层永续，多次回合末层数保持 2', r.p2===2 && r.p3===2, JSON.stringify(r));

  /* 寄生种子（无 turns）= 永续：层数不衰减 */
  r = await ev(`(()=>{
    const sp=wildSpirit();
    startBattle(${BEAST},'normal');
    const b=S.wild.battle; b.spMax=500; b.spHp=500;
    sp.skills.push({id:'g_leechseed',name:'寄生种子',kind:'ult',cost:2,energy:2,power:0,elem:'grass',track:'spec',mastery:30});
    b.energy=5;
    battleSkill('g_leechseed');
    tickStatus(b); tickStatus(b); tickStatus(b);
    return JSON.stringify({p:b.beSt.parasitic});
  })()`);
  r = JSON.parse(r);
  check('寄生种子（无 turns）：永续，多次回合末层数保持 2', r.p===2, JSON.stringify(r));

  /* ===== 8. 状态栏与数据一致性 ===== */
  r = await ev(`(()=>{
    const s=initStatus();
    const txt=statusText({confusion:3});
    const sk=Object.values(SKILLS).flat().find(x=>x.id==='g_petaldance');
    const ef=skillEffectsOf(sk);
    const gs=Object.values(SKILLS).flat().find(x=>x.id==='g_grassyglide');
    const ge=skillEffectsOf(gs);
    return JSON.stringify({c0:s.confusion, txt, petal:ef.map(e=>e.type), glide:ge.map(e=>e.type), glideCond:ge[0]&&ge[0].cond});
  })()`);
  r = JSON.parse(r);
  check('状态栏：initStatus 含 confusion 0 且 statusText 正常', r.c0===0 && r.txt.indexOf('混乱3回合')>=0, JSON.stringify(r));
  check('数据：花瓣舞挂 multilock、青草滑梯挂 priority(field_grass)', r.petal.indexOf('multilock')>=0 && r.glide.indexOf('priority')>=0 && r.glideCond==='field_grass', JSON.stringify(r));

  /* ===== 9. 秘境侧冒烟：dgBattleSkill 先制生效 ===== */
  r = await ev(`(()=>{
    window.renderSettle=function(){};
    const sp=spById(S.wild.spiritId);
    S.settle={spiritId:sp.id, idx:0, enemies:[{name:'咚咚犀',elem:'earth',hp:3000,maxHp:3000,atk:0,def:3,spd:1,lvl:5}], buffs:[], phase:'fight', logs:[]};
    startDgFight();
    const b=S.settle.battle; b.spMax=500; b.spHp=500; b.first='beast';
    sp.skills.push({id:'g_grassyglide',name:'青草滑梯',kind:'ult',cost:2,energy:1,power:65,elem:'grass',track:'phys',mastery:30});
    b.field={elem:'grass',turns:5};
    dgBattleSkill('g_grassyglide');
    const plIdx=b.log.findIndex(l=>l.who==='pl'&&l.text.indexOf('青草滑梯')>=0);
    const beIdx=b.log.findIndex(l=>l.who==='be');
    return JSON.stringify({first:plIdx>=0&&beIdx>=0&&plIdx<beIdx});
  })()`);
  r = JSON.parse(r);
  check('秘境：dgBattleSkill 先制同样生效', r.first===true, JSON.stringify(r));

  console.log(`\nmech_test 结果：${pass} 通过 / ${fail} 失败`);
  process.exit(fail?1:0);
}
main().catch(e=>{ console.error('ERROR', e.message); process.exit(1); });
