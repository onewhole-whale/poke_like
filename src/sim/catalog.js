
/* 全局标签库：扫描所有素材/精灵定义 + 已有 tagLib，去重排序 */
function collectTagLib(){
  const set = new Set(S.tagLib||[]);
  Object.keys(MATS).forEach(id=> (MATS[id].tags||[]).forEach(t=>set.add(t)));
  Object.keys(S.customMats).forEach(id=> (S.customMats[id].tags||[]).forEach(t=>set.add(t)));
  Object.keys(S.matEdits).forEach(id=> (S.matEdits[id].tags||[]).forEach(t=>set.add(t)));
  Object.keys(SPECIES).forEach(id=> (SPECIES[id].tags||[]).forEach(t=>set.add(t)));
  Object.keys(S.customSpecies).forEach(id=> (S.customSpecies[id].tags||[]).forEach(t=>set.add(t)));
  Object.keys(S.speciesEdits).forEach(id=> (S.speciesEdits[id].tags||[]).forEach(t=>set.add(t)));
  S.tagLib = [...set].sort((a,b)=>a.localeCompare(b,'zh'));
}
/* 素材定义解析：自定义新增 > 精灵掉落物表 > 内置素材表；编辑覆盖对内置两类都生效 */
/* 炼化动态产出素材（元素微粒/结晶/凝胶/标准灵材）按 id 解析，保证可持有可识别 */
function dynamicMat(id){
  let m=null;
  if(id.startsWith('micro-')){
    const e=id.slice(6); if(!ELEM[e]) return null;
    m={id, name:ELEM[e].name+'元素微粒', elem:e, quality:'normal', type:'refine', tags:['口粮'], count:0, desc:'元素微粒=灵兽口粮：喂食回复体力（+20）。'};
  } else if(id.startsWith('chr-')){
    const parts=id.split('-'); const e=parts[1]; if(!ELEM[e]||parts.length<3) return null;
    const q=parts[2]; if(!['normal','good','fine','rare','epic','legend'].includes(q)) return null;
    m={id, name:ELEM[e].name+'元素结晶·'+({normal:'普通',good:'优秀',fine:'精良',rare:'稀有',epic:'史诗',legend:'传奇'}[q]), elem:e, quality:q, type:'refine', tags:['亲和训练'], count:0, desc:'元素结晶：投入资源副本可提升对应属性亲和力（受训练上限约束）。'};
  } else if(id.startsWith('gel-')){
    const e=id.slice(4); if(!ELEM[e]) return null;
    m={id, name:ELEM[e].name+'元素凝胶', elem:e, quality:'fine', type:'refine', tags:['洗亲和'], count:0, desc:'元素凝胶：洗去对应属性的训练亲和力（只能洗训练所得）。'};
  } else if(id.startsWith('ling-')){
    const parts=id.split('-'); const w=parts[1]||'';
    m={id, name:(w&&ELEM[w]?ELEM[w].name:w)+'之凝材', elem:w&&ELEM[w]?w:'none', quality:'fine', type:'refine', tags:['标准灵材'], count:0, desc:'标准灵材：单一纯净词条，构建副本不引入多余 tag。'};
  }
  return m;
}
function allMatDef(id){
  if(S.customMats[id]) return S.customMats[id];
  const base = MATS[id];
  if(!base) return dynamicMat(id);
  const edit = S.matEdits[id];
  return edit ? {...base, ...edit} : base;
}
/* v1.16.7 道具表查询（技能石/专长石，type:'item'，与素材平行） */
function itemInfo(id){ return ITEMS[id]||null; }
function isItem(id){ return typeof id==='string' && id.startsWith('DJ_'); }
/* 精灵物种定义解析：默认表 + 用户编辑覆盖 + 自定义新增 */
function allSpeciesDef(id){
  if(typeof id==='string' && id.indexOf('SPROUT_')===0){
    const elem = id.slice(7);
    if(elem!=='any' && !ELEM[elem]) return null;
    const label = elem==='any' ? '无主' : ELEM[elem].name;
    return {
      id:id, name:label+'元素萌芽', elem:elem==='any'?'normal':elem, rarity:'normal', speed:50,
      stats:{hp:55, atk:50, def:50, spa:50, sdef:50}
    };
  }
  if(S.customSpecies[id]) return S.customSpecies[id];
  const base = SPECIES[id] || DUNGEON_SPECIALS[id];
  if(!base) return null;
  const edit = S.speciesEdits[id];
  return edit ? {...base, ...edit} : base;
}
function allSpecies(){
  const ids = [...Object.keys(SPECIES), ...Object.keys(S.customSpecies)];
  return ids.filter(id=> allSpeciesDef(id)).map(id=>allSpeciesDef(id));
}