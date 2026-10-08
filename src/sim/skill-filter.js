

/* ================= 图鉴编辑视图 ================= */
/* 技能池独立视图（M3-P0）：总览统计 + 全技能列表 + 属性存在分池 */
function toggleSkillFlt(axis, val){
  S.skillFilter = S.skillFilter||{};
  if(axis==='type'){
    // 类型标签多选
    S.skillFilter.type = S.skillFilter.type||[];
    const i = S.skillFilter.type.indexOf(val);
    if(i>=0) S.skillFilter.type.splice(i,1); else S.skillFilter.type.push(val);
    if(!S.skillFilter.type.length) delete S.skillFilter.type;
  } else {
    if(S.skillFilter[axis]===val) delete S.skillFilter[axis];
    else S.skillFilter[axis]=val;
  }
  renderSkills();
}
function clearSkillFlt(){ S.skillFilter = {}; renderSkills(); }
/* v1.19.3：技能类型（战斗定位）判定——物理/特殊/状态/防御 */
function skillBattleType(sk){
  if(sk.type==='状态') return '状态';
  if(sk.type==='防御') return '防御';
  if(sk.type==='攻击') return sk.track==='spec' ? '特殊' : '物理';
  return '其他';
}