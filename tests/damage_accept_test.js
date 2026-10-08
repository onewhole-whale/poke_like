/* v1.11.0 伤害公式宝可梦化 · 独立验收测试
   验收标准来源：DEVELOPMENT_PLAN.md §3.6（94-97 行）+ 版本记录 v1.11.0（343 行）
   覆盖：A.calcDamage 公式（基础/def参与/等级项/mods乘区/克制/本系/随机浮动/保底）
         B.属性换算（spiritStats/dungeonBeast/wildBeast/ivContribution 宝可梦式，去×6）
         C.防御体系激活（降防/防御种族值/防御性格/防御专长生效）
         D.双引擎冒烟（野外 startBattle + 副本 startDgFight）
   运行：node tests/damage_accept_test.js */
function mkEl(){
  const e = {children:[], className:'', innerHTML:'', style:{}, title:'', dataset:{}, disabled:false,
    textContent:'', value:'', selected:false, _onclick:null, _ev:{}, _onmd:null,
    addEventListener(t,f){ this._ev[t]=f; }, removeEventListener(t){ delete this._ev[t]; },
    fire(t,ev={}){ const e=Object.assign({preventDefault(){}, key:''}, ev); if(this._ev[t]) this._ev[t](e); if(t==='mousedown'&&this._onmd) this._onmd(e); },
    focus(){}, blur(){},
    set onmousedown(f){ this._onmd=f; }, get onmousedown(){ return this._onmd; },
    classList:{_s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){f?this._s.add(c):this._s.delete(c)}, contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c); return c}, remove(){},
    querySelector(){return mkEl()}, querySelectorAll(){return []},
    set onclick(f){this._onclick=f}, get onclick(){return this._onclick} };
  return e;
}
const LS={_d:{}, getItem(k){return this._d[k]||null}, setItem(k,v){this._d[k]=v}, removeItem(k){delete this._d[k]}};
const _els={};
global.document={querySelector:sel=>{ if(!_els[sel]) _els[sel]=mkEl(); return _els[sel]; }, querySelectorAll:()=>[], createElement:()=>mkEl(), createTextNode:t=>({nodeValue:t, textContent:t}), addEventListener:()=>{}};
global.window={addEventListener:()=>{}, location:{hash:'#/stable'}};
global.location={hash:'#/stable'};
global.localStorage=LS;
global.requestAnimationFrame=fn=>fn();
global.setTimeout=()=>{};
const fs=require('fs');
let code = require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,makeSpirit,spiritStats,dungeonBeast,wildBeast,ivContribution,speciesBase,allSpeciesDef,
  calcDamage,typeMult,perkEffects,statusMods,natureMult,startBattle,battleSkill,beastTurn,startDgFight,dgBattleSkill,
  spById,ELEM,TYPE_CRUSH,TYPE_RESIST,SKILL_STATUS};`);
eval(code);
const T=globalThis.__T;
let pass=0, fail=0;
const assert=(n,c,x)=>{ if(c){pass++;console.log('  ok -',n);} else {fail++;console.log('FAIL -',n,x||'');} };
// 固定随机浮动：calcDamage 内 dmg *= 0.85+Math.random()*0.15；random=1 → ×1.0（确定性上限）
// 中性属性对 fire→thunder（火不克电、电不抗火，typeMult=1）
const setR = v => { global.Math.random = ()=>v; };
const D = (atk,aLvl,def,power,mods,atkElem,defElem) => {
  setR(1);
  return T.calcDamage(atk,aLvl,def,50,power,mods||{},atkElem||'fire',defElem||'thunder');
};

/* ========== A. calcDamage 公式 ========== */
console.log('A. calcDamage 宝可梦式公式');
// A1 基础伤害手算：lvlTerm=floor(2×30/5+2)=14；dmg=floor(14×60×100/50/50)+2=floor(33.6)+2=35
const base = D(100,30,50,60,{},'fire','thunder');
assert('基础伤害公式正确（100攻/30级/50防/60威 = 35）', base===35, 'got '+base);
// A2 def 参与（核心）：def 翻倍 → A/D 减半 → 伤害≈减半
const base2 = D(100,30,100,60,{},'fire','thunder');
assert('def 翻倍伤害约减半（35→18）', Math.abs(base2 - Math.floor(base/2))<=1, 'got '+base2);
// A3 等级项：aLvl 60 → lvlTerm=26，伤害显著提升
const lvl60 = D(100,60,50,60,{},'fire','thunder');
assert('等级项生效（60级 lvlTerm=26 > 30级 14）', lvl60 > base*1.7, lvl60+' vs '+base);
// A4 mods 乘区全部保留
setR(1);
assert('dmgUp .5 → ×1.5', D(100,30,50,60,{dmgUp:.5},'fire','thunder')===Math.round(35*1.5));
assert('vuln .5 → ×1.5', D(100,30,50,60,{vuln:.5},'fire','thunder')===Math.round(35*1.5));
assert('critDmg .5 → ×1.5', D(100,30,50,60,{critDmg:.5},'fire','thunder')===Math.round(35*1.5));
assert('dmgDown .5 → ×0.5', D(100,30,50,60,{dmgDown:.5},'fire','thunder')===Math.round(35*.5));
assert('resist .5 → ×0.5', D(100,30,50,60,{resist:.5},'fire','thunder')===Math.round(35*.5));
assert('resist .5 + pen .5 抵消 → ×1', D(100,30,50,60,{resist:.5,pen:.5},'fire','thunder')===35);
assert('fieldMul .5 → ×1.5（场地乘区保留）', D(100,30,50,60,{fieldMul:.5},'fire','thunder')===Math.round(35*1.5));
// A5 克制 / 抵抗
assert('typeMult 克制 fire→grass ×2', D(100,30,50,60,{},'fire','grass')===70);
assert('typeMult 抵抗 fire→water ×0.5', D(100,30,50,60,{},'fire','water')===Math.round(35*.5));
assert('typeMult 无关 ×1', D(100,30,50,60,{},'fire','thunder')===35);
// A6 本系加成 stab 1.25
assert('stab 1.25 → ×1.25', D(100,30,50,60,{stab:1.25},'fire','thunder')===Math.round(35*1.25));
assert('无 stab（=1）不放大', D(100,30,50,60,{stab:1},'fire','thunder')===35);
// A7 随机浮动 0.85~1.0：采样 300 次，区间与端点覆盖
const rv = [];
for(let i=0;i<300;i++){ setR(i/299); rv.push(T.calcDamage(100,30,50,50,60,{},'fire','thunder')); }
const rMin = Math.min(...rv), rMax = Math.max(...rv);
const floor85 = Math.floor(Math.round(35*.85)), ceil1 = 35;
assert('随机浮动范围 [0.85×, 1.0×] 内（'+rMin+'~'+rMax+'）', rMin>=Math.floor(35*.85)-1 && rMax<=35+1, rMin+'~'+rMax);
assert('随机浮动覆盖端点（出现 35 与最低值）', rMax===35 && rMin<=Math.ceil(35*.85), rMin+'~'+rMax);
// A8 保底 ≥1
setR(1);
assert('极端防御仍保底 ≥1', T.calcDamage(1,1,99999,50,60,{},'fire','thunder')>=1);
setR(0);
assert('随机 0 端 = ×0.85', T.calcDamage(100,30,50,50,60,{},'fire','thunder')===Math.round(35*.85));

/* ========== B. 属性换算（宝可梦式，去×6） ========== */
console.log('B. 属性换算宝可梦化');
const st30 = T.spiritStats(Object.assign(T.makeSpirit('JL_fire_normal_0001',false,'t'),{lvl:30}));
// JL_fire_normal_0001：hp 55 atk 75 def 45 spa 40 sdef 40 spe 70
// mk(hp)=floor(2×55×30/100)=33 → 33+30+10=73；mk(atk)=floor(45)=45 → 45+5=50
assert('HP = floor(2×种族×lvl/100)+lvl+10（73）', st30.hp===73, 'got '+st30.hp);
assert('atk = floor(2×种族×lvl/100)+5（50）', st30.atk===50, 'got '+st30.atk);
assert('spd = floor(2×种族×lvl/100)+5（47）', st30.spd===47, 'got '+st30.spd);
// ivContribution 去×6：20 点 iv Lv30 = 20×2×30/100 = 12（全属性统一，无放大）
assert('ivContribution 20点Lv30 = +12', T.ivContribution({atk:20},'atk',30)===12, T.ivContribution({atk:20},'atk',30));
assert('iv 速度与攻击同规则（去×6）', T.ivContribution({spe:20},'spe',30)===12);
const stIV = T.spiritStats(Object.assign(T.makeSpirit('JL_fire_normal_0001',false,'t'),{lvl:30,iv:{atk:20}}));
assert('面板含 iv：atk 50+12=62', stIV.atk===62, 'got '+stIV.atk);
// Lv1 时 20 点 iv = 0（2×20×1/100=0.4 → 0）
assert('Lv1 时 20 点 iv ≈ +0（宝可梦式低等级低贡献）', T.ivContribution({atk:20},'atk',1)===0);
// dungeonBeast / wildBeast 同公式
const db = T.dungeonBeast('JL_earth_normal_0046', 30);
// JL_earth_normal_0046 hp 80 def 95：mk(hp)=48 → 48+30+10=88；mk(def)=57 → 57+5=62
assert('dungeonBeast hp 宝可梦式（88）', db.hp===88, 'got '+db.hp);
assert('dungeonBeast def 基准 = mk+5（62，不含性格）', Math.abs(db.def - 62*T.natureMult(db.nature,'def'))<=2, 'got '+db.def);
const wb = T.wildBeast('JL_fire_normal_0001'); // lvl=1
// mk(hp)=floor(2×55×1/100)=1 → 1+1+10=12
assert('wildBeast hp 宝可梦式（Lv1 = 12）', wb.hp===12, 'got '+wb.hp);

/* ========== C. 防御体系激活 ========== */
console.log('C. 防御体系激活');
// C1 降防：defMul=0.6（4 层 def_down）→ defSide 打 0.6 → 伤害 ≈ ×1/0.6
setR(1);
const noDebuff = T.calcDamage(100,30,60,50,60,{},'fire','thunder');
const debuffed = T.calcDamage(100,30,Math.round(60*0.6),50,60,{},'fire','thunder');
assert('降防 4 层（def×0.6）伤害提升 ≈1.667 倍', Math.abs(debuffed - noDebuff/0.6) <= Math.max(2,noDebuff*0.05), debuffed+' vs '+noDebuff);
// C2 防御种族值：打高防 vs 低防同攻 → 伤害显著低（A/D 比值线性）
setR(1);
const dHi = T.calcDamage(100,30,95,50,60,{},'fire','thunder');   // 咚咚犀 def 95
const dLo = T.calcDamage(100,30,45,50,60,{},'fire','thunder');   // 烬烬狼 def 45
assert('防御种族值生效（95防受伤 < 45防）', dHi < dLo && Math.abs(dHi/dLo - 45/95) < 0.15, dHi+' vs '+dLo);
// C3 防御性格：def ×1.1 → 伤害 ≈ /1.1
setR(1);
const dN = T.calcDamage(100,30,Math.round(50*1.1),50,60,{},'fire','thunder');
assert('防御性格 +10% → 伤害 ≈/1.1', Math.abs(dN - base/1.1) <= Math.max(2,base*0.05), dN+' vs '+base);
// C4 防御专长：defPct 12% 进面板（Lv30 JL_fire_normal_0001 def 基础 = floor(2×45×30/100)+5=32；铁骨 +12% → 35.84 → 36）
const spPerk = Object.assign(T.makeSpirit('JL_fire_normal_0001',false,'t'),{lvl:30, perks:['ironwill']});  // 铁骨 def+12%
const stP = T.spiritStats(spPerk);
const stN = T.spiritStats(Object.assign(T.makeSpirit('JL_fire_normal_0001',false,'t'),{lvl:30}));
assert('防御专长进面板（def 32→36）', stP.def===36 && stN.def===32, stP.def+' vs '+stN.def);
setR(1);
const dPerk = T.calcDamage(100,30,stP.def,50,60,{},'fire','thunder');
assert('防御专长降低受伤（36防 < 32防）', dPerk < D(100,30,stN.def,60), dPerk+' vs '+D(100,30,stN.def,60));

/* ========== D. 双引擎冒烟 ========== */
console.log('D. 双引擎冒烟（野外 + 副本）');
// D1 野外完整行动
const spD1 = T.makeSpirit('JL_fire_normal_0001',false,'t'); spD1.lvl=30; spD1.hp=999; T.S.spirits=[spD1]; T.S.wild.spiritId=spD1.id;
T.startBattle({speciesId:'JL_earth_normal_0046',name:'咚咚犀',elem:'earth',hp:5000,maxHp:5000,atk:3,def:2,spd:1,lvl:1},'normal');
const b1 = T.S.wild.battle;
assert('野外战斗初始化成功', !!b1 && (b1.first==='player'||b1.first==='beast'));
// 玩家出招一次（用火系普攻打土系咚咚犀，无克制）
setR(1);
const hpBefore = b1.beast.hp;
try{ T.battleSkill('fire-d0'); }catch(e){ console.log('  battleSkill err', e.message); }
assert('野外玩家行动伤害生效（妖兽掉血）', b1.beast.hp < hpBefore, hpBefore+'→'+b1.beast.hp);
const dmgLog = b1.log.map(l=>l.text).join('|');
assert('野外伤害日志数值合理（宝可梦式数值量级）', /<b>\d+<\/b> 点伤害/.test(dmgLog), dmgLog.slice(0,80));
// D2 副本完整行动
const spD2 = T.makeSpirit('JL_fire_normal_0001',false,'t'); spD2.lvl=30; T.S.spirits=[spD2];
window.renderSettle = function(){};
T.S.settle = {spiritId:spD2.id, idx:0, enemies:[{name:'咚咚犀',elem:'earth',hp:5000,maxHp:5000,atk:3,def:2,spd:1,lvl:1}], buffs:[], phase:'fight', logs:[]};
T.startDgFight();
const b2 = T.S.settle.battle;
assert('副本战斗初始化成功', !!b2 && (b2.first==='player'||b2.first==='beast'));
const hpBefore2 = b2.beast.hp;
setR(1);
try{ T.dgBattleSkill('fire-d0'); }catch(e){ console.log('  dgBattleSkill err', e.message); }
assert('副本玩家行动伤害生效（妖兽掉血）', b2.beast.hp < hpBefore2, hpBefore2+'→'+b2.beast.hp);

console.log('\nv1.11.0 伤害公式验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
