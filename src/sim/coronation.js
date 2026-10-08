
function trainSkill(s, sk, row){
  if(S.aura<1){ toast('灵息结晶不足','bad'); return; }
  S.aura--;
  s.trainCount = (s.trainCount||0)+1;   // 苦行僧检查点
  const total = masteryTotal(s);
  const cap = s.masteryCap;
  if(total+10 > cap){
    // 让渡：其他正熟练度的技能均匀扣减，腾出容量（含未装配）
    let need = total+10-cap;
    const others = masteryList(s).filter(x=>x!==sk);
    while(need>0){
      const pool = others.filter(x=>x.mastery>0);
      if(pool.length===0) break;
      const per = Math.ceil(need/pool.length);
      let moved = false;
      pool.forEach(x=>{ const cut=Math.min(x.mastery,per); x.mastery-=cut; need-=cut; if(cut>0) moved=true; });
      if(!moved) break;
    }
    sk.mastery += 10 - need;
    toast('技艺精进，旧技能让渡了熟练度');
  } else {
    sk.mastery += 10;
    toast('熟练度 +10');
  }
  openDetail(s.id);
  renderStable();
  renderRefine();
}

/* ================= 传说加冕（称号系统） =================
   设计：检查点 = 正常情况下完全不可能的条件；玩家主动按下【传说加冕】消耗资源，
   命中任一检查点 → 进入预定义的晋升任务链 → 任务链全部完成后由「KP AI」生成称号与提升方案，
   返回内容必须经管理员（玩家）审核，通过才落实，驳回则携建议重写。 */
