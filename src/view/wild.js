

/* 渲染野外视图 */
function renderWild(){
  const root = $('#wild-root'); root.innerHTML='';
  const w = S.wild;
  // 战斗中：优先渲染战斗（state 可能仍为 idle/detail）
  if(w.phase==='battle' && w.battle){
    root.appendChild(renderWildBattle());
    return;
  }
  // 出战精灵（灵兽或妖兽）
  function wildSpiritById(sid){
    if(typeof sid==='string' && sid.startsWith('beast:')){
      return S.beasts.find(x=>'beast:'+x.id===sid) ? {isBeast:true} : null;
    }
    return spById(sid);
  }
  if(!w.spiritId || !wildSpiritById(w.spiritId)) w.spiritId = S.spirits[0] ? S.spirits[0].id : (S.beasts[0] ? 'beast:'+S.beasts[0].id : null);
  // 顶部：背包
  const top = el('div','card','');
  top.appendChild(el('h3',null,'探索区域 <span class="sub">选择一张冒险地图</span>'));
  const bag = el('div','wild-bag','');
  bag.appendChild(el('span','bag-item','灵息 <b>'+S.aura+'</b>'));
  bag.appendChild(el('span','bag-item','体力 <b>'+staminaNow()+'/'+S.staminaMax+'</b>'));
  const ws0 = wildSpirit();
  if(ws0){ bag.appendChild(el('span','bag-item',essenceName(ws0.speciesId)+' <b>'+essenceOf(ws0.speciesId)+'</b>')); }
  top.appendChild(bag);
  root.appendChild(top);

  if(w.state==='idle'){
    // 地图列表
    const listCard = el('div','card','');
    listCard.appendChild(el('h3',null,'冒险地图 <span class="sub">点击查看详情</span>'));
    const mRow = el('div','wild-top','');
    Object.keys(MAP_CONFIGS).forEach(mid=>{
      const m = MAP_CONFIGS[mid];
      const c = el('div','zone-card'+(w.mapId===mid?' sel':''));
      c.innerHTML = '<div class="z-name">'+m.name+'</div><div class="z-desc">'+m.size+'×'+m.size+' · '+m.desc+'</div>';
      c.onclick = ()=>{ w.mapId=mid; w.state='detail'; renderWild(); };
      mRow.appendChild(c);
    });
    listCard.appendChild(mRow);
    root.appendChild(listCard);
    return;
  }
  if(w.state==='detail'){
    // 地图详情页
    const cfg = MAP_CONFIGS[w.mapId];
    const ec = cfg.eventConfig;
    const dCard = el('div','card','');
    const head = el('div','map-detail-head');
    head.appendChild(el('h3',null, cfg.name));
    const sizeSel = document.createElement('select');
    sizeSel.className = 'map-size';
    sizeSel.title = '地图尺寸';
    [cfg.size].forEach(n=>{
      const op = document.createElement('option');
      op.value = String(n); op.textContent = n+'×'+n;
      sizeSel.appendChild(op);
    });
    sizeSel.value = String(cfg.size);
    head.appendChild(sizeSel);
    const marks = el('span','map-marks');
    for(let i=0;i<(ec.eventCounts.fight_boss||0);i++){
      const mk = el('span','map-mark boss','💀'); mk.title = '首领'; marks.appendChild(mk);
    }
    for(let i=0;i<(ec.eventCounts.wonder||0);i++){
      const mk = el('span','map-mark wonder','★'); mk.title = '奇遇'; marks.appendChild(mk);
    }
    head.appendChild(marks);
    dCard.appendChild(head);
    dCard.appendChild(el('div','muted', cfg.desc));
    const TERRAIN_BORDER = {水域:'#6aa8d8', 平原:'#6dae6a', 山地:'#c4a15a', 高原:'#f2efe6'};
    const GRADE_BORDER = {legend:'#e2c14a', perfect:'#e2c14a', elite:'#9d6bd5', normal:'#5b9bd5'};
    const GRADE_RANK = {legend:3, perfect:2, elite:1, normal:0};
    function dropBorder(quality){
      const r = QUALITY_RANK[quality]||0;
      if(r>=4) return '#e2c14a';
      if(r>=2) return '#9d6bd5';
      return '#5b9bd5';
    }
    function openMapFact(title, sub, rows){
      const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
      mb.appendChild(el('h2',null, esc(title)));
      if(sub) mb.appendChild(el('div','m-sub', esc(sub)));
      rows.forEach(([k,v])=>{
        if(v==null || v==='') return;
        mb.appendChild(el('div','map-info-row','<span>'+esc(k)+'</span><b>'+esc(String(v))+'</b>'));
      });
      const act = el('div','modal-actions');
      const btn = el('button','btn sm','关闭');
      btn.onclick = closeOverlay;
      act.appendChild(btn);
      mb.appendChild(act);
      ov.classList.add('open');
    }
    const POOL_NAME = {fight_normal:'普通战', fight_elite:'精英战', fight_boss:'首领战'};
    function mapTile(name, color, onOpen){
      const cell = el('div','map-tile', esc(name));
      cell.style.borderColor = color;
      cell.title = name;
      cell.onclick = onOpen;
      return cell;
    }
    const info = el('div','map-info');
    const terrCol = el('div','');
    terrCol.appendChild(el('h4',null,'可用地形'));
    const terrGrid = el('div','map-tiles');
    Object.keys(cfg.tileMats).forEach(tid=>{
      const t = TERRAIN[tid];
      if(!t) return;
      const mat = cfg.tileMats[tid];
      const qDist = Object.keys(mat.qualityDist||{}).map(k=>(QUALITY[k]?QUALITY[k].name:k)+' '+Math.round(mat.qualityDist[k]*100)+'%').join(' · ');
      terrGrid.appendChild(mapTile(t.name, TERRAIN_BORDER[t.type]||'#8a7354', ()=>openMapFact(t.name, '', [
        ['大类', t.type],
        ['植被', t.veg],
        ['属性偏向', (t.attribAffinity||[]).map(e=>elemName(e)).join('、')],
        ['植物', mat.plant[0]+'–'+mat.plant[1]],
        ['矿石', mat.ore[0]+'–'+mat.ore[1]],
        ['品质分布', qDist],
        ['变体基底', t.isVariant && TERRAIN[t.baseTerrain] ? TERRAIN[t.baseTerrain].name : ''],
      ])));
    });
    terrCol.appendChild(terrGrid);
    const enemyCol = el('div','');
    enemyCol.appendChild(el('h4',null,'敌人'));
    const enemyGrid = el('div','map-tiles');
    const seen = {};
    ['fight_normal','fight_elite','fight_boss'].forEach(fk=>{
      ((ec.fightPools[fk]&&ec.fightPools[fk].species)||[]).forEach(sid=>{ seen[sid]=true; });
    });
    Object.keys(seen).map(sid=>allSpeciesDef(sid)).filter(Boolean)
      .sort((a,b)=>(GRADE_RANK[b.rarity]||0)-(GRADE_RANK[a.rarity]||0) || a.id.localeCompare(b.id))
      .forEach(sp=>{
        const pools = ['fight_normal','fight_elite','fight_boss'].filter(fk=>ec.fightPools[fk] && ec.fightPools[fk].species.includes(sp.id))
          .map(fk=>{
            const w = ec.fightPools[fk].weights||{};
            const ws = Object.keys(w).map(k=>(GRADE_NAME[k]||k)+' '+w[k]).join(' / ');
            return POOL_NAME[fk]+'（'+ws+'）';
          }).join('；');
        const dropNames = (sp.drops||[]).map(id=>{ const m = matInfo(id); return m ? m.name : id; }).join('、');
        const st = sp.stats||{};
        enemyGrid.appendChild(mapTile(sp.name, GRADE_BORDER[sp.rarity]||'#5b9bd5', ()=>openMapFact(sp.name, '', [
          ['品级', gradeName(sp)],
          ['属性', elemName(sp.elem)],
          ['速度', sp.speed],
          ['种族值', '生命 '+st.hp+' · 攻击 '+st.atk+' · 防御 '+st.def+' · 特攻 '+(st.spa!=null?st.spa:'—')+' · 特防 '+(st.sdef!=null?st.sdef:'—')],
          ['标签', (sp.tags||[]).join('、')],
          ['简介', sp.desc],
          ['出现于', pools],
          ['掉落', dropNames],
        ])));
      });
    enemyCol.appendChild(enemyGrid);
    const dropCol = el('div','');
    dropCol.appendChild(el('h4',null,'其他掉落'));
    const dropGrid = el('div','map-tiles');
    const dropSeen = {};
    Object.keys(ec.extraDrops||{}).forEach(fk=>{
      (ec.extraDrops[fk]||[]).forEach(e=>{ if(e.itemId) dropSeen[e.itemId]=true; });
    });
    const drops = Object.keys(dropSeen).map(id=>ITEMS[id]).filter(Boolean)
      .sort((a,b)=>(QUALITY_RANK[b.quality]||0)-(QUALITY_RANK[a.quality]||0) || a.id.localeCompare(b.id));
    if(drops.length===0) dropGrid.appendChild(el('div','tiny','无'));
    else drops.forEach(it=>{
      const where = Object.keys(ec.extraDrops||{}).map(fk=>{
        const hit = (ec.extraDrops[fk]||[]).find(e=>e.itemId===it.id);
        return hit ? POOL_NAME[fk]+' 权重 '+hit.weight : '';
      }).filter(Boolean).join('；');
      dropGrid.appendChild(mapTile(it.name, dropBorder(it.quality), ()=>openMapFact(it.name, '', [
        ['类型', it.type==='blueprint'?'蓝图':(it.type==='tool'?'工具':it.type)],
        ['品质', QUALITY[it.quality]?QUALITY[it.quality].name:it.quality],
        ['工具', it.kind==='axe'?'斧':(it.kind==='pick'?'镐':(it.kind||''))],
        ['耐久', it.durability!=null ? it.durability : ''],
        ['说明', it.desc],
        ['掉落场合', where],
      ])));
    });
    dropCol.appendChild(dropGrid);
    info.appendChild(terrCol); info.appendChild(enemyCol); info.appendChild(dropCol);
    dCard.appendChild(info);
    // 出战精灵选择
    dCard.appendChild(el('h4',null,'出战精灵'));
    if(S.spirits.length===0 && S.beasts.length===0){
      dCard.appendChild(el('div','muted','尚无精灵。先去炼妖壶炼化一尊，或野外捕获妖兽，再来踏足荒野。'));
    }
    if(S.spirits.length>0){
      const spk = el('div','spirit-pick','');
      S.spirits.forEach(s=>{
        const sp = allSpeciesDef(s.speciesId);
        const st = spiritStats(s);
        const c = el('div','sp-card'+(s.id===w.spiritId?' sel':''));
        c.innerHTML = '<div class="sp-name">'+sp.name+(s.shiny?' <span class="tag shiny">异色</span>':'')+' <span class="tiny">Lv.'+(s.lvl||1)+'</span></div>'+
          '<div class="muted" style="margin-top:2px">'+elemTag(sp.elem)+' <span class="tiny">攻 '+st.atk+' 防 '+st.def+' 速 '+st.spd+'</span></div>';
        c.onclick = ()=>{ w.spiritId = s.id; renderWild(); };
        spk.appendChild(c);
      });
      dCard.appendChild(spk);
    }
    if(S.beasts.length>0){
      dCard.appendChild(el('div','tiny',null,'已捕获妖兽（野外冒险可出战，副本不可）'));
      const bpk = el('div','spirit-pick','');
      S.beasts.forEach(b=>{
        const sp = allSpeciesDef(b.speciesId);
        const bid = 'beast:'+b.id;
        const c = el('div','sp-card'+(bid===w.spiritId?' sel':''));
        c.innerHTML = '<div class="sp-name">'+sp.name+(b.shiny?' <span class="tag shiny">异色</span>':'')+' <span class="tag">妖兽</span></div>'+
          '<div class="muted" style="margin-top:2px">'+elemTag(sp.elem)+'</div>';
        c.onclick = ()=>{ w.spiritId = bid; renderWild(); };
        bpk.appendChild(c);
      });
      dCard.appendChild(bpk);
    }
    // 进入按钮
    dCard.appendChild(el('div','modal-actions',''));
    const act = dCard.querySelector('.modal-actions');
    const back = el('button','btn sm','返回地图列表');
    back.onclick = ()=>{ w.state='idle'; renderWild(); };
    act.appendChild(back);
    const go = el('button','btn primary','进入冒险');
    go.onclick = ()=>{
      const ws = wildSpirit();
      if(!ws){ toast('需要一只灵兽同行','bad'); return; }
      if(isTraining(ws.id)){ toast(ws.name+' 正在挂机修炼，无法同行','bad'); return; }
      savePlay();
      takeAdvSnap();
      const g = genSandbox(w.mapId);
      S.wild = {mapId:w.mapId, state:'grid', grid:g, px:g.startX, py:g.startY, exitX:g.exitX, exitY:g.exitY,
                spiritId:w.spiritId, phase:'move', battle:null, story:null, storyIdx:0, loots:[], log:[], fledFrom:null};
      renderWild();
    };
    act.appendChild(go);
    root.appendChild(dCard);
    return;
  }

  // 冒险结束（到达出口/撤退/死亡）
  if(w.state==='done'){
    root.appendChild(renderWildSummary());
    return;
  }
  // 战斗中：复用现有战斗渲染
  if(w.phase==='battle' && w.battle){
    root.appendChild(renderWildBattle());
    return;
  }
  // v1.20.5 P0-3：遭遇妖兽节点（五选项 / 被突袭应战）
  if(w.phase==='node' && w.node){
    root.appendChild(renderWildNode(w.node));
    return;
  }
  if(w.phase==='result'){
    root.appendChild(renderWildResult());
    return;
  }
  if(w.phase==='chain'){
    root.appendChild(renderEventChain());
    return;
  }
  // 沙盒网格阶段
  if(w.state==='grid'){
    root.appendChild(renderWildGrid());
  }
}

