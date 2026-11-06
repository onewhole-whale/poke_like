
function beastDropsNames(speciesId){
  return dropsOf(speciesId).map(m=>m.name).join('、') || '无';
}
function addToFurnace(id){
  const it = ITEMS[id];
  if(it && it.type==='blueprint'){
    // 蓝图可投炉锻造
    if((S.blueprintInv[id]||0)<=0){ toast('没有这张蓝图','bad'); return; }
    S.furnace.push(id);
    renderRefine();
    return;
  }
  if(isItem(id)){ toast('技能石/专长石不可再投入炼化炉','bad'); return; }
  const cur = S.furnace.filter(x=>x===id).length;
  if((matState[id]||0) <= cur){ toast('这味素材已耗尽','bad'); return; }
  S.furnace.push(id);
  renderRefine();
}
function removeFromFurnace(id){
  const i = S.furnace.lastIndexOf(id);
  if(i<0) return;
  S.furnace.splice(i,1);
  renderRefine();
}
function removeAllFromFurnace(id){
  S.furnace = S.furnace.filter(x=>x!==id);
  renderRefine();
}

/* 炼化预览：候选池 + 概率 + 素材价值 */
/* ================= 炼化映射表（可配置，管理员版本） =================
   规则字段：条件（元素/品质/类型/标签/数量/混沌/低值）→ 产出池（微粒/结晶/凝胶/标准灵材/萌芽/灵兽） */
