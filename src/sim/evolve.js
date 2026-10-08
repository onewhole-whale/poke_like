
/* ================= 进化系统（M2-B 普通进化） =================
   数据结构：物种可带 evoTo（单目标字符串）/ evoToBranches（[{to,cond}] 网状一对多）/ evoCond（单目标条件数组）。
   条件类型：lvl 等级≥v / aff 某系亲和力≥v（elem+v）/ stat 面板属性≥v（k∈hp/atk/def/spa/sdef/spe）。
   同一路径条件为 AND；evoToBranches 优先于 evoTo；两者皆无=不可进化。
   首版默认条件（无显式 evoCond 时按品级差推断）：normal→elite Lv30，elite→perfect Lv45。 */
const EVO_RANK_ORDER = {normal:0, elite:1, perfect:2, legend:3};
function defaultEvoCond(sp, targetSp){
  if(!sp) return [];
  // 首版默认条件（按当前档位）：normal→elite Lv30，elite→perfect Lv45
  const cur = EVO_RANK_ORDER[sp.rarity];
  if(cur === 0) return [{type:'lvl', v:30}];
  if(cur === 1) return [{type:'lvl', v:45}];
  return [];
}
/* 归一化物种定义为进化分支数组 [{to, cond}]，兼容单值 evoTo 与网状 evoToBranches */
function evoBranchesOf(sp){
  if(!sp) return [];
  if(Array.isArray(sp.evoToBranches) && sp.evoToBranches.length){
    return sp.evoToBranches.map(b=>({
      to: b.to,
      cond: (b.cond && b.cond.length) ? b.cond : defaultEvoCond(sp, allSpeciesDef(b.to))
    }));
  }
  if(sp.evoTo){
    const cond = (Array.isArray(sp.evoCond) && sp.evoCond.length) ? sp.evoCond : defaultEvoCond(sp, allSpeciesDef(sp.evoTo));
    return [{to: sp.evoTo, cond}];
  }
  return [];
}
/* 条件判定：AND 语义，全部满足返回 true */
function evoCondOk(spirit, cond){
  if(!cond || !cond.length) return true;
  const st = spiritStats(spirit);
  for(const c of cond){
    if(c.type==='lvl'){
      if((spirit.lvl||1) < (c.v||0)) return false;
    } else if(c.type==='aff'){
      if(affOf(spirit, c.elem) < (c.v||0)) return false;
    } else if(c.type==='stat'){
      const key = (c.k==='spe') ? 'spd' : c.k;   // spiritStats 用 spd 表速度
      if((st[key]||0) < (c.v||0)) return false;
    } else if(c.type==='mat'){
      // M3-1-2: 元素词条单位消耗。统计库存中 elem==c.elem 且品质>=c.qRank 的素材 unit 总量
      const needQRank = c.qRank||0;
      const total = matUnitSum(c.elem, needQRank);
      if(total < (c.v||0)) return false;
    }
  }
  return true;
}
/* M3-1-2: 统计库存中 elem==e 且品质>=qRank 的素材单位总量 */
function matUnitSum(e, qRank){
  qRank = qRank||0;
  let s = 0;
  for(const id in matState){
    const n = matState[id]; if(!n || n<=0) continue;
    const m = matInfo(id); if(!m || m.elem!==e) continue;
    if((QUALITY_RANK[m.quality]||0) < qRank) continue;
    s += n * unitOf(m);
  }
  return s;
}
/* M3-1-2: 从库存里扣除 elem==e 且品质>=qRank 的素材 unit 单位（从低品质到高品质扣） */
function deductMatUnits(e, qRank, need){
  qRank = qRank||0;
  const ids = Object.keys(matState).filter(id=>{
    const n = matState[id]; if(!n || n<=0) return false;
    const m = matInfo(id); if(!m || m.elem!==e) return false;
    return (QUALITY_RANK[m.quality]||0) >= qRank;
  }).sort((a,b)=> (QUALITY_RANK[matInfo(a).quality]||0) - (QUALITY_RANK[matInfo(b).quality]||0));
  let remain = need;
  for(const id of ids){
    if(remain<=0) break;
    const m = matInfo(id);
    const u = unitOf(m);
    const have = matState[id] * u;
    if(have <= remain){
      remain -= have;
      matState[id] = 0;
    } else {
      const takeN = Math.ceil(remain / u);
      matState[id] -= takeN;
      remain = 0;
    }
  }
}
/* 条件文案：人类可读；传入 spirit 时附当前值对比 */
function evoCondText(cond, spirit){
  if(!cond || !cond.length) return '无条件';
  return cond.map(c=>{
    if(c.type==='lvl'){
      const cur = spirit ? (spirit.lvl||1) : null;
      return 'Lv≥'+c.v + (cur!=null ? '（现'+cur+'）' : '');
    }
    if(c.type==='aff'){
      const cur = spirit ? affOf(spirit, c.elem) : null;
      return elemName(c.elem)+'亲和≥'+c.v + (cur!=null ? '（现'+cur+'）' : '');
    }
    if(c.type==='stat'){
      const name = {hp:'生命',atk:'攻击',def:'防御',spa:'特攻',sdef:'特防',spe:'速度'}[c.k]||c.k;
      let cur = null;
      if(spirit){ const st=spiritStats(spirit); cur = (c.k==='spe') ? st.spd : st[c.k]; }
      return name+'≥'+c.v + (cur!=null ? '（现'+cur+'）' : '');
    }
    if(c.type==='mat'){
      const qName = ['普通','优秀','精良','史诗','传说'][(c.qRank||0)]||'普通';
      const cur = spirit ? matUnitSum(c.elem, c.qRank||0) : null;
      return '消耗 '+elemName(c.elem)+'系素材 ×'+c.v+'（'+qName+'+）' + (cur!=null ? '（现'+cur.toFixed(1)+'）' : '');
    }
    return '?';
  }).join(' · ');
}
/* 某精灵可进化的分支列表 [{to, targetSp, cond, ok}] */
function canEvolve(spirit){
  const sp = allSpeciesDef(spirit.speciesId);
  return evoBranchesOf(sp)
    .map(b=>({to:b.to, targetSp:allSpeciesDef(b.to), cond:b.cond, ok:false}))
    .filter(b=>b.targetSp)
    .map(b=>{ b.ok = evoCondOk(spirit, b.cond); return b; });
}
/* 反向回溯：beastSpeciesId 是否在 targetSpeciesId 的进化源链上（不含自身）。
   用于飞升承接校验——承接精英/完美灵兽时，妖兽必须来自其进化链上游形态。 */
