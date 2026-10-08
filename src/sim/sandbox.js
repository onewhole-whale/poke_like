
/* M3-1-4 锚点引擎：生成 7×7 满格地形图 */
function genSandbox(mapId){
  const cfg = MAP_CONFIGS[mapId];
  const size = cfg.size;
  const cells = [];
  for(let y=0;y<size;y++){
    const row=[];
    for(let x=0;x<size;x++) row.push({x,y,terrain:null,plant:0,ore:0,qualityDist:null,explored:false,event:null,resolved:false,looted:false});
    cells.push(row);
  }
  // 阶段A①：采样锚点（每类型锚 1 个，全随机）
  const anchors = cfg.anchors.types.map(t=>({type:t.id, terrains:t.terrains, x:Math.floor(Math.random()*size), y:Math.floor(Math.random()*size)}));
  // 阶段A②：多源波前同时扩展（平原锚优先扩展至 ~40% 占比，再其他锚）
  const anchorsByType = {};
  anchors.forEach(a=>{ anchorsByType[a.type]=a; });
  // 先落锚点自身
  anchors.forEach(a=>{
    cells[a.y][a.x].terrain = pick(a.terrains);
  });
  // 第一轮：有平原锚才扩到约 45%。冒烟火山这类没有平原锚的图跳过，交给后面的锚和兜底。
  if(anchorsByType.plain){
    const plainTarget = Math.floor(size*size*0.45);
    let plainCount = 1;
    const pf = [{x:anchorsByType.plain.x, y:anchorsByType.plain.y}];
    while(pf.length>0 && plainCount<plainTarget){
      const f = pf.shift();
      for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
        const nx=f.x+dx, ny=f.y+dy;
        if(nx<0||ny<0||nx>=size||ny>=size) continue;
        if(cells[ny][nx].terrain) continue;
        cells[ny][nx].terrain = pick(anchorsByType.plain.terrains);
        plainCount++;
        pf.push({x:nx,y:ny});
        if(plainCount>=plainTarget) break;
      }
    }
  }
  // 第二轮：其他锚 BFS 同时扩展剩余格
  const frontier = anchors.filter(a=>a.type!=='plain').map(a=>({x:a.x,y:a.y,type:a.type}));
  let guard=0;
  while(frontier.length>0 && guard++<500){
    const f = frontier.shift();
    const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
    for(const [dx,dy] of dirs){
      const nx=f.x+dx, ny=f.y+dy;
      if(nx<0||ny<0||nx>=size||ny>=size) continue;
      if(cells[ny][nx].terrain) continue;
      const a = anchorsByType[f.type];
      cells[ny][nx].terrain = pick(a.terrains);
      frontier.push({x:nx,y:ny,type:f.type});
    }
  }
  // 兜底：未覆盖格按平原
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) if(!cells[y][x].terrain) cells[y][x].terrain='grassland';
  // D8 孤立格合并：按大类（水域/平原/山地/高原），4 邻全部不同大类则合并到邻接多数派
  const tType = tid => (TERRAIN[tid]&&TERRAIN[tid].type)||'';
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const t = cells[y][x].terrain;
    if(x===0||y===0||x===size-1||y===size-1) continue;
    const nbs = [[1,0],[-1,0],[0,1],[0,-1]].map(([dx,dy])=>cells[y+dy][x+dx].terrain);
    const sameClass = nbs.filter(n=>tType(n)===tType(t)).length;
    if(sameClass===0){
      // 邻接多数派大类
      const cnt = {};
      nbs.forEach(n=>{cnt[tType(n)]=(cnt[tType(n)]||0)+1;});
      const majorityClass = Object.entries(cnt).sort((a,b)=>b[1]-a[1])[0][0];
      // 同大类取第一个邻接地形
      const rep = nbs.find(n=>tType(n)===majorityClass);
      cells[y][x].terrain = rep;
    }
  }
  // 阶段A③：河流锚最后落（无 river 锚配置的地图跳过——补丁 2026-09-21：stillswamp 等只有湖泊无水系的地图）
  const riverCfg = cfg.anchors.river;
  if(riverCfg && riverCfg.len){
  const riverLen = riverCfg.len[0] + Math.floor(Math.random()*(riverCfg.len[1]-riverCfg.len[0]+1));
  // 落点：边缘格 或 plateau 格
  const riverCandidates = [];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    if(x===0||y===0||x===size-1||y===size-1 || cells[y][x].terrain==='plateau') riverCandidates.push({x,y});
  }
  const start = pick(riverCandidates);
  cells[start.y][start.x].terrain = 'river';
  let rx=start.x, ry=start.y, rdir=pick([[1,0],[-1,0],[0,1],[0,-1]]);
  for(let i=1;i<riverLen;i++){
    // 选方向：排除边界外与已连河流
    const opts = [[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>{
      const nx=rx+dx, ny=ry+dy;
      if(nx<0||ny<0||nx>=size||ny>=size) return false;
      if(cells[ny][nx].terrain==='river') return false;
      return true;
    });
    if(opts.length===0) break;
    // 优先沿当前方向
    let ndir = opts.find(d=>d[0]===rdir[0]&&d[1]===rdir[1]) || pick(opts);
    rdir = ndir;
    rx+=rdir[0]; ry+=rdir[1];
    // 前方为湖泊 → 汇入结束
    if(cells[ry][rx].terrain==='lake') break;
    cells[ry][rx].terrain = 'river';
  }
  }
  // 阶段A④：变体地块后生成（M3-1-6）
  if(cfg.variants){
    cfg.variants.forEach(v=>{
      // 找基底地块格
      const baseCells = [];
      for(let y=0;y<size;y++) for(let x=0;x<size;x++){
        if(cells[y][x].terrain===v.base) baseCells.push({x,y});
      }
      if(!baseCells.length) return;
      // 随机选一个锚点
      const anchor = pick(baseCells);
      cells[anchor.y][anchor.x].terrain = v.id;
      // 侵蚀式扩张（补丁修正 2026-09-21）：先洪水填充同类连通区；连通区耗尽且未达上限时，
      // 跳岛：从全图随机找未被侵蚀的同类基底格作新源点（绕过非同类地块，继续侵蚀其他方向的同类地块）。
      // 停止条件 = 到达侵蚀上限，或全图已无同类基底可侵蚀（不再"遇到非同类就停止"）。
      const targetN = v.spreadSize[0] + Math.floor(Math.random()*(v.spreadSize[1]-v.spreadSize[0]+1));
      let count = 1;
      const frontier = [{x:anchor.x, y:anchor.y}];
      const sameClass = (t)=> t===v.base || t===v.id;
      while(count<targetN){
        while(frontier.length>0 && count<targetN){
          const f = frontier.shift();
          const dirs = [[1,0],[-1,0],[0,1],[0,-1]];
          // 打乱方向
          dirs.sort(()=>Math.random()-0.5);
          for(const [dx,dy] of dirs){
            if(count>=targetN) break;
            const nx=f.x+dx, ny=f.y+dy;
            if(nx<0||ny<0||nx>=size||ny>=size) continue;
            if(!sameClass(cells[ny][nx].terrain)) continue;   // 非同类：跳过该方向继续找，不停止侵蚀
            if(cells[ny][nx].terrain===v.id) continue; // 已经是变体
            cells[ny][nx].terrain = v.id;
            count++;
            frontier.push({x:nx,y:ny});
          }
        }
        if(count>=targetN) break;
        // 跳岛：全图找未被侵蚀的同类基底格（含被非同类隔开的碎片）
        const cands = [];
        for(let y=0;y<size;y++) for(let x=0;x<size;x++){
          if(cells[y][x].terrain===v.base) cands.push({x,y});
        }
        if(cands.length===0) break;   // 全图已无同类基底 → 停止
        const hop = cands[Math.floor(Math.random()*cands.length)];
        cells[hop.y][hop.x].terrain = v.id;
        count++;
        frontier.push(hop);
      }
    });
  }
  // 阶段B：资源实例化
  for(let y=0;y<size;y++) for(let x=0;x<size;x++){
    const t = cells[y][x].terrain;
    const tm = cfg.tileMats[t] || {plant:[0,0],ore:[0,0],qualityDist:{normal:1}};
    cells[y][x].qualityDist = tm.qualityDist;
    cells[y][x].plant = tm.plant[0]+Math.floor(Math.random()*(tm.plant[1]-tm.plant[0]+1));
    cells[y][x].ore   = tm.ore[0]+Math.floor(Math.random()*(tm.ore[1]-tm.ore[0]+1));
  }
  // 阶段C：按 eventCounts 精确撒事件（位置随机）
  const emptyCells = [];
  for(let y=0;y<size;y++) for(let x=0;x<size;x++) emptyCells.push({x,y});
  function takeCell(){
    const i = Math.floor(Math.random()*emptyCells.length);
    return emptyCells.splice(i,1)[0];
  }
  const ec = cfg.eventConfig;
  const difficultyRoll = ()=>{
    const r = Math.random();
    if(r<ec.difficultyDist.easy) return 'easy';
    if(r<ec.difficultyDist.easy+ec.difficultyDist.normal) return 'normal';
    return 'hard';
  };
  // 战斗事件（等级按挑战等级 + 模版规则）
  const [cmn, cmx] = cfg.challengeLvl || [1, 15];
  function beastLvl(template){
    if(template==='boss') return cmx;
    if(template==='elite') return Math.ceil((cmn+cmx)/2) + Math.floor(Math.random()*(cmx-Math.ceil((cmn+cmx)/2)+1));
    return cmn + Math.floor(Math.random()*(cmx-cmn+1));
  }
  ['fight_normal','fight_elite','fight_boss'].forEach(fk=>{
    const n = ec.eventCounts[fk]||0;
    for(let i=0;i<n;i++){
      const c = takeCell(); if(!c) break;
      // M3-1-6：地块级敌人池（fallback 全局）
      const t = cells[c.y][c.x].terrain;
      const pool = (ec.tilePools && ec.tilePools[t] && ec.tilePools[t][fk]) || ec.fightPools[fk];
      const speciesId = pickPoolSpecies(pool);
      const template = FIGHT_EVENTS[fk].template;
      const beast = applyTemplate(wildBeast(speciesId, beastLvl(template)), template);
      const difficulty = difficultyRoll();
      const buffs = rollBattleBuffs(ec.buffRule, difficulty);
      cells[c.y][c.x].event = {kind:'fight', fightKey:fk, speciesId, beast, template, difficulty, buffs, ambush:(template!=='boss' && roll(.22))};
    }
  });
  // 冒险事件（从条目池随机选，可重复）
  const advPool = (ec.eventPools && ec.eventPools.adventure) || [];
  for(let i=0;i<(ec.eventCounts.adventure||0);i++){
    const c = takeCell(); if(!c) break;
    const eid = advPool.length ? pick(advPool) : null;
    cells[c.y][c.x].event = {kind:'adventure', chainId:eid, nodeId:null, resolved:false};
  }
  // 奇遇事件（once 过滤：已触发的不再生成）
  const doneOnce = (S.wonderOnce && S.wonderOnce[mapId]) || {};
  const wonderPool = ((ec.eventPools && ec.eventPools.wonder) || []).filter(wid=>!doneOnce[wid]);
  for(let i=0;i<(ec.eventCounts.wonder||0);i++){
    if(!wonderPool.length) break;
    const c = takeCell(); if(!c) break;
    const wid = pick(wonderPool);
    cells[c.y][c.x].event = {kind:'wonder', chainId:wid, nodeId:null, once:true, resolved:false};
  }
  // 阶段D：入口随机（非出口格），出口唯一可见随机
  let startX, startY, exitX, exitY, tries=0;
  do{
    startX = Math.floor(Math.random()*size); startY = Math.floor(Math.random()*size); tries++;
  } while(tries<50 && cells[startY][startX].event);
  cells[startY][startX].explored = true;
  cells[startY][startX].event = null;
  tries=0;
  do{
    exitX = Math.floor(Math.random()*size); exitY = Math.floor(Math.random()*size); tries++;
  } while(tries<50 && (Math.abs(exitX-startX)+Math.abs(exitY-startY)<4 || (exitX===startX&&exitY===startY)));
  cells[exitY][exitX].isExit = true;
  return {size, cells, exitX, exitY, startX, startY};
}