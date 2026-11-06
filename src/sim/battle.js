

/* 战斗引擎（传统回合制 · 三分类技能 · 能量 · 崩铁伤害）
   一套逻辑：速度决定先后，每轮双方各行动一次；先手方行动后，后手若还站着则行动。
   突袭 / 被突袭 只是开战前多一个「只有突袭方结算一次攻击」的额外回合。
   能量：上限 20，初始 5；直接攻击 0/2/4/6/8 能耗；绝技耗能；爆发技需能量 ≥ 阈值，使用后清空；【回能】回复 5。 */
function startBattle(beast, mode, battleBuffs, chainCtx){
  const sp = wildSpirit();
  const st = spiritStats(sp);
  const first = st.spd>=beast.spd ? 'player' : 'beast';
  S.wild.battle = {
    beast, mode, spHp:st.hp, spMax:st.hp, spAtk:st.atk, spDef:st.def,
    spSpa:st.spa, spSdef:st.sdef, spLvl:sp.lvl||1, spSpd:st.spd,
    energy:5, energyMax:10, beastEnergy:5, beastEnergyMax:10,
    spBuffs:{guard:0, powerUp:0}, beastBuffs:{vuln:0}, cds:{},
    spSt:initStatus(), beSt:initStatus(),
    field:null, hitSelf:false, hitBeast:false,
    charge:null, lock:null, recharge:null,   // v1.12.0 蓄力/连舞/力竭战斗状态
    battleBuffs:battleBuffs||[],   // M3-1 战斗全程常驻 buff
    template:beast.template||'normal',
    chainCtx:chainCtx||null,   // M3-1-5a 事件链车轮战上下文
    first, round:0, log:[], phase:'fight', resultShown:false   // M3-2 补丁：战斗结果弹框只弹一次
  };
  const b = S.wild.battle;
  S.wild.phase = 'battle';
  // M3-2 补丁 2.5：敌方队列 = 事件链车轮战的剩余敌人（普通野外 1v1 无队列 → 渲染留空占位）
  if(chainCtx && chainCtx.chainIdx!=null){
    const p = S.wild.chainPending;
    if(p && p.enemies) b.queue = p.enemies.slice(chainCtx.chainIdx+1).map(e=>({speciesId:e.speciesId, name:(SPECIES[e.speciesId]||{}).name||e.speciesId}));
  }
  // 额外回合：只有发动突袭的一方结算一次攻击（按直接攻击 60×1 模板）
  if(mode==='sneak'){
    const m0 = masteryMult((sp.skills[0]||{}).mastery!=null ? sp.skills[0].mastery : 30);
    const t0 = (sp.skills[0]||{}).track || DIRECT_TRACK[sp.elem] || 'phys';
    const dmg = calcDamage(t0==='spec'?b.spSpa:b.spAtk, b.spLvl, t0==='spec'?(b.beast.sdef||0):(b.beast.def||0), b.beast.lvl||1, 60*m0, {stab:1.25}, sp.elem, b.beast.elem);
    b.beast.hp -= dmg;
    b.hitBeast = true;
    b.log.push({who:'pl', text:'<b>悄然突袭</b>：'+sp.name+' 先发制人，'+b.beast.name+' 受到 <b>'+dmg+'</b> 点伤害'+typeLabel(sp.elem, b.beast.elem)+'。'});
    if(b.beast.hp<=0){ markWin(b, sp); }
  } else if(mode==='ambush'){
    const t0 = DIRECT_TRACK[b.beast.elem] || 'phys';
    const dmg = calcDamage(t0==='spec'?(b.beast.spa||0):b.beast.atk, b.beast.lvl||1, t0==='spec'?b.spSdef:b.spDef, b.spLvl, 60, {stab:1.25}, b.beast.elem, sp.elem);
    b.spHp -= dmg;
    b.hitSelf = true;
    b.log.push({who:'be', text:'<b>被突袭</b>：'+b.beast.name+' 先发制人，'+sp.name+' 受到 <b>'+dmg+'</b> 点伤害'+typeLabel(b.beast.elem, sp.elem)+'。'});
    if(b.spHp<=0){ b.phase='lost'; b.log.push({who:'bad', text: sp.name+' 力竭败退，侥幸脱身。'}); }
  }
  renderWild();
}
/* 技能可用性：能量 / 爆发条件（爆发技 energy=触发阈值，使用后清空）+ 冷却 */
function skillUsable(sp, sk){
  const b = S.wild.battle; if(!b) return false;
  if(sk.kind==='mechanic') return true; // 回能等机制技
  if(b.cds && b.cds[sk.id]>0) return false;   // v1.14.0：冷却中不可用
  // v1.19.2：考虑 energyDown/energyUp 修正后的实际能耗
  const effEnergy = Math.max(0,(sk.energy||0) - (b.spSt.costdown||0) - (b.spSt.energyDown||0) + (b.spSt.energyUp||0));
  return b.energy >= effEnergy;
}
/* 胜利标记：若我方残血（≤10%）反杀传说妖兽，记一次「破釜沉舟」 */
function markWin(b, sp){
  b.phase='won'; b.log.push({who:'good', text: b.beast.name+' 倒下了。'});
  if(b.spHp>0 && b.spHp/b.spMax<=0.1 && (b.beast.rarity==='legend'||b.beast.lvl>=8)){
    sp.nearDeathKills = (sp.nearDeathKills||0)+1;
  }
}
/* 战斗用药：占一回合，随后敌方行动 */
function battleUseItem(itemId){
  const sp = wildSpirit();
  const b = S.wild.battle; if(!b || b.phase!=='fight') return;
  if(b.charge && b.charge.side==='self'){ toast('蓄力中不能用药','bad'); return; }
  if(b.lock && b.lock.side==='self'){ toast('连舞中不能用药','bad'); return; }
  const it = (typeof ITEMS!=='undefined' && ITEMS[itemId]) || null;
  if(!it || it.type!=='battle'){ toast('无法使用','bad'); return; }
  if(!(S.toolInv[itemId]>0)){ toast('没有这件道具','bad'); return; }
  S.toolInv[itemId]--;
  if(!S.toolInv[itemId]) delete S.toolInv[itemId];
  b.round++;
  b.hitSelf = false; b.hitBeast = false;
  b._fxQueue = [];
  b._lastDmg = 0; b._lastCrit = false; b._lastHeal = 0;
  const fakeSk = {id:itemId, name:it.name, elem:'', type:'状态'};
  if(b.recharge && b.recharge.side==='self'){
    b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 因<b class="hl">力竭</b>无法行动。'});
    b.recharge = null;
  } else if(!canAct(b.spSt, 'self')){
    b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 陷入<b class="hl">'+statusText(b.spSt)+'</b>，无法行动。'});
  } else {
    if(it.battle==='hp'){
      const heal = Math.max(1, Math.round(b.spMax * 0.25));
      const got = Math.min(heal, Math.max(0, b.spMax - b.spHp));
      b.spHp = Math.min(b.spMax, b.spHp + got);
      b._lastHeal = got;
      b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 喝下<b>血瓶</b>，回复 <b>'+got+'</b> 点生命。'});
    } else if(it.battle==='energy'){
      const before = b.energy||0;
      b.energy = b.energyMax||10;
      b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 喝下<b>蓝瓶</b>，能量回满（'+before+'→'+b.energy+'）。'});
    }
    finishPlayerAct(b, fakeSk, false, '');
  }
  if(b.phase==='fight') beastTurn(b);
  battleRoundEnd(b, sp);
}
function battleSkill(skId){
  const sp = wildSpirit();
  const b = S.wild.battle; if(!b || b.phase!=='fight') return;
  // 蓄力发射（v1.12.0）：我方有未发射蓄力技 → 强制发射（忽略本次点击）
  if(b.charge && b.charge.side==='self'){ fireCharge(sp, b); return; }
  // 连舞锁定（v1.12.0）：强制连打锁定技（忽略本次点击）
  if(b.lock && b.lock.side==='self'){ fireLock(sp, b); return; }
  const sk = skillById(skId);
  if(!sk || !skillUsable(sp, sk)) return;
  // 使用次数累计（称号检查点「一技入化」需要）
  const owned = sp.skills.find(x=>x.id===skId);
  if(owned){ owned.uses = (owned.uses||0) + 1; }
  b.round++;
  b.hitSelf = false; b.hitBeast = false;   // 本回合受击标记重置（睡眠衰减概率用）
  b._lastSkill = {skId, elem:sk.elem};
  b._fxQueue = [];
  // 行动已经选定。顺序先看优先级，相同再看当前速度。防御常态优先级是 0；对方本回合用了攻击，则防御改为应对，优先级提到最高。
  const order = roundOrder(b, sk);
  b.enemyUsedAttack = false; b.enemyUsedDefense = false; b.enemyUsedStatus = false; // cond 条件标记
  let usedBurst = false;
  for(const side of order){
    if(b.phase!=='fight') break;
    if(side==='player'){
      // 力竭（v1.12.0）：释放后下一回合无法行动（敌方照常行动）
      if(b.recharge && b.recharge.side==='self'){
        b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 因<b class="hl">力竭</b>无法行动。'});
        b.recharge = null;
      } else if(!canAct(b.spSt, 'self')){
        b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 陷入<b class="hl">'+statusText(b.spSt)+'</b>，无法行动。'});
      } else {
        playerTurn(sp, sk, b, ()=>{ usedBurst=true; });
      }
    }
    else beastTurn(b);
  }
  battleRoundEnd(b, sp);
}
/* 回合末统一处理（buff 衰减 + 持续状态结算），供 battleSkill / fireCharge / fireLock 复用 */
/* M3-1 战斗全程 buff 回合末结算 */
function tickBattleBuffs(b, sp){
  if(!b.battleBuffs || !b.battleBuffs.length) return;
  b.battleBuffs.forEach(bf=>{
    const p = bf.params||{};
    const applyTo = (side)=>{
      if(bf.id==='b-regen'){
        const pct = p.pct||0.12;
        if(side==='player'){ b.spHp = Math.min(b.spMax, b.spHp + Math.max(1, Math.round(b.spMax*pct))); }
        else if(side==='beast'){ b.beast.hp = Math.min(b.beast.maxHp, b.beast.hp + Math.max(1, Math.round(b.beast.maxHp*pct))); }
      } else if(bf.id==='b-energy-5' || bf.id==='b-energy-3'){
        const amt = p.energy||5;
        if(side==='player'){ b.energy = Math.min(b.energyMax||10, b.energy+amt); }
        else if(side==='beast'){ b.beastEnergy = Math.min(10, (b.beastEnergy||0)+amt); }
      }
    };
    if(bf.side==='both'){ applyTo('player'); applyTo('beast'); }
    else { applyTo(bf.side); }
  });
}
/* 技能在回合里的定位：攻击 / 防御 / 状态。物理和特殊都算攻击。 */
function skillActType(sk){
  if(!sk || !sk.type) return '';
  if(sk.type==='攻击' || sk.type==='防御' || sk.type==='状态') return sk.type;
  return '';
}
function listedPriority(sk, b){
  if(!sk) return 0;
  let p = sk.priority || 0;
  const prioEf = skillEffectsOf(sk).find(ef=>ef.type==='priority');
  if(prioEf){
    if(prioEf.cond==='field_grass') p = (b.field && b.field.elem==='grass') ? 1 : 0;
    else p = Math.max(p, 1);
  }
  return p;
}
/* 防御常态为 0，不沿用技能表里的 -6。对方已选定攻击时，防御改为应对，优先级高于先制。 */
function actionPriority(sk, opp, b){
  if(!sk) return -1000;
  if(skillActType(sk)==='防御') return skillActType(opp)==='攻击' ? 100 : 0;
  return listedPriority(sk, b);
}
function sideSpeed(b, side){
  const st = side==='player' ? b.spSt : b.beSt;
  const base = side==='player' ? (b.spSpd||0) : ((b.beast&&b.beast.spd)||0);
  let spd = base + ((st&&st.spd)||0);
  if(st && st.para>0) spd = Math.floor(spd*0.5);
  return spd;
}
/* 妖兽本回合若还能行动，选定的是攻击。睡眠、畏缩则没有行动。 */
function beastIntent(b){
  if(!canAct(b.beSt, 'beast')) return null;
  return {type:'攻击', priority:0, elem:b.beast.elem};
}
function roundOrder(b, sk){
  const playerCan = !(b.recharge && b.recharge.side==='self') && canAct(b.spSt, 'self');
  const mySk = (playerCan && sk) ? sk : null;
  const enSk = beastIntent(b);
  const myP = actionPriority(mySk, enSk, b);
  const enP = actionPriority(enSk, mySk, b);
  let order;
  if(myP!==enP) order = myP>enP ? ['player','beast'] : ['beast','player'];
  else {
    const ps = sideSpeed(b,'player'), es = sideSpeed(b,'beast');
    if(ps!==es) order = ps>es ? ['player','beast'] : ['beast','player'];
    else order = b.first==='player' ? ['player','beast'] : ['beast','player'];
  }
  b.selfFirst = order[0]==='player';
  return order;
}
function queueFx(b, fx){
  if(!b._fxQueue) b._fxQueue = [];
  b._fxQueue.push(fx);
  if(fx.kind==='act') b._fx = fx;
}
function queueAct(b, fx){ fx.kind='act'; queueFx(b, fx); }
function queueDot(b, target, status, dmg){
  if(!(dmg>0)) return;
  queueFx(b, {kind:'dot', phase:'dot', target:target, status:status, dmg:dmg});
}
function queueHealFx(b, target, dmg, phase){
  if(!(dmg>0)) return;
  queueFx(b, {kind:'heal', phase:phase||'end', target:target, dmg:dmg});
}
function finishPlayerAct(b, sk, landed, hit){
  queueAct(b, {
    side:'player', skId:sk.id, name:sk.name, elem:sk.elem||'', type:sk.type||'',
    dmg:b._lastDmg||0, crit:!!b._lastCrit, heal:b._lastHeal||0,
    hitBeast:hit==='beast', hitSelf:hit==='self', landed:!!landed
  });
}
function battleRoundEnd(b, sp){
  if(b.spBuffs.guard>0) b.spBuffs.guard=0;   // v1.14.0：guard=本回合生效，回合末直接清零（不再 --）
  // v1.14.0：技能冷却递减
  if(b.cds){ for(const k in b.cds){ b.cds[k]--; if(b.cds[k]<=0) delete b.cds[k]; } }
  if(b.spBuffs.powerUp>0) b.spBuffs.powerUp--;
  if(b.beastBuffs.vuln>0) b.beastBuffs.vuln--;
  if(b.phase==='fight'){ tickBattleBuffs(b, sp); tickStatus(b); }
  renderWild();
}
/* 蓄力发射（v1.12.0）：chargeFire 模式结算蓄力技（不再扣能量），发射后清标记；
   若本回合无法行动则蓄力保留，等待可行动回合再发射 */