const REFINE_RULES_DEFAULT = [
  {id:'r-chr-fine',name:'元素结晶·精良', pool:'chr', cost:3, cond:{unit:3, anyUnit:true, minQuality:'fine'},     note:'词条 ≥3 单位 + 精良素材 · 副本提升亲和'},
  {id:'r-chr-perf',name:'元素结晶·完美', pool:'chr', cost:4, cond:{unit:4, anyUnit:true, minQuality:'rare'},   note:'词条 ≥4 单位 + 完美素材 · 亲和上限更高'},
  {id:'r-gel',     name:'元素凝胶',   pool:'gel',   cost:3, cond:{unit:3, anyUnit:true, chaos:true},       note:'词条 ≥3 单位 + 混沌词条 · 洗训练亲和'},
  /* —— 灵兽定向配方（全 24 只，2026-09-12 定价 v2）：所有灵兽只能由定向配方炼化，无泛匹配兜底；
     定价锚点：一次炼化 ≈ 击杀 5 只相关妖兽的素材（普通妖兽每种掉落 2 单位、rare/legend 3 单位）；
     全部配方要求至少 1 单位精良；稀有度越高，条件越复合（多特征词条 + 更高品质门槛）。
     新增精灵须成套：精灵 + 掉落物 + 定向炼化配方，三者一体（图鉴页有成套完整性标记）。 */
  {id:'r-sp-JL_fire_normal_0001',   name:'烬烬狼 · 爪牙之炉',   pool:'spirit', cond:{unit:15, anyUnit:true, words:[{w:'爪',n:4}], minQuality:'fine', spirits:['JL_fire_normal_0001']},     note:'火 ≥15 + 爪 ≥4 + 精良 · 烬烬狼3 + 轰枭2（5只）'},
  {id:'r-sp-JL_fire_normal_0009', name:'咕嘟龟 · 甲纹之炉', pool:'spirit', cond:{unit:15, anyUnit:true, words:[{w:'甲',n:8}], minQuality:'fine', spirits:['JL_fire_normal_0009']},   note:'火 ≥15 + 甲 ≥8 + 精良 · 咕嘟龟5'},
  {id:'r-sp-JL_fire_normal_0016',name:'燎雀 · 灼喙之炉', pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'喙',n:8}], minQuality:'fine', spirits:['JL_fire_normal_0016']},  note:'火 ≥20 + 喙 ≥8 + 精良 · 燎雀5（喙仅杀死）'},
  {id:'r-sp-JL_water_normal_0023',   name:'露露狐 · 绒尾之炉', pool:'spirit', cond:{unit:15, anyUnit:true, words:[{w:'绒',n:8}], minQuality:'fine', spirits:['JL_water_normal_0023']},     note:'水 ≥15 + 绒 ≥8 + 精良 · 露露狐5'},
  {id:'r-sp-JL_thunder_normal_0038',name:'轰枭 · 翎羽之炉',  pool:'spirit', cond:{unit:15, anyUnit:true, words:[{w:'羽',n:8}], minQuality:'fine', spirits:['JL_thunder_normal_0038']}, note:'雷 ≥15 + 羽 ≥8 + 精良 · 轰枭5'},
  {id:'r-sp-JL_thunder_normal_0030',name:'嗞嗞猫 · 电须之炉', pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'须',n:8}], minQuality:'fine', spirits:['JL_thunder_normal_0030']},  note:'雷 ≥20 + 须 ≥8 + 精良 · 嗞嗞猫5（须仅杀死）'},
  {id:'r-sp-JL_wind_normal_0041', name:'嗖隼 · 破风之炉',   pool:'spirit', cond:{unit:15, anyUnit:true, words:[{w:'喙',n:8}], minQuality:'fine', spirits:['JL_wind_normal_0041']},   note:'风 ≥15 + 喙 ≥8 + 精良 · 嗖隼5（喙仅杀死）'},
  {id:'r-sp-JL_earth_normal_0046', name:'咚咚犀 · 犀角之炉', pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'角',n:8}], minQuality:'fine', spirits:['JL_earth_normal_0046']},   note:'土 ≥20 + 角 ≥8 + 精良 · 咚咚犀5（角仅杀死）'},
  {id:'r-sp-JL_fire_normal_0053',name:'南瓜妖 · 瓜灯之炉',pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'南瓜',n:12}], minQuality:'fine', spirits:['JL_fire_normal_0053']},note:'火 ≥20 + 南瓜 ≥12 + 精良 · 南瓜妖5'},
  {id:'r-sp-JL_wind_normal_0056',   name:'悄悄蝠 · 蝠翼之炉',   pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'翼',n:8}], minQuality:'fine', spirits:['JL_wind_normal_0056']},     note:'风 ≥20 + 翼 ≥8 + 精良 · 悄悄蝠5'},
  {id:'r-sp-JL_earth_normal_0063',    name:'咔咔骨 · 白骨之炉', pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'骨',n:8}], minQuality:'fine', spirits:['JL_earth_normal_0063']},      note:'土 ≥20 + 骨 ≥8 + 精良 · 咔咔骨5'},
  {id:'r-sp-JL_dark_normal_0070',  name:'织影蛛 · 影网之炉', pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'影',n:10}], minQuality:'fine', spirits:['JL_dark_normal_0070']},    note:'恶 ≥20 + 影 ≥10 + 精良 · 织影蛛5'},
  {id:'r-sp-JL_thunder_normal_0033',   name:'灯灯猫 · 魅影之炉', pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'夜',n:8}], minQuality:'fine', spirits:['JL_thunder_normal_0033']},     note:'电 ≥20 + 夜 ≥8 + 精良 · 灯灯猫5'},
  {id:'r-sp-JL_wind_normal_0077',  name:'拾穗人 · 秋收之炉', pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'草',n:8}], minQuality:'fine', spirits:['JL_wind_normal_0077']},    note:'风 ≥20 + 草 ≥8 + 精良 · 拾穗人5'},
  {id:'r-sp-coldjiao',   name:'寒岁 · 千年寒水',   pool:'spirit', cond:{unit:18, anyUnit:true, words:[{w:'鳞',n:8},{w:'涎',n:8}], minQuality:'fine', spirits:['JL_water_perfect_0086']}, note:'水 ≥18 + 鳞 ≥8 + 涎 ≥8 + 精良 · 寒岁3 + 露露狐2'},
  {id:'r-sp-JL_light_elite_0088',   name:'踏星 · 星角之炉', pool:'spirit', cond:{unit:18, anyUnit:true, words:[{w:'角',n:8}], minQuality:'fine', spirits:['JL_light_normal_0087']},     note:'光 ≥18 + 角 ≥8 + 精良 · 莹莹鹿3'},
  {id:'r-sp-JL_ghost_elite_0095',  name:'烛泪 · 魂烛之炉', pool:'spirit', cond:{unit:18, anyUnit:true, words:[{w:'魂',n:8}], minQuality:'fine', spirits:['JL_ghost_normal_0094']},    note:'幽 ≥18 + 魂 ≥8 + 精良 · 呜呜灵3'},
  {id:'r-sp-JL_fire_elite_0007',   name:'狼嚎客 · 拜月之炉', pool:'spirit', cond:{unit:18, anyUnit:true, words:[{w:'月',n:12},{w:'爪',n:8}], minQuality:'fine', spirits:['JL_fire_normal_0006']}, note:'火 ≥18 + 月 ≥12 + 爪 ≥8 + 精良 · 月嚎狼3 + 轰枭2'},
  {id:'r-sp-JL_poison_elite_0102',   name:'扫帚巫 · 咒帚之炉', pool:'spirit', cond:{unit:18, anyUnit:true, words:[{w:'咒',n:8}], minQuality:'fine', spirits:['JL_poison_normal_0101']},     note:'毒 ≥18 + 咒 ≥8 + 精良 · 药童巫3'},
  {id:'r-sp-JL_earth_elite_0105',      name:'缠纱使 · 裹尸之炉', pool:'spirit', cond:{unit:18, anyUnit:true, words:[{w:'纱',n:8}], minQuality:'fine', spirits:['JL_earth_normal_0104']},        note:'土 ≥18 + 纱 ≥8 + 精良 · 木乃伊童3'},
  {id:'r-sp-JL_poison_elite_0081',name:'噬年 · 时光砂炉', pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'时空',n:2}], minQuality:'fine', spirits:['JL_poison_normal_0080']}, note:'毒 ≥20 + 时空 ≥2 + 精良 · 药童巫4 + 时空砂'},
  {id:'r-sp-JL_fire_legend_0109',   name:'南瓜王 · 丰收之炉', pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'南瓜',n:18},{w:'鬼火',n:8}], minQuality:'rare', spirits:['JL_fire_legend_0109']}, note:'火 ≥20 + 南瓜 ≥18 + 鬼火 ≥8 + 完美 · 南瓜王3 + 南瓜妖2'},
  {id:'r-sp-JL_dark_legend_0108',    name:'血月侯 · 血月之炉', pool:'spirit', cond:{unit:20, anyUnit:true, words:[{w:'血',n:8},{w:'影',n:10}], minQuality:'rare', spirits:['JL_dark_legend_0108']}, note:'恶 ≥20 + 血 ≥8 + 影 ≥10 + 完美 · 血月侯3 + 织影蛛2'},
  {id:'r-sp-JL_dark_legend_0107', name:'混沌兽 · 归墟之炉', pool:'spirit', cond:{unit:25, anyUnit:true, words:[{w:'混沌',n:2}], minQuality:'rare', spirits:['JL_dark_legend_0107']}, note:'恶 ≥25 + 【混沌】tag ≥2 + 完美 · 混沌精魄/碎核 + 高阶恶系素材'},
];
function refineRules(){ return S.refineRules || REFINE_RULES_DEFAULT; }
/* 词条单位制判定：在词条池中找单位 ≥ c.unit 的词条（取单位最大者），返回词条名或 null
   虚拟修饰词条不参与匹配（只放大单位权重） */
