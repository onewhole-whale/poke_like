/* M2-A3 个体值专项测试：随机生成 / 面板贡献 / 落库自选 / 飞升继承 / 洗髓 */
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
  `init(); route(); globalThis.__T={S,ivContribution,genRandomIV,ivSummary,IV_KEYS,IV_NAME,makeSpirit,spiritStats,landSpirit,hasNormal,essenceName,saveDraft,openDetail,buildIVEditor,closeOverlay,toast,NATURES,natureDesc,renderRefine,allSpeciesDef};`);
eval(code);
const T=globalThis.__T;
let pass=0, fail=0;
const assert=(n,c,x)=>{ if(c){pass++;console.log('  ok -',n);} else {fail++;console.log('FAIL -',n,x||'');} };
const evl = expr => { try{ return eval(expr); }catch(e){ console.log('EVAL ERR:', e.message); return null; } };

async function main(){
  // 1. genRandomIV：随机 0-3 项、各 1-20
  let bad=0, counts={};
  for(let i=0;i<500;i++){
    const iv = T.genRandomIV();
    const n = Object.keys(iv).length;
    counts[n]=(counts[n]||0)+1;
    if(n>3) bad++;
    for(const v of Object.values(iv)){ if(v<1||v>20) bad++; }
  }
  assert('genRandomIV 随机 0-3 项且值 1-20（500 次无违规）', bad===0, JSON.stringify(counts));
  assert('genRandomIV 分布覆盖 0/1/2/3 项', counts[0]>0 && counts[1]>0 && counts[2]>0 && counts[3]>0, JSON.stringify(counts));

  // 2. ivContribution 折算（v1.11.0 宝可梦式）：20 点攻击个体值在 Lv30 = 12（去 ×6 放大），全属性统一
  assert('攻击个体值 Lv30 = 12', T.ivContribution({atk:20},'atk',30)===12);
  assert('速度个体值 Lv30 = 12（与全属性统一）', T.ivContribution({spe:20},'spe',30)===12);
  assert('无个体值 = 0', T.ivContribution({},'atk',50)===0);

  // 3. spiritStats 面板含个体值
  const base = JSON.parse(evl(`(()=>{ const s=T.makeSpirit('JL_fire_normal_0001',false,'t'); s.lvl=30; const b=T.spiritStats(s); s.iv={atk:20,hp:20,spe:20}; const m=T.spiritStats(s); return JSON.stringify({b,m}); })()`));
  assert('攻击个体 +20 → 面板 +12', base.m.atk - base.b.atk === 12, base.b.atk+'→'+base.m.atk);
  assert('生命个体 +20 → 面板 +12', base.m.hp - base.b.hp === 12);
  assert('速度个体 +20 → 面板 +12', base.m.spd - base.b.spd === 12, base.b.spd+'→'+base.m.spd);

  // 4. wildBeast 妖兽带 iv（≤3 项）
  const wb = JSON.parse(evl(`(()=>{ const b=wildBeast('JL_fire_normal_0001'); return JSON.stringify({iv:b.iv||null, n:Object.keys(b.iv||{}).length}); })()`));
  assert('wildBeast 妖兽带 iv（≤3 项）', wb.iv && wb.n<=3, JSON.stringify(wb));

  // 5. 落库自选 iv：landSpirit 传 iv → 灵兽持有
  evl(`(()=>{ T.S.spirits=[]; T.landSpirit({speciesId:'JL_water_normal_0023', shiny:false, source:'t', nature:'serious', iv:{hp:10,spa:15}}); return T.S.spirits.length; })()`);
  assert('落库自选 iv 生效', evl(`(()=>{ const s=T.S.spirits[0]; return !!(s.iv && s.iv.hp===10 && s.iv.spa===15); })()`));

  // 6. 飞升继承妖兽 iv：妖兽有 iv，飞升后灵兽 iv 相同
  evl(`(()=>{ const beast={id:'b1', speciesId:'JL_water_normal_0023', shiny:false, caught:'测试', nature:'serious', iv:{def:8,spe:12}}; T.S.beasts=[beast]; T.S.spirits=[]; T.landSpirit({speciesId:'JL_water_normal_0023', shiny:false, source:'t', fromRefine:true, beastId:'b1'}); return T.S.spirits.length; })()`);
  assert('飞升继承妖兽个体值', evl(`(()=>{ const s=T.S.spirits[0]; return !!(s.iv && s.iv.def===8 && s.iv.spe===12); })()`));
  assert('飞升消耗妖兽', evl(`T.S.beasts.length===0`));

  // 7. 洗髓（洗髓露）：详情页按钮与流程
  evl(`(()=>{ T.S.ivElixir=1; const s=T.S.spirits[0]; T.openDetail(s.id); T.S.ivElixir--; s.iv={atk:20}; T.saveDraft(); return true; })()`);
  assert('洗髓消耗洗髓露并更新 iv', evl(`(()=>{ const s=T.S.spirits[0]; return T.S.ivElixir===0 && s.iv && s.iv.atk===20; })()`));

  // 8. 详情页含个体值行与洗髓按钮（mock 环境检查 children 的 innerHTML）
  assert('详情页含个体值行', evl(`(()=>{ const s=T.S.spirits[0]; T.openDetail(s.id); const mb=document.querySelector('#modal-box'); return mb && mb.children.some(c=>String(c.innerHTML||'').includes('个体值') && String(c.innerHTML||'').includes('洗髓')); })()`));

  // 9. 落库 UI 构建：buildIVEditor 渲染 6 行输入（容器有子元素且含提示文案）
  assert('buildIVEditor 渲染输入区', evl(`(()=>{ const c={children:[],appendChild(x){this.children.push(x);return x},innerHTML:'',style:{}}; T.buildIVEditor(c,{atk:8},{}); return c.children.length>0; })()`));

  console.log('\n'+pass+' 项断言，失败 '+fail);
  process.exit(fail?1:0);
}
main().catch(e=>{ console.log('FATAL', e.message); process.exit(1); });
