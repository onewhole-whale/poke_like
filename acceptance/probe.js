// 把当前游戏加载进 Node，按需求跑一遍，只往 stdout 打一份 JSON。
// 模块顺序见游戏目录里的 src/modules.txt。这里不改规则，只观察它实际做了什么。
const fs = require('fs');
const path = require('path');

const GAME = path.join(__dirname, '..');

function mkNode() {
  const n = {
    className: '',
    title: '',
    style: {},
    dataset: {},
    children: [],
    parent: null,
    _html: '',
    _text: '',
    onclick: null,
  };
  n.classList = {
    add(...cs) {
      const have = new Set(n.className.split(/\s+/).filter(Boolean));
      cs.forEach(c => have.add(c));
      n.className = [...have].join(' ');
    },
    remove(...cs) {
      const drop = new Set(cs);
      n.className = n.className.split(/\s+/).filter(c => c && !drop.has(c)).join(' ');
    },
    contains(c) { return n.className.split(/\s+/).includes(c); },
    toggle(c, force) {
      const on = n.classList.contains(c);
      const next = force == null ? !on : !!force;
      if (next) n.classList.add(c); else n.classList.remove(c);
    },
  };
  Object.defineProperty(n, 'innerHTML', {
    get() { return n._html; },
    set(v) {
      n._html = v == null ? '' : String(v);
      n._text = n._html.replace(/<[^>]+>/g, '');
      n.children = [];
    },
  });
  Object.defineProperty(n, 'textContent', {
    get() { return (n._text || '') + n.children.map(c => c.textContent).join(''); },
    set(v) { n._text = v == null ? '' : String(v); n._html = ''; n.children = []; },
  });
  n.appendChild = c => { c.parent = n; n.children.push(c); return c; };
  n.remove = () => {
    if (n.parent) n.parent.children = n.parent.children.filter(x => x !== n);
  };
  n.setAttribute = (k, v) => { if (k === 'title') n.title = String(v); };
  n.getAttribute = k => (k === 'title' ? (n.title || null) : null);
  n.addEventListener = () => {};
  n.click = () => { if (typeof n.onclick === 'function') n.onclick(); };
  return n;
}

const byId = {};
function bySelector(sel) {
  if (typeof sel === 'string' && sel.startsWith('#')) {
    const id = sel.slice(1);
    if (!byId[id]) byId[id] = mkNode();
    return byId[id];
  }
  return mkNode();
}

global.document = {
  querySelector: bySelector,
  querySelectorAll: () => [],
  createElement: () => mkNode(),
  createTextNode: t => { const n = mkNode(); n.textContent = t; return n; },
  addEventListener: () => {},
  body: mkNode(),
};
global.window = {
  addEventListener: () => {},
  location: { hash: '#/stable' },
};
global.location = global.window.location;
global.localStorage = {
  _d: {},
  getItem(k) { return this._d[k] || null; },
  setItem(k, v) { this._d[k] = String(v); },
  removeItem(k) { delete this._d[k]; },
};
global.setTimeout = () => 0;
global.setInterval = () => 0;
global.clearTimeout = () => {};
global.requestAnimationFrame = () => 0;

const order = fs.readFileSync(path.join(GAME, 'src', 'modules.txt'), 'utf8')
  .split(/\r?\n/).map(l => l.trim()).filter(l => l && !l.startsWith('#'));
let code = '';
for (const rel of order) {
  if (rel === 'src/app/boot.js') continue;
  code += fs.readFileSync(path.join(GAME, rel), 'utf8') + '\n';
}
code += 'init();\nglobalThis.S = S;\n';
eval(code);

function walk(n, acc) {
  acc.push(n);
  (n.children || []).forEach(c => walk(c, acc));
  return acc;
}
function nodes(root) { return root ? walk(root, []) : []; }
function cls(n) { return n.className || ''; }
function has(n, c) { return cls(n).split(/\s+/).includes(c); }

function flat(root) {
  return nodes(root).map(n => ({
    cls: cls(n),
    text: n._text || '',
    html: n._html || '',
    title: n.title || '',
  }));
}