function ruleHitPool(r, pool){
  const c = r.cond; if(!c) return null;
  const unit = c.unit || 1;
  const cand = Object.keys(pool).filter(w=>pool[w]>=unit && !VIRTUAL_WORDS[w]);
  if(cand.length===0) return null;
  let best=null, bestU=-1;
  cand.forEach(w=>{ if(pool[w]>bestU){ best=w; bestU=pool[w]; } });
  return best;
}
/* 词条单位制产出：按命中词条生成常规产物 */
function resolveRulePoolByWord(r, word){
  const qRank = (r.cond&&r.cond.minQuality) ? (QUALITY_RANK[r.cond.minQuality]||0) : 0;
  const qName = Q_NAME[qRank];
  if(r.pool==='micro')  return {id:'micro-'+word,  name:elemName(word)+'元素微粒',   n:1, tag:'口粮'};
  if(r.pool==='chr')    return {id:'chr-'+word+'-'+qName, name:elemName(word)+'元素结晶·'+qName, n:1, tag:'亲和训练'};
  if(r.pool==='gel')    return {id:'gel-'+word,    name:elemName(word)+'元素凝胶',   n:1, tag:'洗亲和'};
  if(r.pool==='ling')   return {id:'ling-'+word+'-mat', name:elemName(word)+'之凝材', n:1, tag:'标准灵材'};
  if(r.pool==='sprout') return {id:'sprout-'+word, name:elemName(word)+'元素萌芽',   n:1, elem:word, tag:'培养精灵'};
  return null;
}
/* 素材规则候选（S池萃取后）：{r, word, cost, times}——times = 当前词条单位可完整触发次数 */
function matCandidates(rules, sPool, mats){
  const out = [];
  rules.forEach(r=>{
    if(r.pool==='spirit') return;
    const c = r.cond||{};
    const isNew = (c.unit!=null || c.anyUnit);
    if(!isNew){
      // legacy 规则（minN 条数制）：命中一次算一次
      if(!ruleHit(r, mats)) return;
      const word = ruleHitPool({cond:{unit:1, anyUnit:true}}, sPool) || '凡尘';
      out.push({r, word, cost:1, times:1, unit:sPool[word]||1});
      return;
    }
    if(c.minQuality && !mats.some(m=>QUALITY_RANK[m.quality]>=QUALITY_RANK[c.minQuality])) return;
    if(c.lowValue && !mats.every(m=>m.quality==='normal')) return;
    if(c.chaos && !(sPool['chaos']>=1)) return;
    const word = ruleHitPool(r, sPool);
    if(!word) return;
    const cost = r.cost || c.unit || 1;
    const unit = sPool[word]||0;
    out.push({r, word, cost, times:Math.max(1, Math.floor(unit/cost)), unit});
  });
  return out;
}
/* 灵兽候选（B池，一鱼多吃）：仅定向配方——词条门槛全部达标（含元素 ≥unit + 特征词条 + 品质门槛）即候选。
   无泛匹配兜底：未命中任何定向配方 → 无候选。返回 {cands, directed}：directed=true 即共享 1%。 */
