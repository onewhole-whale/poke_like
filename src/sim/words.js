
/* ===== 词条系统（新版炼化）=====
   实体词条 = 元素属性 + tags（不含虚拟修饰词条）；虚拟词条只改单位权重，不参与匹配
   单位：默认 1；【巨量】5 /【大量】3 /【少量】0.5 */
const VIRTUAL_WORDS = {'巨量':5, '大量':3, '少量':0.5};
function unitOf(m){
  const tags = m.tags||[];
  for(const k in VIRTUAL_WORDS){ if(tags.includes(k)) return VIRTUAL_WORDS[k]; }
  return 1;
}
function wordsOf(m){
  const out = [];
  if(m.elem && m.elem!=='none') out.push(m.elem);
  (m.tags||[]).forEach(t=>{ if(!VIRTUAL_WORDS[t] && !out.includes(t)) out.push(t); });
  return out;
}
/* B池（灵兽判定用）：一鱼多吃——每素材的每条实体词条都计 unit 单位 */
function spiritPool(mats){
  const pool = {};
  mats.forEach(m=>{
    const u = unitOf(m);
    wordsOf(m).forEach(w=>{ pool[w] = (pool[w]||0)+u; });
  });
  return pool;
}
/* S池（素材判定用）：多轮萃取——每素材最终只归属一个词条
   每轮取未锁定素材中单位总量最大的词条，所有含该词条的素材整体锁定为该词条，直到全部锁定 */
function extractPool(mats){
  const units = mats.map(m=>({words:wordsOf(m), unit:unitOf(m)}));
  const pool = {};
  let pending = units.filter(u=>u.words.length>0);
  let guard = 0;
  while(pending.length>0 && guard++<99){
    // 统计各词条在待萃取素材中的总单位
    const tally = {};
    pending.forEach(u=>{ u.words.forEach(w=>{ tally[w] = (tally[w]||0)+u.unit; }); });
    let best=null, bestU=-1;
    Object.keys(tally).forEach(w=>{ if(tally[w]>bestU){ best=w; bestU=tally[w]; } });
    if(!best) break;
    // 锁定所有含 best 的素材
    pending = pending.filter(u=>{
      if(u.words.includes(best)){ pool[best] = (pool[best]||0)+u.unit; return false; }
      return true;
    });
  }
  return pool;
}
/* 无实体词条素材（如木屑）统一归入「凡尘」词条，避免丢失 */
function withFallback(pool, mats){
  const p = {...pool};
  const voidN = mats.filter(m=>wordsOf(m).length===0).length;
  if(voidN>0) p['凡尘'] = (p['凡尘']||0)+voidN;
  return p;
}
/* 词条聚合（带主导品质）：一鱼多吃，返回 {词条:{unit, q}}。
   q 为主导品质：该词条下单位最大的品质档；同单位取高档。用于复刻挂机的素材校验。 */
const Q_RANK = {normal:0, good:1, fine:2, rare:3, epic:4, legend:5, 普通:0, 优秀:1, 精良:2, 稀有:3, 史诗:4, 传奇:5};
const Q_NAME = ['普通','优秀','精良','稀有','史诗','传奇'];
function aggregateWords(mats){
  const map = {};
  matsToList(mats).forEach(id=>{
    const m = matInfo(id); if(!m) return;
    const u = unitOf(m);
    const qr = Q_RANK[m.quality]||0;
    wordsOf(m).forEach(w=>{
      if(!map[w]) map[w] = {units:[0,0,0,0,0,0], q:0};
      map[w].units[qr] += u;
      let best=0;
      for(let qq=5; qq>=0; qq--){ if(map[w].units[qq] >= map[w].units[best]) best=qq; }
      map[w].q = best;
    });
  });
  const out = {};
  Object.keys(map).forEach(w=>{
    out[w] = {unit: map[w].units.reduce((a,b)=>a+b,0), q: Q_NAME[map[w].q]};
  });
  return out;
}
function wordsText(words){
  return Object.keys(words).map(w=> w+'×'+words[w].unit+'（'+words[w].q+'）').join(' · ');
}
/* 复刻校验：投入素材聚合后，每个参照词条 单位≥参照 且 品质档≥参照（允许多投不能少） */
function refSatisfied(mats, refWords){
  const sel = aggregateWords(mats);
  const lacks = [];
  Object.keys(refWords).forEach(w=>{
    const need = refWords[w];
    const have = sel[w];
    if(!have || have.unit < need.unit || (Q_RANK[have.q]||0) < (Q_RANK[need.q]||0)){
      lacks.push(w+' 需 ≥'+need.unit+' 单位（'+need.q+'）'+(have?'，当前 '+have.unit+' 单位（'+have.q+'）':'，当前无'));
    }
  });
  return {ok: lacks.length===0, lacks, sel};
}