/* v1.20.0 续：截图下半部分 + 完整 DOM 核对 */
const WebSocket = require('/opt/runtime/nodejs/node_modules/ws');
const fs = require('fs');
(async () => {
const targets = await (await fetch('http://127.0.0.1:9334/json')).json();
const page = targets.find(t => t.type === 'page');
const ws = new WebSocket(page.webSocketDebuggerUrl);
await new Promise(r => ws.on('open', r));
let id = 0; const pending = {};
ws.on('message', d => { const m = JSON.parse(d); if(m.id && pending[m.id]){ pending[m.id](m); delete pending[m.id]; } });
const send = (method, params={}) => new Promise(res => { const mid = ++id; pending[mid] = res; ws.send(JSON.stringify({id: mid, method, params})); });

// 截图全页（包括下方功能栏）
const shot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true});
fs.writeFileSync('/tmp/battle_ui_fullpage.png', Buffer.from(shot.result.data, 'base64'));
console.log('全页截图: /tmp/battle_ui_fullpage.png');

// 完整 DOM 核对
const dom = await send('Runtime.evaluate', {expression: `
  (() => {
    const q = s => document.querySelector(s);
    const qa = s => [...document.querySelectorAll(s)];
    const allText = document.body.innerText;
    return {
      // 布局
      battlerPanes: qa('.battle-pane, .bt-pane, .pl-panel, .en-panel, .battler').length,
      battleField: !!q('.battle-field, .battlefield, .arena, #arena'),
      funcBar: !!q('.func-bar, .toolbar, .detail-tabs, .tab-bar'),
      detailBar: !!q('.detail-bar, .detail-panel, .bottom-panel, .skill-panel'),
      // 血条
      hpBars: qa('.hp-bar, .bt-hp').length,
      hpTicks: qa('.bt-hp-ticks, .hp-ticks').length,
      // 能量
      energyTexts: qa('.bt-energy, .energy-bar').map(e => e.textContent.trim()),
      // 状态图标
      statusIcons: qa('.stat-icon, .status-icon, .st-icon, .st-badge').length,
      // 出招名片
      moveCards: qa('.move-card, .play-card, .skill-play').length,
      // 功能栏按钮
      funcBtns: qa('.func-bar button, .toolbar button, .tab-bar button, .detail-tabs button').map(b => b.textContent.trim()),
      // 技能卡片
      skillCards: qa('.skill-card, .sk-card, .sk').length,
      // 选中/冷却
      selected: qa('.skill-card.selected, .sk-card.selected, .skill-card.on, .sk.on').length,
      cd: qa('.skill-card.cd, .sk-card.cd, .skill-card.disabled, .sk.off, .skill-btn.off').length,
      // 伤害飘字
      dmgNumbers: qa('.dmg, .dmg-num, .float-dmg, .damage-num').length,
      // 回合数
      round: (q('.bt-round, .pr-round, .round-display')||{}).textContent || '',
      // 技能卡片文本内容
      firstCard: (q('.skill-card, .sk-card')||{textContent:'(无)'}).textContent.trim().slice(0,200),
      // 功能栏按钮文本
      allBtns: qa('button').map(b => b.textContent.trim()).filter(t => t && t.length < 5).slice(0,20),
    };
  })()
`, returnByValue: true});
console.log(JSON.stringify(dom.result.result.value, null, 2));
ws.close();
})().catch(e => { console.error(e); process.exit(1); });
