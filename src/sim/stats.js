

/* ================= 初始存档 ================= */
/* 种族基础面板：按品级推导（normal/elite/perfect/legend） */
/* 种族值（M2-A2b）：6 维 hp/atk/def/spa(特攻)/sdef(特防)/spe(速度=speed 字段)
   物种品级仅三档：普通 280-390 / 精英 400-490 / 完美 500-590，传说 620-640（赛尔号式，独立不入链）
   妖兽与灵兽同物种种族值完全一致，差异只在个体值（A3 做）与可培养性 */
const GRADE_NAME = {normal:'普通', elite:'精英', perfect:'完美', legend:'传说'};
function gradeName(sp){ return GRADE_NAME[sp.rarity] || sp.rarity; }
function speciesBase(sp){
  const r = {normal:0, elite:1, perfect:1.5, legend:2}[sp.rarity] || 0;
  const st = sp.stats || {hp:30+r*15, atk:10+r*5, def:7+r*3, spa:10+r*5, sdef:7+r*3};   // 兜底旧数据（无 stats 字段的精灵）
  return {
    hp: st.hp, atk: st.atk, def: st.def, spa: st.spa, sdef: st.sdef, spe: sp.speed,
    capBase: (sp.capBase!=null) ? sp.capBase : (5 + Math.floor(sp.speed/20)),
    capGrow: (sp.capGrow!=null) ? sp.capGrow : 0.5,
  };
}
/* 个体值（M2-A3）：妖兽生成时随机 0-3 项、各 1-20；灵兽落库自选（同性格）、飞升继承妖兽旧魂
   面板贡献按宝可梦式折算（每点 = 2 × lvl/100 面板值，v1.11.0 去 ×6 放大，全属性统一） */
const IV_KEYS = ['hp','atk','def','spa','sdef','spe'];
const IV_NAME = {hp:'生命', atk:'攻击', def:'防御', spa:'特攻', sdef:'特防', spe:'速度'};
function ivContribution(iv, k, lvl){
  const v = (iv && iv[k]) || 0;
  if(!v) return 0;
  return Math.round(v*2*lvl/100);   // 宝可梦式（v1.11.0）：每点 iv = 2×lvl/100 面板值（去 ×6 放大）
}
function genRandomIV(){   // 妖兽：随机 0-3 个属性、各 1-20 点
  const n = Math.floor(Math.random()*4);
  const keys = [...IV_KEYS].sort(()=>Math.random()-0.5).slice(0,n);
  const iv = {};
  keys.forEach(k=>{ iv[k] = 1+Math.floor(Math.random()*20); });
  return iv;
}
function ivSummary(s){ return Object.entries(s.iv||{}).filter(([,v])=>v>0); }
/* 精灵面板（M2-A2 6 维版）：等级 + 种族基础 + 个体值 + 专长补正（属性专长在面板层生效）
   返回 {atk 攻击, def 防御, spa 特攻, sdef 特防, hp 血量, spd 速度}
   键约定：spa=特攻、sdef=特防、spd=速度（历史兼容；NATURES 性格键 spd=特防、spe=速度） */
function spiritStats(s){
  const sp = allSpeciesDef(s.speciesId);
  const base = speciesBase(sp);
  const lvl = s.lvl||1;
  // 宝可梦式换算（v1.11.0 定稿）：HP = floor(2×种族×lvl/100)+lvl+10；其他五项 = floor(2×种族×lvl/100)+5
  const mk = r => Math.floor(2*r*lvl/100);
  let atk = mk(base.atk) + 5 + ivContribution(s.iv,'atk',lvl);
  let def = mk(base.def) + 5 + ivContribution(s.iv,'def',lvl);
  let spa = mk(base.spa) + 5 + ivContribution(s.iv,'spa',lvl);
  let sdef = mk(base.sdef) + 5 + ivContribution(s.iv,'sdef',lvl);
  let hp  = mk(base.hp) + lvl + 10 + ivContribution(s.iv,'hp',lvl);
  let spd = mk(base.spe) + 5 + ivContribution(s.iv,'spe',lvl);
  const eff = perkEffects(s);
  if(eff.atkPct) atk *= (1+eff.atkPct);
  if(eff.defPct) def *= (1+eff.defPct);
  if(eff.spaPct) spa *= (1+eff.spaPct);
  if(eff.sdefPct) sdef *= (1+eff.sdefPct);
  if(eff.spdPct) spd *= (1+eff.spdPct);
  if(eff.hpPct)  hp  *= (1+eff.hpPct);
  if(eff.atkGrow) atk += eff.atkGrow*lvl; // 攻击成长专长：每级额外加成
  if(eff.spaGrow) spa += eff.spaGrow*lvl;
  if(eff.sdefGrow) sdef += eff.sdefGrow*lvl;
  // 性格修正（宝可梦式）：攻击/防御/特攻/特防/速度 ±10%，血量不受性格影响
  const nm = s.nature;
  if(nm){
    atk *= natureMult(nm,'atk'); def *= natureMult(nm,'def');
    spa *= natureMult(nm,'spa'); sdef *= natureMult(nm,'spd');  // 性格键 spd=特防
    spd *= natureMult(nm,'spe');                                // 性格键 spe=速度
  }
  return {atk:Math.round(atk), def:Math.round(def), spa:Math.round(spa), sdef:Math.round(sdef), hp:Math.round(hp), spd:Math.round(spd)};
}
/* 六维进度条上限：全图鉴里，该维在满级（50+灵根10）、个体 20、有利性格 +10% 下的最高面板。生命不受性格修正。 */
function statCeilings(){
  const lvl = BASE_LVL_CAP + 10;
  const iv = Math.round(20*2*lvl/100);
  const mk = r => Math.floor(2*r*lvl/100);
  const line = race => Math.round((mk(race)+5+iv)*1.1);
  const ceil = {hp:1, atk:1, def:1, spa:1, sdef:1, spd:1};
  allSpecies().forEach(sp=>{
    const b = speciesBase(sp);
    ceil.hp = Math.max(ceil.hp, Math.round(mk(b.hp)+lvl+10+iv));
    ceil.atk = Math.max(ceil.atk, line(b.atk));
    ceil.def = Math.max(ceil.def, line(b.def));
    ceil.spa = Math.max(ceil.spa, line(b.spa));
    ceil.sdef = Math.max(ceil.sdef, line(b.sdef));
    ceil.spd = Math.max(ceil.spd, line(b.spe));
  });
  return ceil;
}