
/* ================= 副本战斗（多轮单挑 · 每 5 场回满+常驻增益） ================= */
const DG_BUFFS = [
  {id:'atk',  name:'蛮力',      tiers:[.1,.2,.3],  desc:'攻击 +10/20/30%'},
  {id:'def',  name:'坚甲',      tiers:[.1,.2,.3],  desc:'防御 +10/20/30%'},
  {id:'spa',  name:'灵威',      tiers:[.1,.2,.3],  desc:'特攻 +10/20/30%'},
  {id:'sdef', name:'铁壁',      tiers:[.1,.2,.3],  desc:'特防 +10/20/30%'},
  {id:'spd',  name:'神速',      tiers:[.1,.2,.3],  desc:'速度 +10/20/30%'},
  {id:'regen',name:'灵流涌动',  tiers:[1,2,3],     desc:'每回合开始回复 1/2/3 点能量'},
  {id:'enmax',name:'灵核扩容',  tiers:[5,10,15],   desc:'能量上限 +5/10/15'},
  {id:'power',name:'破击',      tiers:[5,10,15],   desc:'所有技能威力 +5/10/15'},
  {id:'elem', name:'元素共鸣',  tiers:[.12,.24],   desc:'本系技能伤害 +12/24%'},
  {id:'armor',name:'硬皮',      tiers:[.08,.16],   desc:'受到伤害 −8/16%'},
  {id:'pen',  name:'穿刺',      tiers:[.15,.30],   desc:'无视防御 15/30%'},
  {id:'life', name:'汲血击',    tiers:[.08],       desc:'攻击吸血 8%'},
  {id:'thrust',name:'蓄力预备', tiers:[3],         desc:'每场开局额外 3 点能量'},
  {id:'undeath',name:'韧性守护',tiers:[1],         desc:'每场一次：致命伤保留 1 点生命'},
  {id:'erosion',name:'持续侵蚀',tiers:[.05],       desc:'敌方每回合损失 5% 最大生命'},
  {id:'swift',name:'迅捷冷却',  tiers:[2],         desc:'绝技能耗 −2'},
  {id:'burstpower',name:'爆发蓄能',tiers:[.2],     desc:'爆发技伤害 +20%'},
  {id:'healwind',name:'愈合之风',tiers:[.05],      desc:'回合结束回复 5% 最大生命'},
];
function dgRollBuff(){
  const b = pick(DG_BUFFS);
  const tier = pick(b.tiers);
  return {id:b.id, name:b.name, tier, desc:b.desc};
}
function dgBuffSum(id){ return S.settle.buffs.filter(b=>b.id===id).reduce((a,b)=>a+b.tier,0); }
function dgBuffText(){ return S.settle.buffs.map(b=>b.name+(b.tier>1?' ×'+b.tier:'')).join(' · ')||'无'; }
function startDgFight(){
  const st = S.settle;
  const sp = spById(st.spiritId);
  const enemy = st.enemies[st.idx];
  const base = spiritStats(sp);
  const b = {
    beast:enemy, mode:'dungeon', spHp:base.hp, spMax:base.hp, spAtk:base.atk, spDef:base.def,
    spSpa:base.spa, spSdef:base.sdef, spLvl:sp.lvl||1, spSpd:base.spd,
    energy:5, energyMax:10, beastEnergy:5, beastEnergyMax:10,
    spBuffs:{guard:0, powerUp:0}, beastBuffs:{vuln:0}, cds:{},
    spSt:initStatus(), beSt:initStatus(),
    field:null, hitSelf:false, hitBeast:false,
    first: base.spd>=enemy.spd ? 'player':'beast', round:0, log:[], phase:'fight', resultShown:false,
  };
  b.spAtk = Math.round(b.spAtk*(1+dgBuffSum('atk')));
  b.spDef = Math.round(b.spDef*(1+dgBuffSum('def')));
  b.spSpa = Math.round(b.spSpa*(1+dgBuffSum('spa')));
  b.spSdef = Math.round(b.spSdef*(1+dgBuffSum('sdef')));
  b.spSpd = Math.round(b.spSpd*(1+dgBuffSum('spd')));
  b.energyMax += dgBuffSum('enmax');
  if(dgBuffSum('thrust')) b.energy = Math.min(b.energyMax, b.energy + dgBuffSum('thrust'));
  b.log.push({who:'sys', text:'第 '+(st.idx+1)+' 场 · 对阵 <b>'+enemy.name+'</b> Lv.'+enemy.lvl+'（'+(st.idx+1)+'/'+st.enemies.length+'）。'});
  if(st.buffs.length) b.log.push({who:'sys', text:'本副本常驻增益：'+dgBuffText()});
  st.battle = b;
  st.phase='fight';
}
function dgSkillDef(id){
  if(S.skillEdits && S.skillEdits[id]) return S.skillEdits[id];
  return Object.values(SKILLS).flat().find(x=>x.id===id);
}
function dgSkillUsable(sk){
  const b = S.settle.battle; if(!b) return false;
  if(sk.kind==='mechanic') return true;
  // v1.14.0：冷却中不可用
  if(b.cds && b.cds[sk.id]>0) return false;
  // B2：副本能耗与野外统一 effEnergy 口径（含 costdown/energyDown/energyUp）
  const cost = sk.kind==='ult'
    ? Math.max(0,(sk.energy||0)-dgBuffSum('swift')-(b.spSt.costdown||0)-(b.spSt.energyDown||0)+(b.spSt.energyUp||0))
    : Math.max(0,(sk.energy||0)-(b.spSt.costdown||0)-(b.spSt.energyDown||0)+(b.spSt.energyUp||0));
  return b.energy >= cost;
}
function dgBattleUseItem(itemId){
  const st = S.settle; const sp = spById(st.spiritId);
  const b = st.battle; if(!b || b.phase!=='fight') return;
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
  dgRoundStart(b, st, sp);
  if(b.phase!=='fight'){ st.phase = b.phase; renderSettle(); return; }
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
  if(b.phase==='fight') dgBeastTurn(b);
  dgRoundEnd(b, st, sp);
}
function dgBattleSkill(skId){
  const st = S.settle; const sp = spById(st.spiritId);
  const b = st.battle; if(!b || b.phase!=='fight') return;
  // 蓄力发射（v1.12.0）：我方有未发射蓄力技 → 强制发射（忽略本次点击）
  if(b.charge && b.charge.side==='self'){ dgFireCharge(sp, b); return; }
  // 连舞锁定（v1.12.0）：强制连打锁定技（忽略本次点击）
  if(b.lock && b.lock.side==='self'){ dgFireLock(sp, b); return; }
  const sk = dgSkillDef(skId);
  if(!sk || !dgSkillUsable(sk)) return;
  const owned = sp.skills.find(x=>x.id===skId);
  if(owned) owned.uses = (owned.uses||0)+1;
  b.round++;
  b.hitSelf = false; b.hitBeast = false;   // 本回合受击标记重置（睡眠衰减概率用）
  b._lastSkill = {skId, elem:sk.elem};
  b._fxQueue = [];
  dgRoundStart(b, st, sp);
  if(b.phase!=='fight'){ st.phase = b.phase; renderSettle(); return; }
  const order = roundOrder(b, sk);
  b.enemyUsedAttack = false; b.enemyUsedDefense = false; b.enemyUsedStatus = false;
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
        dgPlayerTurn(sp, sk, b);
      }
    }
    else dgBeastTurn(b);
  }
  dgRoundEnd(b, st, sp);
}
/* 回合开始统一处理（灵流涌动回能 + 持续侵蚀），供 dgBattleSkill / dgFireCharge / dgFireLock 复用 */
function dgRoundStart(b, st, sp){
  if(dgBuffSum('regen')) b.energy = Math.min(b.energyMax, b.energy + dgBuffSum('regen'));
  if(dgBuffSum('erosion') && b.beast.hp>0){
    const d = Math.max(1, Math.round(b.beast.maxHp*dgBuffSum('erosion')));
    b.beast.hp = Math.max(0, b.beast.hp-d);
    b.log.push({who:'pl', text:'持续侵蚀：'+b.beast.name+' 损失 <b>'+d+'</b> 点生命。'});
    if(typeof queueDot==='function') queueDot(b, 'enemy', 'erosion', d);
    b.hitBeast = true;
    if(b.beast.hp<=0) markDgWin(b, sp);
  }
}
/* 回合末统一处理（愈合之风 + buff 衰减 + 持续状态结算 + 阶段同步），供 dgBattleSkill / dgFireCharge / dgFireLock 复用 */
function dgRoundEnd(b, st, sp){
  if(b.phase==='fight' && dgBuffSum('healwind')){
    const heal = Math.round(b.spMax*dgBuffSum('healwind'));
    b.spHp = Math.min(b.spMax, b.spHp+heal);
    b.log.push({who:'pl', text:'愈合之风：'+sp.name+' 回复 <b>'+heal+'</b> 点生命。'});
    if(typeof queueHealFx==='function') queueHealFx(b, 'player', heal, 'end');
  }
  if(b.spBuffs.guard>0) b.spBuffs.guard=0;   // v1.14.0：guard=本回合生效，回合末直接清零（不再 --）
  // v1.14.0：技能冷却递减
  if(b.cds){ for(const k in b.cds){ b.cds[k]--; if(b.cds[k]<=0) delete b.cds[k]; } }
  if(b.spBuffs.powerUp>0) b.spBuffs.powerUp--;
  if(b.beastBuffs.vuln>0) b.beastBuffs.vuln--;
  if(b.phase==='fight'){ tickBattleBuffs(b, sp); tickStatus(b); }   // 持续状态结算（中毒/灼烧/冻结 + 睡眠/麻痹衰减）
  st.phase = b.phase;   // 战斗阶段与 settle 状态同步
  if(b.phase==='lost'){ if(!b.resultShown){ b.resultShown=true; dgResultModal(b, st, sp); } return; }
  renderSettle();
}
/* 蓄力发射（v1.12.0）：chargeFire 模式结算蓄力技（不再扣能量），发射后清标记；
   若本回合无法行动则蓄力保留，等待可行动回合再发射 */