/* M3-1 沙盒网格渲染 */
function renderWildGrid(){
  const w = S.wild;
  const g = w.grid;
  const card = el('div','card','');
  card.appendChild(el('h3',null, MAP_CONFIGS[w.mapId].name+' · 秘境探索 <span class="sub">每步 -1 体力 · 移动到金色出口结算</span>'));
  // 撤退按钮
  const actRow = el('div','modal-actions','');
  const ret = el('button','btn sm','撤退');
  ret.onclick = ()=>{
    revertAdvGains();
    S.wild = {mapId:w.mapId, state:'idle', grid:null, px:0, py:0, exitX:0, exitY:0, spiritId:w.spiritId, phase:'move', battle:null, story:null, storyIdx:0, loots:[], log:[], fledFrom:null};
    savePlay();
    renderWild();
  };
  actRow.appendChild(ret);
  card.appendChild(actRow);
  // 网格
  const grid = el('div','sandbox-grid','');
  grid.style.display='grid';
  grid.style.gridTemplateColumns='repeat('+g.size+', 48px)';
  grid.style.gap='3px';
  for(let y=0;y<g.size;y++){
    for(let x=0;x<g.size;x++){
      const c = g.cells[y][x];
      const tpl = TERRAIN[c.terrain];
      const cell = el('div','sandbox-cell');
      cell.style.width='48px'; cell.style.height='48px';
      cell.style.borderRadius='4px'; cell.style.display='flex';
      cell.style.flexDirection='column'; cell.style.alignItems='center';
      cell.style.justifyContent='center'; cell.style.fontSize='18px';
      cell.style.cursor='pointer';
      const isPlayer = (x===w.px && y===w.py);
      const isAdj = Math.abs(x-w.px)+Math.abs(y-w.py)===1;
      if(c.isExit && !c.explored){
        cell.style.background='#5b3a8e'; cell.style.color='#ffd966'; cell.style.fontWeight='bold';
        cell.textContent='出口';
        cell.style.fontSize='11px';
      } else if(!c.explored){
        cell.style.background='#2a2a35'; cell.style.color='#2a2a35'; cell.textContent='·';
      } else {
        cell.style.background = isPlayer ? '#3a6ea5' : '#3d3d4d';
        cell.style.color = '#cfd3dc';
        if(c.looted) cell.style.opacity='0.45';
        let icon = tpl.icon;
        if(c.event && !c.resolved && c.event.kind==='fight'){ icon = c.event.template==='boss'?'👹':(c.event.template==='elite'?'👺':'⚔'); }
        else if(c.event && !c.resolved && c.event.kind==='wonder'){ icon='❓'; }
        cell.innerHTML = '<div>'+icon+'</div><div style="font-size:9px">'+(c.plant>0||c.ore>0?(c.plant>0?'植':'')+(c.ore>0?'矿':''):'')+'</div>';
      }
      // 点击：相邻格→移动；当前格→采集
      cell.onclick = ()=>{
        if(isPlayer){
          // 当前格：若有资源可采集
          if((c.plant>0||c.ore>0) && !c.looted && c.explored){
            collectTile(c);
          }
          return;
        }
        if(!isAdj) return;
        moveTo(x,y);
      };
      grid.appendChild(cell);
    }
  }
  card.appendChild(grid);
  // M3-1-6：驻扎按钮
  const campRow = el('div','modal-actions','');
  const campBtn = el('button','btn sm','🏕️ 驻扎休息（-1 体力）');
  campBtn.onclick = ()=>{ doCamp(); };
  campRow.appendChild(campBtn);
  card.appendChild(campRow);
  // 已得战利品
  if(w.loots && w.loots.length){
    const lb = el('div','tiny muted','已得：'+w.loots.map(l=>l.name+' ×'+l.n).join('、'));
    card.appendChild(lb);
  }
  return card;
}