function fireCharge(sp, b){
  const ck = b.charge.sk;
  b.round++;
  b.hitSelf = false; b.hitBeast = false;
  b._fxQueue = [];
  const order = roundOrder(b, ck);
  for(const side of order){
    if(b.phase!=='fight') break;
    if(side==='player'){
      if(!canAct(b.spSt, 'self')){
        b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 陷入<b class="hl">'+statusText(b.spSt)+'</b>，无法行动。'});
      } else {
        playerTurn(sp, ck, b, ()=>{}, false, true);
      }
    }
    else beastTurn(b);
  }
  battleRoundEnd(b, sp);
}
/* 连舞连打（v1.12.0）：locked 模式强制使用锁定技（不扣能量、不重写 lock）；
   仅当本回合真正行动才递减剩余连打数，归零后附加结束效果（混乱） */
function fireLock(sp, b){
  const ck = b.lock.sk;
  b.round++;
  b.hitSelf = false; b.hitBeast = false;
  b._fxQueue = [];
  const order = roundOrder(b, ck);
  let acted = false;
  for(const side of order){
    if(b.phase!=='fight') break;
    if(side==='player'){
      if(b.recharge && b.recharge.side==='self'){
        b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 因<b class="hl">力竭</b>无法行动。'});
        b.recharge = null;
      } else if(!canAct(b.spSt, 'self')){
        b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 陷入<b class="hl">'+statusText(b.spSt)+'</b>，无法行动。'});
      } else {
        playerTurn(sp, ck, b, ()=>{}, true);
        acted = true;
      }
    }
    else beastTurn(b);
  }
  if(acted){
    b.lock.remain--;
    if(b.lock.remain<=0){
      (b.lock.endEffects||[]).forEach(ef=>applyEffects(b, ef.target==='self' ? 'self' : 'enemy', [ef], sp.name));
      b.lock = null;
    }
  }
  battleRoundEnd(b, sp);
}
/* 玩家行动：技能结算（直接攻击分段 / 绝技爆发机制 / 能量） */
function playerTurn(sp, sk, b, onBurst, locked, chargeFire){
  b._lastDmg = 0; b._lastCrit = false; b._lastHeal = 0;
  const mods = {dmgUp:0, dmgDown:0, vuln:0, pen:0};
  mods.stab = sk.elem===sp.elem ? 1.25 : 1;   // 本系加成（v1.11.0）
  // 麻痹判定：50% 概率技能释放失败（不耗能、视为无行动，本回合行动机会照常消耗）
  if(b.spSt.para>0 && Math.random()<.5){
    b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 因<b class="hl">麻痹</b>未能使出招式（不消耗能量）。'});
    finishPlayerAct(b, sk, false, '');
    return;
  }
  // 混乱判定（v1.12.0）：50% 概率攻击自己（无属性 40 威力，替换本回合行动）
  if(b.spSt.confusion>0 && Math.random()<.5){
    const cDmg = Math.max(1, calcDamage(b.spAtk, b.spLvl, b.spDef, b.spLvl, 40, {}, 'none', 'none'));
    b.spHp = Math.max(0, b.spHp - cDmg);
    b.hitSelf = true;
    b._lastDmg = cDmg;
    b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' <b class="hl">陷入混乱</b>，攻击了自己，受到 <b>'+cDmg+'</b> 点伤害。'});
    queueAct(b, {side:'player', skId:sk.id, name:'混乱', elem:'', type:'', dmg:cDmg, crit:false, heal:0, hitBeast:false, hitSelf:true, landed:false});
    if(b.spHp<=0){ b.spHp = 0; b.phase='lost'; b.log.push({who:'bad', text: sp.name+' 在混乱中倒下！'}); }
    return;
  }
  if(b.spBuffs.powerUp>0) mods.dmgUp += .3;
  // 暴击（10%，暴伤 +50%）
  const crit = roll(skillCritChance(sk)); if(crit) mods.critDmg = .5;
  // 技能专长增伤
  const eff = perkEffects(sp);
  if(eff.skillDmg && eff.skillDmg[sk.elem]) mods.dmgUp += eff.skillDmg[sk.elem];
  // 场地：本系技能伤害独立乘区（+50%）
  if(b.field && b.field.elem===sk.elem) mods.fieldMul = .5;
  // 能量结算：爆发技清空 / 绝技与直接攻击按能耗扣减（锁定连打 locked 不再扣能）
  if(!locked){
    if(sk.kind==='burst'){ onBurst(); b.energy = 0; }
    else if(sk.kind==='ult' || sk.kind==='direct'){
      // v1.19.2：energyDown/energyUp 修正能耗；scalingByStatus 的 perEnergyCost 也影响
      let effEnergy = (sk.energy||0) - (b.spSt.costdown||0) - (b.spSt.energyDown||0) + (b.spSt.energyUp||0);
      if(b.spBuffs.scaledEnergy) effEnergy += b.spBuffs.scaledEnergy;
      b.energy -= Math.max(0, effEnergy);
    }
  }
  const mMult = masteryMult(sk.mastery!=null ? sk.mastery : 30);
  const efList = skillEffectsOf(sk);
  // 蓄力（v1.12.0）：本回合蓄力不攻击，写战斗对象标记，下一回合 battleSkill 入口强制发射
  const chargeEf = efList.find(ef=>ef.type==='charge');
  if(chargeEf && !chargeFire){
    b.charge = {side:'self', skId:sk.id, sk:sk};
    b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 使用「'+sk.name+'」<b class="hl">蓄力中</b>，下一回合发射！'});
    finishPlayerAct(b, sk, false, '');
    return;
  }
  if(chargeFire && b.charge) b.charge = null;
  // 连舞（v1.12.0）：首次释放写锁定状态（后续回合 battleSkill 入口强制连打）
  const mlEf = efList.find(ef=>ef.type==='multilock');
  if(mlEf && !locked && b.phase==='fight'){
    b.lock = {side:'self', skId:sk.id, sk:sk, remain:Math.max(1, mlEf.layers||1), endEffects:mlEf.endEffects||[]};
  }
  // 命中判定（v1.12.1）：技能顶层 accuracy 字段（默认 100），<100 可能落空（能量已扣；miss 不结算伤害也不附加效果）
  const acc = (sk.accuracy!=null) ? sk.accuracy : 100;
  if(acc < 100 && Math.random()*100 >= acc){
    b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 使用「'+sk.name+'」…<b class="hl">落空了！</b>'});
    finishPlayerAct(b, sk, false, '');
    return;
  }
  // v1.14.0：技能级冷却——命中即写 cd（落空不写，不浪费冷却）
  if(sk.cooldown && sk.cooldown>0){ b.cds = b.cds||{}; b.cds[sk.id] = sk.cooldown + 1; } // v1.14.0 热修：当回合计入冷却
  // —— 前置机制效果（execute 斩杀；sunder 先设破甲再结算伤害；surge/heal/guard/cleanse/field 立即生效后不结算伤害）——
  const preMech = efList.filter(ef=>['execute','surge','heal','guard','sunder','cleanse','field'].includes(ef.type));
  let didMechAct = false;
  if(preMech.length){
    for(const ef of preMech){
      if(ef.type==='execute'){
        applyMechEffect(b, ef, '第 <b>'+b.round+'</b> 轮 · '+sp.name+' 以「'+sk.name+'」');
        if(b.phase==='won'){ finishPlayerAct(b, sk, sk.type==='攻击', ''); return; }
        didMechAct = true;
      } else if(ef.type==='sunder'){
        applyMechEffect(b, ef, '第 <b>'+b.round+'</b> 轮 · '+sp.name+' 使用「'+sk.name+'」');
        // 破甲在本次伤害结算前生效
        if(b.beastBuffs.vuln>0) mods.vuln = Math.max(mods.vuln, b.beastBuffs.vuln);
      } else {
        applyMechEffect(b, ef, '第 <b>'+b.round+'</b> 轮 · '+sp.name+' 使用「'+sk.name+'」');
        didMechAct = true;
      }
    }
    if(didMechAct){
      // 机制技不结算伤害，但其余非机制效果（属性增减/控制/持续）照常附加
      const rest = efList.filter(ef=>SKILL_STATUS[ef.type] && SKILL_STATUS[ef.type].kind!=='mech');
      if(rest.length) applySkillEffects(b, rest, sp.name, 0);
      finishPlayerAct(b, sk, false, '');
      return;
    }
  }
  // 分段伤害：每段独立结算（总威力 ÷ 段数）；物理吃攻/防，特殊吃特攻/特防（M2-A2）
  let hits = sk.hits||1;
  // 光能聚集成长（被动）：使用其他草系技能时，本技能威力永久 +60（存精灵身上）
  if(sk.elem==='grass' && sk.id!=='g_lightcharge' && sp.skills.some(x=>x.id==='g_lightcharge')){
    sp.growth = (sp.growth||0) + 60;
    b.log.push({who:'pl', text:'「'+sk.name+'」的草系波动涌入体内，<b class="hl">光能聚集</b>的威力提升了！'});
  }
  // 光能聚集：基础威力 + 永久成长
  let powerBase = sk.power||0;
  if(efList.some(ef=>ef.type==='grow')) powerBase += (sp.growth||0);
  // v1.18.0 新机制效果：威力/段数修正
  if(b.spBuffs.copyPower!=null){ powerBase = b.spBuffs.copyPower; }
  if(b.spBuffs.condPower) powerBase += b.spBuffs.condPower;
  if(b.spBuffs.missingHpPower){
    const lostPct = Math.max(0, (b.spMax - b.spHp) / b.spMax * 100);
    powerBase += Math.floor(lostPct / 10) * b.spBuffs.missingHpPower;
  }
  if(b.spBuffs.speedRatio) powerBase = Math.round(powerBase * b.spBuffs.speedRatio);
  if(b.spBuffs.defRatio) powerBase = Math.round(powerBase * b.spBuffs.defRatio);
  // powerup 状态：每层 +10 威力
  if(b.spSt.powerup) powerBase += b.spSt.powerup * 10;
  // v1.19.2：scalingByStatus / energyScaling 读状态/能量动态调整 power/hits
  efList.forEach(ef=>{
    if(ef.type==='scalingByStatus'){
      const st = ef.target==='enemy' ? b.beSt : b.spSt;
      const layers = st[ef.status]||0;
      if(ef.perPower) powerBase += ef.perPower * layers;
      if(ef.perHits) hits += ef.perHits * layers;
    }
    if(ef.type==='energyScaling'){
      const enE = b.beastEnergy||0, myE = b.energy||0;
      if(ef.cond==='enemyEnergyLt' && enE < (ef.threshold||0)){ if(ef.condPower) powerBase += ef.condPower; }
      if(ef.cond==='selfGtEnemy' && myE > enE){ if(ef.perPowerSelfGt) powerBase += ef.perPowerSelfGt; }
      if(ef.perPowerPerEnemyEnergy) powerBase = Math.max(1, powerBase - ef.perPowerPerEnemyEnergy * enE);
    }
  });
  if(b.spBuffs.scaledPower) powerBase += b.spBuffs.scaledPower;
  // 段数：combo/costdown 等——连击技能（hits>1）叠加 combo 状态与 condCombo
  const isComboSkill = (hits > 1);
  if(isComboSkill){
    if(b.spSt.combo) hits += b.spSt.combo;
    if(b.spBuffs.condCombo) hits += b.spBuffs.condCombo;
  }
  if(b.spBuffs.varietyHits) hits += b.spBuffs.varietyHits;
  const per = Math.max(1, Math.round(powerBase/hits));
  // 状态效果：状态栏攻防增减实时修正伤害面板（每层 ±10%，速度 ±10 点）
  const sm = statusMods('self', b);
  const bm = statusMods('beast', b);
  // v1.18.0 defScaled：以物防代替物攻结算
  const atkVal = b.spBuffs.defScaled ? b.spDef : (sk.track==='spec' ? b.spSpa : b.spAtk);
  const atkMul = sk.track==='spec' ? (sm.spaMul||1) : (b.spBuffs.defScaled ? (sm.defMul||1) : (sm.atkMul||1));
  const atkSide = Math.round(atkVal * atkMul);
  const defSide = Math.round((sk.track==='spec' ? (b.beast.sdef||0) : (b.beast.def||0)) * (sk.track==='spec' ? (bm.sdefMul||1) : (bm.defMul||1)));
  // v1.18.0 condSuperEffective：敌方未用防御 → 本技能视为克制（vuln ×2）
  if(b.spBuffs.condSuperEffective) mods.vuln = Math.max(mods.vuln||0, 1);
  let total = 0; const parts = [];
  // v1.19.2 perHit：effects 带 perHit:true 时每段触发一次
  const perHitEfs = efList.filter(ef=>ef && ef.perHit);
  const tailEfs = efList.filter(ef=>!(ef && ef.perHit));
  for(let i=0;i<hits;i++){
    const d = calcDamage(atkSide, b.spLvl, defSide, b.beast.lvl||1, per*mMult, mods, sk.elem, b.beast.elem);
    total += d; parts.push(d);
    b.beast.hp -= d;
    b.hitBeast = true;   // 本回合敌方被命中（睡眠衰减概率用）
    if(perHitEfs.length && b.beast.hp>0) applySkillEffects(b, perHitEfs, sp.name, d);
    if(b.beast.hp<=0) break;
  }
  // 后置效果：状态类（属性增减/中毒/睡眠/麻痹）+ drain 吸血 + sunder 破甲 + gain 攻击后回能
  if(tailEfs.length){
    applySkillEffects(b, tailEfs, sp.name, total);
  }
  // v1.18.0 leech：每层=本次伤害 10% 回血（与 drain 加算）
  if(total>0 && b.spSt.leech){
    const lh = Math.max(1, Math.round(total * b.spSt.leech / 10));
    b.spHp = Math.min(b.spMax, b.spHp + lh);
  }
  let txt = '第 <b>'+b.round+'</b> 轮 · '+sp.name+' 使用「'+sk.name+'」';
  if(hits>1) txt += '，<b class="hl">连击 '+hits+' 段</b>';
  txt += '，'+b.beast.name+' 受到 <b>'+total+'</b> 点伤害'+(crit?'（会心一击！）':'')+typeLabel(sk.elem, b.beast.elem);
  if(parts.length>1) txt += '（各段 '+parts.join(' / ')+'）';
  if(sk.mech==='sunder'){ b.beastBuffs.vuln = Math.max(b.beastBuffs.vuln, 1); txt += ' 破甲！'+b.beast.name+' 的防御被撕开。'; }
  b._lastDmg = total;
  b._lastCrit = !!crit;
  b.log.push({who:'pl', text:txt});
  finishPlayerAct(b, sk, true, 'beast');
  if(b.beast.hp<=0){ markWin(b, sp); }
}
/* 敌人行动：妖兽从妖兽技能池（直接攻击）出招，随能量增长用更高威力招式 */
function beastTurn(b){
  const sp = wildSpirit();
  const mods = {dmgUp:0, dmgDown:0};
  mods.stab = 1.25;   // 本系加成：妖兽技能池元素恒=妖兽元素（v1.11.0）
  if(b.spBuffs.guard>0) mods.dmgDown += b.spBuffs.guard;   // v1.14.0：读技能配置的免伤百分比
  if(b.spBuffs.nullifyDamage) mods.dmgDown = 1;   // v1.18.0 寸止：完全免伤
  if(b.spBuffs.neutralizeWeakness) mods.neutralizeWeakness = true;   // v1.18.0 铁壁：克制降普通
  // M3-1：b-harden side=player → 我方减伤 8%
  if(b.battleBuffs) b.battleBuffs.forEach(bf=>{ if(bf.id==='b-harden' && bf.side==='player') mods.dmgDown += (bf.params&&bf.params.dmgDown)||0.08; });
  // v1.19.2：湿润场地 → 我方受到伤害 -10%
  if(b.field && b.field.waterDmgCut) mods.dmgDown += .1;
  // 睡眠/畏缩行动判定（麻痹不再挡行动，改为释放时 50% 失败）
  if(!canAct(b.beSt, 'beast')){
    b.log.push({who:'be', text:'第 <b>'+b.round+'</b> 轮 · '+b.beast.name+' 陷入<b class="hl">'+statusText(b.beSt)+'</b>，无法行动。'});
    return;
  }
  // 麻痹判定：50% 概率释放失败（不耗能、视为无行动）
  if(b.beSt.para>0 && Math.random()<.5){
    b.log.push({who:'be', text:'第 <b>'+b.round+'</b> 轮 · '+b.beast.name+' 因<b class="hl">麻痹</b>未能使出招式（不消耗能量）。'});
    return;
  }
  // 混乱判定（v1.12.0）：50% 概率攻击自己（无属性 40 威力，替换本回合行动）
  if(b.beSt.confusion>0 && Math.random()<.5){
    const cDmg = Math.max(1, calcDamage(b.beast.atk, b.beast.lvl||1, b.beast.def||0, b.beast.lvl||1, 40, {}, 'none', 'none'));
    b.beast.hp = Math.max(0, b.beast.hp - cDmg);
    b.hitBeast = true;
    b.log.push({who:'be', text:'第 <b>'+b.round+'</b> 轮 · '+b.beast.name+' <b class="hl">陷入混乱</b>，攻击了自己，受到 <b>'+cDmg+'</b> 点伤害。'});
    queueAct(b, {side:'enemy', skId:'', name:'混乱', elem:'', type:'', dmg:cDmg, crit:false, heal:0, hitBeast:true, hitSelf:false, landed:false});
    if(b.beast.hp<=0){ markWin(b, sp); }
    return;
  }
  // 场地：本系技能伤害独立乘区（+50%）
  const bskElem = b.beast.elem;
  if(b.field && b.field.elem===bskElem) mods.fieldMul = .5;
  // 妖兽每回合 +1 能量（上限 20）
  b.beastEnergy = Math.min(10, (b.beastEnergy||0)+1);
  // AI：从技能池倒序选「能量够用的最高能耗招式」，否则用基础 60×1
  const pool = directUnlocked(bskElem, b.beast.lvl||1);
  let sk = null;
  for(let i=pool.length-1;i>=0;i--){
    if((b.beastEnergy||0) >= pool[i].energy){ sk = pool[i]; break; }
  }
  if(!sk && pool.length) sk = pool[0];
  if(!sk) sk = {name:'扑击', power:60, hits:1, energy:0};
  b.enemyUsedAttack = true; // v1.18.0 cond 条件标记：妖兽用了攻击技能
  b.enemyUsedStatus = (sk.type==='状态'); // v1.19.0 cond 条件标记：妖兽用了状态技能
  b.beastEnergy -= sk.energy||0;
  const hits = sk.hits||1;
  const per = Math.max(1, Math.round(sk.power/hits));
  const bm = statusMods('beast', b);
  const sm = statusMods('self', b);
  const atkSide = Math.round((sk.track==='spec' ? (b.beast.spa||0) : b.beast.atk) * (sk.track==='spec' ? (bm.spaMul||1) : (bm.atkMul||1)));
  const defSide = Math.round((sk.track==='spec' ? b.spSdef : b.spDef) * (sk.track==='spec' ? (sm.sdefMul||1) : (sm.defMul||1)));
  let total = 0; const parts = [];
  for(let i=0;i<hits;i++){
    const d = calcDamage(atkSide, b.beast.lvl||1, defSide, b.spLvl, per, mods, b.beast.elem, sp.elem);
    total += d; parts.push(d);
    b.spHp -= d;
    b.hitSelf = true;   // 本回合我方被命中（睡眠衰减概率用）
    if(b.spHp<=0) break;
  }
  let txt = '第 <b>'+b.round+'</b> 轮 · '+b.beast.name+' 使出「'+sk.name+'」';
  if(hits>1) txt += '，<b class="hl">连击 '+hits+' 段</b>';
  txt += '，'+sp.name+' 受到 <b>'+total+'</b> 点伤害'+typeLabel(b.beast.elem, sp.elem);
  if(parts.length>1) txt += '（各段 '+parts.join(' / ')+'）';
  b.log.push({who:'be', text:txt});
  queueAct(b, {side:'enemy', skId:sk.id||sk.name, name:sk.name, elem:bskElem, type:sk.type||'攻击', dmg:total, crit:false, heal:0, hitBeast:false, hitSelf:true, landed:true});
  // M3-1 受击回能：敌方攻击动作结算后我方 +1（多段只+1，上限20）
  b.energy = Math.min(b.energyMax||10, (b.energy||0)+1);
  if(b.spHp<=0){ b.phase='lost'; b.log.push({who:'bad', text: sp.name+' 力竭败退，侥幸脱身。'}); }
}
/* 自动战斗：期望伤害（去掉随机浮动，取 0.925 中位；不模拟暴击/专长细项，够用比大小） */
function expectSkillDamage(sp, b, sk){
  if(!sk || !(sk.power>0) || sk.kind==='mechanic') return 0;
  const hits = Math.max(1, sk.hits||1);
  const powerBase = sk.power||0;
  const per = Math.max(1, Math.round(powerBase/hits));
  const owned = (sp.skills||[]).find(x=>(x.id||x)===sk.id);
  const mMult = typeof masteryMult==='function' ? masteryMult(owned && owned.mastery!=null ? owned.mastery : (sk.mastery!=null?sk.mastery:30)) : 1;
  const track = sk.track || (typeof DIRECT_TRACK!=='undefined' && DIRECT_TRACK[sk.elem]) || 'phys';
  const atkSide = Math.max(1, Math.round(track==='spec' ? (b.spSpa||0) : (b.spAtk||0)));
  const defSide = Math.max(1, Math.round(track==='spec' ? (b.beast.sdef||1) : (b.beast.def||1)));
  const aLvl = b.spLvl||1;
  const lvlTerm = Math.floor(2*aLvl/5 + 2);
  let dmg = Math.floor(Math.floor(lvlTerm * per * mMult * atkSide / defSide / 50) + 2);
  dmg *= (typeof typeMult==='function' ? typeMult(sk.elem, b.beast.elem) : 1);
  if(sk.elem===sp.elem) dmg *= 1.25;
  dmg *= 0.925;
  return Math.max(0, Math.round(dmg) * hits);
}
function normalizeAutoCfg(cfg){
  cfg = cfg || (typeof S!=='undefined' && S.autoCfg) || {};
  const strat = cfg.regenStrategy;
  return {
    useHpPotion: cfg.useHpPotion!==false,
    useMpPotion: cfg.useMpPotion!==false,
    regenStrategy: (strat==='maxSkill'||strat==='zero'||strat==='noAttack') ? strat : 'noAttack'
  };
}
/* 兼容旧调用：只返回技能 id */
function pickAutoBattleSkill(sp, b, usableOf){
  const act = pickAutoBattleAction(sp, b, usableOf);
  return (act && act.kind==='skill') ? act.id : 'regen';
}
/* 自动战斗动作：{kind:'skill',id} | {kind:'item',id}
   优先：低血喝血瓶 → 最大期望伤害技 → 不够能耗喝蓝瓶 → 按回能策略回能/次优攻击。 */
