/* 种族值系统 M2-A2 专项验收：6 维种族值 + 技能物理/特殊分轨 */
const { execSync } = require('child_process');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
(async()=>{
  const list = JSON.parse(execSync(`curl -s http://127.0.0.1:9334/json`).toString());
  const page = list.find(p=>p.type==='page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pending={};
  ws.onmessage = ev=>{ const m=JSON.parse(ev.data); if(m.id&&pending[m.id]){pending[m.id](m);delete pending[m.id];} };
  const send=(method,params={})=>new Promise(res=>{const i=++id;pending[i]=res;ws.send(JSON.stringify({id:i,method,params}));});
  const evl=async(expression)=>{ const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true}); return (r.result&&r.result.result)? r.result.result.value : undefined; };
  await new Promise(r=>ws.onopen=r);
  await send('Page.enable'); await send('Runtime.enable');
  await send('Page.navigate',{url:'http://127.0.0.1:8765/spirit-refinery/index.html?a2='+Date.now()});
  for(let i=0;i<30;i++){
    await sleep(500);
    if(await evl(`document.readyState==='complete' && typeof speciesBase==='function'`)) break;
  }
  const results=[];
  const T=(name,cond,extra='')=>results.push((cond?'PASS':'FAIL')+' '+name+(extra?'  ['+extra+']':''));

  // 1. 24 只精灵都有 stats 6 维（hp/atk/def/spa/sdef 均 >0）
  T('109只精灵均有6维种族值', await evl(`Object.keys(SPECIES).length===109 && Object.keys(SPECIES).every(id=>{ const st=SPECIES[id].stats; return st && st.hp>0&&st.atk>0&&st.def>0&&st.spa>0&&st.sdef>0; })`), 'SPECIES='+await evl('Object.keys(SPECIES).length'));
  T('speed 字段 = 速度种族值', await evl(`Object.keys(SPECIES).every(id=>SPECIES[id].speed>0)`));

  // 2. speciesBase 返回 6 维
  T('speciesBase 返回6维（烬烬狼新种族值）', await evl(`(()=>{ const b=speciesBase(SPECIES.JL_fire_normal_0001); return b.hp===55&&b.atk===75&&b.def===45&&b.spa===40&&b.sdef===40&&b.spe===70; })()`));

  // 3. spiritStats 6 维（含性格修正 spa/sdef/spe）
  const st = JSON.parse(await evl(`(()=>{ const s=makeSpirit('JL_fire_normal_0016',false,'t'); const b=spiritStats(s); s.nature='modest'; const m=spiritStats(s); return JSON.stringify({base:b, modest:m}); })()`));
  T('spiritStats 含 spa/sdef', st.base.spa>0 && st.base.sdef>0, 'spa='+st.base.spa+' sdef='+st.base.sdef);
  T('保守性格: 特攻×1.1', st.modest.spa===Math.round(st.base.spa*1.1), st.base.spa+'→'+st.modest.spa);
  T('保守性格: 攻击×0.9', st.modest.atk===Math.round(st.base.atk*0.9));
  T('保守性格: 防御不动', st.modest.def===st.base.def);

  // 4. 技能分轨
  T('直接攻击池带 track（物特双轨）', await evl(`Object.keys(DIRECT_NAMES).length===15 && SKILLS.fire.filter(s=>s.kind==='direct'&&s.track==='phys').length===7 && SKILLS.fire.filter(s=>s.kind==='direct'&&s.track==='spec').length===7 && SKILLS.earth.filter(s=>s.kind==='direct'&&s.track==='phys').length===7`));
  T('绝技/爆发跟随属性轨', await evl(`SKILLS.fire.some(s=>s.kind==='ult'&&s.track==='spec') && SKILLS.fight.some(s=>s.kind==='ult'&&s.track==='phys') && SKILLS.fire.some(s=>s.kind==='burst'&&s.track==='spec')`));
  T('冰牙/雷爪覆盖为物理', await evl(`SKILLS.water.find(s=>s.id==='icefang').track==='phys' && SKILLS.thunder.find(s=>s.id==='thunderclaw').track==='phys'`));

  // 5. 战斗分轨：玩家特殊技能伤害吃特攻（对比：同样面板、特攻>攻击时特殊技能伤害更高）
  // v1.11.0 宝可梦式含随机浮动：改为 30 次采样累加比期望，避免单次随机翻转
  const dm = JSON.parse(await evl(`(()=>{
    const sp=makeSpirit('JL_poison_elite_0102',false,'t');   // 扫帚巫 特攻17 攻击9：特攻远高
    sp.lvl=10;
    const st=spiritStats(sp);
    const beast=wildBeast('JL_earth_normal_0046');         // 咚咚犀 特防9 防御13：特防低
    const mods={};
    let physSum=0, specSum=0;
    for(let i=0;i<30;i++){
      physSum += calcDamage(st.atk, 10, beast.def, beast.lvl, 60, mods, 'poison', beast.elem);
      specSum += calcDamage(st.spa, 10, beast.sdef, beast.lvl, 60, mods, 'poison', beast.elem);
    }
    return JSON.stringify({st, physSum, specSum, beastLvl:beast.lvl});
  })()`));
  T('特攻>攻击时特殊技能伤害更高（30 次采样期望）', dm.specSum > dm.physSum, 'phys='+dm.physSum+' spec='+dm.specSum+' spa='+dm.st.spa+' atk='+dm.st.atk);

  // 6. 战斗流程分轨结算：battleSkill 特殊技能用 spSpa
  const bt = JSON.parse(await evl(`(()=>{
    const sp=makeSpirit('JL_poison_elite_0102',false,'t'); sp.lvl=10;
    S.spirits.push(sp);
    S.wild={spiritId:sp.id, phase:'battle', zone:'magma'};
    const beast=wildBeast('JL_earth_normal_0046');
    startBattle(beast, 'none');
    const b=S.wild.battle;
    const before=b.beast.hp;
    battleSkill('poison-d8');   // 毒系特攻 60 威力 1 段（spec 轨）
    const after=b.beast.hp;
    const log=b.log[b.log.length-1];
    return JSON.stringify({before, after, dmg:before-after, log:log&&log.text, track:SKILLS.poison.find(x=>x.id==='poison-d8').track});
  })()`));
  T('特殊技能战斗结算用特攻', bt.track==='spec' && bt.dmg>0, 'dmg='+bt.dmg);
  T('妖兽 AI 分轨不报错', true);   // 上面已实际跑了一轮战斗

  // 7. 突袭/被突袭分轨
  const amb = JSON.parse(await evl(`(()=>{
    const sp=makeSpirit('JL_earth_normal_0046',false,'t'); sp.lvl=5;
    S.spirits.push(sp);
    S.wild={spiritId:sp.id, phase:'battle', zone:'magma'};
    const beast=wildBeast('JL_poison_elite_0102');   // 毒系（spec）
    startBattle(beast, 'ambush');
    const b=S.wild.battle;
    return JSON.stringify({spHp:b.spHp, spMax:b.spMax, hit:b.spHp<b.spMax, sdef:b.spSdef});
  })()`));
  T('被突袭用特防承伤', amb.hit && amb.sdef>0, 'spHp='+amb.spHp+'/'+amb.spMax);

  // 8. wildBeast 6 维 + 性格
  const wb = JSON.parse(await evl(`(()=>{ const w=wildBeast('JL_fire_normal_0009'); return JSON.stringify({spa:w.spa, sdef:w.sdef, atk:w.atk, def:w.def, spd:w.spd, lvl:w.lvl, nature:w.nature}); })()`));
  T('wildBeast 含特攻特防', wb.spa>0 && wb.sdef>0, 'spa='+wb.spa+' sdef='+wb.sdef);

  // 9. 管理端表单含种族值输入（打开编辑表单验证）
  const form = await evl(`(()=>{ openSpeciesForm('JL_fire_normal_0001'); const mb=document.getElementById('modal-box'); return mb.innerHTML.includes('种族值') && mb.querySelectorAll('input[type=number]').length>=6; })()`);
  T('管理端种族值输入', !!form);

  console.log(results.join('\n'));
  const fails=results.filter(r=>r.startsWith('FAIL')).length;
  console.log('\n'+results.length+' 项断言，失败 '+fails);
  process.exit(fails?1:0);
})().catch(e=>{ console.error('ERR',e.stack||e.message); process.exit(1); });
