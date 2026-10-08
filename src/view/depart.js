
function depart(){
  const sp = spById(S.buildSpiritId);
  if(!sp) return;
  if(isTraining(sp.id)){ toast(sp.name+' 正在挂机修炼，无法进入副本','bad'); return; }
  if(S.aura<1){ toast('灵息结晶不足，无法开启秘境','bad'); return; }
  if(matsCount(S.buildMats)<1){ toast('请先投入至少 1 单位素材','bad'); return; }
  for(const id in S.buildMats){
    const own = (matState[id]||0) + (isItem(id) ? 0 : 0);
    if(own < S.buildMats[id]){
      const nm = isItem(id) ? (itemInfo(id)&&itemInfo(id).name) : (matInfo(id)&&matInfo(id).name);
      toast('构建素材不足：「'+(nm||id)+'」×'+S.buildMats[id],'bad'); return;
    }
  }
  // v1.16.7: 0 敌人副本校验
  const lvl = sp.lvl||1;
  const preMats = {...S.buildMats};
  const enemies = buildEnemyList(preMats, lvl);
  let totalScore = 0;
  if(enemies.length===0){
    const plan = scorePlan(preMats);
    totalScore = Object.values(plan).reduce((a,p)=>a+p.total,0);
    if(totalScore<1000){ toast('无敌人副本需存在分满 1000 方可开启（当前 '+totalScore+'）','bad'); return; }
  }
  if(!spendStamina(10)){ toast('体力不足（开启副本需要 10 点）','bad'); return; }
  S.aura -= 1;
  for(const id in S.buildMats) matState[id] -= S.buildMats[id];
  const mats = {...S.buildMats};
  S.buildMats = {};
  S.settle = {
    spiritId:sp.id, enemies, idx:0, kills:0, buffs:[], phase: enemies.length===0 ? 'done' : 'fight', battle:null,
    exp:0, plan:scorePlan(mats), gainType:S.buildGainType, logs:[], mats, words:aggregateWords(mats),
    won:false, rewards:[], wonders:S.wonderQueue.splice(0),
  };
  if(enemies.length===0){
    // v1.16.7: 0 敌人直接结算抽奖，无经验/训练/挂机记录
    S.settle.phase='done'; S.settle.won=true;
    finalizeDungeon(true);
    location.hash = '#/settle';
    return;
  }
  startDgFight();
  location.hash = '#/settle';
}