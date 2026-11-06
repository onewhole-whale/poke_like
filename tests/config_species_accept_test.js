/* 配置物种 id 验收：data/overworld、events、refine 与测试/源码引用的 JL_* 必须存在于 SPECIES */
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname, '..');
let pass = 0, fail = 0;
const assert = (n, c, x='')=>{ if(c){ pass++; console.log('  ok - '+n); } else { fail++; console.log('FAIL - '+n+' '+(x||'')); } };

const speciesSrc = fs.readFileSync(path.join(root, 'data/species.js'), 'utf8');
const speciesIds = new Set([...speciesSrc.matchAll(/^\s*(JL_[\w]+)\s*:/gm)].map(x=>x[1]));
assert('SPECIES 含 JL_ 键', speciesIds.size >= 100, 'count='+speciesIds.size);

const re = /\b(JL_[A-Za-z0-9_]+)\b/g;
function collectFrom(rel){
  const p = path.join(root, rel);
  if(!fs.existsSync(p)) return [];
  const t = fs.readFileSync(p, 'utf8');
  const found = new Set();
  let m; while((m = re.exec(t))) found.add(m[1]);
  return [...found].filter(id => !speciesIds.has(id));
}

const prodFiles = [
  'data/overworld.js',
  'data/events.js',
  'src/sim/refine.js',
  'src/sim/wild-spawn.js',
  'src/sim/growth.js',
  'src/sim/furnace.js',
  'src/sim/sandbox.js',
  'src/sim/event-battle.js',
];
const prodBad = [];
prodFiles.forEach(f=>{
  collectFrom(f).forEach(id=> prodBad.push(f+':'+id));
});
assert('生产配置无假 JL_ 物种 id', prodBad.length===0, prodBad.slice(0,12).join('; '));
assert('无 JL_grass_* 残留（overworld）', !fs.readFileSync(path.join(root,'data/overworld.js'),'utf8').includes('JL_grass_'));

const testBad = [];
function walkTests(d){
  for(const ent of fs.readdirSync(d, {withFileTypes:true})){
    const p = path.join(d, ent.name);
    if(ent.isDirectory()) walkTests(p);
    else if(/\.js$/.test(ent.name) && ent.name !== 'config_species_accept_test.js'){
      const rel = path.relative(root, p);
      collectFrom(rel).forEach(id=> testBad.push(rel+':'+id));
    }
  }
}
walkTests(path.join(root, 'tests'));
walkTests(path.join(root, 'acceptance'));
assert('tests/acceptance 无假 JL_ 物种 id', testBad.length===0, testBad.slice(0,12).join('; '));

// wildBeast 无效 id 必须连 speciesId 一并回退
const {loadGame} = require('./_load.js');
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
let code = loadGame();
code = code.replace(/window\.addEventListener\('hashchange', route\);/,'');
code = code.replace(/init\(\);\s*route\(\);\s*[\s\S]*$/,
  `init(); route(); globalThis.__T={wildBeast,allSpeciesDef,SPECIES};`);
eval(code);
const bad = globalThis.__T.wildBeast('JL_grass_perfect_0014', 5);
assert('wildBeast 无效 id 回退 speciesId', bad.speciesId==='JL_fire_normal_0001' && bad.name==='烬烬狼', JSON.stringify({id:bad.speciesId,name:bad.name}));

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail?1:0);
