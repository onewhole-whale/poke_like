/* v1.20.0 攻击后截图：伤害飘字+技能卡片完整信息 */
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

// 直接用普攻攻击
await send('Runtime.evaluate', {expression: `
  (() => {
    try {
      // 点第一个技能按钮（普攻）
      const btns = [...document.querySelectorAll('button')].filter(b => b.textContent.trim() === '普攻' || b.textContent.trim() === '攻击');
      if(btns.length) btns[0].click();
      return {clicked: btns.length, btnText: btns[0] && btns[0].textContent};
    } catch(e) { return {err: e.message}; }
  })()
`, returnByValue: true}).then(r => console.log('点击攻击:', JSON.stringify(r.result.result.value)));

await new Promise(r => setTimeout(r, 1500));

const shot = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true});
fs.writeFileSync('/tmp/battle_after_attack.png', Buffer.from(shot.result.data, 'base64'));
console.log('截图: /tmp/battle_after_attack.png');

const dom = await send('Runtime.evaluate', {expression: `
  (() => {
    const q = s => document.querySelector(s);
    const qa = s => [...document.querySelectorAll(s)];
    return {
      dmgNumbers: qa('.dmg, .dmg-num, .float-dmg, .damage-num, .dmg-float').length,
      dmgTexts: qa('.dmg, .dmg-num, .float-dmg, .damage-num, .dmg-float').map(e => e.textContent.trim()).slice(0,5),
      skillCards: qa('.skill-card, .sk-card').length,
      cardTexts: qa('.skill-card, .sk-card').map(c => c.textContent.trim().slice(0,150)),
      statusIcons: qa('.st-icon, .stat-icon, .badge').length,
      energy: qa('.bt-energy, .energy-bar').map(e => e.textContent.trim()),
    };
  })()
`, returnByValue: true});
console.log(JSON.stringify(dom.result.result.value, null, 2));
ws.close();
})().catch(e => { console.error(e); process.exit(1); });
