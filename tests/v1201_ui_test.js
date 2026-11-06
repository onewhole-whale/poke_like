/* v1.20.1 UI 修正与代码动画 验收
   CDP 打开战斗界面截图核对 12 条 */
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

// 导航到游戏
await send('Page.enable');
await send('Runtime.enable');
await send('Page.navigate', {url: 'http://127.0.0.1:8765/spirit-refinery/index.html?v=' + Date.now()});
await new Promise(r => setTimeout(r, 3000));

// 重新进战斗（带 name 字段）
await send('Runtime.evaluate', {expression: `
  localStorage.clear(); location.reload();
`});
await new Promise(r => setTimeout(r, 3000));

await send('Runtime.evaluate', {expression: `
  (() => {
    S.spirits = [{id:'sp1', speciesId:'JL_fire_normal_0001', elem:'fire', lvl:10, hp:100, maxHp:100, energy:5, energyMax:10, iv:{}, nature:'', skills:['f_ember'], exp:0, aff:{}, perks:[], shiny:false, ivs:{}, name:'测试火狐'}];
    S.team = ['sp1']; S.mats = {}; S.dexSeen = {}; S.dexClaimed = {};
    location.hash = '#/wild'; route();
    startBattle({speciesId:'JL_water_normal_0023', elem:'water', lvl:8, rarity:'normal', name:'测试水妖'});
    return 'ok';
  })()
`});
await new Promise(r => setTimeout(r, 1500));

// 截图初始界面
const shot1 = await send('Page.captureScreenshot', {format: 'png', captureBeyondViewport: true});
fs.writeFileSync('/tmp/v1201_initial.png', Buffer.from(shot1.result.data, 'base64'));
console.log('初始截图: /tmp/v1201_initial.png');

// DOM 核对 1-7
const dom = await send('Runtime.evaluate', {expression: `
  (() => {
    const q = s => document.querySelector(s);
    const qa = s => [...document.querySelectorAll(s)];
    return {
      // 1. 名字在立绘框内
      namePl: (q('.bt-pl-name, .pl-name, .sp-name')||{}).textContent || '',
      nameBe: (q('.bt-be-name, .be-name, .en-name')||{}).textContent || '',
      // 2. 血条三角刻度
      hpTicks: qa('.bt-hp-ticks, .hp-ticks, .hp-tick').length,
      // 3. 能量位置+格式
      energy: qa('.bt-energy, .energy-bar').map(e => e.textContent.trim()),
      // 4. 状态栏初始为空
      statusIcons: qa('.st-icon, .status-icon, .st-badge').length,
      // 5. 队列栏
      queueBar: qa('.queue, .queue-bar, .bt-queue').length,
      // 6. 技能卡片尺寸（拿 computed style）
      skillCardH: (() => { const c = q('.skill-btn, .sk-card, .skill-card'); return c ? Math.round(c.getBoundingClientRect().height) : 0; })(),
      // 7. 战斗场地尺寸
      battleFieldH: (() => { const c = q('.battle-field, .battlefield, .arena, #arena'); return c ? Math.round(c.getBoundingClientRect().height) : 0; })(),
      // 8-12. CSS 动画类
      hasAttackAnim: /attack|lunge|dash|forward/.test(document.styleSheets && [...document.styleSheets].map(s => {try{return s.cssRules?[...s.cssRules].map(r=>r.cssText).join(''):''}catch(e){return ''}}).join('')),
      hasHitAnim: /hit|shake|flash|red-flash/.test(document.body.innerText),
      hasDmgFloat: /dmg-float|float-dmg|dmg-num/.test(document.body.innerHTML),
      hasParticle: /particle|canvas-particle/.test(document.body.innerHTML),
    };
  })()
`, returnByValue: true});
console.log('DOM 核对:', JSON.stringify(dom.result.result.value, null, 2));

ws.close();
})().catch(e => { console.error(e); process.exit(1); });