function spiritCandidates(bPool, mats){
  const directed = new Set();
  let directedHit = false;
  refineRules().forEach(r=>{
    if(r.pool!=='spirit') return;
    const c = r.cond||{};
    if(!(c.spirits && c.spirits.length)) return;
    const unit = c.unit||1;
    // 特征词条（支持单条 word 或数组 words，全部达标才命中）——与精灵无关，按全局词条池判定
    const wordOk = (()=>{
      if(c.words && c.words.length){
        return c.words.every(x=>(bPool[x.w]||0)>=(x.n||c.wordUnit||c.unit||1));
      }
      if(c.word) return (bPool[c.word]||0)>=(c.wordUnit||c.unit||1);
      return true;
    })();
    const qualOk = !c.minQuality || mats.some(m=>QUALITY_RANK[m.quality]>=QUALITY_RANK[c.minQuality]);
    const chaosOk = !c.chaos || (bPool['chaos']||0)>0;
    // 元素达标按每只候选精灵自身的元素判定：火系配方不会被水系素材触发
    c.spirits.forEach(sid=>{
      const sp = allSpeciesDef(sid);
      if(!sp) return;
      const elemOk = (bPool[sp.elem]||0)>=unit;
      if(elemOk && wordOk && qualOk && chaosOk){
        directedHit = true;
        directed.add(sid);
      }
    });
  });
  if(directedHit) return {cands:[...directed], directed:true};
  return {cands:[], directed:false};
}
/* 灵兽品质权重：同品质均分；每高一个品质，概率衰减至 10%（空出概率由其余均分） */
function pickSpiritByRarity(cands){
  const rank = {normal:0, elite:1, perfect:2, legend:3};
  const items = cands.map(id=>({id, w:Math.pow(0.1, rank[allSpeciesDef(id).rarity]||0)}));
  const total = items.reduce((a,x)=>a+x.w,0);
  let rnd = Math.random()*total;
  for(const x of items){ rnd-=x.w; if(rnd<0) return x.id; }
  return items[items.length-1].id;
}
/* 规则条件判定：r.cond × 炉内素材 */
function ruleHit(r, mats){
  const c = r.cond; if(!c) return mats.length>0;
  if(mats.length < (c.minN||1)) return false;
  const elems = mats.filter(m=>m.elem && ELEM[m.elem]).map(m=>m.elem);
  if(c.anyElem && elems.length < c.minN) return false;
  if(c.sameElem){
    const cnt = {};
    elems.forEach(e=>cnt[e]=(cnt[e]||0)+1);
    if(!Object.values(cnt).some(n=>n>=c.minN)) return false;
  }
  if(c.chaos && !mats.some(m=>m.elem==='chaos')) return false;
  if(c.minQuality){
    const qn = mats.filter(m=>QUALITY_RANK[m.quality]>=QUALITY_RANK[c.minQuality]).length;
    if(qn < c.minN) return false;
  }
  if(c.lowValue && !mats.every(m=>m.quality==='normal')) return false;
  return true;
}
/* 规则产出结算 → {id, name, n} 常规产物（灵兽单独判定） */
function resolveRulePool(r, mats){
  const elems = mats.filter(m=>m.elem && ELEM[m.elem]);
  const mainElem = elems.length ? (elems.sort((a,b)=>(b.quality?QUALITY_RANK[b.quality]:0)-(a.quality?QUALITY_RANK[a.quality]:0))[0].elem) : 'none';
  const total = mats.length;
  if(r.pool==='micro'){
    const n = Math.max(1, Math.floor(total*0.6));
    return {id:'micro-'+mainElem, name:elemName(mainElem)+'元素微粒', n, tag:'口粮'};
  }
  if(r.pool==='chr'){
    const q = mats.reduce((a,m)=>Math.max(a, QUALITY_RANK[m.quality]||0),0);
    const qName = ['普通','精良','完美'][q]||'普通';
    return {id:'chr-'+mainElem+'-'+qName, name:elemName(mainElem)+'元素结晶·'+qName, n:1, tag:'亲和训练'};
  }
  if(r.pool==='gel'){
    return {id:'gel-'+mainElem, name:elemName(mainElem)+'元素凝胶', n:1, tag:'洗亲和'};
  }
  if(r.pool==='ling'){
    // 标准灵材：100% 得 1 个符条件灵材，数量 = 投入 50%；生命精华可视为任意同品质纯洁灵材，计入数量
    // 再 50% 概率将剩余 50%（25%）转为另一素材，迭代至 <1
    const lifeN = mats.filter(m=>m.id==='SC_none_fine_000001').length;
    const mainN = Math.max(1, Math.floor((total+lifeN)/2));
    const out = [{id:'ling-'+mainElem+'-mat', name:elemName(mainElem)+'之凝材', n:mainN, tag:'标准灵材'}];
    let rest = total - mainN;
    let guard = 0;
    while(rest>=1 && roll(.5) && guard<3){
      const n2 = Math.max(1, Math.floor(rest/2));
      const t2 = mats[0].type;
      const tName = {plant:'草木', ore:'矿脉', beast:'妖兽'}[t2]||'万物';
      out.push({id:'ling-'+t2+'-mat', name:tName+'之凝材', n:n2, tag:'标准灵材'});
      rest -= n2; guard++;
    }
    return out;
  }
  if(r.pool==='sprout') return {id:'sprout-'+mainElem, name:elemName(mainElem)+'元素萌芽', n:1, elem:mainElem, tag:'培养精灵'};
  return null;
}
function comboInfo(){
  const mats = furnaceMats();
  const bPool = spiritPool(mats);
  const sPool = extractPool(mats);
  const sc = spiritCandidates(bPool, mats);
  const cands = sc.cands;
  const extras = matCandidates(refineRules(), sPool, mats).map(x=>x.r);
  const hasValue = extras.length>0 || cands.length>0;
  const value = mats.length;
  // 仅定向配方可出灵兽（无泛匹配）：命中定向即共享 1%
  const chance = sc.directed ? (S.demo ? .28 : .01) : 0;
  const shinyRate = S.demo ? .18 : .05;
  const shiny = cands.some(id=>hasShinyArt(id)) ? shinyRate : 0;
  const outLing = 1 + Math.floor(value/4);
  return {cands, directed:sc.directed, chance:Math.min(.95,chance), shiny, sprout:.08, value, outLing, hasValue, extras, bPool, sPool};
}