function pickAutoBattleAction(sp, b, usableOf){
  const can = usableOf || (d=>skillUsable(sp, d));
  const cfg = normalizeAutoCfg();
  const HP_POT = 'DJ_none_002020', MP_POT = 'DJ_none_002021';
  if(cfg.useHpPotion && b.spMax>0 && (b.spHp/b.spMax)<0.5 && (S.toolInv[HP_POT]||0)>0){
    return {kind:'item', id:HP_POT};
  }
  let bestAll=null, bestAllDmg=0, bestUse=null, bestUseDmg=0;
  (sp.skills||[]).forEach(row=>{
    const sk = skillById(row && (row.id||row));
    if(!sk) return;
    const exp = expectSkillDamage(sp, b, sk);
    if(exp>bestAllDmg){ bestAllDmg=exp; bestAll=sk; }
    if(exp>0 && can(sk) && exp>bestUseDmg){ bestUseDmg=exp; bestUse=sk; }
  });
  if(bestAll && bestAllDmg>0 && can(bestAll)) return {kind:'skill', id:bestAll.id};
  if(bestAll && bestAllDmg>0 && !can(bestAll) && cfg.useMpPotion && (S.toolInv[MP_POT]||0)>0){
    return {kind:'item', id:MP_POT};
  }
  if(cfg.regenStrategy==='maxSkill') return {kind:'skill', id:'regen'};
  if(cfg.regenStrategy==='zero'){
    if((b.energy||0)<=0) return {kind:'skill', id:'regen'};
    if(bestUse) return {kind:'skill', id:bestUse.id};
    return {kind:'skill', id:'regen'};
  }
  if(bestUse) return {kind:'skill', id:bestUse.id};
  return {kind:'skill', id:'regen'};
}