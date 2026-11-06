
/* 有立绘文件就显示图；加载失败则退回属性 emoji。variant：card 卡片缩略 / sheet 详情大图 / 缺省为战斗立绘。
   shiny 为真且该物种已放出异色图时，先读 assets/portraits/shiny/，失败再退回普通立绘。 */
function fillPortrait(box, speciesId, elem, fallback, variant, shiny){
  const imgCls = variant==='card' ? 'species-card-art' : (variant==='sheet' ? 'species-sheet-art' : 'bt-portrait-img');
  const emCls = variant ? 'species-emoji' : 'bt-portrait-em';
  const emoji = elemIcon(elem, fallback);
  const showEmoji = ()=>{
    box.classList.remove('has-art');
    if(!box.querySelector('.'+emCls)) box.appendChild(el('div', emCls, emoji));
  };
  if(!speciesId){ showEmoji(); return; }
  const num = String(speciesId).match(/(\d{4})$/);
  const file = (num ? num[1]+'_' : '')+speciesId+'.png';
  const normal = 'assets/portraits/'+file;
  const src = (shiny && typeof hasShinyArt==='function' && hasShinyArt(speciesId)) ? 'assets/portraits/shiny/'+file : normal;
  const img = document.createElement('img');
  img.className = imgCls;
  img.alt = '';
  img.onload = function(){ box.classList.add('has-art'); };
  img.onerror = function(){
    if(img.dataset.fallback!=='1' && img.src.indexOf('/shiny/')>=0){
      img.dataset.fallback='1';
      img.src = normal;
      return;
    }
    img.remove();
    showEmoji();
  };
  img.src = src;
  box.appendChild(img);
}
function renderBattle(opts){
  const b = opts.battle, sp = opts.sp, ctx = opts.ctx || {};
  const defOf = ctx.defOf || skillById;
  const usableOf = ctx.usableOf || (d=>skillUsable(sp,d));
  const onSkill = ctx.onSkill || battleSkill;
  const onResult = ctx.onResult || battleResultModal;
  const card = el('div','wild-node-card','');
  card.innerHTML = '<div class="wn-tag">战斗 · '+(b.mode==='ambush'?'被突袭':(b.mode==='sneak'?'悄悄突袭':(b.mode==='dungeon'?'秘境连战':'正面对峙')))+'</div>';
  const pad = n => String(n).padStart(2,'0');
  const wrap = el('div','bt-wrap','');
  function stCls(k, def){
    const map = {poison:'poison',burn:'burn',freeze:'freeze',sleep:'sleep',para:'para',confusion:'confusion',parasitic:'parasitic',flinch:'flinch',wenling:'wenling'};
    if(map[k]) return map[k];
    if(def.kind==='stat') return /_down$/.test(k) ? 'debuff' : 'buff';
    if(def.kind==='attr') return def.isDebuff ? 'debuff' : 'buff';
    return 'neutral';
  }
  function iconRows(st){
    const rows = [];
    if(!st) return rows;
    ['atk','def','spa','sdef','spd'].forEach(k=>{
      const v = st[k]||0;
      if(!v) return;
      const id = v>0 ? k+'_up' : k+'_down';
      const def = SKILL_STATUS[id];
      if(!def) return;
      const layers = k==='spd' ? Math.max(1, Math.round(Math.abs(v)/10)) : Math.max(1, Math.round(Math.abs(v)*10));
      rows.push({id:id, name:def.name, layers:layers, cls:v>0?'buff':'debuff'});
    });
    Object.entries(st).forEach(([k,v])=>{
      if(k==='atk'||k==='def'||k==='spa'||k==='sdef'||k==='spd') return;
      if(!v || (typeof v==='number' && v<=0)) return;
      const layers = typeof v==='number' ? v : (v.layers||0);
      if(layers<=0) return;
      const def = SKILL_STATUS[k]; if(!def) return;
      rows.push({id:k, name:def.name, layers:layers, cls:stCls(k, def)});
    });
    return rows;
  }
  function renderStIcons(st, side){
    const box = el('div','bt-status','');
    const now = iconRows(st);
    const prev = (b._iconSnap && b._iconSnap[side]) || {};
    const meta = b._iconMeta || (b._iconMeta = {});
    const seen = {};
    now.forEach(row=>{
      seen[row.id] = 1;
      meta[side+'|'+row.id] = row;
      const ic = el('div','bt-st-ic '+row.cls+(prev[row.id]?'':' popIn'), (row.name||row.id).slice(0,1));
      ic.title = row.name+' ×'+row.layers;
      ic.appendChild(el('span','bt-st-layers', row.layers));
      box.appendChild(ic);
    });
    Object.keys(prev).forEach(id=>{
      if(seen[id]) return;
      const row = meta[side+'|'+id] || {name:id, cls:'neutral'};
      const ic = el('div','bt-st-ic '+row.cls+' popOut', (row.name||id).slice(0,1));
      ic.title = row.name||id;
      box.appendChild(ic);
    });
    b._iconSnap = b._iconSnap || {};
    b._iconSnap[side] = seen;
    return box;
  }
  function renderQueue(side){
    const box = el('div','bt-queue','');
    if(side==='enemy' && b.queue && b.queue.length){
      b.queue.forEach(q=>{
        const sd = SPECIES[q.speciesId];
        box.appendChild(el('span','bt-q-chip', (sd&&sd.elem?elemIcon(sd.elem,'👹'):'👹')+esc(q.name||q.speciesId)));
      });
    } else {
      box.textContent = '—';
    }
    return box;
  }
  const mySide = el('div','bt-side','');
  const myPortrait = el('div','bt-portrait','<div class="bt-name">'+esc(sp.name)+'</div><div class="bt-lv">Lv.'+(sp.lvl||1)+'</div>');
  fillPortrait(myPortrait, sp.speciesId, sp.elem, '🐺', null, !!sp.shiny);
  myPortrait.appendChild(renderStIcons(b.spSt, 'player'));
  mySide.appendChild(myPortrait);
  mySide.appendChild(el('div','bt-side-hp', Math.max(0,Math.round(b.spHp))+'/'+b.spMax));
  mySide.appendChild(renderQueue('player'));
  wrap.appendChild(mySide);
  const mid = el('div','bt-center-col','');
  const hpPct = Math.round(Math.max(0,b.spHp/b.spMax*100)*10)/10;
  const enPct = Math.round(Math.max(0,b.beast.hp/b.beast.maxHp*100)*10)/10;
  // A2：我方血条 hover 显示数值，敌方不显示
  mid.innerHTML = '<div class="bt-top">'+
    '<div class="bt-hp left"><div class="hp-bar" title="'+Math.max(0,Math.round(b.spHp))+'/'+b.spMax+'"><i style="width:'+hpPct+'%"></i><div class="bt-hp-ticks"><span></span><span></span><span></span><span></span><span></span></div></div>'+
    '<div class="bt-energy left">'+pad(b.energy)+'/'+pad(b.energyMax)+'</div></div>'+
    '<div class="bt-round">第 '+(b.round||1)+' 回合</div>'+
    '<div class="bt-hp right"><div class="hp-bar enemy"><i style="width:'+enPct+'%"></i><div class="bt-hp-ticks"><span></span><span></span><span></span><span></span><span></span></div></div>'+
    '<div class="bt-energy">'+pad(b.beastEnergy||0)+'/'+pad(b.beastEnergyMax||10)+'</div></div></div>';
  const stage = el('div','bt-stage','');
  const spIcon = el('div','bt-fighter left', elemIcon(sp.elem,'🐺'));
  const enIcon = el('div','bt-fighter right', elemIcon(b.beast.elem,'👹'));
  stage.appendChild(spIcon); stage.appendChild(enIcon);
  // A5：stage 动画层容器（前冲/受击/飘字/粒子）
  const fxLayer = el('div','bt-fx',''); stage.appendChild(fxLayer);
  mid.appendChild(stage);
  wrap.appendChild(mid);
  const enSide = el('div','bt-side right','');
  const enPortrait = el('div','bt-portrait','<div class="bt-name"><span class="enemy">'+esc(b.beast.name)+'</span></div><div class="bt-lv">Lv.'+(b.beast.lvl||1)+'</div>');
  fillPortrait(enPortrait, b.beast.speciesId, b.beast.elem, '👹', null, !!b.beast.shiny);
  enPortrait.appendChild(renderStIcons(b.beSt, 'enemy'));
  enSide.appendChild(enPortrait);
  enSide.appendChild(el('div','bt-side-hp', Math.max(0,Math.round(b.beast.hp))+'/'+b.beast.maxHp));
  enSide.appendChild(renderQueue('enemy'));
  wrap.appendChild(enSide);
  card.appendChild(wrap);
  const func = el('div','bt-func','');
  const detail = el('div','bt-detail','');
  if(sp.isBeast) detail.style.maxHeight = '520px';
  function showSkills(){
    detail.innerHTML='';
    if(b.phase!=='fight'){ showLog(); return; }
    const capInfo = sp.isBeast ? '妖兽出战 · 无容量体系 · 先手：'+(b.first==='player'?sp.name:b.beast.name) : '技能容量 <b>'+usedCap(sp)+'/'+capacityOf(sp)+'</b> · 先手：'+(b.first==='player'?sp.name:b.beast.name);
    detail.appendChild(el('div','battle-skills-hd', capInfo));
    const grid = el('div','bt-skill-grid','');
    sp.skills.forEach(sk=>{
      const def = defOf(sk.id);
      const usable = def ? usableOf(def) : true;
      const cardEl = el('div','bt-skill-card'+(usable?'':' off'));
      const capTxt = sp.isBeast ? '' : ' · 占容'+skillCapCost(sp, def||sk);
      let main = esc(sk.name), meta = sp.isBeast ? '' : '占容'+skillCapCost(sp, def||sk), vs = '', desc = '';
      if(def){
        const t = skillBattleType(def);
        const pw = (def.power||0)>0 ? def.power : '-';
        const m = typeMult(def.elem, b.beast.elem);
        vs = m>1 ? '<span class="bt-skill-vs up">克制↑</span>' : (m<1 ? '<span class="bt-skill-vs down">抵抗↓</span>' : '<span class="bt-skill-vs norm">正常→</span>');
        meta = t+' · 威力 '+pw+(def.hits>1?' ×'+def.hits+'段':'')+capTxt;
        desc = def.desc ? '<div class="bt-skill-desc">'+esc(def.desc)+'</div>' : '';
        main = '<span class="bt-skill-elem">'+(ELEM[def.elem]?ELEM[def.elem].name:esc(def.elem||'—'))+'</span><span class="bt-skill-nm">'+esc(sk.name)+'</span>';
      } else {
        main = '<span class="bt-skill-elem">—</span><span class="bt-skill-nm">'+esc(sk.name)+'</span>';
      }
      cardEl.innerHTML = '<div class="bt-skill-main">'+main+vs+'</div><div class="bt-skill-meta">'+meta+'</div>'+desc;
      if(usable) cardEl.onclick = ()=> onSkill(sk.id);
      grid.appendChild(cardEl);
    });
    const regenEl = el('div','bt-skill-card','<div><div class="bt-skill-nm">回能</div><div class="bt-skill-meta">机制 · 用一回合回 5 点能量</div></div>');
    regenEl.onclick = ()=> onSkill('regen');
    grid.appendChild(regenEl);
    if(ctx.source==='wild' && b.template==='boss'){
      const fleeEl = el('div','bt-skill-card','<div><div class="bt-skill-nm">逃跑</div><div class="bt-skill-meta">退回上一格，事件保留</div></div>');
      fleeEl.onclick = ()=>{ const w=S.wild; const fr=w.fledFrom; if(fr){w.px=fr.x;w.py=fr.y;} w.phase='move'; w.battle=null; toast('脱离战斗'); renderWild(); };
      grid.appendChild(fleeEl);
    }
    detail.appendChild(grid);
  }
  function showLog(){
    detail.innerHTML='';
    // A3：日志最新在上（数据仍 push 追加，渲染层倒序）
    b.log.slice().reverse().forEach(l=> detail.appendChild(el('div','blog '+l.who, l.text)));
  }
  // 战斗背包：只列 type:battle 药剂，不展示采集工具
  function showBag(){
    detail.innerHTML='';
    detail.appendChild(el('div','battle-skills-hd','背包 · 药剂'));
    const grid = el('div','bt-skill-grid','');
    const inv = S.toolInv || {};
    const entries = Object.entries(inv).filter(([id,n])=>{
      if(!(n>0)) return false;
      const it = (typeof ITEMS!=='undefined' && ITEMS[id]) || null;
      return it && it.type==='battle';
    });
    if(entries.length===0){
      detail.appendChild(el('div','muted','没有可在战斗中使用的药剂。'));
    } else {
      entries.forEach(([id,n])=>{
        const t = ITEMS[id];
        const can = b.phase==='fight';
        const c = el('div','bt-skill-card'+(can?'':' off'));
        const tip = t.battle==='hp' ? '回最大生命 25% · 占一回合' : (t.battle==='energy' ? '能量回满 · 占一回合' : '占一回合');
        c.innerHTML = '<div class="bt-skill-main">'+esc(t.name||id)+'</div><div class="bt-skill-meta">×'+n+' · '+tip+'</div>';
        if(can) c.onclick = ()=>{
          if(ctx.source==='dungeon' && typeof dgBattleUseItem==='function') dgBattleUseItem(id);
          else battleUseItem(id);
        };
        grid.appendChild(c);
      });
      detail.appendChild(grid);
    }
  }
  // C1：普通战斗逃跑（退回上一格、事件格保留不 resolved）
  function showFlee(){
    if(b.phase!=='fight'){ onResult(b, sp); return; }
    if(ctx.source!=='wild'){ toast('秘境连战无法逃跑'); return; }
    const w = S.wild;
    const fr = w.fledFrom; if(fr){ w.px=fr.x; w.py=fr.y; }
    w.phase='move'; w.battle=null; toast('脱离战斗，退回上一格'); renderWild();
  }
  const autoBtn = el('button','bt-func-btn'+(S.autoBattle?' on':''), '自');
  autoBtn.title = '自动战斗（用药/回能见设置）；演出速度在设置里改';
  autoBtn.onclick = ()=>{
    S.autoBattle = !S.autoBattle;
    if(S.autoBattle && b.phase==='fight') kickAutoBattle(b, sp, onSkill, usableOf, ctx);
    else clearAutoBattleTimer();
    render();
  };
  const bSkills = el('button','bt-func-btn','技'); bSkills.onclick = showSkills;
  const bLog = el('button','bt-func-btn','日'); bLog.onclick = showLog;
  const bBag = el('button','bt-func-btn','包'); bBag.onclick = showBag;
  const bFlee = el('button','bt-func-btn','跑'); bFlee.onclick = showFlee;
  func.appendChild(bSkills); func.appendChild(bLog); func.appendChild(bBag); func.appendChild(bFlee); func.appendChild(autoBtn);
  mid.appendChild(func);
  showSkills();
  mid.appendChild(detail);
  if(b.phase!=='fight' && !b.resultShown){
    b.resultShown = true;
    onResult(b, sp);
  }
  const fxMs = playBattleFx(b, fxLayer, spIcon, enIcon, defOf, sp) || 0;
  if(S.autoBattle && b.phase==='fight') scheduleAutoBattle(b, sp, onSkill, usableOf, fxLayer, fxMs, ctx);
  return card;
}
function clearAutoBattleTimer(){
  if(window._autoBattleTimer){ clearTimeout(window._autoBattleTimer); window._autoBattleTimer = null; }
}
function kickAutoBattle(b, sp, onSkill, usableOf, ctx){
  clearAutoBattleTimer();
  if(!S.autoBattle || !b || b.phase!=='fight') return;
  if(b.charge && b.charge.side==='self'){ onSkill('regen'); return; }
  if(b.lock && b.lock.side==='self'){ onSkill((b.lock.skId)||'regen'); return; }
  const act = typeof pickAutoBattleAction==='function'
    ? pickAutoBattleAction(sp, b, usableOf)
    : {kind:'skill', id:'regen'};
  if(act.kind==='item'){
    if(ctx && ctx.source==='dungeon' && typeof dgBattleUseItem==='function') dgBattleUseItem(act.id);
    else if(typeof battleUseItem==='function') battleUseItem(act.id);
    else onSkill('regen');
    return;
  }
  onSkill(act.id||'regen');
}
function scheduleAutoBattle(b, sp, onSkill, usableOf, fxLayer, fxMs, ctx){
  clearAutoBattleTimer();
  if(!S.autoBattle || b.phase!=='fight') return;
  const wait = Math.max(40, (fxMs||0) + 80);
  const tok = fxLayer && fxLayer.dataset ? fxLayer.dataset.fx : '';
  window._autoBattleTimer = setTimeout(()=>{
    window._autoBattleTimer = null;
    if(!S.autoBattle) return;
    if(fxLayer && fxLayer.dataset && tok && fxLayer.dataset.fx!==tok && fxLayer.isConnected) return;
    const still = (S.wild && S.wild.battle===b) || (S.settle && S.settle.battle===b);
    if(!still || b.phase!=='fight') return;
    kickAutoBattle(b, sp, onSkill, usableOf, ctx);
  }, wait);
}
function playBattleFx(b, fxLayer, spIcon, enIcon, defOf, sp){
  const queued = (b._fxQueue && b._fxQueue.length) ? b._fxQueue.slice() : [];
  const q = queued.length ? queued : (b._fx ? [b._fx] : []);
  b._fxQueue = null;
  b._fx = null;
  if(!q.length) return 0;
  playBattleFx._n = (playBattleFx._n||0)+1;
  const tok = String(playBattleFx._n);
  fxLayer.dataset.fx = tok;
  const acts = [], dots = [], ends = [];
  q.forEach(fx=>{
    const phase = fx.phase || ((!fx.kind || fx.kind==='act') ? 'act' : (fx.kind==='dot' ? 'dot' : 'end'));
    if(phase==='dot') dots.push(fx);
    else if(phase==='end') ends.push(fx);
    else acts.push(fx);
  });
  // 出招：冲到位、停一下、走回原位，再空一拍。下一击开始时双方都已站定。
  // 双方都回正之后，先结算持续伤害，再进入回合结束（场地回复等）。
  // LUNGE_MS 与 .bt-fighter 的 transform 过渡一致。倍速 / 跳过演出。
  const spd = S.battleSpeed||'1x';
  const mul = spd==='skip' ? 0 : (spd==='2x' ? 0.5 : 1);
  const LUNGE_MS = Math.round(300 * mul);
  const HOLD_MS = Math.round(180 * mul);
  const REST_MS = Math.round(280 * mul);
  const RELEASE = LUNGE_MS + HOLD_MS;
  const BACK = Math.max(1, RELEASE + LUNGE_MS + REST_MS);
  const TAIL = Math.max(1, Math.round(560 * mul));
  const NUM_MS = Math.max(1, Math.round(1300 * (mul||0.05)));
  let t = 0;
  function schedule(wait, fn){
    const run = (first)=>{
      if(fxLayer.dataset.fx!==tok) return;
      if(!first && !fxLayer.isConnected) return;
      fn();
    };
    if(wait===0) run(true);
    else setTimeout(()=>run(false), wait);
  }
  acts.forEach(fx=>{
    const wait = t;
    schedule(wait, ()=> playAct(fx));
    t += BACK;
  });
  function clearCallout(){
    fxLayer.querySelectorAll('.bt-move-card').forEach(n=>n.remove());
  }
  dots.forEach((fx, i)=>{
    const wait = t;
    schedule(wait, ()=>{
      if(i===0) clearCallout();
      if(fx.kind==='heal') spawnNum(fx.target==='enemy'?'66%':'14%', fx.dmg, 'heal', '', 36);
      else spawnDot(fx);
    });
    t += TAIL;
  });
  ends.forEach(fx=>{
    const wait = t;
    schedule(wait, ()=>{
      clearCallout();
      spawnNum(fx.target==='enemy'?'66%':'14%', fx.dmg, 'heal', '', 36);
    });
    t += TAIL;
  });
  function spawnNum(left, text, cls, tag, lift){
    const n = el('div','bt-dmg-num'+(cls?' '+cls:''), (tag?'<i>'+tag+'</i>':'')+text);
    n.style.left = left;
    n.style.bottom = (78+(lift||0))+'px';
    fxLayer.appendChild(n);
    setTimeout(()=>{ if(n.parentNode) n.remove(); }, NUM_MS);
  }
  function spawnDot(fx){
    const map = {poison:['#d2a6ff','毒'], burn:['#ff9a4a','灼'], freeze:['#c7ecff','冻'], parasitic:['#e4c48a','寄'], erosion:['#e6d39a','蚀']};
    const pair = map[fx.status] || ['#f4ead8',''];
    const n = el('div','bt-dmg-num dot', (pair[1]?'<i>'+pair[1]+'</i>':'')+fx.dmg);
    n.style.color = pair[0];
    n.style.left = fx.target==='enemy' ? '66%' : '14%';
    n.style.bottom = '124px';
    fxLayer.appendChild(n);
    setTimeout(()=>{ if(n.parentNode) n.remove(); }, NUM_MS);
  }
  function playAct(fx){
    fxLayer.querySelectorAll('.bt-move-card').forEach(n=>n.remove());
    const skDef = fx.skId ? defOf(fx.skId) : null;
    const skName = fx.name || (skDef ? skDef.name : (fx.skId||''));
    const type = fx.type || (skDef && skDef.type) || '';
    const landed = fx.landed!=null ? !!fx.landed : !!(fx.hitBeast || fx.hitSelf);
    let mark = '';
    if(type==='攻击' && landed && fx.elem){
      const defElem = fx.side==='player' ? b.beast.elem : sp.elem;
      const mult = typeMult(fx.elem, defElem);
      mark = mult>1 ? '△' : (mult<1 ? '▽' : '');
    }
    if(skName){
      const card = el('div','bt-move-card'+(fx.side==='player'?' left':' right'));
      card.textContent = skName+mark;
      fxLayer.appendChild(card);
      setTimeout(()=>{ if(card.parentNode) card.style.opacity='0'; }, Math.max(0, BACK - Math.round(160*mul)));
      setTimeout(()=>{ if(card.parentNode) card.remove(); }, BACK);
    }
    const atkEl = fx.side==='player' ? spIcon : enIcon;
    const defEl = fx.hitBeast ? enIcon : (fx.hitSelf ? spIcon : null);
    [spIcon, enIcon].forEach(node=>{ if(node) node.classList.remove('lunge-left','lunge-right'); });
    if(atkEl && mul>0){
      void atkEl.offsetWidth;
      atkEl.classList.add(fx.side==='player'?'lunge-left':'lunge-right');
      setTimeout(()=>{ if(atkEl.isConnected) atkEl.classList.remove('lunge-left','lunge-right'); }, Math.max(1, RELEASE));
    }
    if(defEl){
      defEl.classList.remove('hit');
      void defEl.offsetWidth;
      defEl.classList.add('hit');
      setTimeout(()=>{ if(defEl.isConnected) defEl.classList.remove('hit'); }, Math.max(1, Math.round(260*mul)));
    }
    if(fx.dmg>0){
      const onEnemy = !!fx.hitBeast || (fx.side==='player' && !fx.hitSelf);
      spawnNum(onEnemy?'66%':'14%', fx.dmg, fx.crit?'crit':'', '');
    }
    if(fx.heal>0) spawnNum(fx.side==='player'?'14%':'66%', fx.heal, 'heal', '', 34);
    if(fx.elem){
      const COLOR = {fire:'#ff6b4a',water:'#4aa8ff',grass:'#6fcf6f',thunder:'#ffd94a',ice:'#e8f4ff',dark:'#9b59b6'};
      const col = COLOR[fx.elem] || '#ccc';
      const anchor = fx.side==='player' ? 66 : 22;
      for(let i=0;i<14;i++){
        const p = el('div','bt-particle');
        const size = 7+Math.random()*8;
        const life = 0.72+Math.random()*0.38;
        const delay = Math.random()*0.22;
        p.style.cssText = 'left:'+(anchor+Math.random()*16-8)+'%;bottom:'+(18+Math.random()*36)+'px;width:'+size+'px;height:'+size+'px;background:'+col+';'+
          '--dx:'+(Math.random()*28-14)+'px;--rise:'+(-78-Math.random()*56)+'px;--life:'+life+'s;--delay:'+delay+'s;';
        fxLayer.appendChild(p);
        setTimeout(()=>{ if(p.parentNode) p.remove(); }, (life+delay)*1000+40);
      }
    }
  }
  return t;
}