function dgFireCharge(sp, b){
  const st = S.settle;
  const ck = b.charge.sk;
  b.round++;
  b.hitSelf = false; b.hitBeast = false;
  b._fxQueue = [];
  dgRoundStart(b, st, sp);
  if(b.phase!=='fight'){ st.phase = b.phase; renderSettle(); return; }
  const order = roundOrder(b, ck);
  for(const side of order){
    if(b.phase!=='fight') break;
    if(side==='player'){
      if(!canAct(b.spSt, 'self')){
        b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 陷入<b class="hl">'+statusText(b.spSt)+'</b>，无法行动。'});
      } else {
        dgPlayerTurn(sp, ck, b, false, true);
      }
    }
    else dgBeastTurn(b);
  }
  dgRoundEnd(b, st, sp);
}
/* 连舞连打（v1.12.0）：locked 模式强制使用锁定技（不扣能量、不重写 lock）；
   仅当本回合真正行动才递减剩余连打数，归零后附加结束效果（混乱） */
function dgFireLock(sp, b){
  const st = S.settle;
  const ck = b.lock.sk;
  b.round++;
  b.hitSelf = false; b.hitBeast = false;
  b._fxQueue = [];
  dgRoundStart(b, st, sp);
  if(b.phase!=='fight'){ st.phase = b.phase; renderSettle(); return; }
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
        dgPlayerTurn(sp, ck, b, true);
        acted = true;
      }
    }
    else dgBeastTurn(b);
  }
  if(acted){
    b.lock.remain--;
    if(b.lock.remain<=0){
      (b.lock.endEffects||[]).forEach(ef=>applyEffects(b, ef.target==='self' ? 'self' : 'enemy', [ef], sp.name));
      b.lock = null;
    }
  }
  dgRoundEnd(b, st, sp);
}
/* 我方行动（照抄野外回合制 + 副本 buff 修正） */
function dgPlayerTurn(sp, sk, b, locked, chargeFire){
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
  const crit = roll(skillCritChance(sk)); if(crit) mods.critDmg = .5;
  const eff = perkEffects(sp);
  if(eff.skillDmg && eff.skillDmg[sk.elem]) mods.dmgUp += eff.skillDmg[sk.elem];
  if(sk.elem===sp.elem && dgBuffSum('elem')) mods.dmgUp += dgBuffSum('elem');
  if(dgBuffSum('pen')) mods.pen += dgBuffSum('pen');
  // 场地：本系技能伤害独立乘区（+50%）
  if(b.field && b.field.elem===sk.elem) mods.fieldMul = .5;
  const burstExtra = (sk.kind==='burst' && dgBuffSum('burstpower')) ? dgBuffSum('burstpower') : 0;
  if(!locked){
    if(sk.kind==='burst') b.energy = 0;
    else if(sk.kind==='ult'){ let _e=Math.max(0,(sk.energy||0)-dgBuffSum('swift')-(b.spSt.costdown||0)-(b.spSt.energyDown||0)+(b.spSt.energyUp||0)); b.energy -= _e; }
    else if(sk.kind==='direct'){ let _e=Math.max(0,(sk.energy||0)-(b.spSt.costdown||0)-(b.spSt.energyDown||0)+(b.spSt.energyUp||0)); b.energy -= _e; }
  }
  const mMult = masteryMult(sk.mastery!=null ? sk.mastery : 30);
  const efList = skillEffectsOf(sk);
  // 蓄力（v1.12.0）：本回合蓄力不攻击，写战斗对象标记，下一回合 dgBattleSkill 入口强制发射
  const chargeEf = efList.find(ef=>ef.type==='charge');
  if(chargeEf && !chargeFire){
    b.charge = {side:'self', skId:sk.id, sk:sk};
    b.log.push({who:'pl', text:'第 <b>'+b.round+'</b> 轮 · '+sp.name+' 使用「'+sk.name+'」<b class="hl">蓄力中</b>，下一回合发射！'});
    finishPlayerAct(b, sk, false, '');
    return;
  }
  if(chargeFire && b.charge) b.charge = null;
  // 连舞（v1.12.0）：首次释放写锁定状态（后续回合 dgBattleSkill 入口强制连打）
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
  const powerUp = dgBuffSum('power');
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
  if(b.spSt.powerup) powerBase += b.spSt.powerup * 10;
  const isComboSkill = (hits > 1);
  if(isComboSkill){
    if(b.spSt.combo) hits += b.spSt.combo;
    if(b.spBuffs.condCombo) hits += b.spBuffs.condCombo;
  }
  if(b.spBuffs.varietyHits) hits += b.spBuffs.varietyHits;
  const per = Math.max(1, Math.round((powerBase+powerUp)/hits));
  // 状态效果：状态栏攻防增减实时修正伤害面板
  const sm = statusMods('self', b);
  const bm = statusMods('beast', b);
  const atkVal = b.spBuffs.defScaled ? b.spDef : (sk.track==='spec' ? b.spSpa : b.spAtk);
  const atkMul = sk.track==='spec' ? (sm.spaMul||1) : (b.spBuffs.defScaled ? (sm.defMul||1) : (sm.atkMul||1));
  const atkSide = Math.round(atkVal * atkMul);
  const defSide = Math.round((sk.track==='spec' ? (b.beast.sdef||0) : (b.beast.def||0)) * (sk.track==='spec' ? (bm.sdefMul||1) : (bm.defMul||1)));
  if(b.spBuffs.condSuperEffective) mods.vuln = Math.max(mods.vuln||0, 1);
  let total = 0; const parts = [];
  for(let i=0;i<hits;i++){
    const d = calcDamage(atkSide, b.spLvl, defSide, b.beast.lvl||1, per*mMult*(1+burstExtra), mods, sk.elem, b.beast.elem);
    total += d; parts.push(d);
    b.beast.hp -= d;
    b.hitBeast = true;   // 本回合敌方被命中（睡眠衰减概率用）
    if(b.beast.hp<=0) break;
  }
  // 后置效果：状态类 + drain 吸血 + sunder 破甲 + gain 攻击后回能
  if(efList.length){
    applySkillEffects(b, efList, sp.name, total);
  }
  // v1.18.0 leech：每层=本次伤害 10% 回血
  if(total>0 && b.spSt.leech){
    const lh = Math.max(1, Math.round(total * b.spSt.leech / 10));
    b.spHp = Math.min(b.spMax, b.spHp + lh);
  }
  if(total>0 && dgBuffSum('life')){
    const heal = Math.max(1, Math.round(total*dgBuffSum('life')));
    b.spHp = Math.min(b.spMax, b.spHp+heal);
  }
  let txt = '第 <b>'+b.round+'</b> 轮 · '+sp.name+' 使用「'+sk.name+'」';
  if(hits>1) txt += '，<b class="hl">连击 '+hits+' 段</b>';
  txt += '，'+b.beast.name+' 受到 <b>'+total+'</b> 点伤害'+(crit?'（会心一击！）':'')+typeLabel(sk.elem, b.beast.elem);
  if(parts.length>1) txt += '（各段 '+parts.join(' / ')+'）';
  if(total>0 && dgBuffSum('life')) txt += ' 汲血回复。';
  b._lastDmg = total;
  b._lastCrit = !!crit;
  b.log.push({who:'pl', text:txt});
  finishPlayerAct(b, sk, true, 'beast');
  if(b.beast.hp<=0){ markDgWin(b, sp); }
}
/* 敌方行动（妖兽直接攻击池 + 硬皮减伤） */
function dgBeastTurn(b){
  const sp = spById(S.settle.spiritId);
  const mods = {dmgUp:0, dmgDown:0};
  mods.stab = 1.25;   // 本系加成：妖兽技能池元素恒=妖兽元素（v1.11.0）
  if(b.spBuffs.guard>0) mods.dmgDown += b.spBuffs.guard;   // v1.14.0：读技能配置的免伤百分比
  if(b.spBuffs.nullifyDamage) mods.dmgDown = 1;   // v1.18.0 寸止：完全免伤
  if(b.spBuffs.neutralizeWeakness) mods.neutralizeWeakness = true;   // v1.18.0 铁壁：克制降普通
  if(dgBuffSum('armor')) mods.dmgDown += dgBuffSum('armor');
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
    if(b.beast.hp<=0){ markDgWin(b, sp); }
    return;
  }
  // 场地：本系技能伤害独立乘区（+50%）
  const bskElem = b.beast.elem;
  if(b.field && b.field.elem===bskElem) mods.fieldMul = .5;
  b.beastEnergy = Math.min(10, (b.beastEnergy||0)+1);
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
  if(b.spHp<=0){
    // 韧性守护：每场一次保命
    if(dgBuffSum('undeath')){
      b.spHp = 1;
      b.log.push({who:'good', text:'<b class="hl">韧性守护</b>：致命一击被挡下，'+sp.name+' 保留 1 点生命！'});
    } else {
      b.phase='lost';
      b.log.push({who:'bad', text: sp.name+' 力竭败退。'});
    }
  }
}
function markDgWin(b, sp){
  b.phase='won';
  b.log.push({who:'good', text: b.beast.name+' 倒下了。'});
}
/* 胜利推进：5 倍经验 → 每 5 场回满+增益 → 下一场 / 通关 */
function dgWinFight(){
  const st = S.settle; const sp = spById(st.spiritId);
  const b = st.battle;
  st.kills++;
  const be = {normal:10, elite:20, perfect:30, legend:40}[b.beast.rarity]||10;
  const tm = {normal:1.0, elite:2.0, boss:3.0}[b.beast.template]||1.0;
  const gain = Math.max(5, Math.round((b.beast.lvl||1) * be * tm)) * 5;
  st.exp += gain;
  sp.exp = (sp.exp||0) + gain;
  sp.wins = (sp.wins||0)+1;
  let lvls = 0;
  while(sp.exp >= expToNext(sp.lvl) && sp.lvl < lvlCapOf(sp)){
    sp.exp -= expToNext(sp.lvl); sp.lvl++; lvls++;
    const stt = spiritStats(sp);
    sp.hp = Math.min(stt.hp, sp.hp + stt.hp);
    sp.capacity = capacityOf(sp);
    sp.skillPool = sp.skillPool||[];
    directUnlocked(sp.elem, sp.lvl).forEach(sk=>{
      if(!sp.skills.some(x=>x.id===sk.id) && !sp.skillPool.some(x=>x.id===sk.id)){
        sp.skillPool.push({id:sk.id, name:sk.name, kind:'direct', cost:sk.cost, elem:sk.elem, mastery:0});
      }
    });
  }
  st.logs.push('击破 '+b.beast.name+' Lv.'+b.beast.lvl+' · +'+gain+' 经验'+(lvls>0?' · 升到 Lv.'+sp.lvl:''));
  if(st.kills % 5 === 0){
    const buff = dgRollBuff();
    st.buffs.push(buff);
    st.logs.push('连战告捷！回满状态并获得常驻增益：<b>'+buff.name+(buff.tier>1?' ×'+buff.tier:'')+'</b>');
  }
  st.idx++;
  if(st.idx >= st.enemies.length){
    st.phase='done'; st.won=true;
    finalizeDungeon(true);
  } else {
    startDgFight();
  }
  renderSettle();
}
function dgLose(){
  const st = S.settle;
  st.phase='done'; st.won=false;
  st.logs.push('力竭败退——只结算已击杀经验，不抽取技能专长。');
  finalizeDungeon(false);
  renderSettle();
}