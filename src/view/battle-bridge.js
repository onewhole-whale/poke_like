
/* 野外战斗入口：包一层 ctx 给 renderBattle */
function renderWildBattle(){
  return renderBattle({battle:S.wild.battle, sp:wildSpirit(), ctx:{
    source:'wild',
    defOf:skillById,
    usableOf:d=>skillUsable(wildSpirit(),d),
    onSkill:battleSkill,
    onResult:battleResultModal
  }});
}