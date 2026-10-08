
const STATUS_EFFECT_TYPES = Object.keys(SKILL_STATUS);
/* 旧「主机制」枚举 → effects 翻译（兼容存量技能；新技能直接写 effects） */
function mechToEffects(sk){
  const out = [];
  const map = {execute:'execute', heal:'heal', guard:'guard', sunder:'sunder', surge:'surge', grow:'grow'};
  if(sk && sk.mech && map[sk.mech]){
    const def = SKILL_STATUS[map[sk.mech]];
    out.push({target:def.target, type:map[sk.mech], layers:def.defLayers||1});
  }
  if(sk && sk.gain){
    out.push({target:'self', type:'gain', layers:sk.gain});
  }
  return out;
}
/* 归一化技能效果：返回统一 effects 数组（旧 mech 字段 → 翻译合并；新 effects 直接使用） */
function skillEffectsOf(sk){
  if(!sk) return [];
  if(sk.effects && sk.effects.length) return sk.effects;
  return mechToEffects(sk);
}
/* 状态栏快照文本：'物攻+20% · 中毒3层' */
function statusText(st){
  if(!st) return '';
  const parts = [];
  if(st.atk)  parts.push('物攻'+(st.atk>0?'+':'')+Math.round(st.atk*100)+'%');
  if(st.def)  parts.push('物防'+(st.def>0?'+':'')+Math.round(st.def*100)+'%');
  if(st.spa)  parts.push('特攻'+(st.spa>0?'+':'')+Math.round(st.spa*100)+'%');
  if(st.sdef) parts.push('特防'+(st.sdef>0?'+':'')+Math.round(st.sdef*100)+'%');
  if(st.spd)  parts.push('速度'+(st.spd>0?'+':'')+st.spd);
  if(st.poison) parts.push('中毒'+st.poison+'层');
  if(st.burn) parts.push('灼烧'+st.burn+'层');
  if(st.freeze) parts.push('冻结'+st.freeze+'层');
  if(st.parasitic) parts.push('寄生'+st.parasitic+'层');
  if(st.sleep) parts.push('睡眠'+st.sleep+'回合');
  if(st.para) parts.push('麻痹'+st.para+'回合');
  if(st.flinch) parts.push('畏缩');
  if(st.confusion) parts.push('混乱'+st.confusion+'回合');
  return parts.join(' · ') || '';
}
/* 初始化双方状态栏 */
function initStatus(){
  return {atk:0, def:0, spa:0, sdef:0, spd:0, poison:0, burn:0, freeze:0, parasitic:0, parasiticTurns:0, sleep:0, para:0, confusion:0};
}
/* 技能命中后：把 effects 叠加到目标状态栏（带上限，ctrl 类层数 = 持续回合数） */
function applyEffects(b, side, effects, logName){
  if(!effects || !effects.length) return;
  const st = side==='self' ? b.spSt : b.beSt;
  const tgtName = side==='self' ? '自己' : b.beast.name;
  effects.forEach(ef=>{
    if(!ef || !SKILL_STATUS[ef.type]) return;
    const def = SKILL_STATUS[ef.type];
    if(def.kind==='mech') return; // 机制类由 applyMechEffect 即时执行
    // v1.18.0 属性免疫：冰免疫 freeze / 草免疫 parasitic / 雷免疫 para / 毒免疫 poison（状态附加无效）
    const myElem = b.mode==='dungeon' ? (spById(S.settle.spiritId)||{}).elem : (wildSpirit()||{}).elem;
    const tgtElem = side==='self' ? myElem : b.beast.elem;
    const immuneMap = {freeze:'ice', parasitic:'grass', para:'thunder', poison:'poison'};
    if(immuneMap[ef.type] && tgtElem===immuneMap[ef.type]){
      b.log.push({who:'pl', text: tgtName+' 免疫了'+def.name+'！'});
      return;
    }
    const n = Math.max(1, ef.layers||1);
    if(def.kind==='stat'){
      // 属性状态栏存累计值：攻防特攻特防按百分比（0.1/层），速度按点数（10/层）
      const key = ef.type.replace(/_up|_down$/,'');
      const isDown = ef.type.endsWith('_down');
      const step = key==='spd' ? 10 : .1;
      st[key] = clampLayers((st[key]||0) + (isDown?-1:1)*step*n, def.cap);
      if(key!=='spd') st[key] = Math.round(st[key]*1000)/1000; // 消浮点尾差
      const shown = key==='spd' ? st[key] : Math.round(st[key]*100)+'%';
      b.log.push({who:'pl', text:logName+' 使'+tgtName+def.name+'至 '+shown+'。'});
    } else if(def.kind==='dot'){
      st[ef.type] = Math.min(def.cap, (st[ef.type]||0) + n);
      // v1.13.3：dot 效果可带 turns（回合限制，仅寄生使用如茁茁炸弹「持续 3 回合」）；
      //          无 turns = 永续（层数=数值，不衰减）
      if(ef.type==='parasitic' && ef.turns) st.parasiticTurns = Math.max(st.parasiticTurns||0, ef.turns);
      b.log.push({who:'pl', text:logName+' 使'+tgtName+def.name+' '+n+' 层。'});
    } else if(def.kind==='attr'){
      // v1.18.0：我方属性增益（leech/combo/costdown/powerup），存到 st 上，持有时对我方技能生效
      st[ef.type] = (st[ef.type]||0) + n;
      b.log.push({who:'pl', text:logName+' 获得'+def.name+' '+n+' 层。'});
    } else { // ctrl：睡眠/麻痹/畏缩——层数 = 持续回合数（存在即生效）
      st[ef.type] = Math.min(def.cap||10, (st[ef.type]||0) + n);
      b.log.push({who:'pl', text:logName+' 使'+tgtName+def.name+'（'+st[ef.type]+' 回合）！'});
    }
  });
}
function clampLayers(v, cap){
  if(v>0) return Math.min(cap, v);
  return Math.max(-cap, v);
}
/* 技能 effects 分派：状态/持续/控制 → 状态栏；机制类 → 即时执行（drain 吸血需要伤害值 dmg）
   每条效果可带 prob（0~1，缺省必中）：未命中则整条效果不生效 */
