/* v1.17.0 M3-1-4 工具·地形表·事件表·冒险地图与沙盒生成 验收
   口径：需求文档_M3-1-4工具地形与沙盒生成_2026-09-18.md §4 A-I + DEV_PLAN §10 v1.17.0 行
   只校验记录，不改代码不动数值 */
const fs = require('fs');
let pass=0, fail=0, warn=0;
const assert=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
const note=(n,x='')=>{ warn++; console.log('  ~~ '+n+' '+(x||'')); };
function mkEl(){ const e={children:[],className:'',innerHTML:'',style:{},title:'',dataset:{},disabled:false,textContent:'',value:'',_ev:{},addEventListener(t,f){this._ev[t]=f;},removeEventListener(){},focus(){},blur(){},classList:{_s:new Set(),add(c){this._s.add(c)},remove(c){this._s.delete(c)},toggle(c,f){f?this._s.add(c):this._s.delete(c)},contains(c){return this._s.has(c)}},appendChild(c){this.children.push(c);return c},remove(){},querySelector(){return mkEl()},querySelectorAll(){return []}}; return e; }
const elCache={};
global.document={getElementById:id=>(elCache[id]=elCache[id]||mkEl()),querySelector:()=>mkEl(),querySelectorAll:()=>[],createElement:()=>mkEl(),createTextNode:t=>({nodeValue:t,textContent:t}),addEventListener:()=>{}};
global.window={addEventListener:()=>{},location:{hash:'#/refine'},renderSettle:()=>{},renderWild:()=>{},renderRefine:()=>{},renderCodex:()=>{},renderDex:()=>{},renderStable:()=>{},openLandingModal:()=>{}};
global.location={hash:'#/refine'};
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}};
global.requestAnimationFrame=fn=>fn();
global.setTimeout=fn=>fn();
global.toast=(m,c)=>{ (global.__toasts=global.__toasts||[]).push((c||'')+'|'+m); };
const CODE = require('./_load.js').loadGame();
let code=require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); toast=(m,c)=>{ (globalThis.__toasts=globalThis.__toasts||[]).push((c||'')+'|'+m); };
  globalThis.__T={S,ITEMS,TERRAIN,MATS,MAP_CONFIGS,FIGHT_EVENTS,FIGHT_EVENT_BASE,ADVENTURE_EVENT_BASE,WONDER_EVENT_BASE,WONDERS,
  matState,matInfo,matAny,matUnitSum,allSpeciesDef,genSandbox,collectTile,applyTemplate,bestTool,collectMatId,rollQuality,
  doRefine,furnaceMats,addToFurnace,QUALITY_RANK,spendStamina,wildBeast,rollBattleBuffs,beastDrops};`);
eval(code);
const T=globalThis.__T;
const S=T.S;
const clean=(o)=>{ for(const k in o) delete o[k]; };

/* ===== A. 道具表与工具 ===== */
console.log('A. 道具表');
const tools = Object.values(T.ITEMS).filter(i=>i.type==='tool');
const bps = Object.values(T.ITEMS).filter(i=>i.type==='blueprint');
assert('A1 工具恰 12 条（斧/镐×6）', tools.length===12, '实际 '+tools.length);
assert('A1 蓝图恰 4 条（斧/镐×优秀/精良）', bps.length===4, '实际 '+bps.length);
assert('A1 id 均 DJ_none_ 前缀、全局不重复', tools.concat(bps).every(i=>/^DJ_none_\d{6}$/.test(i.id)) && new Set(tools.concat(bps).map(i=>i.id)).size===16);
const idNums = tools.concat(bps).map(i=>parseInt(i.id.split('_')[2]));
assert('A1 号段 002000~002015 连续', Math.min(...idNums)===2000 && Math.max(...idNums)===2015 && new Set(idNums).size===16);
assert('A1 工具字段 kind/quality/rank/durability/maxDurability', tools.every(i=>['axe','pick'].includes(i.kind)&&i.quality&&typeof i.rank==='number'&&i.durability&&i.maxDurability));
const durByQ={normal:100,good:120,fine:140,rare:160,epic:180,legend:200};
assert('A1 耐久档 100~200 正确', tools.every(i=>i.durability===durByQ[i.quality]), JSON.stringify(tools.map(i=>[i.quality,i.durability])));

// A4 锻造：普通工具配方（素材×3+生命精华×1 无蓝图）——doRefine 无此分支
S.furnace=['SC_none_normal_000002','SC_none_normal_000002','SC_none_normal_000002','SC_none_normal_000008','SC_none_normal_000008','SC_none_normal_000008','SC_none_fine_000001'];
T.matState['SC_none_normal_000002']=3; T.matState['SC_none_normal_000008']=3; T.matState['SC_none_fine_000001']=1;
T.doRefine();
const normalAxeId = Object.keys(T.ITEMS).find(i=>T.ITEMS[i].kind==='axe'&&T.ITEMS[i].quality==='normal');
assert('A4 普通工具=素材×3+生命精华×1 无蓝图（实现=plant+ore 各3）', (S.toolInv&&S.toolInv[normalAxeId])>0, 'toolInv='+JSON.stringify(S.toolInv));
note('A4 素材量口径：需求「同大类×3」，实现「plant+ore 各×3=6 单位」','');
S.furnace=[]; if(S.toolInv) delete S.toolInv[normalAxeId]; if(S.toolDur) delete S.toolDur[normalAxeId];
T.matState['SC_none_normal_000002']=0; T.matState['SC_none_normal_000008']=0; T.matState['SC_none_fine_000001']=0;

// A4/A5 优秀/精良锻造：蓝图 + 素材×3 + 生命精华×1；蓝图 -1
for(const q of ['good','fine']){
  const bpId = Object.keys(T.ITEMS).find(i=>T.ITEMS[i].type==='blueprint'&&T.ITEMS[i].quality===q&&T.ITEMS[i].kind==='axe');
  const targetId = Object.keys(T.ITEMS).find(i=>T.ITEMS[i].type==='tool'&&T.ITEMS[i].quality===q&&T.ITEMS[i].kind==='axe');
  const matId = q==='good' ? 'SC_none_good_000003' : 'SC_none_fine_000004';
  const oreId = q==='good' ? 'SC_none_good_000009' : 'SC_none_fine_000010';
  S.furnace=[bpId];
  T.matState[matId]=3; T.matState[oreId]=3; T.matState['SC_none_fine_000001']=1;
  S.blueprintInv={[bpId]:1};
  T.doRefine();
  assert('A4/A5 锻造 '+q+' 斧：蓝图+素材×3+生命精华 → 工具', (S.toolInv&&S.toolInv[targetId])>0, 'toolInv='+JSON.stringify(S.toolInv));
  assert('A5 蓝图被消耗（blueprintInv -1）', (S.blueprintInv&&S.blueprintInv[bpId])===0, 'bpInv='+JSON.stringify(S.blueprintInv));
  S.furnace=[]; if(S.toolInv) delete S.toolInv[targetId]; if(S.toolDur) delete S.toolDur[targetId];
  T.matState[matId]=0; T.matState[oreId]=0; T.matState['SC_none_fine_000001']=0; S.blueprintInv={};
}
// 蓝图投料入口：addToFurnace 是否拦截蓝图
T.matState['SC_none_fine_000001']=1;
const bpGood = Object.keys(T.ITEMS).find(i=>T.ITEMS[i].type==='blueprint'&&T.ITEMS[i].quality==='good');
S.blueprintInv={[bpGood]:1};
global.__toasts=[];
T.addToFurnace(bpGood);
assert('A5 蓝图可投入炉子（作为锻造材料入口）', S.furnace.includes(bpGood), 'furnace='+JSON.stringify(S.furnace)+' toast='+JSON.stringify(global.__toasts));
S.furnace=[]; T.matState['SC_none_fine_000001']=0; S.blueprintInv={};

// A6 TOOL_TREE 删除
assert('A6 TOOL_TREE 零残留', !CODE.includes('TOOL_TREE'));

/* ===== B. 地形表 ===== */
console.log('B. 地形表');
const tids = Object.keys(T.TERRAIN);
assert('B1 恰 20 条', tids.length===20, '实际 '+tids.length);
const exp18=['lake','river','mudflat','beach','grassland','gobi','swamp','tundra','savanna','plain_forest','hill','mountain','valley','mountain_forest','valley_forest','plateau','plateau_cut','plateau_forest','poison_swamp','volcano'];
assert('B1 id 集合正确', JSON.stringify([...tids].sort())===JSON.stringify([...exp18].sort()), tids.join(','));
assert('B1 每条含 type/veg/size=1/icon', tids.every(id=>{const t=T.TERRAIN[id]; return ['水域','平原','山地','高原'].includes(t.type)&&t.veg&&t.size===1&&t.icon; }));
assert('B1 无 plant/ore/qualityDist 残留', tids.every(id=>!(T.TERRAIN[id].plant||T.TERRAIN[id].ore||T.TERRAIN[id].qualityDist)));
assert('B2 mine/rock/ruin 地形零残留', !tids.includes('mine') && !tids.includes('rock') && !tids.includes('ruin'));

/* ===== C. 事件表 ===== */
console.log('C. 事件表');
assert('C1 fight/adventure/wonder 基类 3 个', !!T.FIGHT_EVENT_BASE && !!T.ADVENTURE_EVENT_BASE && !!T.WONDER_EVENT_BASE);
assert('C1 战斗基类含难度效果、无模版占比', !!T.FIGHT_EVENT_BASE.difficultyEffects && !('templateProb' in T.FIGHT_EVENT_BASE), JSON.stringify(T.FIGHT_EVENT_BASE).slice(0,300));
assert('C2 fight_normal/elite/boss 三条', ['fight_normal','fight_elite','fight_boss'].every(k=>T.FIGHT_EVENTS[k]&&T.FIGHT_EVENTS[k].template), JSON.stringify(T.FIGHT_EVENTS));
assert('C2 wonder 条目=现有 4 条', Array.isArray(T.WONDERS) && T.WONDERS.length===4, 'wonders '+(T.WONDERS&&T.WONDERS.length));

/* ===== D. 冒险地图与沙盒 ===== */
console.log('D. 地图与沙盒');
const cfg = T.MAP_CONFIGS.gentlebreeze;
assert('D1 微风平原存在 7×7', cfg && cfg.size===7);
assert('D1 7 地形配置（6+river）', Object.keys(cfg.tileMats).length===7, '实际 '+(cfg.tileMats&&Object.keys(cfg.tileMats).length)+' '+JSON.stringify(Object.keys(cfg.tileMats||{})));
assert('D1 河流 tileMats 含产出行（plant [1,2]）', cfg.tileMats.river && JSON.stringify(cfg.tileMats.river.plant)==='[1,2]', JSON.stringify(cfg.tileMats.river));
assert('D1 锚点配置 5 类（含河流 last）', cfg.anchors.types.length===4 && cfg.anchors.river && cfg.anchors.river.last===true && JSON.stringify(cfg.anchors.river.len)==='[2,4]');
assert('D1 eventCounts 10/3/1/2/2', JSON.stringify(cfg.eventConfig.eventCounts)==='{"fight_normal":10,"fight_elite":3,"fight_boss":1,"adventure":2,"wonder":2}');
assert('D1 difficultyDist 2.5:5:2.5', JSON.stringify(cfg.eventConfig.difficultyDist)==='{"easy":0.25,"normal":0.5,"hard":0.25}');
assert('D1 fightPools 三池', ['fight_normal','fight_elite','fight_boss'].every(k=>cfg.eventConfig.fightPools[k]&&cfg.eventConfig.fightPools[k].species&&cfg.eventConfig.fightPools[k].weights));
assert('D1 buffRule count1+4池', cfg.eventConfig.buffRule.count===1 && cfg.eventConfig.buffRule.pool.length===4);
assert('D1 extraDrops 精英优秀/首领精良', cfg.eventConfig.extraDrops.fight_normal.length===0 && cfg.eventConfig.extraDrops.fight_elite.length===2 && cfg.eventConfig.extraDrops.fight_boss.length===2);

// D2-D4 生成统计
let planePct=0, lakeCnt=0, hillCnt=0, valleyCnt=0, plateauCnt=0, riverCnt=0, riverChains=0, isoLake=0, isoHill=0;
let eventCounts={fight_normal:0,fight_elite:0,fight_boss:0,adventure:0,wonder:0};
let exitsOk=true, startsOk=true;
let totalSpecies=new Set();
for(let g=0;g<40;g++){
  const m = T.genSandbox('gentlebreeze');
  if(m.cells.length!==7 || m.cells.every(r=>r.length===7)===false) exitsOk=false;
  let cells=m.cells.flat();
  if(cells.length!==49) exitsOk=false;
  const plane=cells.filter(c=>['grassland','plain_forest'].includes(c.terrain)).length;
  planePct+=plane;
  lakeCnt += cells.filter(c=>c.terrain==='lake').length;
  hillCnt += cells.filter(c=>c.terrain==='hill').length;
  valleyCnt += cells.filter(c=>c.terrain==='valley').length;
  plateauCnt += cells.filter(c=>c.terrain==='plateau').length;
  const rv = cells.filter(c=>c.terrain==='river');
  riverCnt += rv.length;
  // 河流成链判断（8邻域连通 >1）
  const riverSet = new Set(rv.map(c=>c.x+','+c.y));
  let chain=0;
  rv.forEach(c=>{ const nb=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>riverSet.has((c.x+dx)+','+(c.y+dy))).length; if(nb>0) chain++; });
  if(chain>0) riverChains++;
  // 孤立格（4邻全不同类型）
  const TYPE={lake:'水域',river:'水域',mudflat:'水域',beach:'水域',grassland:'平原',gobi:'平原',swamp:'平原',tundra:'平原',savanna:'平原',plain_forest:'平原',hill:'山地',mountain:'山地',valley:'山地',mountain_forest:'山地',valley_forest:'山地',plateau:'高原',plateau_cut:'高原',plateau_forest:'高原'};
  cells.forEach(c=>{
    const myType=TYPE[c.terrain]||'';
    if(c.terrain==='lake'||c.terrain==='hill'||c.terrain==='valley'){
      const nb=[[1,0],[-1,0],[0,1],[0,-1]].filter(([dx,dy])=>{
        const nx=c.x+dx, ny=c.y+dy; if(nx<0||ny<0||nx>6||ny>6) return false;
        return (TYPE[m.cells[ny][nx].terrain]||'')!==myType;
      });
      const edge = c.x===0||c.y===0||c.x===6||c.y===6;
      if(!edge && nb.length===4) { if(c.terrain==='lake') isoLake++; else isoHill++; }
    }
  });
  cells.forEach(c=>{ if(c.event) eventCounts[c.event.kind+(c.event.fightKey?'_'+c.event.fightKey.replace('fight_',''):'')] = (eventCounts[c.event.kind+(c.event.fightKey?'_'+c.event.fightKey.replace('fight_',''):'')]||0)+1; });
  // 出口可见/入口无事件
  const st=m.cells[m.startY][m.startX], ex=m.cells[m.exitY][m.exitX];
  if(st.event || !ex.isExit) exitsOk=false;
}
planePct/=40*49;
const evtNorm = Math.round(eventCounts.fight_normal/40), evtElite = Math.round(eventCounts.fight_elite/40), evtBoss = Math.round(eventCounts.fight_boss/40), evtAdv = Math.round(eventCounts.adventure/40), evtWon = Math.round(eventCounts.wonder/40);
assert('D2 49 格满格', exitsOk);
assert('D2 平原占比 ≥40%（实际 '+Math.round(planePct*100)+'%）', planePct>=0.4, Math.round(planePct*100)+'%');
assert('D2 湖泊/丘陵/山谷/高原各 ≥1 格', lakeCnt/40>=1 && hillCnt/40>=1 && valleyCnt/40>=1 && plateauCnt/40>=1, JSON.stringify({lake:lakeCnt/40,hill:hillCnt/40,valley:valleyCnt/40,plateau:plateauCnt/40}));
assert('D3 无孤立湖泊/丘陵单格（沿边除外）', isoLake===0 && isoHill===0, 'isoLake='+isoLake+' isoHill='+isoHill);
assert('D4 河流长度 2~4 格成链', riverCnt/40>=2 && riverCnt/40<=4 && riverChains>0, 'avg='+(riverCnt/40)+' chains='+riverChains);
assert('C3 事件数量=10/3/1/2/2', evtNorm===10 && evtElite===3 && evtBoss===1 && evtAdv===2 && evtWon===2, JSON.stringify({n:evtNorm,e:evtElite,b:evtBoss,a:evtAdv,w:evtWon}));
// D5 敌人池品质权重：normal 池完美权重 << boss 池
const wn = cfg.eventConfig.fightPools.fight_normal.weights, wb = cfg.eventConfig.fightPools.fight_boss.weights;
assert('D5 normal 池完美权重显著低于 boss 池', (wn.perfect||0) < (wb.perfect||0), JSON.stringify({n:wn.perfect,b:wb.perfect}));

/* ===== E. 采集闭环 ===== */
console.log('E. 采集');
const eids=['SC_none_normal_000002','SC_none_good_000003','SC_none_fine_000004','SC_none_rare_000005','SC_none_epic_000006','SC_none_legend_000007','SC_none_normal_000008','SC_none_good_000009','SC_none_fine_000010','SC_none_rare_000011','SC_none_epic_000012','SC_none_legend_000013'];
assert('E1 12 测试素材落库', eids.every(id=>T.matInfo(id)), eids.filter(id=>!T.matInfo(id)).join(','));
// E2 带工具出货率 100% + 品质锁：普通斧 → 仅普通
const normalPickId = Object.keys(T.ITEMS).find(i=>T.ITEMS[i].type==='tool'&&T.ITEMS[i].kind==='pick'&&T.ITEMS[i].quality==='normal');
S.toolInv={[normalPickId]:1}; S.toolDur={[normalPickId]:100};
let noLoot=0, qCount={};
for(let i=0;i<60;i++){
  const c={x:0,y:0,terrain:'valley',plant:0,ore:5,qualityDist:{normal:.55,good:.25,fine:.15,rare:.05},looted:false};
  global.__toasts=[]; S.stamina=120;
  T.collectTile(c);
  if(global.__toasts.some(t=>/一无所获/.test(t))) noLoot++;
  // 统计本次出货（从 loots）
  const last = S.wild.loots&&S.wild.loots[S.wild.loots.length-1];
  if(last) qCount[last.name]= (qCount[last.name]||0)+1;
}
assert('A2/E3 持普通镐 60 次采集出货率 100%（空手失败 0）', noLoot===0, 'noLoot='+noLoot);
assert('E3 品质锁：普通镐出货仅普通', Object.keys(qCount).length===1 && /普通/.test(Object.keys(qCount)[0]||''), JSON.stringify(qCount));
// E4 资源扣减 = 1+2×品质档（普通=1）
S.stamina=120; S.toolInv={[normalPickId]:1}; S.toolDur={[normalPickId]:100};
const c4={x:0,y:0,terrain:'valley',plant:0,ore:5,qualityDist:{normal:1},looted:false};
T.collectTile(c4);
assert('E4 资源扣减 1（普通）+采后变灰', c4.ore===4 && c4.looted===true, JSON.stringify(c4));
// 空手 50% 出货率且仅普通
delete S.toolInv[normalPickId]; delete S.toolDur[normalPickId];
let handOk=0, handNo=0, handQ={};
for(let i=0;i<60;i++){
  const c={x:0,y:0,terrain:'valley',plant:0,ore:5,qualityDist:{normal:.55,good:.25,fine:.15,rare:.05},looted:false};
  global.__toasts=[]; S.stamina=120;
  T.collectTile(c);
  if(global.__toasts.some(t=>/一无所获/.test(t))) handNo++;
  else { handOk++; const last=S.wild.loots&&S.wild.loots[S.wild.loots.length-1]; if(last) handQ[last.name]=(handQ[last.name]||0)+1; }
}
assert('E2 空手出货率 ≈50%（'+(handOk/60*100).toFixed(0)+'%）', handOk>=20&&handOk<=40, handOk+'/60');
assert('E2 空手出货仅普通', Object.keys(handQ).every(k=>/普通/.test(k)), JSON.stringify(handQ));
// E5 空手失败不扣资源（mock 50% 失败分支）
const c5={x:0,y:0,terrain:'valley',plant:0,ore:5,qualityDist:{normal:1},looted:false};
S.stamina=120;
const _r=Math.random; let failOnce=false;
Math.random=()=>{ if(!failOnce){failOnce=true; return .99;} return _r(); };
T.collectTile(c5);
Math.random=_r;
assert('E5 空手失败不扣资源', c5.ore===5 && c5.looted===false, JSON.stringify(c5));
note('E5 空手失败：不扣 ore、不置 looted（格可再采）', 'looted='+c5.looted);

/* ===== F. 难度实例化 ===== */
console.log('F. 难度');
let easy=0,hard=0,norm=0;
for(let i=0;i<400;i++){
  const m=T.genSandbox('gentlebreeze');
  m.cells.flat().forEach(c=>{ if(c.event&&c.event.kind==='fight'){ if(c.event.difficulty==='easy')easy++; else if(c.event.difficulty==='hard')hard++; else norm++; } });
}
const tot=easy+hard+norm;
assert('F1 difficulty 占比 ≈25/50/25', tot>0 && Math.abs(easy/tot-.25)<.08 && Math.abs(norm/tot-.5)<.08 && Math.abs(hard/tot-.25)<.08, JSON.stringify({easy:easy/tot,norm:norm/tot,hard:hard/tot}));
// F2 同格难度持久（逃离重进不变）：事件难度存在 event 上，重进读取
note('F2 难度持久：difficulty 存于格 event（重进读同一对象）', '由 genSandbox 一次生成持久化');

/* ===== G. 模版倍率 ===== */
console.log('G. 模版倍率');
const b0=T.wildBeast('JL_fire_normal_0001');
const bE=T.applyTemplate({...b0}, 'elite');
const bB=T.applyTemplate({...b0}, 'boss');
assert('G1 精英 血×3 攻防×1.5', bE.maxHp===b0.maxHp*3 && bE.atk===Math.round(b0.atk*1.5) && bE.def===Math.round(b0.def*1.5), JSON.stringify({hp:bE.maxHp/b0.maxHp,atk:bE.atk/b0.atk}));
assert('G1 首领 血×4 攻防×2', bB.maxHp===b0.maxHp*4 && bB.atk===Math.round(b0.atk*2) && bB.def===Math.round(b0.def*2), JSON.stringify({hp:bB.maxHp/b0.maxHp,atk:bB.atk/b0.atk}));
assert('G1 速度不乘', bE.spd===b0.spd && bB.spd===b0.spd);

/* ===== H. 战斗其他掉落 ===== */
console.log('H. 蓝图掉落');
// 静态：kill 结算处 extraDrops 处理存在（7224-7227 已见）；运行时验证 boss/elite 池 extraDrops 配置
const bpGoodIds = Object.keys(T.ITEMS).filter(k=>T.ITEMS[k].type==='blueprint'&&T.ITEMS[k].quality==='good');
const bpFineIds = Object.keys(T.ITEMS).filter(k=>T.ITEMS[k].type==='blueprint'&&T.ITEMS[k].quality==='fine');
const elId = cfg.eventConfig.extraDrops.fight_elite.map(e=>e.itemId);
const boId = cfg.eventConfig.extraDrops.fight_boss.map(e=>e.itemId);
const elTypes = elId.map(id=>T.ITEMS[id]?T.ITEMS[id].type+'/'+T.ITEMS[id].quality:'?');
const boTypes = boId.map(id=>T.ITEMS[id]?T.ITEMS[id].type+'/'+T.ITEMS[id].quality:'?');
assert('H1 extraDrops：精英→优秀蓝图、首领→精良蓝图', elId.every(id=>bpGoodIds.includes(id)) && boId.every(id=>bpFineIds.includes(id)), 'elite='+JSON.stringify(elTypes)+' boss='+JSON.stringify(boTypes)+' bpGood='+JSON.stringify(bpGoodIds)+' bpFine='+JSON.stringify(bpFineIds));
assert('H2 蓝图可进 blueprintInv（掉落写入 7224-7227 静态确认）', CODE.includes('blueprintInv[e.itemId]'));

/* ===== I. 冒险入口（静态：UI 结构） ===== */
console.log('I. 冒险入口');
assert('I1 冒险 tab 地图列表（MAP_CONFIGS 遍历渲染）', /MAP_CONFIGS/.test(CODE) && /微风平原/.test(CODE));
assert('I2 详情页含地形/事件/敌人池/extraDrops 展示', /extraDrops/.test(CODE) && /fightPools/.test(CODE));
assert('I3 进入后随机落点（genSandbox startX/startY）', /startX/.test(CODE) && /isExit/.test(CODE));

/* ===== 旧档兼容 ===== */
console.log('旧档兼容');
// init 运行时缺字段兜底：eval 时 init() 已执行，S 有 toolInv/toolDur/blueprintInv 默认值
assert('旧档兼容：S.toolInv/toolDur/blueprintInv 字段存在且不报错', S.toolInv && S.toolDur && S.blueprintInv, JSON.stringify({t:!!S.toolInv,d:!!S.toolDur,b:!!S.blueprintInv}));

console.log('\nv1.17.0 M3-1-4 验收 '+pass+' 项断言，失败 '+fail+'，观察 '+warn);
process.exit(fail?1:0);