function findBtn(root, label) {
  return nodes(root).find(n => (n._text || '').trim() === label) || null;
}

function components(cells, terrainId) {
  const size = cells.length;
  const seen = new Set();
  let n = 0;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const k = x + ',' + y;
      if (cells[y][x].terrain !== terrainId || seen.has(k)) continue;
      n++;
      const q = [[x, y]];
      seen.add(k);
      while (q.length) {
        const [cx, cy] = q.shift();
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx, ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
          const nk = nx + ',' + ny;
          if (seen.has(nk) || cells[ny][nx].terrain !== terrainId) continue;
          seen.add(nk);
          q.push([nx, ny]);
        }
      }
    }
  }
  return n;
}

function mapFacts(mapId) {
  const g = genSandbox(mapId);
  let empty = 0;
  for (const row of g.cells) for (const c of row) if (!c.terrain) empty++;
  return { ok: true, size: g.size, empty, cells: g.cells.length };
}

function section(out, key, fn) {
  try { out[key] = fn(); }
  catch (e) { out[key] = { error: e && e.stack ? String(e.stack) : String(e) }; }
}

const out = {};

section(out, 'damage', () => {
  const prev = Math.random;
  Math.random = () => 1;
  const base = calcDamage(100, 30, 50, 50, 60, {}, 'fire', 'thunder');
  const crushed = calcDamage(100, 30, 50, 50, 60, {}, 'fire', 'grass');
  const resisted = calcDamage(100, 30, 50, 50, 60, {}, 'fire', 'water');
  const floor = calcDamage(1, 1, 99999, 1, 1, {}, 'fire', 'thunder');
  Math.random = prev;
  return { base, crushed, resisted, floor };
});

section(out, 'exp', () => {
  const sp = makeSpirit('JL_fire_normal_0001', false, 'probe');
  sp.lvl = 80;
  sp.exp = 0;
  gainExp(sp, 10, 'normal', 'normal');
  const normal = sp.exp;
  sp.exp = 0;
  gainExp(sp, 10, 'normal', 'elite');
  const eliteTemplate = sp.exp;
  sp.exp = 0;
  gainExp(sp, 10, 'legend', 'boss');
  const legendBoss = sp.exp;
  return { normal, eliteTemplate, legendBoss };
});

section(out, 'maps', () => {
  const maps = {};
  for (const id of ['gentlebreeze', 'stillswamp', 'smokevolcano']) {
    try { maps[id] = mapFacts(id); }
    catch (e) { maps[id] = { ok: false, error: String(e && e.message || e) }; }
  }
  let multi = 0;
  const runs = 40;
  let swampErr = null;
  for (let i = 0; i < runs; i++) {
    try {
      const g = genSandbox('stillswamp');
      if (components(g.cells, 'poison_swamp') >= 2) multi++;
    } catch (e) {
      swampErr = String(e && e.message || e);
      break;
    }
  }
  maps.stillswampHop = { runs, multi, error: swampErr };
  return maps;
});

section(out, 'upMat', () => {
  const normal = upMatFor('SC_none_normal_000002', 'normal');
  const elite = upMatFor('SC_none_normal_000002', 'elite');
  const boss = upMatFor('SC_none_normal_000002', 'boss');
  const q = id => (MATS[id] && MATS[id].quality) || null;
  return {
    normal, elite, boss,
    normalQ: q(normal), eliteQ: q(elite), bossQ: q(boss),
  };
});

section(out, 'killUpgrade', () => {
  const speciesId = 'JL_fire_normal_0001';
  const base = beastDrops(speciesId, 'kill');
  const merged = Object.assign({}, base);
  let upgraded = 0;
  for (const k in base) {
    const up = upMatFor(k, 'elite');
    if (up !== k) { merged[up] = (merged[up] || 0) + base[k]; upgraded++; }
  }
  return { speciesId, baseIds: Object.keys(base), upgraded, mergedIds: Object.keys(merged) };
});