function applySkillEffects(b, effects, logName, dmg){
  // v1.19.4：效果组（effectGroup）通用化——旧格式自动包装成 all 组
  (normalizeEffects(effects)).forEach(ef=>{
    if(!ef) return;
    if(ef.type==='effectGroup'){ applyEffectGroup(b, ef, logName, dmg); return; }
    if(!SKILL_STATUS[ef.type]) return;
    const def = SKILL_STATUS[ef.type];
    if(ef.prob!=null && ef.prob<1 && Math.random()>=ef.prob){
      b.log.push({who:'pl', text:logName+' 的'+def.name+'效果未能附加。'});
      return;
    }
    if(def.kind==='mech'){
      applyMechEffect(b, ef, logName, dmg);
      return;
    }
    const side = ef.target==='self' ? 'self' : 'enemy';
    applyEffects(b, side, [ef], logName);
  });
}
/* v1.19.4：normalizeEffects——旧格式（效果数组）自动包装成 [{type:'effectGroup',mode:'all',children:[...]}] */
function normalizeEffects(effects){
  if(!effects || !effects.length) return [];
  // 已经是 effectGroup 格式
  if(effects[0] && effects[0].type==='effectGroup') return effects;
  // 旧格式：自动包装成 all 组
  return [{type:'effectGroup', mode:'all', children:effects}];
}
/* v1.19.4：applyEffectGroup——按 mode 分派 */
function applyEffectGroup(b, grp, logName, dmg){
  const mode = grp.mode||'all';
  const children = grp.children||[];
  if(mode==='all'){
    children.forEach(ef=>{
      if(!ef) return;
      if(!SKILL_STATUS[ef.type]) return;
      const def = SKILL_STATUS[ef.type];
      if(ef.prob!=null && ef.prob<1 && Math.random()>=ef.prob) return;
      if(def.kind==='mech') applyMechEffect(b, ef, logName, dmg);
      else { const side = ef.target==='self'?'self':'enemy'; applyEffects(b, side, [ef], logName); }
    });
  } else if(mode==='randomOne'){
    // 按 prob 权重随机选一个
    const total = children.reduce((s,c)=>s+(c.prob||0),0);
    let roll = Math.random()*total, chosen = null;
    for(const c of children){ roll -= (c.prob||0); if(roll<0){ chosen=c; break; } }
    if(!chosen) chosen = children[children.length-1];
    if(chosen && chosen.effects){
      chosen.effects.forEach(ef=>{
        if(!ef || !SKILL_STATUS[ef.type]) return;
        const def = SKILL_STATUS[ef.type];
        if(def.kind==='mech') applyMechEffect(b, ef, logName, dmg);
        else { const side = ef.target==='self'?'self':'enemy'; applyEffects(b, side, [ef], logName); }
      });
    }
  } else if(mode==='randomRoll'){
    // 每个子组独立按 prob 判定
    children.forEach(c=>{
      if(Math.random()*100 >= (c.prob||0)) return;
      if(c.effects){
        c.effects.forEach(ef=>{
          if(!ef || !SKILL_STATUS[ef.type]) return;
          const def = SKILL_STATUS[ef.type];
          if(def.kind==='mech') applyMechEffect(b, ef, logName, dmg);
          else { const side = ef.target==='self'?'self':'enemy'; applyEffects(b, side, [ef], logName); }
        });
      }
    });
  }
}
/* 机制类效果即时执行：execute/heal/drain/guard/sunder/surge/gain/grow */
function applyMechEffect(b, ef, logName, dmg){
  const isDg = b.mode==='dungeon';
  const sp = isDg ? spById(S.settle.spiritId) : wildSpirit();
  const win = isDg ? markDgWin : markWin;
  const n = Math.max(1, ef.layers||1);
  switch(ef.type){
    case 'execute': {
      // 斩杀：敌血低于 n% 直接击倒（在伤害结算前调用）
      if(b.beast.hp < b.beast.maxHp * n / 100){
        b.beast.hp = 0;
        b.log.push({who:'pl', text:logName+'<b class="hl">斩杀</b>了残血的'+b.beast.name+'！'});
        win(b, sp);
      }
      break;
    }
    case 'heal': {
      // 治愈：按 target 回我方或敌方最大生命 X%（吸取力量会同时回双方）
      const isEnemy = ef.target==='enemy';
      const maxHp = isEnemy ? (b.beast.maxHp||b.beast.hp) : b.spMax;
      const heal = Math.max(1, Math.round(maxHp * n / 100));
      if(isEnemy){
        b.beast.hp = Math.min(b.beast.maxHp||b.beast.hp, b.beast.hp + heal);
        b.log.push({who:'pl', text:logName+' 唤回生机，'+b.beast.name+' 回复 <b>'+heal+'</b> 点生命。'});
      } else {
        b.spHp = Math.min(b.spMax, b.spHp + heal);
        b.log.push({who:'pl', text:logName+' 回溯生机，回复 <b>'+heal+'</b> 点生命。'});
      }
      b._lastHeal = (b._lastHeal||0) + heal;
      break;
    }
    case 'cleanse': {
      // 净化：清除我方全体负面状态（属性下降 + 中毒/灼烧/冻结/寄生/睡眠/麻痹/畏缩）
      const st = b.spSt;
      const keys = ['atk','def','spa','sdef','spd'];
      let cleared = 0;
      keys.forEach(k=>{ if(st[k]<0){ st[k]=0; cleared++; } });
      ['poison','burn','freeze','parasitic','sleep','para','flinch','confusion'].forEach(k=>{
        if(st[k]>0){ st[k]=0; cleared++; }
      });
      st.parasiticTurns = 0;  // v1.13.3：寄生回合计数随寄生状态一并清除
      b.log.push({who:'pl', text:logName+' 花香涤荡，清除我方全部负面状态。'});
      break;
    }
    case 'field': {
      // 场地：开启对应属性场地 X 回合（新场地覆盖旧场地；场地是全场景 buff 机制）
      b.field = {elem: ef.elem || (sp&&sp.elem) || 'grass', turns: Math.max(1, n), healTurns: 0};
      b.log.push({who:'pl', text:logName+' <b class="hl">开启'+elemName(b.field.elem)+'场地</b>，持续 '+b.field.turns+' 回合：本系技能伤害 +50%，我方每回合回复 1/16 最大生命。'});
      break;
    }
    case 'drain': {
      const drain = Math.round((dmg||0) * n / 100);
      if(drain>0){
        b.spHp = Math.min(b.spMax, b.spHp + drain);
        b.log.push({who:'pl', text:logName+' 汲取生命，回复 <b>'+drain+'</b> 点生命。'});
      }
      break;
    }
    case 'guard': {
      // v1.14.0：免伤百分比读 effects.layers（如 layers:80 → 0.8），不再写死 25%/布尔
      b.spBuffs.guard = Math.max(b.spBuffs.guard||0, (ef.layers||25)/100);
      b.log.push({who:'pl', text:logName+' 摆出守势，本回合受到伤害 −'+(ef.layers||25)+'%。'});
      break;
    }
    case 'sunder': {
      b.beastBuffs.vuln = Math.max(b.beastBuffs.vuln||0, n/100);
      b.log.push({who:'pl', text:logName+' <b class="hl">破甲</b>！'+b.beast.name+' 本回合受到伤害 +'+n+'%。'});
      break;
    }
    case 'surge': {
      b.energy = Math.min(b.energyMax, b.energy + n);
      b.log.push({who:'pl', text:logName+'，能量 +'+n+'（当前 <b>'+b.energy+'</b>/'+b.energyMax+'）。'});
      break;
    }
    case 'gain': {
      b.energy = Math.min(b.energyMax, b.energy + n);
      b.log.push({who:'pl', text:logName+' 流转生机，能量 +'+n+'（当前 <b>'+b.energy+'</b>/'+b.energyMax+'）。'});
      break;
    }
    case 'grow': {
      if(sp) sp.growth = (sp.growth||0) + n;
      b.log.push({who:'pl', text:logName+' 的本源力量沉淀，<b class="hl">成长</b>效果永久提升了！'});
      break;
    }
    case 'recoil': {
      // 反震/反噬：命中后自身承受造成伤害的 X%（伤害结算后调用，dmg 为本次总伤害）
      if((dmg||0)>0){
        const rk = Math.max(1, Math.round(dmg * n / 100));
        b.spHp = Math.max(0, b.spHp - rk);
        b.log.push({who:'pl', text:logName+' 受到 <b class="hl">'+rk+'</b> 点反震伤害。'});
        if(b.spHp<=0){ b.spHp = 0; b.phase='lost'; b.log.push({who:'bad', text: sp.name+' 被自己的招式反噬击倒！'}); }
      }
      break;
    }
    case 'recharge': {
      // 力竭：释放后下一回合无法行动（写在战斗对象的 pending 标记，回合循环里拦截该侧行动）
      b.recharge = {side: ef.target==='self' ? 'self' : 'enemy', pending: Math.max(1, n)};
      break;
    }
    /* —— v1.18.0 新机制效果 —— */
    case 'weather': {
      b.weather = {type: ef.elem || 'snow', turns: Math.max(1, n)};
      b.log.push({who:'pl', text:logName+' <b class="hl">'+(ef.elem==='snow'?'暴风雪':elemName(ef.elem||'snow'))+'</b>，天气持续 '+n+' 回合。'});
      break;
    }
    case 'weatherClear': {
      if(b.weather){ b.weather = null; b.log.push({who:'pl', text:logName+' 锁住了天气，场上天气消散。'}); }
      break;
    }
    case 'speedRatio': {
      // 速度差倍率：⌊我方速度÷敌方速度⌋ clamp 1~5，存 b.spBuffs.speedRatio 供伤害结算
      const mySpd = spiritStats(sp).spd;
      const enSpd = b.beast.spd || (b.beast.stats&&b.beast.stats.spd) || 1;
      const ratio = Math.max(1, Math.min(5, Math.floor(mySpd / Math.max(1, enSpd))));
      b.spBuffs.speedRatio = ratio;
      b.log.push({who:'pl', text:logName+' 速度差爆发，倍率 ×'+ratio+'。'});
      break;
    }
    case 'defRatio': {
      const myDef = spiritStats(sp).def;
      const enDef = b.beast.def || (b.beast.stats&&b.beast.stats.def) || 1;
      const ratio = Math.max(1, Math.min(5, Math.floor(myDef / Math.max(1, enDef))));
      b.spBuffs.defRatio = ratio;
      b.log.push({who:'pl', text:logName+' 物防差爆发，倍率 ×'+ratio+'。'});
      break;
    }
    case 'defScaled': {
      b.spBuffs.defScaled = true;
      b.log.push({who:'pl', text:logName+' 以物防为臂，坚石出击！'});
      break;
    }
    case 'freezeCountHeal': {
      const layers = b.beSt.freeze || 0;
      if(layers>0){
        const heal = Math.max(1, Math.round(b.spMax * n/100 * layers));
        b.spHp = Math.min(b.spMax, b.spHp + heal);
        b.log.push({who:'pl', text:logName+' 冰雪映景，回复 <b>'+heal+'</b> 点生命。'});
      }
      break;
    }
    case 'pierceGuard': {
      b.spBuffs.pierceGuard = true;
      b.log.push({who:'pl', text:logName+' 念力穿透，无视对方防御！'});
      break;
    }
    case 'nullifyDamage': {
      b.spBuffs.nullifyDamage = true;
      break;
    }
    case 'neutralizeWeakness': {
      b.spBuffs.neutralizeWeakness = true;
      break;
    }
    case 'cooldownUp': {
      // 敌方本回合技能冷却 +1（寸止反击）
      if(b.enemySkillCd) b.enemySkillCd++;
      else b.enemySkillCd = 1;
      break;
    }
    case 'condSuperEffective': {
      // 敌方未用防御技能时本技能视为克制
      if(!b.enemyUsedDefense) b.spBuffs.condSuperEffective = true;
      break;
    }
    case 'copyPower': {
      // 敌方用攻击时本次威力=敌方技能威力
      if(b.enemyUsedAttack && b.enemySkillPower!=null){
        b.spBuffs.copyPower = b.enemySkillPower;
      }
      break;
    }
    case 'missingHpPower': {
      // 每损失 10% 血量威力 +N（存标记，伤害结算时读 spHp/spMax 算）
      b.spBuffs.missingHpPower = n;
      break;
    }
    case 'condPower': {
      // 满足条件时本次威力 +N
      if(condMatch(b, ef.cond, ef.pct)){
        b.spBuffs.condPower = (b.spBuffs.condPower||0) + n;
      }
      break;
    }
    case 'condBurn': {
      // v1.19.0：满足条件时额外给敌方加 N 层灼烧
      if(condMatch(b, ef.cond, ef.pct)){
        applyEffects(b, 'enemy', [{target:'enemy', type:'burn', layers:n}], logName);
      }
      break;
    }
    case 'condCombo': {
      if(condMatch(b, ef.cond, ef.pct)){
        b.spBuffs.condCombo = (b.spBuffs.condCombo||0) + n;
      }
      break;
    }
    case 'condBuff': {
      if(condMatch(b, ef.cond, ef.pct)){
        applyEffects(b, 'self', [{target:'self', type:ef.buffType, layers:n}], logName);
      }
      break;
    }
    case 'condCooldown': {
      if(b.enemyUsedAttack){
        // 我方防御技能冷却 -1
        if(b.cds){ for(const k in b.cds){ if(b.cds[k]>0) b.cds[k]--; } }
        b.log.push({who:'pl', text:logName+' 借势反击，防御节奏加快。'});
      }
      break;
    }
    case 'condHeal': {
      if(condMatch(b, ef.cond, ef.pct)){
        const heal = Math.max(1, Math.round(b.spMax * n / 100));
        b.spHp = Math.min(b.spMax, b.spHp + heal);
        b.log.push({who:'pl', text:logName+' 蓄势回气，回复 <b>'+heal+'</b> 点生命。'});
      }
      break;
    }
    case 'randomBuff': {
      const pool = ['atk_up','spa_up','def_up','sdef_up','spd_up','leech','combo','costdown'];
      for(let i=0;i<n;i++){
        const pick = pool[Math.floor(Math.random()*pool.length)];
        applyEffects(b, 'self', [{target:'self', type:pick, layers:1}], logName);
      }
      break;
    }
    case 'dispelBuff': {
      // 驱散敌方技能来源正向属性状态（不碰天气/dot/ctrl/减益）
      const st = b.beSt;
      let cleared = 0;
      ['atk','def','spa','sdef','spd','leech','combo','costdown','powerup'].forEach(k=>{
        if(st[k]>0){ st[k]=0; cleared++; }
      });
      b.log.push({who:'pl', text:logName+' 信念涤荡，驱散了'+b.beast.name+'的增益（'+cleared+' 项）。'});
      break;
    }
    case 'varietyBuff': {
      const cnt = varietyCount(sp);
      if(cnt>0){
        const atkL = ef.atkLayers||2, spaL = ef.spaLayers||2;
        if(atkL) applyEffects(b, 'self', [{target:'self', type:'atk_up', layers:atkL*cnt}], logName);
        if(spaL) applyEffects(b, 'self', [{target:'self', type:'spa_up', layers:spaL*cnt}], logName);
      }
      break;
    }
    case 'varietyGuard': {
      const cnt = varietyCount(sp);
      if(cnt>0){
        const extra = n*cnt;
        b.spBuffs.guard = Math.max(b.spBuffs.guard||0, extra/100);
      }
      break;
    }
    case 'varietyHits': {
      const cnt = varietyCount(sp);
      if(cnt>0) b.spBuffs.varietyHits = (b.spBuffs.varietyHits||0) + cnt;
      break;
    }
    /* —— v1.19.2：水毒幽新机制 —— */
    case 'scalingByStatus': {
      // 读目标身上某状态层数，动态调整本技能 power/hits/damageReduce/energyCost
      const st = ef.target==='enemy' ? b.beSt : b.spSt;
      const layers = st[ef.status] || 0;
      if(layers>0){
        if(ef.perPower) b.spBuffs.scaledPower = (b.spBuffs.scaledPower||0) + ef.perPower * layers;
        if(ef.perHits) b.spBuffs.scaledHits = (b.spBuffs.scaledHits||0) + ef.perHits * layers;
        if(ef.perDamageReduce) b.spBuffs.scaledGuard = Math.max(b.spBuffs.scaledGuard||0, ef.perDamageReduce * layers);
        if(ef.perEnergyCost) b.spBuffs.scaledEnergy = (b.spBuffs.scaledEnergy||0) - ef.perEnergyCost * layers; // 负=能耗降
        b.log.push({who:'pl', text:logName+' 借势'+(SKILL_STATUS[ef.status]?SKILL_STATUS[ef.status].name:ef.status)+'（'+layers+'层），威力/段数变化。'});
      }
      break;
    }
    case 'energyScaling': {
      // 读双方能量做条件/动态（如敌每1能量威力-10%；我>敌能量威力+50）
      const enE = b.beastEnergy||0;
      const myE = b.energy||0;
      if(ef.cond==='enemyEnergyLt' && enE >= (ef.threshold||0)) break;
      if(ef.cond==='selfGtEnemy' && myE <= enE) break;
      if(ef.perPowerSelfGt) b.spBuffs.scaledPower = (b.spBuffs.scaledPower||0) + ef.perPowerSelfGt;
      if(ef.perPowerPerEnemyEnergy) b.spBuffs.scaledPower = (b.spBuffs.scaledPower||0) - ef.perPowerPerEnemyEnergy * enE;
      if(ef.condPower) b.spBuffs.condPower = (b.spBuffs.condPower||0) + ef.condPower;
      break;
    }
    case 'stealEnergy': {
      // 扣敌 N 能量，回自 N 能量
      const n = Math.min(b.beastEnergy||0, ef.layers||1);
      b.beastEnergy = Math.max(0, b.beastEnergy - n);
      b.energy = Math.min(b.energyMax, b.energy + n);
      b.log.push({who:'pl', text:logName+' 窃取敌方 <b>'+n+'</b> 点能量（当前敌方 '+b.beastEnergy+' / 我方 '+b.energy+'）。'});
      break;
    }
    case 'drainEnergy': {
      const n = Math.min(b.beastEnergy||0, ef.layers||1);
      b.beastEnergy = Math.max(0, b.beastEnergy - n);
      b.log.push({who:'pl', text:logName+' 抽干敌方 <b>'+n+'</b> 点能量（当前敌方 '+b.beastEnergy+'）。'});
      break;
    }
    case 'cleanseByCount': {
      // 移除目标身上某状态，每移除 1 层触发效果
      const st = ef.target==='self' ? b.spSt : b.beSt;
      const layers = st[ef.status]||0;
      if(layers>0){
        st[ef.status] = 0;
        // 转效果：每 N 层回自 healPct% 血 / 每 N 层给敌方附 poison
        if(ef.healPerLayer) b.spHp = Math.min(b.spMax, b.spHp + Math.max(1, Math.round(b.spMax * ef.healPerLayer/100 * layers)));
        if(ef.poisonPerLayer) applyEffects(b, 'enemy', [{target:'enemy', type:'poison', layers:layers}], logName);
        b.log.push({who:'pl', text:logName+' 涤荡'+layers+' 层'+(SKILL_STATUS[ef.status]?SKILL_STATUS[ef.status].name:ef.status)+'，转化效果。'});
      }
      break;
    }
    case 'randomDebuff': {
      // 从减益池随机选 count 种，各挂 layers 层
      const pool = ['atk_down','def_down','spa_down','sdef_down','spd_down','energyUp'];
      for(let i=0;i<(ef.count||1);i++){
        const pick = pool[Math.floor(Math.random()*pool.length)];
        applyEffects(b, 'enemy', [{target:'enemy', type:pick, layers:ef.layers||1}], logName);
      }
      break;
    }
    case 'field_water': {
      // 湿润场地：8 回合，水系伤+50%，我方受伤-10%
      b.field = {elem:'water', turns:Math.max(1, n), healTurns:0, waterDmgCut:true};
      b.log.push({who:'pl', text:logName+' <b class="hl">召唤湿润场地</b>，持续 '+b.field.turns+' 回合：水系技能伤害 +50%，我方受到伤害 −10%。'});
      break;
    }
    case 'energyFull': {
      // 目标能量回满
      if(ef.target==='enemy') b.beastEnergy = 10;
      else b.energy = Math.min(b.energyMax||10, b.energyMax||10);
      b.log.push({who:'pl', text:logName+' 能量回满。'});
      break;
    }
    case 'energyZero': {
      if(ef.target==='enemy') b.beastEnergy = 0;
      else b.energy = 0;
      b.log.push({who:'pl', text:logName+' 能量清零。'});
      break;
    }
  }
}
/* v1.18.0：条件判定（cond key：enemyUsedAttack/firstStrike/hpBelow:{pct}/enemyNoDefense） */
function condMatch(b, cond, pct){
  if(cond==='enemyUsedAttack') return !!b.enemyUsedAttack;
  if(cond==='enemyUsedStatus') return !!b.enemyUsedStatus;
  if(cond==='firstStrike') return !!b.selfFirst;
  if(cond==='enemyNoDefense') return !b.enemyUsedDefense;
  if(cond==='hpBelow'){
    const p = pct||50;
    return (b.spMax>0 && (b.spHp/b.spMax)*100 < p);
  }
  if(cond==='enemyHasDebuffStatus'){
    // v1.19.2：敌方身上有负面效果状态（dot/ctrl/wenling/energyUp）
    const st = b.beSt;
    return ['poison','burn','freeze','parasitic','sleep','para','flinch','confusion','wenling'].some(k=>(st[k]||0)>0) || (st.energyUp||0)>0;
  }
  return false;
}
/* v1.18.0：携带属性数 = sp.skills 中真正技能的不同 elem 种类数（含 none；被动不算技能） */
function varietyCount(sp){
  if(!sp || !sp.skills) return 0;
  const s = new Set();
  sp.skills.forEach(x=>{
    if(!x) return;
    if(x.id==='g_lightcharge') return; // 聚能被动不算技能
    const e = x.elem || 'none';
    s.add(e);
  });
  return s.size;
}
/* 从技能 effects 读取本技能暴击率（crit 覆盖全局 10%） */
function skillCritChance(sk){
  const ef = skillEffectsOf(sk).find(x=>x.type==='crit');
  if(ef && ef.layers>0) return Math.min(100, ef.layers)/100;
  return .1;
}
/* 从状态栏算伤害/先手修正（mods.dmgUp/dmgDown + 攻防实际值修正） */
function statusMods(side, b){
  const st = side==='self' ? b.spSt : b.beSt;
  const wst = side==='self' ? b.spStWeather : b.beStWeather;
  const mods = {dmgUp:0, dmgDown:0};
  if(!st) return mods;
  // v1.18.0：合并天气状态栏（def/sdef，不被净化）
  const defV = (st.def||0) + (wst?(wst.def||0):0);
  const sdefV = (st.sdef||0) + (wst?(wst.sdef||0):0);
  if(st.atk>0) mods.atkMul = 1 + st.atk; else if(st.atk<0) mods.atkMul = Math.max(.1, 1 + st.atk);
  if(st.spa>0) mods.spaMul = 1 + st.spa; else if(st.spa<0) mods.spaMul = Math.max(.1, 1 + st.spa);
  if(defV>0) mods.defMul = 1 + defV; else if(defV<0) mods.defMul = Math.max(.1, 1 + defV);
  if(sdefV>0) mods.sdefMul = 1 + sdefV; else if(sdefV<0) mods.sdefMul = Math.max(.1, 1 + sdefV);
  if(st.spd) mods.spdMul = Math.max(.1, 1 + st.spd/100);
  if(st.para>0) mods.spdMul = (mods.spdMul||1) * .5;  // 麻痹：速度下降 50%
  return mods;
}
/* 回合末结算：中毒/灼烧/冻结/寄生伤害 + 睡眠概率衰减 / 麻痹、畏缩层数衰减 + 场地结算 */
function tickStatus(b){
  const mk = (side, st, tgtName)=>{
    let dmg = 0;
    const maxHp = side==='self' ? b.spMax : b.beast.maxHp;
    const myElem = b.mode==='dungeon' ? (spById(S.settle.spiritId)||{}).elem : (wildSpirit()||{}).elem;
    const immuneElem = side==='self' ? myElem : b.beast.elem;
    if(st.poison>0 && immuneElem!=='poison'){
      const dot = Math.max(1, Math.round(maxHp * (SKILL_STATUS.poison.dot||.03) * st.poison));
      dmg += dot;
      b.log.push({who: side==='self'?'pl':'be', text: tgtName+' 因中毒损失 <b>'+dot+'</b> 点生命。'});
      if(typeof queueDot==='function') queueDot(b, side==='self'?'player':'enemy', 'poison', dot);
    }
    // 灼烧：永续状态，层数=数值（每层回合末受 2% 最大生命火伤，不衰减；v1.14.2 与中毒/寄生同口径）
    if(st.burn>0 && immuneElem!=='fire'){
      const dot = Math.max(1, Math.round(maxHp * (SKILL_STATUS.burn.dot||.02) * st.burn));
      dmg += dot;
      b.log.push({who: side==='self'?'pl':'be', text: tgtName+' 因灼烧损失 <b>'+dot+'</b> 点生命。'});
      if(typeof queueDot==='function') queueDot(b, side==='self'?'player':'enemy', 'burn', dot);
    }
    if(st.freeze>0 && immuneElem!=='ice'){
      const dot = Math.max(1, Math.round(maxHp * (SKILL_STATUS.freeze.dot||.05) * st.freeze));
      dmg += dot;
      b.log.push({who: side==='self'?'pl':'be', text: tgtName+' 因冻结损失 <b>'+dot+'</b> 点生命。'});
      if(typeof queueDot==='function') queueDot(b, side==='self'?'player':'enemy', 'freeze', dot);
    }
    // 寄生：永续状态，层数 = 数值（每层回合末流失 3% 最大生命，施法者回复等量血量；谁被寄生，对面回血）
    // v1.13.3：移除「层数当回合数」的错误实现（v1.12.0 遗留）——寄生不再自动衰减；
    //         技能若带 turns 字段（如茁茁炸弹「持续 3 回合」）由 parasiticTurns 独立计数，归零才清除。
    if(st.parasitic>0 && immuneElem!=='grass'){
      const dot = Math.max(1, Math.round(maxHp * (SKILL_STATUS.parasitic.dot||.03) * st.parasitic));
      dmg += dot;
      b.log.push({who: side==='self'?'pl':'be', text: tgtName+' 被寄生种子吸取 <b>'+dot+'</b> 点生命。'});
      if(typeof queueDot==='function') queueDot(b, side==='self'?'player':'enemy', 'parasitic', dot);
      if(side==='self'){
        b.beast.hp = Math.min(b.beast.maxHp||b.beast.hp, b.beast.hp + dot);
        b.log.push({who:'be', text: b.beast.name+' 回复 <b>'+dot+'</b> 点生命。'});
        if(typeof queueHealFx==='function') queueHealFx(b, 'enemy', dot, 'dot');
      } else {
        b.spHp = Math.min(b.spMax, b.spHp + dot);
        b.log.push({who:'pl', text:' 我方回复 <b>'+dot+'</b> 点生命。'});
        if(typeof queueHealFx==='function') queueHealFx(b, 'player', dot, 'dot');
      }
      if(st.parasiticTurns>0){
        st.parasiticTurns--;
        if(st.parasiticTurns<=0) st.parasitic = 0;
      }
    }
    if(dmg>0){
      if(side==='self'){ b.spHp = Math.max(0, b.spHp-dmg); if(b.spHp<=0) b.phase='lost'; }
      else { b.beast.hp = Math.max(0, b.beast.hp-dmg); if(b.beast.hp<=0) b.phase='won'; }
    }
    // 睡眠：层数 = 持续回合数；每回合衰减——本回合未受攻击 50% 概率不降层，受攻击 25% 概率不降层
    if(st.sleep>0){
      const hit = side==='self' ? b.hitSelf : b.hitBeast;
      const keepP = hit ? .25 : .5;
      if(Math.random() >= keepP) st.sleep = Math.max(0, st.sleep-1);
    }
    if(st.para>0) st.para = Math.max(0, st.para-1);
    if(st.flinch>0) st.flinch = Math.max(0, st.flinch-1);
    if(st.confusion>0) st.confusion = Math.max(0, st.confusion-1);
    // v1.19.2：energyDown/energyUp 每回合衰减 -1
    if(st.energyDown>0) st.energyDown = Math.max(0, st.energyDown-1);
    if(st.energyUp>0) st.energyUp = Math.max(0, st.energyUp-1);
    // v1.19.2：问灵 wenling（层数=计数）：先按旧计数结算，再 +1
    if(st.wenling>0){
      const cnt = st.wenling;
      if(side==='self'){
        if(cnt % 2 === 1) b.energy = Math.min(b.energyMax||10, b.energy + 1);
        else b.energy = Math.max(0, b.energy - cnt);
      } else {
        if(cnt % 2 === 1) b.beastEnergy = Math.min(10, (b.beastEnergy||0) + 1);
        else b.beastEnergy = Math.max(0, (b.beastEnergy||0) - cnt);
      }
      st.wenling = Math.min(10, st.wenling + 1);
    }
  };
  mk('self', b.spSt, '己方');
  if(b.phase==='fight') mk('beast', b.beSt, b.beast.name);
  // 场地结算：我方每回合回复 1/16 最大生命；回合数递减，归零后消失
  if(b.field){
    if(b.phase==='fight'){
      const h = Math.max(1, Math.round(b.spMax/16));
      b.spHp = Math.min(b.spMax, b.spHp + h);
      b.log.push({who:'pl', text: b.field.elem==='grass' ? '青草场地滋养，我方回复 <b>'+h+'</b> 点生命。' : elemName(b.field.elem)+'场地滋养，我方回复 <b>'+h+'</b> 点生命。'});
      if(typeof queueHealFx==='function') queueHealFx(b, 'player', h, 'end');
    }
    b.field.turns--;
    if(b.field.turns<=0) b.field = null;
  }
  // v1.18.0 天气结算：雪天每回合末双方各 +2 冻结；冰系精灵 +10 物防/特防（weather 状态栏，不被净化）
  if(b.weather && b.weather.type==='snow'){
    b.spSt.freeze = Math.min(10, (b.spSt.freeze||0) + 2);
    if(b.phase==='fight') b.beSt.freeze = Math.min(10, (b.beSt.freeze||0) + 2);
    const myElem = b.mode==='dungeon' ? (spById(S.settle.spiritId)||{}).elem : (wildSpirit()||{}).elem;
    b.spStWeather = b.spStWeather || {def:0, sdef:0};
    if(myElem==='ice'){ b.spStWeather.def = 1; b.spStWeather.sdef = 1; }
    else { b.spStWeather.def = 0; b.spStWeather.sdef = 0; }
    if(b.phase==='fight' && b.beast.elem==='ice'){
      b.beStWeather = b.beStWeather || {def:0, sdef:0};
      b.beStWeather.def = 1; b.beStWeather.sdef = 1;
    }
    b.weather.turns--;
    if(b.weather.turns<=0) b.weather = null;
  }
}
/* 睡眠/畏缩行动判定：返回 false 表示该回合无法行动（麻痹不再阻挡行动，改为释放时 50% 失败） */
function canAct(st, side){
  if(!st) return true;
  if(st.sleep>0) return false;
  if(st.flinch>0) return false;
  return true;
}
/* 克制/抵抗效果标注（供战斗日志展示） */
function typeLabel(atkElem, defElem){
  const m = typeMult(atkElem, defElem);
  if(m>=2) return ' <b class="hl">效果绝佳！</b>';
  if(m<=0.5) return ' <span class="muted">效果不佳…</span>';
  return '';
}
function spiritAtk(sp){
  const st = spiritStats(sp);
  return st.atk;
}