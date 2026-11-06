/* v1.20.0 战斗演出 UI 改造 验收
   用 CDP 打开游戏、进战斗、截图核对 10 条 UI */
const WebSocket = require('/opt/runtime/nodejs/node_modules/ws');
const fs = require('fs');

const HTTP = 'http://127.0.0.1:8765/spirit-refinery/index.html?v=' + Date.now();

async function main(){
  // 拿 CDP target
  const targets = await (await fetch('http://127.0.0.1:9334/json')).json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise(r => ws.on('open', r));
  let id = 0;
  const pending = {};
  ws.on('message', d => {
    const m = JSON.parse(d);
    if(m.id && pending[m.id]){ pending[m.id](m); delete pending[m.id]; }
  });
  const send = (method, params={}) => new Promise(res => {
    const mid = ++id; pending[mid] = res;
    ws.send(JSON.stringify({id: mid, method, params}));
  });

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Page.navigate', {url: HTTP});
  await new Promise(r => setTimeout(r, 3000));

  // 清 localStorage 新档
  await send('Runtime.evaluate', {expression: 'localStorage.clear(); location.reload();'});
  await new Promise(r => setTimeout(r, 3000));

  // 自动进战斗：直接调 startBattle 或路由到 #/wild 触发
  const r1 = await send('Runtime.evaluate', {expression: `
    (() => {
      // 初始化存档
      if(typeof S !== 'undefined' && !S.spirits){
        // 用默认存档
      }
      location.hash = '#/wild';
      route();
      return {hash: location.hash, hasS: typeof S, hasStartBattle: typeof startBattle};
    })()
  `, returnByValue: true});
  console.log('初始路由:', JSON.stringify(r1.result.result.value));

  // 直接构造一场战斗进战斗界面
  const r2 = await send('Runtime.evaluate', {expression: `
    (() => {
      try {
        // 强制新档
        S.spirits = [{id:'sp1', speciesId:'JL_fire_normal_0001', elem:'fire', lvl:10, hp:100, maxHp:100, energy:5, energyMax:10, iv:{}, nature:'', skills:['f_ember'], exp:0, aff:{}, perks:[], shiny:false, ivs:{}}];
        S.team = ['sp1'];
        S.mats = {};
        S.dexSeen = {}; S.dexClaimed = {};
        route();
        // 直接 startBattle
        startBattle({speciesId:'JL_water_normal_0023', elem:'water', lvl:8, rarity:'normal'});
        return {battle: !!b, phase: b && b.phase, enemy: b && b.beast && b.beast.name};
      } catch(e) { return {err: e.message}; }
    })()
  `, returnByValue: true});
  console.log('进战斗:', JSON.stringify(r2.result.result.value));

  await new Promise(r => setTimeout(r, 1500));

  // 截图 1：战斗界面整体
  const shot1 = await send('Page.captureScreenshot', {format: 'png'});
  fs.writeFileSync('/tmp/battle_ui_full.png', Buffer.from(shot1.result.data, 'base64'));
  console.log('截图1: /tmp/battle_ui_full.png');

  // 核对 DOM 结构
  const dom = await send('Runtime.evaluate', {expression: `
    (() => {
      const q = s => document.querySelector(s);
      const qa = s => [...document.querySelectorAll(s)];
      return {
        // 1. 布局
        hasBattlerLeft: !!q('.battler-left, .bt-left, .pl-panel, .sp-panel'),
        hasBattlerRight: !!q('.battler-right, .bt-right, .en-panel, .be-panel'),
        hasBattleField: !!q('.battle-field, .battlefield, #battle-field'),
        hasFuncBar: !!q('.func-bar, .toolbar, .detail-tabs'),
        hasDetailBar: !!q('.detail-bar, .detail-panel, .skill-panel'),
        // 2. 血条
        hpBars: qa('.hp-bar, .bt-hp').length,
        hpTicks: qa('.bt-hp-ticks, .hp-ticks').length,
        // 3. 能量 XX/YY
        energyTexts: qa('.bt-energy, .energy-bar').map(e => e.textContent.trim()),
        // 4. 状态图标
        statusIcons: qa('.stat-icon, .status-icon, .st-icon').length,
        // 5. 出招名片
        moveCard: !!q('.move-card, .skill-card-play, .play-card'),
        // 6. 功能栏按钮
        funcBtns: qa('.func-bar button, .toolbar button, .detail-tabs button').map(b => b.textContent.trim()),
        // 7. 技能卡片
        skillCards: qa('.skill-card, .sk-card').length,
        // 8. 选中高亮/冷却灰化
        selectedCard: qa('.skill-card.selected, .sk-card.selected, .skill-card.on').length,
        onCooldown: qa('.skill-card.cooldown, .sk-card.cd, .skill-card.disabled, .sk-card.off').length,
        // 9. 伤害飘字
        damageNumbers: qa('.dmg-num, .damage-num, .float-dmg, .dmg').length,
        // 10. 回合数
        roundText: (q('.bt-round, .pr-round, .round-display')||{}).textContent || '',
      };
    })()
  `, returnByValue: true});
  console.log('DOM 核对:', JSON.stringify(dom.result.result.value, null, 2));

  ws.close();
}
main().catch(e => { console.error(e); process.exit(1); });