section(out, 'names', () => {
  const bag = [];
  const push = (name, where) => { if (name) bag.push({ name, where }); };
  for (const e in DIRECT_NAMES) (DIRECT_NAMES[e] || []).forEach(n => push(n, 'DIRECT_NAMES.' + e));
  for (const e in PURE_ULT_NAMES) (PURE_ULT_NAMES[e] || []).forEach(n => push(n, 'PURE_ULT_NAMES.' + e));
  for (const e in BURST_DEFS) push(BURST_DEFS[e] && BURST_DEFS[e].name, 'BURST_DEFS.' + e);
  for (const id in SPECIES) push(SPECIES[id].name, 'SPECIES.' + id);
  for (const id in DUNGEON_SPECIALS) push(DUNGEON_SPECIALS[id].name, 'DUNGEON_SPECIALS.' + id);
  for (const id in MATS) push(MATS[id].name, 'MATS.' + id);
  if (typeof GRASS_POOL !== 'undefined') GRASS_POOL.forEach(s => push(s.name, 'GRASS_POOL.' + s.id));
  for (const e in SAMPLE_SKILLS) (SAMPLE_SKILLS[e] || []).forEach(s => push(s.name, 'SAMPLE_SKILLS.' + e));
  const bad = bag.filter(x => /[圣神魔]/.test(x.name));
  return { checked: bag.length, bad };
});

