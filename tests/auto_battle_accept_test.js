/* 自动战斗：血蓝瓶 + 回能策略 */
const {loadGame} = require('./_load.js');
let pass=0, fail=0;
const assert=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
function mkEl(){
  const e={children:[],className:'',innerHTML:'',style:{},dataset:{},disabled:false,textContent:'',value:'',
    classList:{add(){},remove(){},toggle(){},contains(){return false}},
    appendChild(c){this.children.push(c);return c},remove(){},querySelector(){return mkEl()},querySelectorAll(){return []},
    addEventListener(){},removeEventListener(){},setAttribute(){},getAttribute(){return null}};
  return e;
}
global.document={body:mkEl(),querySelector:()=>mkEl(),querySelectorAll:()=>[],getElementById:()=>mkEl(),createElement:()=>mkEl(),addEventListener(){}};
global.window={addEventListener(){},location:{hash:'',href:''}};
global.location=window.location;
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=String(v)},removeItem(k){delete this._d[k]}};
global.requestAnimationFrame=fn=>fn();
global.setTimeout=()=>{};
let code=loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  "init(); route(); globalThis.__T={S:S,makeSpirit:makeSpirit,wildBeast:wildBeast,applyTemplate:applyTemplate,startBattle:startBattle,pickAutoBattleSkill:pickAutoBattleSkill,pickAutoBattleAction:pickAutoBattleAction,expectSkillDamage:expectSkillDamage,skillById:skillById,skillUsable:skillUsable,SKILLS:SKILLS};");
(0,eval)(code);
const T=globalThis.__T;
const sp=T.makeSpirit('JL_fire_normal_0001',false,'t'); sp.lvl=10;
T.S.spirits=[sp]; T.S.wild.spiritId=sp.id; T.S.sessionLive=true;
T.S.autoCfg={useHpPotion:true,useMpPotion:true,regenStrategy:'noAttack'};
T.S.toolInv={'DJ_none_002020':2,'DJ_none_002021':2};
const beast=T.applyTemplate(T.wildBeast('JL_water_normal_0023',5),'normal');
T.startBattle(beast,'normal',[]);
const b=T.S.wild.battle;

b.spHp=Math.floor(b.spMax*0.4);
let act=T.pickAutoBattleAction(sp,b);
assert('低血优先血瓶', act.kind==='item' && act.id==='DJ_none_002020', JSON.stringify(act));
b.spHp=b.spMax;

// 只挂高能耗伤害技，能量 0 → 应喝蓝瓶
let costly=null;
Object.keys(T.SKILLS).forEach(k=>{
  (T.SKILLS[k]||[]).forEach(s=>{
    if(s && (s.power||0)>0 && (s.energy||0)>=4) costly=s;
  });
});
assert('找到高能耗测试技', !!costly, 'none');
const bakSkills=sp.skills;
sp.skills=[{id:costly.id, mastery:50}];
T.S.autoCfg.useHpPotion=false;
T.S.autoCfg.useMpPotion=true;
b.energy=0;
act=T.pickAutoBattleAction(sp,b);
assert('最大技不够能耗时尝试蓝瓶', act.kind==='item' && act.id==='DJ_none_002021', JSON.stringify(act)+' sk='+costly.id+' e='+costly.energy);

T.S.autoCfg.useMpPotion=false;
T.S.autoCfg.regenStrategy='maxSkill';
act=T.pickAutoBattleAction(sp,b);
assert('maxSkill+无蓝瓶 → 回能', act.kind==='skill' && act.id==='regen', JSON.stringify(act));

sp.skills=[];
T.S.autoCfg.regenStrategy='noAttack';
assert('技能池空 → 回能', T.pickAutoBattleSkill(sp,b)==='regen');
sp.skills=bakSkills;

b.energy=10;
const pick=T.pickAutoBattleSkill(sp,b);
const sk=T.skillById(pick);
assert('有能量打伤害技', pick && pick!=='regen', pick);
assert('选中技有威力', sk && (sk.power||0)>0, sk&&sk.name);

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
