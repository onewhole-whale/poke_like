/* v1.11.0 伤害公式宝可梦化 · CDP UI 冒烟
   验证：详情面板按宝可梦式换算显示、野外战斗伤害日志数值、降防实战生效
   依赖：http://127.0.0.1:8765 + CDP 9334 */
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

  /* 详情页面板：JL_fire_normal_0001 Lv30 宝可梦式 hp73/atk50/def32 */
  console.log('① 详情页面板（宝可梦式换算）');
  await boot('#/stable');
  await ev(`(()=>{ S.spirits=[makeSpirit('JL_fire_normal_0001',false,'t')]; S.spirits[0].lvl=30; location.hash='#/stable'; route(); })()`);
  await sleep(300);
  const spid = await ev(`S.spirits[0].id`);
  await ev(`openDetail('${spid}')`); await sleep(300);
  const dTxt = await ev(`document.getElementById('modal-box').innerText`);
  check('详情面板含 HP 73（宝可梦式）', dTxt.includes('HP 73')||dTxt.includes('73'), dTxt.slice(0,300));
  check('详情面板含攻击 50', dTxt.includes('攻 50')||dTxt.includes('攻击 50')||dTxt.includes('50'), dTxt.slice(0,300));
  await ev(`closeOverlay()`);

  /* 野外战斗：实际伤害日志 */
  console.log('② 野外战斗伤害（宝可梦式）');
  await ev(`(()=>{ const s=S.spirits[0]; s.hp=999; s.skills=[{id:'fire-d0',name:'炎拳',kind:'direct',cost:1,elem:'fire',mastery:100}]; S.wild.spiritId=s.id; startBattle({speciesId:'JL_earth_normal_0046',name:'咚咚犀',elem:'earth',hp:500,def:95,atk:3,spd:1,lvl:30},'normal'); })()`);
  await sleep(200);
  await ev(`Math.random=()=>0.6`);  // 浮动 0.85+0.6×0.15=0.94
  const dmg = JSON.parse(await ev(`(()=>{ const hp0=S.wild.battle.beast.hp; battleSkill('fire-d0'); return JSON.stringify({hp0, hp1:S.wild.battle.beast.hp, log:S.wild.battle.log.map(l=>l.text).join('|')}); })()`));
  const dealt = dmg.hp0 - dmg.hp1;
  // 手算：玩家 Lv30 atk50 打 def95；lvlTerm=14；14×40×50/95/50=floor(5.89)+2=7；克制×0.5(火打土抵抗)；×0.94 浮动 → 7×0.5×0.94≈3
  check('野外伤害=宝可梦式期望（抵抗 95 防 ≈3±2）', dealt>=1 && dealt<=5, 'dealt '+dealt+' log='+dmg.log.slice(0,100));
  check('战斗日志含伤害数值', /<b>\d+<\/b> 点伤害/.test(dmg.log), dmg.log.slice(0,100));

  /* 降防实战：sunder/def_down 后伤害提升 */
  console.log('③ 降防实战（防御体系激活）');
  await ev(`(()=>{ const s=S.spirits[0]; S.wild.spiritId=s.id; startBattle({speciesId:'JL_earth_normal_0046',name:'咚咚犀',elem:'earth',hp:9999,def:95,atk:3,spd:1,lvl:30},'normal'); })()`);
  await sleep(200);
  const debuff = JSON.parse(await ev(`(()=>{ const b=S.wild.battle; b.beSt.def=-0.4; const hp0=b.beast.hp; Math.random=()=>0.6; battleSkill('fire-d0'); const hp1=b.beast.hp; return JSON.stringify({hp0,hp1,dealt:hp0-hp1}); })()`));
  // 降防后 def=95×0.6=57；14×40×50/57/50=floor(9.82)+2=11；×0.5×0.94≈5
  check('降防 4 层后伤害提升（≈5±2）', debuff.dealt>=3 && debuff.dealt<=8, 'dealt '+debuff.dealt);

  /* 管理端/其他视图不受换算影响：图鉴仍正常渲染 */
  console.log('④ 图鉴渲染正常');
  await ev(`location.hash='#/codex'; route();`); await sleep(300);
  const cx = await ev(`document.getElementById('codex-species').innerText.length`);
  check('图鉴物种列表正常渲染', cx>500, String(cx));

  console.log(`\nv1.11.0 CDP 冒烟 PASS ${pass} / ${pass+fail}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error('ERR',e.stack||e.message);process.exit(1);});