const CHECKPOINTS = [
  {id:'master400', name:'一技入化', desc:'任一技能熟练度达到 400%，且使用超过 1000 次 —— 常态上限 150%，这是撑破上限的绝活',
   cond:s=>!!(s.skills.find(x=>x.mastery>=400 && (x.uses||0)>=1000))},
  {id:'hepta', name:'万象通明', desc:'至少 7 系亲和力达到 100 —— 训练亲和填不满七系，必有专长破格',
   cond:s=>Object.keys(ELEM).filter(e=>affOf(s,e)>=100).length>=7},
  {id:'aff500', name:'一念通天', desc:'单系亲和力超过 500 —— 上限 200 挡不住它，这是深度上的极限',
   cond:s=>Object.keys(ELEM).some(e=>affOf(s,e)>500)},
  {id:'century', name:'百技归一', desc:'熟练度达到 100% 的技能不少于 7 个',
   cond:s=>s.skills.filter(x=>x.mastery>=100).length>=7},
  {id:'legendary5', name:'天选之人', desc:'拥有不少于 5 个传奇品质专长 —— 传奇专长本就万中无一',
   cond:s=>(s.perks||[]).filter(p=>{ const d=perkDef(p); return d&&(d.quality==='legend'||d.star); }).length>=5},
  {id:'forbidden', name:'破禁者', desc:'携带 3 个不同属性、亲和力归零的技能，且全部修炼至 100% —— 零亲和本应禁带，你偏要练成禁术',
   cond:s=>{ const z=s.skills.filter(x=>x.elem && x.elem!=='none' && affOf(s,x.elem)===0 && x.mastery>=100); return new Set(z.map(x=>x.elem)).size>=3; }},
  {id:'rainbow', name:'异色飞升', desc:'以异色妖兽承接炼化之灵飞升 —— 1% 出灵兽叠乘异色判定，再赌一只异色妖兽，此路近乎不可能',
   cond:s=>!!s.rainbowAscended},
];
const ASCENSION_CHAINS = {
  master400:{name:'一技入化之途', hint:'兵器谱 · 绝技向', steps:[
    '以该绝活技能在秘境中赢得 100 场胜利',
    '将这门技艺再精进 100 熟练度',
    '独闯传说妖兽巢穴，以该技能完成最后一击',
  ]},
  hepta:{name:'万象通明之途', hint:'全知者 · 万象向', steps:[
    '在七系秘境各完成至少一次收获',
    '将两系训练亲和提升至 150',
    '以非本系技能赢得一场硬仗',
  ]},
  aff500:{name:'一念通天之途', hint:'登峰 · 专精向', steps:[
    '将单系亲和突破 200 上限',
    '以该系技能独战十场',
    '将这一系推至 500 之巅',
  ]},
  century:{name:'百技归一之途', hint:'宗师 · 百艺向', steps:[
    '收集 12 个不同的技能',
    '将 7 个技能修炼至 100%',
    '以自创技能搭配挑战同系传说妖兽',
  ]},
  legendary5:{name:'天选之人之途', hint:'天命 · 传奇向', steps:[
    '获得第一枚传奇专长',
    '凑齐三系传奇专长',
    '五种传奇之道加于一身',
  ]},
  forbidden:{name:'破禁者之途', hint:'禁术 · 破格向', steps:[
    '获得一门禁带属性的豁免专长',
    '将三系零亲和技能修炼至 100%',
    '以禁术击败同属性妖兽',
  ]},
  rainbow:{name:'异色飞升之途', hint:'虹霓 · 出身向', steps:[
    '炼化出一只异色灵兽',
    '在秘境中捕获一只异色妖兽',
    '以异色妖兽承接灵体，完成飞升',
  ]},
};
function checkpointState(s){
  return CHECKPOINTS.map(cp=>({cp, hit:cp.cond(s)}));
}
function coronationStatus(s){
  const st = s.coronation||{};
  if(!st.active) return {stage:'none'};
  if(st.stage==='trials'){ const chain = ASCENSION_CHAINS[st.checkpoint]; return {stage:'trials', chain, idx:st.chainIdx, cp:CHECKPOINTS.find(x=>x.id===st.checkpoint)}; }
  return {stage:st.stage, cp:CHECKPOINTS.find(x=>x.id===st.checkpoint), draft:st.draft, review:st.review};
}
/* 按下【传说加冕】：消耗灵息 ×10，检查检查点 */
function tryCoronation(s){
  if(S.aura<10){ toast('灵息结晶不足（需 ×10）','bad'); return; }
  const hit = CHECKPOINTS.find(cp=>cp.cond(s));
  if(!hit){ toast('尚未达成任何加冕检查点——这些条件在正常游玩中几乎不可能达成','bad'); return; }
  S.aura -= 10;
  s.coronation = {active:true, checkpoint:hit.id, chainIdx:0, stage:'trials'};
  toast('『'+hit.name+'』达成！晋升任务链开启','gold');
  openDetail(s.id);
}
/* 任务链推进：一步消耗灵息 ×5（原型模拟；真实版需完成对应冒险/修炼） */
function coronationStep(s){
  const st = s.coronation; if(!st || st.stage!=='trials') return;
  if(S.aura<5){ toast('灵息结晶不足','bad'); return; }
  S.aura -= 5;
  st.chainIdx++;
  if(st.chainIdx >= ASCENSION_CHAINS[st.checkpoint].steps.length){
    st.stage = 'kp';
    toast('晋升任务链完成','gold');
  } else {
    toast('迈出一步，离传说更近了');
  }
  openDetail(s.id);
}
/* KP 模拟生成称号草稿（原型为本地占位；真实版由扮演 KP 的 AI 生成，须过管理员审核） */
const KP_TITLES = {
  master400:{name:'万里独行', grant:{perk:{name:'万里独行', desc:'绝活技能伤害 +60%，使用次数越多越得心应手'}, skill:{name:'星夜白虹', desc:'无视敌方防御的超大额单体伤害'}}},
  hepta:{name:'万象通明', grant:{perk:{name:'万象通明', desc:'全系亲和力上限突破 200，非本系技能容量占用 −30%'}, skill:{name:'诸界回响', desc:'依照本场碰面过的属性切换伤害属性'}}},
  aff500:{name:'焚天煮海', grant:{perk:{name:'一念通天', desc:'最强亲和之系：容量占用再 −25%，该系技能伤害 +30%'}, skill:{name:'元初之焰', desc:'以最强亲和之系释放的巨额伤害，无可匹敌'}}},
  century:{name:'百艺归宗', grant:{perk:{name:'百艺归宗', desc:'所有技能熟练度上限 +100，总熟练度容量 +100'}, skill:{name:'百式连击', desc:'连续结算本精灵最熟练的七门技艺'}}},
  legendary5:{name:'天命所归', grant:{perk:{name:'天选之姿', desc:'所有传奇专长效果 +20%，运势常伴'}, skill:{name:'天命垂青', desc:'无视条件必定触发一次效果判定'}}},
  forbidden:{name:'破禁者', grant:{perk:{name:'万法皆通', desc:'禁带属性豁免，非亲和技能容量占用减半'}, skill:{name:'禁术·天罚', desc:'按本精灵突破禁带的属性数量增伤'}}},
  rainbow:{name:'虹霓真身', grant:{perk:{name:'虹霓之躯', desc:'异色之姿加身，全系亲和 +10%，异色灵兽不可替代'}, skill:{name:'流光化虹', desc:'双属性混合伤害，随战斗轮次增长'}}},
};
function kpGenerate(s){
  const st = s.coronation; if(!st || st.stage!=='kp') return;
  const tpl = KP_TITLES[st.checkpoint];
  st.draft = {title:tpl.name, perk:tpl.grant.perk, skill:tpl.grant.skill, advice:''};
  st.stage = 'review';
  openDetail(s.id);
}
/* 管理员审核：通过 → 落实；驳回 → 带建议让 KP 重写（原型：重写 = 重新生成一次） */
function kpReview(s, pass){
  const st = s.coronation; if(!st || st.stage!=='review') return;
  if(!pass){
    st.draft.advice = '收敛强度，补足说明。';
    st.stage = 'kp';
    toast('已驳回，携建议重写','bad');
    openDetail(s.id);
    return;
  }
  // 落实：名称变化 + 专属专长 + 专属技能
  s.name = '【'+st.draft.title+'】'+allSpeciesDef(s.speciesId).name;
  s.perks.push({id:'coronation-'+st.checkpoint, name:st.draft.perk.name, desc:st.draft.perk.desc, cost:0, quality:'legend', category:'special', star:true});
  s.skills.push({id:'coronation-sk-'+st.checkpoint, name:st.draft.skill.name, desc:st.draft.skill.desc, kind:'ult', cost:1, elem:s.elem, mastery:0, star:true, uses:0});
  st.stage = 'done';
  toast('加冕完成！传说就此书写','gold');
  renderStable();
  openDetail(s.id);
}