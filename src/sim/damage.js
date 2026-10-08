

/* 战斗 buff 实例化：按 buffRule.count 抽，按难度映射 side */
function rollBattleBuffs(rule, difficulty){
  if(!rule || !rule.enabled===false && !rule.count) return [];
  const n = rule.count||0;
  const pool = rule.pool||[];
  const out = [];
  for(let i=0;i<n;i++){
    const bid = pick(pool);
    const def = BATTLE_BUFFS[bid];
    if(!def) continue;
    // side 映射：简单=buff→player/debuff→beast；普通=双方同；困难=buff→beast/debuff→player
    let side;
    if(difficulty==='easy'){
      side = (def.effectType==='debuff') ? 'beast' : 'player';
    } else if(difficulty==='hard'){
      side = (def.effectType==='buff') ? 'beast' : 'player';
    } else {
      side = def.effectType==='neutral' ? 'both' : (Math.random()<.5?'player':'beast');
    }
    out.push({id:bid, name:def.name, effectType:def.effectType, desc:def.desc, params:def.params, side});
  }
  return out;
}

/* 崩铁式伤害公式（威力制：power 为技能总威力，60 威力 ≈ 旧倍率 1.0）
   伤害 = 攻击力 × (威力/60) × (1+增伤) × (1+暴伤，若暴击) × (1-减伤) × (1+易伤) × [1-(抗性-穿透)] × 防御系数
   防御系数 = (攻方等级+20) / [(攻方等级+20) + (守方等级+20)] */
function calcDamage(atk, aLvl, def, dLvl, power, mods, atkElem, defElem){
  mods = mods||{};
  // 宝可梦式基础伤害（v1.11.0 定稿）：(2L/5+2) × power × A/D / 50，再 +2
  // def 参数真正参与（A/D 比值）；dLvl 不再直接出现（等级只通过防御数值间接体现，签名保留避免改调用点）
  const lvlTerm = Math.floor(2*aLvl/5 + 2);
  let dmg = Math.floor(Math.floor(lvlTerm * power * atk / Math.max(1,def) / 50) + 2);
  dmg = dmg * (1+(mods.dmgUp||0)) * (1+(mods.critDmg||0)) * (1-(mods.dmgDown||0)) *
    (1+(mods.vuln||0)) * (1-((mods.resist||0)-(mods.pen||0)));
  if(mods.fieldMul) dmg *= (1+mods.fieldMul);   // 场地：本系技能伤害独立乘区（+50%）
  let tm = typeMult(atkElem, defElem);
  if(mods.neutralizeWeakness && tm>=2) tm = 1;   // v1.18.0 铁壁：克制伤害降为普通
  dmg *= tm;   // 属性克制 ×2 / 抵抗 ×0.5
  if(mods.stab) dmg *= mods.stab;      // 本系加成 1.25（调用方注入：技能元素===精灵元素）
  dmg *= 0.85 + Math.random()*0.15;    // 随机浮动 0.85~1.0（宝可梦原式）
  return Math.max(1, Math.round(dmg));
}

/* ================= 通用状态效果系统（M3-P0，参考洛克王国世界确定性状态） =================
   设计：技能 effects 字段 = [{target:'self'|'enemy', type:'atk_up', layers:2}, ...]
   每个效果是「确定数值 × 层数」，由 SKILL_STATUS 统一定义；战斗双方各挂一个状态栏，
   属性增减实时进伤害/先手判定，持续状态在回合末结算并衰减。旧 mech 枚举（execute/heal/
   guard/sunder/surge）保留兼容，新技能优先用 effects 表达。 */;