/* M3-1-6：驻扎行动 */
function doCamp(){
  const w = S.wild;
  const sp = wildSpirit();
  const c = w.grid.cells[w.py][w.px];
  const tpl = TERRAIN[c.terrain];
  if(!spendStamina(1)){ toast('体力不足（驻扎需 1 点）','bad'); return; }
  // 判断属性交集
  const myElems = [sp.elem];
  const affs = tpl.attribAffinity||[];
  const match = myElems.some(e=>affs.includes(e));
  // 4 秒读条
  const ov = $('#overlay'), mb = $('#modal-box');
  mb.innerHTML='';
  mb.appendChild(el('h2',null,'精灵休息中...'));
  const bar = el('div','',''); bar.style.cssText='width:100%;height:20px;background:#333;border-radius:4px;overflow:hidden;margin:12px 0';
  const fill = el('div','',''); fill.style.cssText='width:0%;height:100%;background:#4a6ea5;transition:width .1s linear';
  bar.appendChild(fill); mb.appendChild(bar);
  ov.classList.add('open');
  let pct = 0;
  const timer = setInterval(()=>{
    pct += 2.5;
    fill.style.width = pct+'%';
    if(pct>=100){
      clearInterval(timer);
      // 结算
      const st = spiritStats(sp);
      if(match){
        sp.hp = st.hp; sp.energy = sp.energyMax||10;
        mb.innerHTML='<h2>你和精灵都得到了良好的休息，又是活力满满啦！</h2><div class="m-sub">属性匹配：全血量 + 全能量恢复</div><div class="modal-actions"><button class="btn primary" onclick="closeOverlay()">确认</button></div>';
      } else {
        sp.hp = Math.min(st.hp, sp.hp + Math.floor(st.hp*0.5));
        sp.energy = Math.min(sp.energyMax||10, (sp.energy||0)+5);
        mb.innerHTML='<h2>你和精灵打了个盹，精神好了一些。</h2><div class="m-sub">属性不匹配：恢复 50% 血量 + 5 点能量</div><div class="modal-actions"><button class="btn primary" onclick="closeOverlay()">确认</button></div>';
      }
      saveDraft(); renderWild();
    }
  }, 100);
}
/* 移动到相邻格 */
function moveTo(x,y){
  const w = S.wild;
  const g = w.grid;
  if(!g) return;
  if(x<0 || y<0 || x>=g.size || y>=g.size) return;   // 越界保护
  if(!spendStamina(1)){ toast('体力不足（移动需 1 点）','bad'); return; }
  w.px = x; w.py = y;
  const c = w.grid.cells[y][x];
  c.explored = true;
  // 到达出口
  if(c.isExit){
    w.state='done'; w.phase='exit'; renderWild();
    return;
  }
  // 触发事件
  if(c.event && !c.resolved){
    if(c.event.kind==='fight'){
      w.fledFrom = {x,y};
      // v1.20.5 P0-3：遭遇策略恢复——boss 直战；其他走遭遇节点卡（被突袭应战 / 五选项）
      if(c.event.template==='boss'){
        startBattle(c.event.beast, 'normal', c.event.buffs);
        return;
      }
      w.node = {type:'beast', beast:c.event.beast, ambush:!!c.event.ambush, buffs:c.event.buffs, template:c.event.template};
      w.phase = 'node';
      renderWild();
      return;
    } else if(c.event.kind==='adventure' || c.event.kind==='wonder'){
      // M3-1-5a 事件链触发
      const chain = EVENT_CHAINS[c.event.chainId];
      if(!chain){ c.resolved = true; renderWild(); return; }
      // once 奇遇：触发即标记
      if(chain.once || c.event.once){
        S.wonderOnce = S.wonderOnce || {};
        S.wonderOnce[S.wild.mapId] = S.wonderOnce[S.wild.mapId] || {};
        S.wonderOnce[S.wild.mapId][c.event.chainId] = true;
      }
      w.phase = 'chain';
      w.chainId = c.event.chainId;
      w.chainNode = chain.entry;
      w.chainLose = null;   // 进入 loseMats 面板时填充 {qty, picks:[]}
      w.chainPending = null; // 战斗分支后回跳节点
      renderWild();
      return;
    }
    // gather 事件：不自动采集，玩家点当前格才采
  }
  renderWild();
}