/* 状态系统回归：确定性效果（攻防±10%/层、速度±10点、中毒3%、睡眠/麻痹控制、回合末结算、编辑器effects配置）
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
  const boot = async () => {
    await send('Page.navigate',{url:'http://127.0.0.1:8765/spirit-refinery/index.html?r='+Date.now()+Math.random()});
    await sleep(1400);
    await send('Runtime.evaluate',{expression:"localStorage.clear(); location.reload();",returnByValue:true});
    await sleep(1800);
  };
  const ev = async expr => { const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true}); if(r.result&&r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception.description); return r.result&&r.result.result?r.result.result.value:undefined; };

  await boot();

  // 1. 状态定义存在且口径正确
  check('攻防状态每层±10%', await ev('SKILL_STATUS.atk_up.layers===0.1 && SKILL_STATUS.atk_down.layers===0.1'));
  check('速度每层±10点', await ev('SKILL_STATUS.spd_up.layers===10'));
  check('中毒每层回合末3%最大生命', await ev('SKILL_STATUS.poison.dot===0.03'));
  check('睡眠/麻痹为控制状态', await ev('SKILL_STATUS.sleep.kind==="ctrl" && SKILL_STATUS.para.kind==="ctrl"'));

  // 2. 写入一个带 effects 的测试技能，编辑器能显示效果行
  await ev('S.skillEdits["test_status_sk"] = {id:"test_status_sk", name:"状态测试", elem:"grass", kind:"ult", track:"spec", power:60, hits:1, energy:2, cost:2, mech:"", type:"攻击", tags:["草"], desc:"测试", effects:[{target:"enemy", type:"poison", layers:3},{target:"self", type:"atk_up", layers:1}]}; openSkillForm("test_status_sk"); "saved"');
  check('编辑器显示已配置的效果行数=2', await ev('document.querySelectorAll(".eff-row").length')===2);

  // 3. 野外战斗：战斗开始双方状态栏为空（用真实物种造精灵）
  await ev('S.wild={}; S.wild.spiritId="t1"; S.spirits=[{speciesId:"JL_fire_normal_0001", id:"t1", name:"测试灵", lvl:10, nature:"勇敢", skills:[{id:"test_status_sk",mastery:100}]}]; startBattle({speciesId:"JL_fire_normal_0001", id:"b1", name:"野狼", elem:"fire", lvl:10, atk:50, def:35, spa:45, sdef:35, spd:40, nature:"悠闲", rarity:"common"}, "encounter"); "ok"');
  check('战斗开始双方状态栏为空', await ev('statusText(S.wild.battle.spSt)==="" && statusText(S.wild.battle.beSt)===""'));

  // 4. 直接应用技能效果：敌方中毒3层、自身物攻+1层
  await ev('S.wild.battle.spSt=initStatus(); S.wild.battle.beSt=initStatus(); S.wild.battle.beast.hp=80; S.wild.battle.phase="fight"; applySkillEffects(S.wild.battle, [{target:"enemy",type:"poison",layers:3},{target:"self",type:"atk_up",layers:1}], "测试灵"); "ok"');
  check('敌方中毒3层', await ev('S.wild.battle.beSt.poison===3'));
  check('自身物攻+10%', await ev('Math.abs(S.wild.battle.spSt.atk-0.1)<0.001'));
  check('状态栏文案=中毒3层', await ev('statusText(S.wild.battle.beSt)==="中毒3层"'));

  // 5. 攻防修正倍率
  check('物攻修正倍率1.1', await ev('Math.abs(statusMods("self",S.wild.battle).atkMul-1.1)<0.001'));

  // 6. 回合末 tickStatus：敌方中毒3层掉 3%*3=9% 最大生命（向下取整）
  await ev('S.wild.battle.beast.hp=80; S.wild.battle.beast.maxHp=80; S.wild.battle.beSt.poison=3; tickStatus(S.wild.battle); "ok"');
  check('中毒3层回合末掉血9%', await ev('S.wild.battle.beast.hp===80-Math.floor(80*0.03*3)'));

  // 7. 睡眠/麻痹行动判定
  check('无控制时可行动', await ev('canAct({sleep:0,para:0},"self")===true'));
  check('睡眠不可行动', await ev('canAct({sleep:1,para:0},"self")===false'));
  check('麻痹25%概率判定返回布尔', await ev('typeof canAct({sleep:0,para:1},"self")==="boolean"'));

  // 8. 状态栏速度显示点数
  await ev('S.wild.battle.spSt.spd=20; "ok"');
  check('速度+20点显示', await ev('statusText(S.wild.battle.spSt).indexOf("速度+20")>=0'));

  // 9. 副本战斗也初始化状态栏
  await ev('S.settle={spiritId:"t1",enemies:[{speciesId:"JL_fire_normal_0001", id:"e1", name:"野狼", elem:"fire", lvl:10, atk:50, def:35, spa:45, sdef:35, spd:40, nature:"悠闲"}], idx:0, buffs:[], phase:"build", battle:null}; startDgFight(); "ok"');
  check('副本战斗状态栏初始化', await ev('!!S.settle.battle.spSt && !!S.settle.battle.beSt'));

  // 10. 敌方 tickStatus 不产生 NaN（b.beast.maxHp 修复验证）
  await ev('S.wild.battle.beSt.poison=2; S.wild.battle.beast.maxHp=80; S.wild.battle.beast.hp=80; tickStatus(S.wild.battle); "ok"');
  check('敌方中毒结算非NaN', await ev('isFinite(S.wild.battle.beast.hp)'));

  console.log('状态系统断言 ' + (pass+fail) + ' 条：PASS ' + pass + ' / FAIL ' + fail);
  process.exit(fail?1:0);
}
main().catch(e=>{ console.error('ERR', e.message||e); process.exit(2); });
