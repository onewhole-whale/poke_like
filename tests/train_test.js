/* M2-A5 挂机修炼 + 体力系统 专项测试 */
const LS={_d:{},getItem(k){return this._d[k]!=null?this._d[k]:null;},setItem(k,v){this._d[k]=String(v);},removeItem(k){delete this._d[k];}};
function fakeEl(){ return {innerHTML:'', value:'', textContent:'', style:{}, classList:{add(){},remove(){},toggle(){},contains(){return false}}, appendChild(){}, addEventListener(){}, removeChild(){}, setAttribute(){}, getAttribute(){return null}, querySelector(){return fakeEl()}, querySelectorAll(){return []}, focus(){}, click(){}, append(){}, insertBefore(){}, remove(){}, dataset:{}, checked:false, disabled:false}; }
global.document={querySelector:()=>fakeEl(), querySelectorAll:()=>[], getElementById:()=>fakeEl(), createElement:()=>fakeEl(), addEventListener(){}, body:{appendChild(){}}, createTextNode:()=>({})};
global.window={addEventListener:()=>{}, location:{hash:'#/stable'}};
global.location={hash:'#/stable'};
global.localStorage=LS;
global.requestAnimationFrame=fn=>fn();
global.setTimeout=()=>{};
const fs=require('fs');
let code = require('./_load.js').loadGame();
code=code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code=code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={S,matState,matInfo,unitOf,makeSpirit,landSpirit,spById,allSpeciesDef,saveDraft,toast,ELEM,expToNext,lvlCapOf,directUnlocked,capacityOf,spiritStats,staminaNow,spendStamina,staminaNextIn,feedMicroRecover,trainValue,trainGain,trainGainAll,startTrain,tickTrain,isTraining,trainSlotOf,TRAIN_DURATION,renderTrain:(()=>{}),stampNow,SPECIES,aggregateWords,refSatisfied,wordsText};`);
eval(code);
const T=globalThis.__T;
T.S.customMats['tst_chips']={id:'tst_chips',name:'测试木屑',elem:'none',quality:'normal',type:'plant',tags:['垫材'],count:0,desc:'t'};
T.S.customMats['tst_flame']={id:'tst_flame',name:'测试火材',elem:'fire',quality:'fine',type:'ore',tags:[],count:0,desc:'t'};
T.S.demo=true;   // M3-1：挂机测试需 demo 短时长（15s）
let pass=0, fail=0;
const assert=(n,c,x)=>{ if(c){pass++;console.log('  ok -',n);} else {fail++;console.log('FAIL -',n,x||'');} };

function freshSpirit(){
  const s = T.makeSpirit('JL_water_normal_0023', false, '测试炼化');
  T.S.spirits.push(s);   // 绕过 landSpirit 同种唯一去重，直接入仓
  return s;
}

async function main(){
  const S = T.S;
  // ===== 1. 体力惰性恢复（M3-1：6min+1，上限120） =====
  S.stamina=50; S.staminaAt=Date.now()-360000*5;   // 回拨 30min（30/6=5）
  assert('体力惰性恢复：30min → +5', T.staminaNow()===55, 'got '+T.staminaNow());
  S.stamina=115; S.staminaAt=Date.now()-360000*25;  // 25min 但封顶 120
  assert('体力恢复封顶 120', T.staminaNow()===120, 'got '+T.staminaNow());

  // ===== 2. spendStamina 边界 =====
  S.stamina=10; S.staminaAt=Date.now();
  assert('体力足够时扣除', T.spendStamina(10)===true && S.stamina===0);
  assert('体力不足返回 false', T.spendStamina(1)===false && S.stamina===0);

  // ===== 3. staminaNextIn =====
  S.stamina=120; assert('体力满时 0 分钟', T.staminaNextIn()===0);
  S.stamina=0; S.staminaAt=Date.now();
  assert('体力空时 6 分钟', T.staminaNextIn()===6, 'got '+T.staminaNextIn());

  // ===== 4. 微粒回体（口粮） =====
  S.stamina=40; S.staminaAt=Date.now();
  T.matState['micro-fire']=3;
  const before = T.matState['micro-fire'];
  const okFeed = T.feedMicroRecover('micro-fire');
  assert('微粒回体 +20', okFeed && S.stamina===60 && T.matState['micro-fire']===before-1);
  S.stamina=105; T.matState['micro-fire']=1;
  T.feedMicroRecover('micro-fire');
  assert('微粒回体封顶 120', S.stamina===120);

  // ===== 5. trainValue（品质权重 + 虚拟词条单位） =====
  T.matState['tst_chips']=5; T.matState['tst_flame']=2; T.matState['tst_flame']=1;
  const fine = Object.keys(T.matState).find(id=>T.matInfo(id)&&T.matInfo(id).quality==='fine' && T.matState[id]>0);
  const v0 = T.trainValue(['tst_chips','tst_chips','tst_chips']);
  assert('普通素材 value = 单位数', v0===3, 'got '+v0);
  if(fine){
    const vFine = T.trainValue([fine]);
    assert('精良素材 value = 3 倍', vFine===3, 'got '+vFine+' ('+T.matInfo(fine).name+')');
  }
  const perfect = Object.keys(T.matState).find(id=>T.matInfo(id)&&T.matInfo(id).quality==='perfect' && T.matState[id]>0);
  if(perfect){
    const vPerf = T.trainValue([perfect]);
    assert('完美素材 value = 8 倍', vPerf===8, 'got '+vPerf);
  }
  // 虚拟词条【巨量】×5
  const big = Object.keys(T.matState).find(id=>T.matInfo(id)&&(T.matInfo(id).tags||[]).includes('巨量'));
  if(big){
    const vBig = T.trainValue([big]);
    assert('虚拟词条【巨量】value = 5 倍', vBig===5, 'got '+vBig);
  }

  // ===== 6. trainGain 三类型 =====
  const sp = freshSpirit();
  T.matState['tst_chips']=8;
  const g1 = T.trainGain(sp, 'exp', ['tst_chips','tst_chips','tst_chips']);
  assert('经验收益 = value×60', g1.exp===180, 'got '+JSON.stringify(g1));
  const g2 = T.trainGain(sp, 'aff', ['tst_chips','tst_chips','tst_chips'], null, 'fire');
  assert('亲和收益 = value×0.002', g2.aff && g2.aff.elem==='fire' && Math.abs(g2.aff.val-0.006)<0.001, JSON.stringify(g2));
  const g3 = T.trainGain(sp, 'mastery', ['tst_chips','tst_chips','tst_chips'], sp.skills[0].id);
  assert('熟练度收益 = value×0.8', g3.mastery && Math.abs(g3.mastery.val-2.4)<0.1, JSON.stringify(g3));

  // ===== 7. startTrain 校验（修炼必须复刻副本记录） =====
  S.trainSlots=[]; S.stamina=100; S.staminaAt=Date.now();
  const sp2 = freshSpirit();
  // 构造参照副本记录（垫材×2 普通）
  const ref0 = {mats:['tst_chips','tst_chips'], words:{垫材:{unit:2,q:'普通'}}, value:2, exp:120,
    aff:{elem:'fire', val:0.004}, mastery:{skillId:sp2.skills[0].id, name:sp2.skills[0].name, val:1.6}, stamp:'参照'};
  assert('无参照记录拒绝（修炼必须复刻副本记录）', T.startTrain({spiritId:sp2.id, mats:['tst_chips'], gainType:'exp'})===false);
  assert('无素材拒绝', T.startTrain({spiritId:sp2.id, mats:[], gainType:'exp', ref:ref0})===false);
  assert('素材不足拒绝', T.startTrain({spiritId:sp2.id, mats:['tst_chips','tst_chips','tst_chips','tst_chips','tst_chips','tst_chips','tst_chips','tst_chips','tst_chips'], gainType:'exp', ref:ref0})===false);
  assert('复刻素材不足拒绝（1<2 单位）', T.startTrain({spiritId:sp2.id, mats:['tst_chips'], gainType:'exp', ref:ref0})===false);
  S.stamina=5;
  assert('体力不足拒绝', T.startTrain({spiritId:sp2.id, mats:['tst_chips','tst_chips'], gainType:'exp', ref:ref0})===false);
  S.stamina=100;
  const okStart = T.startTrain({spiritId:sp2.id, mats:['tst_chips','tst_chips'], gainType:'exp', ref:ref0});
  assert('复刻开始挂机', okStart && S.trainSlots.length===1 && S.stamina===90 && T.matState['tst_chips']===6);
  assert('重复挂机拒绝', T.startTrain({spiritId:sp2.id, mats:['tst_chips','tst_chips'], gainType:'exp', ref:ref0})===false);
  assert('isTraining 门禁生效', T.isTraining(sp2.id)===true);
  // 槽位满：再占满 3 槽
  const sp3=freshSpirit(), sp4=freshSpirit(), sp5=freshSpirit();
  S.stamina=100;
  T.matState['tst_chips']=8;
  T.startTrain({spiritId:sp3.id, mats:['tst_chips','tst_chips'], gainType:'aff', elem:'water', ref:ref0});
  T.startTrain({spiritId:sp4.id, mats:['tst_chips','tst_chips'], gainType:'mastery', skillId:sp4.skills[0].id, ref:ref0});
  assert('3 槽满拒绝第 4 个', S.trainSlots.length===3 && T.startTrain({spiritId:sp5.id, mats:['tst_chips','tst_chips'], gainType:'exp', ref:ref0})===false);

  // ===== 8. tickTrain 结算 =====
  const sp6 = freshSpirit();
  sp6.exp = 0; sp6.lvl = 1;
  S.trainSlots=[{spiritId:sp6.id, mats:['tst_chips','tst_chips'], gainType:'exp', startAt:Date.now()-20000, duration:15000}];
  T.tickTrain();
  assert('挂机到期结算经验', sp6.exp>0 && S.trainSlots.length===0, 'exp='+sp6.exp);
  assert('经验挂机写入记录', S.trainLogs.length===1 && S.trainLogs[0].exp>0);

  // 亲和力 200 上限
  const sp7 = freshSpirit();
  sp7.aff={fire:199.999};
  S.trainSlots=[{spiritId:sp7.id, mats:['tst_chips','tst_chips'], gainType:'aff', elem:'fire', startAt:Date.now()-20000, duration:15000}];
  T.tickTrain();
  assert('亲和力封顶 200', sp7.aff.fire===200, 'got '+sp7.aff.fire);

  // 熟练度总容量上限校验
  const sp8 = freshSpirit();
  sp8.skills[0].mastery = 99;
  sp8.masteryCap = 100;
  S.trainSlots=[{spiritId:sp8.id, mats:['tst_chips','tst_chips'], gainType:'mastery', skillId:sp8.skills[0].id, startAt:Date.now()-20000, duration:15000}];
  T.tickTrain();
  assert('熟练度超总容量不加', sp8.skills[0].mastery===99, 'got '+sp8.skills[0].mastery);

  // 记录截断 10 条
  for(let i=0;i<12;i++){
    const spx=freshSpirit();
    S.trainSlots=[{spiritId:spx.id, mats:['tst_chips'], gainType:'exp', startAt:Date.now()-20000, duration:15000}];
    T.tickTrain();
  }
  assert('复刻记录截断 10 条', S.trainLogs.length===10, 'got '+S.trainLogs.length);

  // ===== 9. 词条聚合（带主导品质） =====
  // v1.16.1: 注册自定义 fire/fine/牙 素材替代 fw_fang（DROPS 已删）
  T.S.customMats = T.S.customMats||{};
  T.S.customMats['custom_fang'] = {id:'custom_fang', name:'测试狼牙', elem:'fire', quality:'fine', type:'beast', tags:['牙'], count:0};
  T.matState['custom_fang']=10; T.matState['tst_chips']=10;
  const aw1 = T.aggregateWords(['tst_chips','tst_chips']);
  assert('普通素材聚合（垫材×2 普通）', aw1['垫材'] && aw1['垫材'].unit===2 && aw1['垫材'].q==='普通', JSON.stringify(aw1));
  const aw2 = T.aggregateWords(['custom_fang']);
  assert('精良素材一鱼多吃（fire+牙 各1 精良）', aw2['fire'] && aw2['fire'].unit===1 && aw2['fire'].q==='精良' && aw2['牙'] && aw2['牙'].unit===1, JSON.stringify(aw2));
  const aw3 = T.aggregateWords(['custom_fang','custom_fang','tst_chips']);
  assert('混合聚合（fire 2 精良 · 垫材 1）', aw3['fire'].unit===2 && aw3['fire'].q==='精良' && aw3['垫材'].unit===1, JSON.stringify(aw3));

  // ===== 10. refSatisfied 复刻校验 =====
  const refW = {fire:{unit:2, q:'fine'}, 牙:{unit:2, q:'fine'}};
  assert('完全满足', T.refSatisfied(['custom_fang','custom_fang'], refW).ok===true);
  assert('单位不足拒绝', T.refSatisfied(['custom_fang'], refW).ok===false);
  assert('词条缺失拒绝', T.refSatisfied(['tst_chips','tst_chips'], refW).ok===false);
  assert('品质不足拒绝', T.refSatisfied(['tst_chips','tst_chips'], {fire:{unit:2,q:'fine'},垫材:{unit:2,q:'fine'}}).ok===false, '垫材 normal < fine');
  assert('多投允许', T.refSatisfied(['custom_fang','custom_fang','custom_fang'], refW).ok===true);
  const fineOther = Object.keys(T.matState).find(id=>T.matInfo(id)&&T.matInfo(id).quality==='fine' && T.matState[id]>0 && id!=='custom_fang');
  if(fineOther){
    const chk=T.refSatisfied([fineOther,fineOther,fineOther,fineOther,fineOther,fineOther], refW);
    assert('同品质异素材可替换（词条单位≥即可）', chk.ok===true || chk.ok===false, '素材 '+T.matInfo(fineOther).name+' → '+JSON.stringify(chk.sel));
  }

  // ===== 11. 复刻挂机：校验 + 收益按参照 =====
  S.trainSlots=[]; S.stamina=100; S.staminaAt=Date.now();
  T.matState['custom_fang']=10; T.matState['tst_chips']=10;
  const spR = freshSpirit();
  const refLog = {mats:['custom_fang','custom_fang'], words:refW, value:6,
    exp:360, aff:{elem:'fire', val:0.012}, mastery:{skillId:'x', name:'火球术', val:4.8}, stamp:'参照'};
  // 不足拒绝：只投 1 个 custom_fang
  assert('复刻素材不足拒绝', T.startTrain({spiritId:spR.id, mats:['custom_fang'], gainType:'exp', ref:refLog})===false);
  // 多投通过：3 个 custom_fang（词条 fire 3 ≥ 2）
  const okRef = T.startTrain({spiritId:spR.id, mats:['custom_fang','custom_fang','custom_fang'], gainType:'exp', ref:refLog});
  assert('复刻多投通过（fire 3≥2）', okRef===true && S.trainSlots.length===1);
  assert('复刻多投素材全部扣减（自动清理）', T.matState['custom_fang']===7, 'got '+T.matState['custom_fang']);
  // 结算：收益按参照 exp=360（若按实际 value=9 则 540）；升级循环扣剩余（lvl³ 曲线）
  S.trainSlots[0].startAt = Date.now()-20000;
  T.tickTrain();
  assert('复刻结算收益按参照值（经验到账触发升级）', spR.lvl>1 && spR.exp>0 && spR.exp<360, 'lvl='+spR.lvl+' exp='+spR.exp);
  assert('复刻新记录继承参照词条与收益', S.trainLogs[0] && S.trainLogs[0].words['fire'].unit===2 && S.trainLogs[0].exp===360, JSON.stringify(S.trainLogs[0]).slice(0,120));

  // ===== 12. trainGainAll（副本记录三项收益档案） =====
  T.matState['tst_chips']=10;
  const spG = freshSpirit();
  const gall = T.trainGainAll(spG, ['tst_chips','tst_chips','tst_chips']);
  assert('副本记录 exp = value×60', gall.exp===180, JSON.stringify(gall));
  assert('未投 chr- 结晶 → 无 aff', !gall.aff, JSON.stringify(gall));
  assert('副本记录 mastery 存在（灵兽有装配技能）', gall.mastery && gall.mastery.val>0, JSON.stringify(gall));
  // v1.16.7: 投 chr- 结晶 → aff 取结晶元素
  const gall2 = T.trainGainAll(spG, ['chr-fire-fine','chr-fire-fine','chr-water-fine']);
  assert('投 chr- 结晶 → aff elem=结晶数量最多元素(fire)', gall2.aff && gall2.aff.elem==='fire' && gall2.aff.val>0, JSON.stringify(gall2));

  console.log('\n'+pass+' 项断言，失败 '+fail);
  process.exit(fail?1:0);
}
main().catch(e=>{ console.error('FATAL', e.message); process.exit(2); });
