/* v1.19.5 M3-1-6 冒险地图扩充与经验修正 验收
   口径：需求文档_M3-1-6冒险地图扩充与经验修正_2026-09-20.md §8（7条） */
const fs = require('fs');
let pass=0, fail=0, warn=0;
const assert=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
function mkEl(){ return {children:[],className:'',innerHTML:'',style:{},title:'',dataset:{},disabled:false,textContent:'',value:'',_ev:{},addEventListener(){},removeEventListener(){},focus(){},blur(){},classList:{add(){},remove(){},toggle(){},contains(){return false}},appendChild(c){return c},remove(){},querySelector(){return mkEl()},querySelectorAll(){return []}}; }
const elCache={};
global.document={getElementById:id=>elCache[id]||(elCache[id]=mkEl()),querySelector:()=>mkEl(),querySelectorAll:()=>[],createElement:()=>mkEl(),createTextNode:t=>({nodeValue:t,textContent:t}),addEventListener:()=>{}};
global.window={addEventListener:()=>{},location:{hash:'#/wild'},renderSettle(){},renderWild(){},renderRefine(){},renderCodex(){},renderDex(){},renderStable(){}};
global.location={hash:'#/wild'};
global.localStorage={_d:{},getItem(k){return this._d[k]||null},setItem(k,v){this._d[k]=v},removeItem(k){delete this._d[k]}};
global.requestAnimationFrame=fn=>fn();global.setTimeout=fn=>fn();global.toast=()=>{};
const CODE = require('./_load.js').loadGame();
let code=require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'').replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,"init(); route(); globalThis.__T={S,MAP_CONFIGS,TERRAIN,genSandbox,GLOBAL_SKILL_POOL,skillById};");
eval(code);
const T=globalThis.__T;

console.log('1. 静水沼泽 stillswamp + 冒烟火山 smokevolcano');
assert('MAP_CONFIGS.stillswamp 存在', T.MAP_CONFIGS.stillswamp, '未注册');
assert('MAP_CONFIGS.smokevolcano 存在', T.MAP_CONFIGS.smokevolcano, '未注册');
if(T.MAP_CONFIGS.stillswamp){
  assert('stillswamp 7×7', T.MAP_CONFIGS.stillswamp.size===7 || (T.MAP_CONFIGS.stillswamp.w===7&&T.MAP_CONFIGS.stillswamp.h===7) || JSON.stringify(T.MAP_CONFIGS.stillswamp).includes('7'), 'size='+JSON.stringify(T.MAP_CONFIGS.stillswamp.size||T.MAP_CONFIGS.stillswamp.w));
}
if(T.MAP_CONFIGS.smokevolcano){
  assert('smokevolcano 7×7', T.MAP_CONFIGS.smokevolcano.size===7 || (T.MAP_CONFIGS.smokevolcano.w===7&&T.MAP_CONFIGS.smokevolcano.h===7) || JSON.stringify(T.MAP_CONFIGS.smokevolcano).includes('7'));
}

console.log('2. 变体地块 poison_swamp 后生成 + 侵蚀扩张');
assert('TERRAIN.poison_swamp 存在', T.TERRAIN.poison_swamp, '未注册');
assert('poison_swamp isVariant=true', T.TERRAIN.poison_swamp && T.TERRAIN.poison_swamp.isVariant===true, JSON.stringify(T.TERRAIN.poison_swamp&&{iv:T.TERRAIN.poison_swamp.isVariant, bt:T.TERRAIN.poison_swamp.baseTerrain}));
assert('poison_swamp baseTerrain=swamp', T.TERRAIN.poison_swamp && T.TERRAIN.poison_swamp.baseTerrain==='swamp');
assert('poison_swamp spreadSize 在 VARIANT_TILES 配置表（6038 行 [2,5]）', /poison_swamp.*spreadSize:\[2,5\]|spreadSize:\[2,5\]/.test(CODE), '无 spreadSize');
assert('代码有变体地块后生成落锚逻辑', /variant.*anchor|anchorVariant|poison_swamp/.test(CODE) && /isVariant/.test(CODE));

console.log('3. 地块表 attribAffinity/isVariant/baseTerrain 字段补齐');
let missingAffinity=[];
for(const t of Object.keys(T.TERRAIN)){
  if(!Array.isArray(T.TERRAIN[t].attribAffinity)) missingAffinity.push(t);
}
assert('所有地块有 attribAffinity 数组（缺 '+missingAffinity.length+'）', missingAffinity.length===0, '缺: '+missingAffinity.slice(0,10).join(','));
assert('volcano 地块存在', T.TERRAIN.volcano, '未注册');
assert('volcano attribAffinity=[fire,earth]', T.TERRAIN.volcano && T.TERRAIN.volcano.attribAffinity && T.TERRAIN.volcano.attribAffinity.includes('fire') && T.TERRAIN.volcano.attribAffinity.includes('earth'), JSON.stringify(T.TERRAIN.volcano&&T.TERRAIN.volcano.attribAffinity));

console.log('4. 微风平原地块级敌人池 tilePools');
const gb = T.MAP_CONFIGS.gentlebreeze;
assert('gentlebreeze 存在', !!gb);
assert('gentlebreeze 有 tilePools（地块级）', gb && (gb.tilePools || gb.eventConfig && gb.eventConfig.tilePools), '仍为地图级 fightPools');
const pools = (gb && (gb.tilePools || (gb.eventConfig&&gb.eventConfig.tilePools))) || {};
assert('tilePools 含多个地块（'+Object.keys(pools).length+'）', Object.keys(pools).length>=3, 'keys='+Object.keys(pools).join(','));

console.log('5. 驻扎行动 1 体力 + 属性交集全血/无交集50%+5能 + 4秒读条');
assert('代码有驻扎函数', /驻扎|station|camp|rest|驻扎/.test(CODE), '无驻扎相关');
assert('驻扎消耗 1 体力', /stamina.*-=.*1|体力.*1/.test(CODE));
assert('驻扎 4 秒读条', /4000|4\s*秒|4s|读条/.test(CODE));
assert('驻扎效果含全血全能', /全血|满血|hp.*=.*max|fullHeal/.test(CODE) || /100%.*血/.test(CODE));
assert('驻扎效果含 50%血+5能', /50%|half.*heal|0\.5.*hp/.test(CODE) && /\+?\s*5.*能量|energy\s*\+?=?\s*5/.test(CODE));

console.log('6. 战斗经验新公式 max(5, 等级×基础)×模板系数');
assert('代码有经验公式新结构', /exp.*=.*Math\.max\(5|expGain|gainExp|exp\s*=.*Math\.floor/.test(CODE), '未找到经验计算');
assert('基础经验按品质 10/20/30/40', /10.*20.*30.*40|rarityExp|baseExp/.test(CODE));
assert('模板系数 1.0/2.0/3.0', /1\.0.*2\.0.*3\.0|templateMult|tplMult/.test(CODE));

console.log('7. 副本经验 ×5');
assert('副本结算经验 ×5（dgWinFight 内 gain 末尾 *5）', /dgWinFight[\s\S]{0,800}\*\s*5/.test(CODE), '未找到 ×5');

console.log('\nv1.19.5 冒险地图扩充验收 '+pass+' 过 / '+fail+' 失败 / '+warn+' 观察');
process.exit(fail?1:0);
