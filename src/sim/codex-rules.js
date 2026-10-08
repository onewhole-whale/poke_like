

function ruleCondDesc(r){
  const c = r.cond||{};
  const parts = [];
  if(c.unit!=null || c.anyUnit) parts.push('词条 ≥'+(c.unit||1)+' 单位');
  if(c.minN && c.unit==null && !c.anyUnit) parts.push('素材 ≥'+c.minN);
  if(c.anyElem && c.unit==null) parts.push('任意属性');
  if(c.sameElem && c.unit==null) parts.push('同属性');
  if(c.minQuality) parts.push(c.minQuality==='fine'?'精良以上':'完美');
  if(c.chaos) parts.push('含混沌');
  if(c.lowValue) parts.push('普通杂料');
  if(c.words && c.words.length){ c.words.forEach(x=>parts.push(x.w+' ≥'+(x.n||c.unit||1)+' 单位')); }
  else if(c.word) parts.push('含'+c.word+'词条'+(c.wordUnit&&c.wordUnit!==(c.unit||1)?' ≥'+c.wordUnit+' 单位':''));
  if(c.spirits && c.spirits.length) parts.push('定向 '+(c.spirits.length>3?c.spirits.length+' 灵兽':c.spirits.map(id=>allSpeciesDef(id).name).join('/')));
  return parts.join(' + ')||'无条件';
}
function ruleOutDesc(r){
  const pool = {micro:'该属性元素微粒', chr:'元素结晶', gel:'元素凝胶', ling:'标准灵材', sprout:'元素萌芽', spirit:'灵兽'}[r.pool]||r.pool;
  return pool+' · '+(r.qty==='pct:60'?'数量=素材×60%':(r.qty==='pct:50'?'数量=素材×50%迭代':'1')+(r.chance<1?' · 概率'+(r.chance*100).toFixed(0)+'%':''));
}
/* 炼化规则编辑表单 */
/* 技能池公共渲染（M3-P0）：图鉴区块与独立「技能」视图共用，返回去重后的技能数组 */
function filterSkills(flt){
  const seenSk = {};
  return Object.values(SKILLS).flat().concat(Object.values(S.skillEdits||{})).filter(function(x){ if(!x||!x.id||seenSk[x.id]) return false; seenSk[x.id]=true; return true; }).filter(function(x){
    if(flt && flt.kind && x.kind!==flt.kind) return false;
    if(flt && flt.elem && (x.elem||'none')!==flt.elem) return false;
    if(flt && flt.type && flt.type.length){
      if(!flt.type.includes(skillBattleType(x))) return false;
    }
    return true;
  });
}