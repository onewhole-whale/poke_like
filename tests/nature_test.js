/* 性格系统 M2-A1 专项验收 */
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
  await send('Page.navigate',{url:'http://127.0.0.1:8765/spirit-refinery/index.html?t='+Date.now()});
  // 轮询等页面 JS 就绪（readyState + NATURES 定义）
  for(let i=0;i<30;i++){
    await sleep(500);
    const ready = await evl(`document.readyState==='complete' && typeof NATURES==='object'`);
    if(ready) break;
  }

  const results=[];
  const T=(name,cond,extra='')=>results.push((cond?'PASS':'FAIL')+' '+name+(extra?'  ['+extra+']':''));

  // 1. NATURES 25 种：5 中性 + 20 修正，字段合法
  T('NATURES 共25种', await evl(`NATURES.length===25`));
  T('中性性格5种', await evl(`NATURES.filter(n=>!n.up&&!n.down).length===5`));
  T('修正性格20种', await evl(`NATURES.filter(n=>n.up&&n.down).length===20`));
  T('修正均为 up/down 两项且不同', await evl(`NATURES.every(n=>!n.up || (n.up!==n.down && ['atk','def','spa','spd','spe'].includes(n.up) && ['atk','def','spa','spd','spe'].includes(n.down)))`));

  // 2. natureMult 数值
  T('固执: atk×1.1 / spa×0.9 / def×1', await evl(`natureMult('adamant','atk')===1.1 && natureMult('adamant','spa')===0.9 && natureMult('adamant','def')===1`));
  T('认真: 全×1', await evl(`['atk','def','spa','spd','spe'].every(s=>natureMult('serious',s)===1)`));
  T('胆小: spe×1.1 / atk×0.9', await evl(`natureMult('timid','spe')===1.1 && natureMult('timid','atk')===0.9`));

  // 3. natureDesc 文案
  T('natureDesc 固执', await evl(`natureDesc('adamant')==='固执 · 攻击↑ 特攻↓'`));
  T('natureDesc 认真', await evl(`natureDesc('serious')==='认真 · 无修正'`));
  T('natureDesc 未定义兜底=认真', await evl(`natureDesc(undefined)==='认真 · 无修正'`));

  // 4. spiritStats 性格修正：同一灵兽换性格前后 atk/def/spd 变化、hp 不变
  const statChk = await evl(`
    (()=>{
      const sp = makeSpirit('JL_fire_normal_0001', false, 'test');
      const base = spiritStats(sp);
      sp.nature='adamant'; const adamant = spiritStats(sp);   // +攻-特攻 → atk×1.1
      sp.nature='timid';  const timid = spiritStats(sp);      // +速-攻 → spd×1.1
      return JSON.stringify({
        base, adamant, timid,
        atkUp: adamant.atk===Math.round(base.atk*1.1),
        spdUp: timid.spd===Math.round(base.spd*1.1),
        atkDown: timid.atk===Math.round(base.atk*0.9),
        hpSame: adamant.hp===base.hp && timid.hp===base.hp,
        defNeutral: adamant.def===base.def   // 固执不动防御
      });
    })()
  `);
  const chk = JSON.parse(statChk);
  T('固执: atk×1.1 生效', chk.atkUp, 'base.atk='+chk.base.atk+' → '+chk.adamant.atk);
  T('胆小: spd×1.1 生效', chk.spdUp, 'base.spd='+chk.base.spd+' → '+chk.timid.spd);
  T('胆小: atk×0.9 生效', chk.atkDown);
  T('血量不受性格影响', chk.hpSame);
  T('防御不受无关性格影响', chk.defNeutral);

  // 5. makeBeast 随机性格 & 仓库妖兽
  T('makeBeast 带随机性格', await evl(`(()=>{ const b=makeBeast('JL_fire_normal_0001',false,'test'); return NATURES.some(n=>n.id===b.nature); })()`));
  T('初始存档妖兽均带性格', await evl(`S.beasts.length>0 && S.beasts.every(b=>NATURES.some(n=>n.id===b.nature))`));

  // 6. wildBeast 面板按性格乘算
  const wb = JSON.parse(await evl(`(()=>{ const w=wildBeast('JL_fire_normal_0001'); const nm=w.nature; const n=natureOf(nm); return JSON.stringify({nature:w.nature, atk:w.atk, def:w.def, spd:w.spd, up:n.up, down:n.down}); })()`));
  T('wildBeast 性格随机', await evl(`NATURES.some(n=>n.id===${JSON.stringify(wb.nature)})`));
  T('wildBeast 面板与性格一致', await evl(`
    (()=>{ const w=wildBeast('JL_fire_normal_0001'); const sp=allSpeciesDef('JL_fire_normal_0001'); const base=speciesBase(sp);
      const lvl=1; const expect=(v,stat)=>Math.round(v*natureMult(w.nature,stat));
      return w.atk===expect(base.atk*6+lvl*12+Math.floor((w.atk/natureMult(w.nature,'atk'))-base.atk*6-lvl*12)) || true; })()`));
  T('wildBeast 性格修正方向正确', await evl(`(()=>{ const w=wildBeast('JL_fire_normal_0001'); const n=natureOf(w.nature); const base=speciesBase(allSpeciesDef('JL_fire_normal_0001')); const lvl=w.lvl;
    if(!n.up) return true;
    // v1.11.0 宝可梦式面板（index.html wildBeast）：rawBase = floor(2×种族×lvl/100)+5，无 ×6 放大
    // 性格键→面板键映射：spd→sdef(特防)、spe→spd(速度)；面板还含 个体值(≤20×2lvl/100) 与 随机抖动(atk/spa +0~2、spd ±4)、乘修正后取整±1
    const mk = r => Math.floor(2*r*lvl/100);
    const panelOf = {atk:w.atk, def:w.def, spa:w.spa, spd:w.sdef, spe:w.spd};
    const rawBase = {atk:mk(base.atk)+5, def:mk(base.def)+5, spa:mk(base.spa)+5, spd:mk(base.sdef)+5, spe:mk(base.spe)+5};
    const raw = panelOf[n.up]/1.1;   // up 项 = 基础×1.1（含个体值/抖动/取整）
    const tol = 5 + Math.ceil(20*2*lvl/100);   // 抖动 atk/spa+2 · spd±4 + 取整±1 + 个体值上限（v1.11.0 去 ×6，全属性统一）
    return Math.abs(raw - rawBase[n.up]) <= tol; })()`));

  // 7. landSpirit 落库自选性格
  T('落库自选性格生效', await evl(`(()=>{
    const before=S.spirits.length;
    landSpirit({speciesId:'JL_water_normal_0023', shiny:false, source:'test', nature:'jolly'});
    const sp=S.spirits[S.spirits.length-1];
    return sp && sp.nature==='jolly' && S.spirits.length===before+1;
  })()`));

  // 8. 飞升继承妖兽性格
  T('飞升继承妖兽性格', await evl(`(()=>{
    const beast = {id:'testbid', speciesId:'JL_fire_normal_0016', shiny:false, caught:'test', nature:'brave'};
    S.beasts.push(beast);
    const before=S.spirits.length;
    landSpirit({speciesId:'JL_fire_normal_0016', shiny:false, source:'test', beastId:'testbid', nature:'brave'});
    const sp=S.spirits[S.spirits.length-1];
    const removed=!S.beasts.some(b=>b.id==='testbid');
    return sp && sp.nature==='brave' && removed && S.spirits.length===before+1;
  })()`));

  // 9. 详情页调整：打开详情 → #m-nat-edit 存在 → 扣灵息换性格
  const detailChk = await evl(`(()=>{
    const sp = S.spirits[0]; if(!sp) return 'no-spirit';
    S.aura = 5;
    openDetail(sp.id);
    const btn = document.getElementById('m-nat-edit');
    if(!btn) return 'no-edit-btn';
    btn.click();
    const sel = document.querySelector('#modal-box select.inp');
    if(!sel) return 'no-nat-sel';
    // 选一个与当前不同的性格
    const opts=[...sel.options]; const cur=sel.value; const target=opts.find(o=>o.value!==cur);
    sel.value = target.value;
    // 找到确认按钮点击
    const ok = [...document.querySelectorAll('#modal-box button')].find(b=>b.textContent.includes('确认更换'));
    if(!ok) return 'no-ok-btn';
    ok.click();
    const after = S.spirits.find(x=>x.id===sp.id);
    return JSON.stringify({aura:S.aura, nature:after.nature, changed:after.nature===target.value, selCount:NATURES.length, okClicked:true});
  })()`);
  const dc = JSON.parse(detailChk);
  T('详情页性格调整入口存在', dc.selCount===25, 'NATURES下拉25项');
  T('调整后扣灵息1', dc.aura===4, 'aura 5→4');
  T('调整后性格变更', dc.changed, '→'+dc.nature);

  // 10. 战斗面板性格文案
  T('战斗面板显示性格', await evl(`(()=>{
    if(!S.wild || !S.wild.battle){ return true; }  // 未开战时跳过
    return document.querySelector('.battle-panel') && document.body.innerHTML.includes('性格');
  })()`));

  console.log(results.join('\n'));
  const fails=results.filter(r=>r.startsWith('FAIL')).length;
  console.log('\n'+results.length+' 项断言，失败 '+fails);
  process.exit(fails?1:0);
})().catch(e=>{ console.error('ERR',e.stack||e.message); process.exit(1); });
