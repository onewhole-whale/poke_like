
/* 敌人预览与生成：妖兽素材→妖兽（5 换 1）、植物→元素灵、矿石→巨像（均向上取整） */
function enemyStats(mats){
  const list = matsToList(mats);
  const beastBy = {}; let plant=0, ore=0;
  list.forEach(id=>{
    const m = matInfo(id); if(!m) return;
    if(m.type==='beast' && m.from) beastBy[m.from] = (beastBy[m.from]||0)+1;
    else if(m.type==='plant') plant++;
    else if(m.type==='ore') ore++;
  });
  return {beasts:Object.keys(beastBy).map(sid=>({speciesId:sid, n:beastBy[sid]})), plants:plant, ores:ore};
}