function isEvoAncestor(targetSpeciesId, beastSpeciesId){
  if(!targetSpeciesId || !beastSpeciesId || targetSpeciesId===beastSpeciesId) return false;
  const seen = new Set();
  let cur = targetSpeciesId;
  while(cur && !seen.has(cur)){
    seen.add(cur);
    // 找所有能进化到 cur 的物种
    const preds = allSpecies().filter(x=> evoBranchesOf(x).some(b=>b.to===cur));
    if(preds.some(x=>x.id===beastSpeciesId)) return true;
    cur = preds.length ? preds[0].id : null;
  }
  return false;
}
/* 进化结算：只改 speciesId/name/elem/speed + 解锁新物种 direct 技能入 skillPool + 写 log；
   面板/种族值/容量由 spiritStats/capacityOf 实时读新物种。iv/nature/lvl/exp/perks/aff/shiny 全保留。 */
function evolveSpirit(spirit, targetSpeciesId){
  const sp = allSpeciesDef(spirit.speciesId);
  const branch = evoBranchesOf(sp).find(b=>b.to===targetSpeciesId);
  if(!branch) return {ok:false, msg:'无此进化分支'};
  if(!evoCondOk(spirit, branch.cond)) return {ok:false, msg:'进化条件未满足'};
  const targetSp = allSpeciesDef(targetSpeciesId);
  if(!targetSp) return {ok:false, msg:'目标物种不存在'};
  // M3-1-2: 扣除 mat 条件要求的素材词条单位（从低品质到高品质扣）
  for(const c of (branch.cond||[])){
    if(c.type==='mat'){
      deductMatUnits(c.elem, c.qRank||0, c.v||0);
    }
  }
  const oldName = spirit.name;
  // 解锁新物种当前等级可用的 direct 技能进 skillPool（已装备/已习得的不重复）
  const existingIds = new Set([...(spirit.skills||[]).map(x=>x.id), ...(spirit.skillPool||[]).map(x=>x.id)]);
  directUnlocked(targetSp.elem, spirit.lvl||1).forEach(sk=>{
    if(!existingIds.has(sk.id)){
      spirit.skillPool.push({id:sk.id, name:sk.name, kind:'direct', cost:sk.cost, elem:sk.elem, mastery:0});
      existingIds.add(sk.id);
    }
  });
  spirit.speciesId = targetSpeciesId;
  spirit.name = targetSp.name;
  spirit.elem = targetSp.elem;
  spirit.speed = targetSp.speed;
  spirit.log = spirit.log||[];
  spirit.log.unshift('进化：'+oldName+' → '+targetSp.name);
  markDexSeen(targetSpeciesId);   // M2-C：进化到新形态点亮图鉴
  return {ok:true, targetSp, oldName};
}