section(out, 'battle', () => {
  const S = globalThis.S;
  const sp = S.spirits[0];
  const facts = {};
  const prev = Math.random;
  Math.random = () => 0.99;

  S.wild = S.wild || {};
  S.wild.mapId = 'gentlebreeze';
  S.wild.spiritId = sp.id;
  S.wild.phase = 'battle';
  S.wild.px = 1;
  S.wild.py = 1;
  S.wild.fledFrom = { x: 2, y: 3 };
  S.wild.cells = [];
  for (let y = 0; y < 7; y++) {
    const row = [];
    for (let x = 0; x < 7; x++) row.push({ x, y, resolved: false, event: { kind: 'fight' } });
    S.wild.cells.push(row);
  }

  const beast = wildBeast('JL_water_normal_0023', 1);
  beast.maxHp = 999999;
  beast.hp = 999999;
  beast.atk = 0;
  beast.spa = 0;
  startBattle(beast, 'normal', []);
  const b = S.wild.battle;
  b.beSt.sleep = 5;
  b.spSt.energyUp = 3;
  b.energy = 10;
  const sk = sp.skills[0];
  const energyBefore = b.energy;
  const skillEnergy = (skillById(sk.id) || sk).energy || 0;
  battleSkill(sk.id);
  facts.wildSpent = energyBefore - S.wild.battle.energy;
  facts.skillEnergy = skillEnergy;
  facts.energyUp = 3;

  const root = byId['wild-root'];
  const view = flat(root);
  const card = view.find(n => n.cls.includes('bt-move-card'));
  facts.fullRoundCard = card ? { cls: card.cls, text: card.text } : null;
  facts.fullRoundDmg = view.filter(n => n.cls.includes('bt-dmg-num')).map(n => ({ cls: n.cls, text: n.text }));
  facts.fullRoundHeal = view.filter(n => n.cls.includes('heal')).length;
  facts.fullRoundParticles = view.filter(n => n.cls.includes('bt-particle')).length;
  facts.lunge = view.some(n => n.cls.includes('lunge-right') || n.cls.includes('lunge-left'));
  facts.hit = view.some(n => n.cls.split(/\s+/).includes('hit'));
  const htmlAll = view.map(n => n.html).join('\n');
  facts.sideHp = [...htmlAll.matchAll(/bt-side-hp">(\d+\/\d+)/g)].map(m => m[1]);
  const titles = [...htmlAll.matchAll(/title="(\d+\/\d+)"/g)].map(m => m[1]);
  facts.hpTitles = titles;
  facts.enemyHpHasTitle = /hp-bar enemy"[^>]*title=/.test(htmlAll) || /class="hp-bar enemy" title=/.test(htmlAll);
  facts.hasBtWrap = view.some(n => n.cls.includes('bt-wrap'));
  facts.hasBp = view.some(n => n.cls.includes('bp-'));
  facts.energyText = (view.find(n => n.cls.includes('bt-energy')) || {}).text || '';
  facts.roundText = (view.find(n => n.cls.includes('bt-round')) || {}).text || '';

  const logBtn = findBtn(root, '日');
  if (logBtn) logBtn.click();
  const afterLog = flat(root);
  const blogs = afterLog.filter(n => n.cls.includes('blog')).map(n => n.text.replace(/<[^>]+>/g, ''));
  const live = S.wild.battle;
  facts.logDomFirst = blogs[0] || '';
  facts.logDataLast = live && live.log.length ? String(live.log[live.log.length - 1].text).replace(/<[^>]+>/g, '') : '';

  const bagBtn = findBtn(root, '包');
  S.toolInv = {};
  if (bagBtn) bagBtn.click();
  facts.bagEmpty = flat(root).map(n => n.text).join(' ').includes('背包空空如也');
  S.toolInv = { 'pick-normal': 2 };
  if (bagBtn) bagBtn.click();
  const bagText = flat(root).map(n => n.text).join(' ');
  facts.bagHasPick = bagText.includes('普通采集镐');
  facts.bagError = null;

  const fleeBtn = findBtn(root, '跑');
  const cell = S.wild.cells[1][1];
  cell.resolved = false;
  let fleeErr = null;
  try { if (fleeBtn) fleeBtn.click(); else fleeErr = '没有逃跑按钮'; }
  catch (e) { fleeErr = String(e && e.message || e); }
  facts.flee = {
    phase: S.wild.phase,
    battle: S.wild.battle,
    px: S.wild.px,
    py: S.wild.py,
    resolved: cell.resolved,
    error: fleeErr,
  };

  // 敌方单独出招后再渲染，看名片和克制是不是对着玩家
  const water = wildBeast('JL_water_normal_0023', 5);
  water.maxHp = 999999; water.hp = 999999; water.atk = 80; water.spa = 80;
  startBattle(water, 'normal', []);
  const eb = S.wild.battle;
  eb.spHp = 999999;
  eb.beSt = initStatus();
  Math.random = () => 0.99;
  beastTurn(eb);
  facts.enemyFx = eb._fx ? { side: eb._fx.side, elem: eb._fx.elem, dmg: eb._fx.dmg, skId: eb._fx.skId } : null;
  renderWild();
  const ev = flat(byId['wild-root']);
  const ecard = ev.find(n => n.cls.includes('bt-move-card'));
  facts.enemyCard = ecard ? { cls: ecard.cls, text: ecard.text } : null;
  facts.enemyDmg = ev.filter(n => n.cls.includes('bt-dmg-num')).map(n => n.cls + ':' + n.text);
  facts.typeWaterVsFire = typeMult('water', 'fire');
  facts.typeWaterVsWater = typeMult('water', 'water');

  // 副本：同一套界面、能耗、能量上限
  S.settle = {
    spiritId: sp.id,
    enemies: [wildBeast('JL_water_normal_0023', 3)],
    idx: 0, buffs: [], phase: 'fight', kills: 0, logs: [], exp: 0,
  };
  startDgFight();
  const db = S.settle.battle;
  db.beast.maxHp = 999999; db.beast.hp = 999999; db.beast.atk = 0; db.beast.spa = 0;
  db.beSt.sleep = 5;
  db.spSt.energyUp = 3;
  db.energy = 10;
  const dsk = skillById(sp.skills[0].id);
  const dBefore = db.energy;
  dgPlayerTurn(sp, dsk, db, false, false);
  facts.dungeonSpent = dBefore - db.energy;
  facts.beastEnergyMax = db.beastEnergyMax;
  const dcard = renderBattle({
    battle: db,
    sp: sp,
    ctx: { source: 'dungeon', defOf: skillById, usableOf: () => true, onSkill: () => {}, onResult: () => {} },
  });
  const dv = flat(dcard);
  facts.dungeonBt = dv.some(n => n.cls.includes('bt-wrap'));
  facts.dungeonBp = dv.some(n => n.cls.includes('bp-'));
  const dhtml = dv.map(n => n.html).join('\n');
  facts.dungeonEnergy = [...dhtml.matchAll(/class="bt-energy[^"]*">(\d+\/\d+)/g)].map(m => m[1]);

  // 妖兽出战
  const beastId = S.beasts[0].id;
  S.wild.spiritId = 'beast:' + beastId;
  S.wild.phase = 'battle';
  const ally = wildBeast('JL_grass_normal_0012', 1);
  ally.maxHp = 50; ally.hp = 50;
  startBattle(ally, 'normal', []);
  const ws = wildSpirit();
  facts.beastLead = {
    isBeast: !!(ws && ws.isBeast),
    skillCount: ws && ws.skills ? ws.skills.length : 0,
    elems: ws && ws.skills ? [...new Set(ws.skills.map(s => s.elem))] : [],
  };
  renderWild();
  const bv = flat(byId['wild-root']).map(n => n.text).join(' ');
  facts.beastHasRegen = bv.includes('回能');
  facts.beastShowsCap = bv.includes('占容');

  // 捕捉点亮图鉴
  const sid = 'JL_ice_normal_0004';
  if (S.dexSeen) delete S.dexSeen[sid];
  Math.random = () => 0.99;
  startBattle(wildBeast(sid, 1), 'normal', []);
  const caughtBattle = S.wild.battle;
  caughtBattle.phase = 'won';
  caughtBattle.beast.speciesId = sid;
  battleResultModal(caughtBattle, sp);
  const failBtn = nodes(byId['modal-box']).find(n => (n._text || '').includes('捕捉'));
  try { if (failBtn) failBtn.click(); }
  catch (e) { facts.catchFailError = String(e && e.message || e); }
  facts.dexAfterFail = !!(S.dexSeen && S.dexSeen[sid]);
  Math.random = () => 0;
  battleResultModal(caughtBattle, sp);
  const okBtn = nodes(byId['modal-box']).find(n => (n._text || '').includes('捕捉'));
  let catchErr = null;
  try { if (okBtn) okBtn.click(); else catchErr = '没有捕捉按钮'; }
  catch (e) { catchErr = String(e && e.message || e); }
  facts.dexAfterCatch = !!(S.dexSeen && S.dexSeen[sid]);
  facts.catchError = catchErr;

  // 事件链面板
  S.wild.spiritId = sp.id;
  startBattle(wildBeast('JL_fire_normal_0001', 1), 'normal', []);
  const panel = eventStatPanel('atk');
  const changed = S.wild.battle.spAtk;
  S.wild.battle.spAtk = changed + 25;
  facts.eventStat = { before: panel, after: eventStatPanel('atk'), delta: 25 };

  S.skillEdits = S.skillEdits || {};
  S.skillEdits.probe_heal = {
    id: 'probe_heal', name: '探针回春', kind: 'ult', cost: 1, energy: 0, power: 0,
    elem: 'water', type: '状态', track: 'spec',
    effects: [{ target: 'self', type: 'heal', layers: 20 }],
  };
  if (!sp.skills.some(s => s.id === 'probe_heal')) {
    sp.skills.push({ id: 'probe_heal', name: '探针回春', kind: 'ult', cost: 1, elem: 'water', mastery: 50 });
  }
  S.wild.spiritId = sp.id;
  const healBeast = wildBeast('JL_fire_normal_0001', 1);
  healBeast.maxHp = 999999; healBeast.hp = 999999; healBeast.atk = 0; healBeast.spa = 0;
  startBattle(healBeast, 'normal', []);
  S.wild.battle.beSt.sleep = 5;
  S.wild.battle.energy = 10;
  S.wild.battle.spHp = Math.floor(S.wild.battle.spMax / 2);
  battleSkill('probe_heal');
  const healView = flat(byId['wild-root']);
  facts.healNodes = healView.filter(n => n.cls.includes('bt-dmg-num')).map(n => n.cls + ':' + n.text);
  facts.fullRoundHeal = healView.filter(n => n.cls.includes('heal')).length;

  Math.random = prev;
  return facts;
});

process.stdout.write(JSON.stringify(out));
