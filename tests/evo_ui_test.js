/* M2-B 普通进化机制 · UI 验收测试（CDP 真实浏览器）
   覆盖（验收标准 §8 ⑤⑦ + UI 细节）：
   ⑦ 灵兽仓详情页进化面板：按钮高亮/置灰、缺条件提示含当前值、确认弹窗含目标/品级/种族值对比、确认后结算并重渲染
   ⑤ 管理端 openSpeciesForm：customSpecies（新增精灵配进化）与 speciesEdits（编辑内置改进化）两条路径保存生效
   图鉴：进化→ 目标名（条件文案）金色展示
   飞升承接：无关妖兽 UI 拒绝 toast + log
   依赖：http://127.0.0.1:8765 + CDP 9334 */
const { execSync } = require('child_process');
const sleep = ms => new Promise(r=>setTimeout(r,ms));
async function main(){
  const list = JSON.parse(execSync(`curl -s http://127.0.0.1:9334/json`).toString());
  const page = list.find(p=>p.type==='page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id=0; const pending={};
  ws.onmessage = ev=>{ const m=JSON.parse(ev.data); if(m.id&&pending[m.id]){pending[m.id](m);delete pending[m.id];} };
  const send=(method,params={})=>new Promise(res=>{const i=++id;pending[i]=res;ws.send(JSON.stringify({id:i,method,params}));});
  await new Promise(r=>ws.onopen=r);
  await send('Page.enable'); await send('Runtime.enable');
  let pass=0, fail=0;
  const check=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
  const boot = async hash => {
    await send('Page.navigate',{url:'http://127.0.0.1:8765/spirit-refinery/index.html?r='+Date.now()+Math.random()+hash});
    await sleep(1400);
    await send('Runtime.evaluate',{expression:"localStorage.clear(); location.reload();",returnByValue:true});
    await sleep(1800);
  };
  const ev = async expr => { const r=await send('Runtime.evaluate',{expression:expr,returnByValue:true}); if(r.result&&r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception.description); return r.result&&r.result.result?r.result.result.value:undefined; };

  /* ========== ⑦ 详情页进化面板 + 确认弹窗 + 结算 ========== */
  console.log('⑦ UI：详情页进化面板');
  await boot('#/stable');
  await ev(`(()=>{ S.spirits=[makeSpirit('JL_fire_normal_0001',false,'测试')]; const s=S.spirits[0]; s.lvl=30; s.aff={fire:60}; s.iv={atk:12,hp:8}; s.nature='bold'; location.hash='#/stable'; route(); })()`);
  // v1.16.5: 旧 flame 已删，注册临时 fire/fine 素材供 mat 进化条件测试
  await ev(`S.customMats['flame']={id:'flame',name:'测试火材',elem:'fire',quality:'fine',type:'ore',tags:[],count:0,desc:'t'}; S.customMats['tst_water']={id:'tst_water',name:'测试水材',elem:'water',quality:'fine',type:'ore',tags:[],count:0,desc:'t'}; S.customMats['tst_fire_n']={id:'tst_fire_n',name:'测试火材普通',elem:'fire',quality:'normal',type:'plant',tags:[],count:0,desc:'t'};`);
  await sleep(300);
  const spid = await ev(`S.spirits[0].id`);
  await ev(`openDetail('${spid}')`); await sleep(300);
  const boxTxt = await ev(`document.getElementById('modal-box').innerText`);
  check('详情弹窗含「灵兽进化」面板', boxTxt.includes('灵兽进化'));
  check('进化条件文案含当前值对比（现30）', boxTxt.includes('现30'), boxTxt.slice(0,400));
  check('进化条件文案含需求值（Lv≥30）', boxTxt.includes('Lv≥30'));
  check('进化面板含种族值对比（→）', boxTxt.includes('→') && boxTxt.includes('HP'));
  // 条件满足 → 高亮按钮（v1.16 mat 条件：注入火系素材）
  await ev(`(()=>{ const s=S.spirits[0]; s.iv={atk:31}; s.nature='hardy'; for(const k in matState) delete matState[k]; matState['flame']=15; matState['tst_fire_n']=15; openDetail('${spid}'); })()`); await sleep(300);
  const btnOk = await ev(`(()=>{ const b=[...document.querySelectorAll('#modal-box button')].find(x=>x.innerText.includes('进化 →')); return b?{txt:b.innerText, dis:b.disabled, cls:b.className}:null; })()`);
  check('条件满足：按钮高亮且可用', btnOk && btnOk.dis===false && btnOk.cls.includes('primary'), JSON.stringify(btnOk));
  // 条件不满足 → 置灰 + 缺条件提示
  await ev(`(()=>{ const s=S.spirits[0]; s.lvl=20; s.aff={fire:50}; openDetail('${spid}'); })()`); await sleep(300);
  const btnNo = await ev(`(()=>{ const b=[...document.querySelectorAll('#modal-box button')].find(x=>x.innerText==='条件未达成'); return b?{dis:b.disabled, title:b.title}:null; })()`);
  check('条件不满足：按钮置灰', btnNo && btnNo.dis===true, JSON.stringify(btnNo));
  check('条件不满足：title 提示「尚缺」含当前值对比', btnNo && btnNo.title.includes('尚缺') && btnNo.title.includes('现20') && btnNo.title.includes('Lv≥30'), JSON.stringify(btnNo));
  // 恢复满足 → 点进化 → 确认弹窗（v1.16 mat 条件：注入火系素材）
  await ev(`(()=>{ const s=S.spirits[0]; s.lvl=30; s.aff={fire:60}; s.iv={atk:31}; s.nature='hardy'; for(const k in matState) delete matState[k]; matState['flame']=15; matState['tst_fire_n']=15; openDetail('${spid}'); })()`); await sleep(300);
  await ev(`(()=>{ [...document.querySelectorAll('#modal-box button')].find(x=>x.innerText.includes('进化 →')).click(); })()`); await sleep(300);
  const cfTxt = await ev(`document.getElementById('modal-box').innerText`);
  check('确认弹窗标题「进化确认」', cfTxt.includes('进化确认'));
  check('确认弹窗含目标形态与品级（老烬 精英）', cfTxt.includes('老烬') && cfTxt.includes('精英'));
  check('确认弹窗含当前面板', cfTxt.includes('当前面板'));
  check('确认弹窗含进化后面板', cfTxt.includes('进化后面板'));
  check('确认弹窗含进化条件', cfTxt.includes('进化条件'));
  check('确认弹窗含保留说明（个体值/性格/专长）', cfTxt.includes('个体值') && cfTxt.includes('性格') && cfTxt.includes('专长'));
  // 点确认 → 结算
  await ev(`(()=>{ [...document.querySelectorAll('#modal-box button')].find(x=>x.innerText==='确认进化').click(); })()`); await sleep(400);
  const after = JSON.parse(await ev(`(()=>{ const s=S.spirits[0]; return JSON.stringify({sid:s.speciesId,name:s.name,lvl:s.lvl,iv:s.iv,nature:s.nature,log:s.log&&s.log[0],atk:spiritStats(s).atk}); })()`));
  check('确认后 speciesId=JL_fire_elite_0002', after.sid==='JL_fire_elite_0002', JSON.stringify(after));
  check('确认后 name=老烬', after.name==='老烬');
  check('确认后 lvl/iv/nature 保留', after.lvl===30 && after.iv.atk===31 && after.nature==='hardy');
  check('确认后 log 追加进化', after.log && after.log.includes('进化：烬烬狼 → 老烬'), after.log);
  check('确认后面板攻击提升', after.atk>0);
  await ev(`closeOverlay()`);

  /* ========== 图鉴：进化→ 目标名（条件文案） ========== */
  console.log('图鉴进化链展示');
  await ev(`location.hash='#/codex'; route();`); await sleep(400);
  const codexTxt = await ev(`document.getElementById('codex-species').innerText`);
  check('图鉴物种行含进化→目标（老烬）', codexTxt.includes('进化→老烬'), String(codexTxt).slice(0,200));
  check('图鉴行不堆放长条件文案（v1.16.7 收口）', !codexTxt.includes('Lv≥30') && !codexTxt.includes('火亲和≥60'));

  /* ========== ⑤ 管理端 speciesEdits 路径 ========== */
  console.log('⑤ 管理端：speciesEdits 路径');
  await boot('#/codex');
  // boot 会 reload，重新注册临时素材
  await ev(`S.customMats['flame']={id:'flame',name:'测试火材',elem:'fire',quality:'fine',type:'ore',tags:[],count:0,desc:'t'}; S.customMats['tst_water']={id:'tst_water',name:'测试水材',elem:'water',quality:'fine',type:'ore',tags:[],count:0,desc:'t'}; S.customMats['tst_fire_n']={id:'tst_fire_n',name:'测试火材普通',elem:'fire',quality:'normal',type:'plant',tags:[],count:0,desc:'t'};`);
  await ev(`openSpeciesForm('JL_fire_normal_0001')`); await sleep(300);
  // v1.16：网状进化（evoToBranches）。把第一个分支目标改为 JL_water_elite_0024 + 条件改为 lvl30（保留 aff60+mat）
  const setEvo = await ev(`(()=>{
    const box=document.getElementById('modal-box');
    const list=box.querySelector('.evo-admin-list');
    if(!list) return 'no-evo-list';
    const tgt=list.querySelector('select');
    tgt.value='JL_water_elite_0024'; tgt.dispatchEvent(new Event('change'));
    const rows=list.querySelectorAll('.evo-cond-row');
    const vIn=rows[0].querySelector('input[type=number]');
    vIn.value='30'; vIn.dispatchEvent(new Event('input'));
    return JSON.stringify({tgt:tgt.value, rows:list.querySelectorAll('.evo-cond-row').length});
  })()`);
  check('openSpeciesForm 进化目标下拉可改（JL_water_elite_0024）', setEvo.includes('JL_water_elite_0024'), setEvo);
  await ev(`(()=>{ [...document.querySelectorAll('#modal-box button')].find(x=>x.innerText==='保存').click(); })()`); await sleep(400);
  const editSaved = JSON.parse(await ev(`(()=>{ const e=S.speciesEdits['JL_fire_normal_0001']; const br=(e&&(e.evoToBranches||(e.evoTo?[{to:e.evoTo,cond:e.evoCond||[]}]:[])))||[]; return JSON.stringify({br:br.map(b=>b.to), lv:(br[0]&&(br[0].cond||[]).find(c=>c.type==='lvl')||{}).v||null}); })()`));
  check('保存写 S.speciesEdits（分支含 JL_water_elite_0024）', editSaved && editSaved.br.includes('JL_water_elite_0024'), JSON.stringify(editSaved));
  const eff = JSON.parse(await ev(`(()=>{ const fw=makeSpirit('JL_fire_normal_0001',false,'t'); fw.lvl=30; fw.aff={fire:60,water:80}; fw.iv={atk:31}; fw.nature='hardy'; for(const k in matState) delete matState[k]; matState['flame']=15; matState['tst_water']=15; matState['tst_fire_n']=15; return JSON.stringify({mu:matUnitSum('fire',0), hasCM:!!S.customMats['tst_fire_n'], mi:!!matInfo('tst_fire_n'), keys:Object.keys(matState), branches:canEvolve(fw).map(b=>({to:b.to,ok:b.ok,why:b.why}))}); })()`));
  check('speciesEdits 保存后实际生效（Lv30+素材 可进化 JL_water_elite_0024）', (eff.branches||[]).some(b=>b.to==='JL_water_elite_0024'&&b.ok===true), JSON.stringify(eff));
  await ev(`delete S.speciesEdits['JL_fire_normal_0001']; saveDraft();`);

  /* ========== ⑤ 管理端 customSpecies 路径 ========== */
  console.log('⑤ 管理端：customSpecies 路径（新增精灵配进化）');
  await ev(`openSpeciesForm(null)`); await sleep(300);
  // 新增精灵初始无分支 → 先点「+ 添加进化分支」
  const mkNew = await ev(`(()=>{
    const box=document.getElementById('modal-box');
    const nameIn=box.querySelector('input[placeholder="精灵名称"]');
    nameIn.value='测试进化兽'; nameIn.dispatchEvent(new Event('input'));
    const addBtn=[...box.querySelectorAll('button')].find(x=>x.innerText==='+ 添加进化分支');
    if(!addBtn) return 'no-add-btn';
    addBtn.click();
    const list=box.querySelector('.evo-admin-list');
    const tgt=list.querySelector('select');
    tgt.value='JL_fire_elite_0002'; tgt.dispatchEvent(new Event('change'));
    const vIn=list.querySelector('input[type=number]');
    vIn.value='10'; vIn.dispatchEvent(new Event('input'));
    return JSON.stringify({name:nameIn.value,tgt:tgt.value,v:vIn.value,rows:list.querySelectorAll('.evo-cond-row').length});
  })()`);
  check('新增精灵表单：名称+添加分支+目标+条件可填', mkNew.includes('测试进化兽') && mkNew.includes('JL_fire_elite_0002'), mkNew);
  await ev(`(()=>{ [...document.querySelectorAll('#modal-box button')].find(x=>x.innerText==='保存').click(); })()`); await sleep(400);
  const customSaved = JSON.parse(await ev(`(()=>{ const k=Object.keys(S.customSpecies).find(k=>k.startsWith('custom_')); const c=S.customSpecies[k]; return JSON.stringify(k?{id:c.id,to:c.evoTo,cond:c.evoCond}:null); })()`));
  check('新增精灵入 S.customSpecies（含 evoTo=JL_fire_elite_0002）', customSaved && customSaved.to==='JL_fire_elite_0002', JSON.stringify(customSaved));
  check('新增精灵 evoCond=[{lvl,10}]', customSaved && customSaved.cond && customSaved.cond.length===1 && customSaved.cond[0].type==='lvl' && customSaved.cond[0].v===10, JSON.stringify(customSaved));
  const cEff = JSON.parse(await ev(`(()=>{ const id=Object.keys(S.customSpecies)[0]; const s=makeSpirit(id,false,'t'); s.lvl=10; return JSON.stringify(canEvolve(s).map(b=>({to:b.to,ok:b.ok}))); })()`));
  check('customSpecies 路径实际生效（Lv10 新兽可进化到 JL_fire_elite_0002）', cEff.length===1 && cEff[0].to==='JL_fire_elite_0002' && cEff[0].ok===true, JSON.stringify(cEff));
  const cLow = JSON.parse(await ev(`(()=>{ const id=Object.keys(S.customSpecies)[0]; const s=makeSpirit(id,false,'t'); s.lvl=9; return JSON.stringify(canEvolve(s).map(b=>b.ok)); })()`));
  check('Lv9 新兽不满足（阈值生效）', cLow[0]===false, JSON.stringify(cLow));
  await ev(`Object.keys(S.customSpecies).forEach(k=>delete S.customSpecies[k]); saveDraft();`);

  /* ========== ⑥ 飞升承接 UI：无关妖兽拒绝 toast + log ========== */
  console.log('⑥ 飞升承接 UI 校验');
  await boot('#/refine');
  await ev(`(()=>{ S.spirits=[]; S.beasts=[{id:'b_x',speciesId:'JL_water_normal_0023',shiny:false,caught:'测试',nature:'serious',iv:{}}]; })()`);
  await ev(`landSpirit({speciesId:'JL_fire_elite_0002',shiny:false,source:'t',beastId:'b_x'})`); await sleep(300);
  const uiState = JSON.parse(await ev(`(()=>{ const t=document.querySelector('.toast, #toast'); return JSON.stringify({spirits:S.spirits.length, beasts:S.beasts.length, log:S.logs[0]?S.logs[0].text:''}); })()`));
  check('无关妖兽 UI 拒绝：灵兽未入仓', uiState.spirits===0, JSON.stringify(uiState));
  check('无关妖兽 UI 拒绝：妖兽未消耗', uiState.beasts===1);
  check('无关妖兽 UI 拒绝：log 记录失败原因', uiState.log && uiState.log.includes('飞升承接失败') && uiState.log.includes('进化链上游'), uiState.log);

  console.log(`\nUI 验收 PASS ${pass} / ${pass+fail}`);
  process.exit(fail?1:0);
}
main().catch(e=>{console.error('ERR',e.stack||e.message);process.exit(1);});
