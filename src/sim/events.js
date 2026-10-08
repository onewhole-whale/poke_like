
/* 事件链运行时：判定当前出战精灵某 stat 面板（按挑战等级 lvlRef） */
function eventStatPanel(stat, race, iv, lvlRef){
  // C4：按 stat 取出战精灵该属性实际面板值（不再用种族公式理论面板）
  const sp = wildSpirit();
  if(!sp) return 0;
  const map = {spe:'spd', atk:'atk', def:'def', spa:'spa', sdef:'sdef', hp:'hp'};
  const key = map[stat] || stat;
  // 优先战斗面板（若战斗中），否则精灵面板
  const b = (S.wild && S.wild.battle);
  if(b && b.phase==='fight'){
    if(key==='hp') return b.spHp;
    if(key==='spd') return b.spSpd;
    if(key==='atk') return b.spAtk;
    if(key==='def') return b.spDef;
    if(key==='spa') return b.spSpa;
    if(key==='sdef') return b.spSdef;
  }
  // 非战斗：取精灵面板
  const st = sp && typeof spById === 'function' ? spiritStats(sp) : null;
  if(st){
    if(key==='hp') return st.hp;
    if(key==='spd') return st.spd;
    if(key==='atk') return st.atk;
    if(key==='def') return st.def;
    if(key==='spa') return st.spa;
    if(key==='sdef') return st.sdef;
  }
  return 0;
}
function evalCond(cond){
  if(!cond) return true;
  const sp = wildSpirit();
  if(cond.aff){
    const a = S.aff && S.aff[cond.aff.elem] || 0;
    return a >= cond.aff.gte;
  }
  if(cond.mats){
    return cond.mats.every(mi => (matState[mi.id]||0) >= mi.qty);
  }
  if(cond.elem){
    return sp && sp.elem === cond.elem;
  }
  if(cond.stat){
    const panel = eventStatPanel(cond.stat, cond.race||100, cond.iv||0, cond.lvlRef||'max');
    return panel >= (cond.gte || 0);
  }
  return true;
}
/* 事件链 loseMats：先随机 roll a~b 决定损失数量，玩家选对应件数 */
function rollLoseQty(qty){
  if(typeof qty==='number') return qty;
  const m = String(qty).split('~');
  const a = parseInt(m[0]), b = parseInt(m[1]);
  return a + Math.floor(Math.random()*(b-a+1));
}