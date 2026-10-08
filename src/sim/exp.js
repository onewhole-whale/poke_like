
/* 战斗胜利：经验奖励（宝可梦中等速曲线），升级 */
function gainExp(sp, enemyLvl, enemyRarity, template){
  // M3-1-6：新经验公式 = max(5, 等级 × 基础经验 × 模板系数)
  const baseExp = {normal:10, elite:20, perfect:30, legend:40};
  const tplMul = {normal:1.0, elite:2.0, boss:3.0};
  const be = (enemyRarity && baseExp[enemyRarity]) || 10;
  const tm = (template && tplMul[template]) || 1.0;
  const gain = Math.max(5, Math.round(enemyLvl * be * tm));
  sp.exp = (sp.exp||0) + gain;
  sp.wins = (sp.wins||0)+1;   // 胜场（百战不殆检查点）
  let lvls = 0;
  while(sp.exp >= expToNext(sp.lvl) && sp.lvl < lvlCapOf(sp)){
    sp.exp -= expToNext(sp.lvl);
    sp.lvl++;
    lvls++;
    const st = spiritStats(sp);
    sp.hp = Math.min(st.hp, sp.hp + st.hp); // 升级回满血（原型简化）
    sp.capacity = capacityOf(sp);
    // 等级解锁直接攻击 → 入技能库待装配（10 级解锁全部）
    sp.skillPool = sp.skillPool||[];
    directUnlocked(sp.elem, sp.lvl).forEach(sk=>{
      if(!sp.skills.some(x=>x.id===sk.id) && !sp.skillPool.some(x=>x.id===sk.id)){
        sp.skillPool.push({id:sk.id, name:sk.name, kind:'direct', cost:sk.cost, elem:sk.elem, mastery:0});
      }
    });
  }
  return {gain, lvls};
}
/* 兼容旧入口：默认直接攻击（第一个已装配技能） */
function battleAct(){
  const sp = wildSpirit();
  const sk = sp.skills[0] || SKILLS[sp.elem][0];
  battleSkill(sk.id);
}