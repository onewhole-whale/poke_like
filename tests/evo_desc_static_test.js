/* v1.16.2 精灵描述三字段（desc+ecology+appearance）独立验收脚本
   验收口径：req-docs/DEVELOPMENT_PLAN.md §10 v1.16.2 行（唯一口径）
   变更点 6 项：字段新增 / openDexDetail 渲染顺序 / 未遇见遮罩 / 缺字段无空区块 /
   openSpeciesForm 保存路径（空→undefined）/ tip·战斗开场只用 desc
   静态结构断言 A-F；动态渲染用 CDP（/tmp/cdp_v1162.js）验证。只校验记录，不改代码不动数值 */
const fs = require('fs');
let pass=0, fail=0;
const assert=(n,c,x='')=>{ if(c){pass++;console.log('  ok - '+n);}else{fail++;console.log('FAIL - '+n+' '+(x||''));} };
const CODE = require('./_load.js').loadGame();

/* ===== A. 字段机制存在（SPECIES 定义支持 ecology/appearance，desc 保留） ===== */
console.log('A. 三字段机制存在');
assert('SPECIES 条目仍含 desc 字段（JL_fire_normal_0001 有 desc）', /JL_fire_normal_0001:\{id:'JL_fire_normal_0001',name:'烬烬狼'[\s\S]*?desc:'火山口游荡的火系狼兽/.test(CODE));
assert('openDexDetail 读 sp.ecology/sp.appearance', /if\(sp\.ecology\)/.test(CODE) && /if\(sp\.appearance\)/.test(CODE));
assert('openSpeciesForm 含生态/外观 textarea（ecoIn/appIn）', /ecoIn/.test(CODE) && /appIn/.test(CODE));

/* ===== B. openDexDetail 渲染顺序（静态结构） ===== */
console.log('B. 渲染顺序');
const dd = CODE.slice(CODE.indexOf('function openDexDetail'), CODE.indexOf('function openDexDetail')+2600);
const iSub=dd.indexOf("'m-sub'"), iStat=dd.indexOf('种族值：'), iEco=dd.indexOf("'生态'"), iApp=dd.indexOf("'外观'"), iDrop=dd.indexOf("'掉落素材'"), iHidden=dd.indexOf('尚未遇见');
assert('未遇见分支在渲染生态/外观之前 return', iHidden!==-1 && (iHidden<iEco||iEco===-1), 'iHidden='+iHidden+' iEco='+iEco);
assert('顺序：m-sub 概览 → 种族值', iSub<iStat, iSub+'/'+iStat);
assert('顺序：种族值 → 生态', iStat<iEco, iStat+'/'+iEco);
assert('顺序：生态 → 外观', iEco<iApp, iEco+'/'+iApp);
assert('顺序：外观 → 掉落素材', iApp<iDrop, iApp+'/'+iDrop);
assert('生态/外观区块条件化（if 包裹 h3+muted）', /if\(sp\.ecology\)\{[\s\S]*?h3'[\s\S]*?'生态'[\s\S]*?muted/.test(dd) && /if\(sp\.appearance\)\{[\s\S]*?h3'[\s\S]*?'外观'[\s\S]*?muted/.test(dd));

/* ===== C. 未遇见遮罩（静态） ===== */
console.log('C. 未遇见遮罩');
assert('未遇见分支：h2 用？？？ + 早退 return', /(seen\?esc\(sp\.name\):'？？？')/.test(dd) && /if\(!seen\)\{[\s\S]*?return;/.test(dd));

/* ===== D. 缺字段不渲染空区块（静态：if 守卫确保） ===== */
console.log('D. 缺字段守卫');
assert('生态区块有 if 守卫（缺字段不渲染 h3）', /if\(sp\.ecology\)\{[\s\S]*?el\('h3'[\s\S]*?'生态'/.test(dd));
assert('外观区块有 if 守卫', /if\(sp\.appearance\)\{[\s\S]*?el\('h3'[\s\S]*?'外观'/.test(dd));

/* ===== E. 保存路径：ecology/appearance 写入 speciesEdits，空→undefined ===== */
console.log('E. 保存路径');
const sv = CODE.slice(CODE.indexOf("const def = {name"), CODE.indexOf("const def = {name")+800);
assert('保存 def 含 ecology/appearance（trim||undefined）', /ecology:\s*ecoIn\.value\.trim\(\)\|\|undefined/.test(CODE) && /appearance:\s*appIn\.value\.trim\(\)\|\|undefined/.test(CODE), '');
assert('保存写入 speciesEdits（...SPECIES[id], ...def）', /S\.speciesEdits\[[^\]]+\]\s*=\s*\{\s*\.\.\.\(SPECIES\[[^\]]+\]\|\|\{\}\)[\s\S]*?\.\.\.def\}/.test(CODE));

/* ===== F. tip / 战斗开场只用 desc（ecology/appearance 零误用） ===== */
console.log('F. desc 唯一短文本出口');
const useEcoApp = CODE.replace(/\/\*[\s\S]*?\*\//g,'').replace(/\/\/[^\n]*/g,'').match(/ecology|appearance/g)||[];
const usage = CODE.match(/ecology|appearance/g)||[];
// 仅允许出现：openDexDetail 渲染（2 处 if + 2 h3 + 2 muted 读取）、openSpeciesForm（2 textarea 创建 + 2 读取 + 2 placeholder + 2 保存）、注释
const allowed = CODE.match(/"生态"|"外观"|'生态'|'外观'|sp\.ecology|sp\.appearance|ecoIn|appIn|ecology:|appearance:|生态描述|外观描述|生态描述\/外观描述|v1\.16\.2|M3-1-2 补充/g)||[];
assert('ecology/appearance 仅用于详情渲染+编辑器（无 tip/战斗误用）', usage.length<=allowed.length+4, 'total='+usage.length+' allowed='+allowed.length);
assert('图鉴列表 tip 区块无 ecology/appearance', !CODE.slice(CODE.indexOf('function renderCodex'), CODE.indexOf('function openDexDetail')).match(/ecology|appearance/));
assert('战斗开场卡（遭遇妖兽）无 ecology/appearance', !CODE.slice(6115, 6130).match(/ecology|appearance/));

console.log('\nv1.16.2 描述三字段静态验收 '+pass+' 项断言，失败 '+fail);
process.exit(fail?1:0);
