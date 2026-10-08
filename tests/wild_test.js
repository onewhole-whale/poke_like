function mkEl(){
  const e = {
    children:[], className:'', innerHTML:'', style:{}, title:'', dataset:{}, disabled:false,
    textContent:'', value:'', selected:false, _onclick:null,
    classList:{_s:new Set(), add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, toggle(c,f){f?this._s.add(c):this._s.delete(c)}, contains(c){return this._s.has(c)}},
    appendChild(c){this.children.push(c); return c}, remove(){},
    querySelector(){return mkEl()}, querySelectorAll(){return [mkEl(), mkEl()]},
    set onclick(f){this._onclick=f}, get onclick(){return this._onclick},
  };
  return e;
}
global.document = {
  querySelector:()=>mkEl(), querySelectorAll:()=>[], createElement:()=>mkEl(), createTextNode:t=>({nodeValue:t, textContent:t}), addEventListener:()=>{},
};
global.window = { addEventListener:()=>{}, location:{hash:'#/refine'} };
global.location = { hash:'#/refine' };
global.requestAnimationFrame = fn=>fn();
global.setTimeout = ()=>{};
const fs = require('fs');
let code = require('./_load.js').loadGame();
code = code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code = code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__ELEM=ELEM; globalThis.__T={S,comboInfo,trainSkill,landSpirit,addToFurnace,removeFromFurnace,matState,SPECIES,SKILLS,PERKS,baseBeta,makeSpirit,matInfo,ZONES,WONDERS,genWildNodes,wildBeast,spiritAtk,beastDrops,startBattle,battleAct,renderWild,wonderToItem,wildLoot,wildNodeDone,exchangeTool,renderRefine,renderBuild,renderSettle,renderStable,dropsOf,beastMatIds,essenceName,essenceOf,allEssences,battleSkill,skillUsable,calcDamage,affCapacityMult,spiritStats,capacityOf,usedCap,gainExp,expToNext,expNeed,affOf,perkEffects,skillCapCost,wildSpirit,betaOf,masteryTotal,checkpointState,tryCoronation,coronationStep,kpGenerate,kpReview,ELEM};`);
eval(code);
const T = globalThis.__T;
// v1.16.5: 旧 flame/herb 已删，注册临时素材
T.S.customMats['flame']={id:'flame',name:'测试火材',elem:'fire',quality:'fine',type:'ore',tags:[],count:0,desc:'t'};
T.S.customMats['herb']={id:'herb',name:'测试草',elem:'none',quality:'normal',type:'plant',tags:[],count:0,desc:'t'};
T.matState['flame']=99; T.matState['herb']=99;
let pass=0, fail=0;
function assert(name, cond, extra){ if(cond){pass++; console.log('  ok -',name);} else {fail++; console.log('FAIL -',name, extra||'');} }

// 1. matInfo 解析（v1.16.1: DROPS 已删，妖兽素材池空；仅 MATS 可解析）
assert('matInfo 普通素材', T.matInfo('flame').tier==='mid' && T.matInfo('herb').tier==='low');
assert('已删妖兽素材 matInfo 返回 null', T.matInfo('fw_fang')===null, T.matInfo('fw_fang'));

// 2. 素材价值 = 炉中素材数
T.addToFurnace('flame'); T.addToFurnace('herb');
let info = T.comboInfo();
assert('素材价值为炉中素材数', info.value===2, 'value='+info.value);
T.removeFromFurnace('flame'); T.removeFromFurnace('herb');

// 3. 区域与节点生成
T.S.wild.spiritId = T.S.spirits[0].id;
const nodes = T.genWildNodes('burning');
assert('节点 3-5 个', nodes.length>=3 && nodes.length<=5);
assert('焚风原妖兽为火系', nodes.filter(n=>n.type==='beast').every(n=>allSpeciesDef(n.speciesId).elem==='fire'));

// 4. 掉落（v1.16.1: 素材池空 → 妖兽战无掉落）
const kill = T.beastDrops('JL_fire_normal_0001', 'kill');
const failD = T.beastDrops('JL_fire_normal_0001', 'catchFail');
assert('v1.16.6 填充：杀死返回 5 条掉落', Object.keys(kill).length===5, JSON.stringify(kill));
assert('v1.16.6 填充：捕捉失败返回非空掉落', Object.keys(failD).length>=1, JSON.stringify(failD));
const calmD = T.beastDrops('JL_fire_normal_0001', 'calm');
assert('v1.16.6 填充：安抚返回非空掉落', Object.keys(calmD).length>=1, JSON.stringify(calmD));

// 5. 战斗：先手只由速度决定，与突袭方式无关
// v1.11.0 后妖兽面板为宝可梦式小数值且速度带随机抖动（±4），Lv1 玩家烬烬狼速度≈6，与 wildBeast 随机生成区间重叠会令先手随机；
// 故改为确定性构造妖兽对象（参照 5.1 段写法，直接传 spd 字段）：spd=1 必玩家先手、spd=999 必敌方先手，不再依赖随机生成。
const b1 = {speciesId:'JL_earth_normal_0046', name:'咚咚犀', elem:'earth', hp:100, maxHp:100, atk:3, def:2, spd:1, lvl:1}; // 慢速
const sp1 = T.S.spirits[0]; // 烬烬狼 速度≈6（宝可梦式面板）
T.S.wild.spiritId = sp1.id;
T.startBattle(b1, 'normal');
assert('速度快 → 我方先手', T.S.wild.battle.first==='player');
const b2 = {speciesId:'JL_wind_normal_0041', name:'穿风', elem:'wind', hp:100, maxHp:100, atk:3, def:2, spd:999, lvl:1}; // 快速
T.startBattle(b2, 'normal');
assert('速度慢 → 敌方先手', T.S.wild.battle.first==='beast');
T.startBattle(b2, 'sneak');
assert('突袭不改变先手（仍敌方快）', T.S.wild.battle.first==='beast');
T.startBattle(b1, 'ambush');
assert('被突袭不改变先手（仍我方快）', T.S.wild.battle.first==='player');

// 5.1 额外回合：突袭方单独结算一次
T.startBattle({speciesId:'JL_fire_normal_0001', name:'烬烬狼', elem:'fire', hp:60, maxHp:60, atk:6, spd:40}, 'sneak');
let b = T.S.wild.battle;
assert('突袭有额外一击日志', b.log[0].text.includes('悄然突袭'));
assert('突袭额外一击造成伤害', b.beast.hp<60);
T.startBattle({speciesId:'JL_fire_normal_0001', name:'烬烬狼', elem:'fire', hp:60, maxHp:60, atk:6, spd:40}, 'ambush');
b = T.S.wild.battle;
assert('被突袭有额外一击日志', b.log[0].text.includes('被突袭'));
assert('被突袭额外一击造成伤害', b.spHp>0 && b.spHp<b.spMax, b.spHp+'/'+b.spMax);

// 5.2 一次行动结算完整一轮：双方各攻击一次（妖兽 HP 放大，避免被直接攻击秒杀）
T.startBattle({speciesId:'JL_fire_normal_0001', name:'烬烬狼', elem:'fire', hp:3000, maxHp:3000, atk:3, spd:20}, 'normal');
b = T.S.wild.battle;
const hpB = b.beast.hp, hpS = b.spHp;
T.battleAct();
assert('一轮内双方都受击', b.beast.hp<hpB && b.spHp<hpS, 'beast:'+b.beast.hp+' sp:'+b.spHp);
assert('一轮两条日志', b.log.length===2, b.log.length);
assert('先手方日志在前', b.first==='player' ? b.log[0].text.includes('使用') : b.log[0].text.includes('使出'));

// 6. 战斗伤害推进（不产生死循环）
T.startBattle({speciesId:'JL_fire_normal_0001', name:'烬烬狼', elem:'fire', hp:10, maxHp:10, atk:1, spd:10}, 'sneak');
let guard=0;
while(T.S.wild.battle.phase==='fight' && guard<50){ T.battleAct(); guard++; }
assert('战斗收敛（胜利）', T.S.wild.battle.phase==='won', T.S.wild.battle.phase);

// 7. 奇遇转换
const wi = T.wonderToItem({kind:'skill', elem:'water', itemId:'maelstrom'});
assert('奇遇技能转换', wi.kind==='skill' && wi.skill.id==='maelstrom');
const wp = T.wonderToItem({kind:'perk', elem:'fire', itemId:'blaze-affinity'});
assert('奇遇专长转换', wp.kind==='perk' && wp.perk.id==='blaze-affinity');

// 8. 工具兑换
T.S.aura = 5;
T.S.toolInv = {};
T.exchangeTool();
assert('兑换消耗灵息并得普通斧', T.S.aura===3 && (T.S.toolInv['DJ_none_002000']||0)===1, 'aura='+T.S.aura);

// 9. 奇遇故事结构
assert('奇遇故事结构完整', T.WONDERS.every(w=>w.story.length>=3 && w.perfect && w.perfect.itemId));

// 10. 杀死掉落（v1.16.1: 空池无掉落，框架可接收素材池数据）
const drops = T.beastDrops('JL_fire_normal_0001','kill');
assert('v1.16.6 填充：杀死返回 5 条掉落', typeof drops==='object' && Object.keys(drops).length===5, JSON.stringify(drops));

// 11. 5 视图渲染不抛异常（含修复后的 idle 分支）
try{
  T.renderRefine(); T.renderWild(); T.renderBuild(); T.renderSettle(); T.renderStable();
  assert('5 视图渲染', true);
}catch(e){ assert('5 视图渲染', false, e.message); }

// 12. 战斗系统（三分类技能 · 能量 · 宝可梦伤害 · 亲和力容量 · 升级）
const T2 = T;
// 12.1 宝可梦伤害公式（v1.11.0：等级项 (2L/5+2)，60 威力基准）
assert('伤害公式下限 1', T.calcDamage(10, 1, 5, 1, 60, {}) >= 1);
assert('增伤/暴伤/易伤参与计算', T.calcDamage(10, 1, 5, 1, 60, {dmgUp:.5, critDmg:.5, vuln:.2}) > T.calcDamage(10, 1, 5, 1, 60, {}));
assert('减伤/抗性参与计算', T.calcDamage(10, 1, 5, 1, 60, {dmgDown:.5, resist:.5}) < T.calcDamage(10, 1, 5, 1, 60, {}));
assert('等级项随等级提升', T.calcDamage(10, 1, 5, 1, 60, {}) < T.calcDamage(10, 10, 5, 1, 60, {}));

// 12.2 亲和力容量系数
assert('50% 亲和系数 1.0', T.affCapacityMult({aff:{}}, 'fire')===1);
assert('100% 亲和系数 0.75', Math.abs(T.affCapacityMult({aff:{fire:100}}, 'fire')-0.75)<1e-9);
assert('150% 封顶 0.5', Math.abs(T.affCapacityMult({aff:{fire:150}}, 'fire')-0.5)<1e-9);
assert('40% 亲和 ×2', T.affCapacityMult({aff:{fire:40}}, 'fire')===2);
assert('20% 亲和 ×4', T.affCapacityMult({aff:{fire:20}}, 'fire')===4);
assert('<20% 禁带', T.affCapacityMult({aff:{fire:19}}, 'fire')===null);
assert('容量占用取整', T.skillCapCost({aff:{}}, {cost:3, elem:'fire'})===3);

// 12.3 能量与技能可用性
T.S.wild.spiritId = T.S.spirits[0].id;
const sp0 = T.wildSpirit();
assert('初始能量 5', sp0.energy===5 && sp0.energyMax===10);
T.startBattle({speciesId:'JL_fire_normal_0001', name:'烬烬狼', elem:'fire', hp:200, maxHp:200, atk:3, def:2, spd:10, lvl:2}, 'normal');
let bx = T.S.wild.battle;
assert('爆发技需能量达标', T.skillUsable(sp0, T.SKILLS.fire.find(x=>x.id==='inferno'))===false && bx.energy<8);
T.battleSkill('regen');
assert('回能 +5（上限截断到10）', T.S.wild.battle.energy===10, 'energy='+T.S.wild.battle.energy);
T.battleSkill('f_flamethrower');
assert('绝技耗能 4', T.S.wild.battle.energy===6, 'energy='+T.S.wild.battle.energy);
T.startBattle({speciesId:'JL_fire_normal_0001', name:'烬烬狼', elem:'fire', hp:300, maxHp:300, atk:3, def:2, spd:10, lvl:2}, 'normal');
bx = T.S.wild.battle; bx.energy = 12;
T.battleSkill('inferno');
assert('爆发技清空能量', bx.energy===0, 'energy='+bx.energy);
assert('爆发技造成重创', bx.beast.hp < 300, 'hp='+bx.beast.hp);

// 12.4 斩杀机制（血量 <25% 秒杀）
T.startBattle({speciesId:'JL_fire_normal_0001', name:'烬烬狼', elem:'fire', hp:1, maxHp:200, atk:3, def:2, spd:10, lvl:2}, 'normal');
bx = T.S.wild.battle; bx.energy = 10;
T.battleSkill('inferno');
assert('斩杀直接获胜', bx.phase==='won', bx.phase);

// 12.5 升级：宝可梦中等速曲线
assert('expToNext(2)=8', T.expToNext(2)===8);
assert('expNeed(2)=7', T.expNeed(2)===7);
T.S.spirits[0].lvl = 1; T.S.spirits[0].exp = 0;
const g = T.gainExp(T.S.spirits[0], 2);
assert('战斗经验升级', g.gain>=5 && T.S.spirits[0].lvl>=2, 'gain='+g.gain+' lvl='+T.S.spirits[0].lvl);

// 12.6 初始灵兽技能：直接攻击（回能是独立机制，不在技能列表）
const sk0 = T.S.spirits[0].skills;
assert('初始技能为直接攻击', sk0.some(x=>x.kind==='direct'));
assert('回能不入技能列表（机制）', !sk0.some(x=>x.id==='regen'));
assert('初始熟练度 0/100', T.masteryTotal(T.S.spirits[0])===0 && T.S.spirits[0].masteryCap===100, 'tot='+T.masteryTotal(T.S.spirits[0]));

// 13. 详情页三修：初始熟练度容量 / 无精魄 / β 动态反映亲和力 + 称号加冕流程
const fs0 = T.S.spirits[0];
assert('初始熟练度不超上限', fs0.skills.reduce((a,b)=>a+b.mastery,0) <= fs0.masteryCap, fs0.skills.reduce((a,b)=>a+b.mastery,0));
assert('初始灵兽无精魄字段', fs0.essence===undefined);
assert('β 基础：本系 1.00', T.betaOf(fs0,'fire')===1);
fs0.perks.push({id:'blaze-affinity', name:'炽热亲和', desc:'', beta:{fire:.3}, effects:{aff:{fire:20}}});
assert('亲和专长后 β 火提升', T.betaOf(fs0,'fire')>1.3, T.betaOf(fs0,'fire'));
assert('初始无检查点命中', T.checkpointState(fs0).every(x=>!x.hit));
fs0.skills[0].mastery = 400; fs0.skills[0].uses = 1000;
assert('绝活检查点命中', T.checkpointState(fs0).find(x=>x.cp.id==='master400').hit===true);
fs0.skills[0].mastery = 30; fs0.skills[0].uses = 0;
fs0.perks = [];
// 加冕流程（重新满足绝活检查点）
fs0.skills[0].mastery = 400; fs0.skills[0].uses = 1000;
T.S.aura = 30;
T.tryCoronation(fs0);
assert('资源不足拒绝加冕前先检查（aura 30 ≥10）', T.S.aura===20);
assert('加冕开启任务链', fs0.coronation && fs0.coronation.stage==='trials' && fs0.coronation.checkpoint==='master400');
T.coronationStep(fs0); T.coronationStep(fs0); T.coronationStep(fs0);
assert('任务链完成进入 KP', fs0.coronation.stage==='kp');
T.kpGenerate(fs0);
assert('KP 草稿待审核', fs0.coronation.stage==='review' && fs0.coronation.draft.title);
T.kpReview(fs0, true);
assert('加冕落实：名称变化+专属专长+专属技能', fs0.name.includes('【') && fs0.perks.some(p=>p.star) && fs0.skills.some(x=>x.star), fs0.name);
assert('已加冕状态 done', fs0.coronation.stage==='done');

console.log('\nPASS '+pass+' / '+(pass+fail));
process.exit(fail>0?1:0);
