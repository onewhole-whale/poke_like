

/* 基础 β：主系别 1.0，其余按亲疏（相邻系 0.3，其余 0.05）。普系与其余常驻系同一套默认。
   时空/星辉/混沌初始为 0，面板不列，等有这些属性的精灵再单独安排。 */
const BETA_BASE = {};
['water','fire','grass','earth','wind','steel','ice','thunder','poison','light','ghost','fight','dark','bug','psy','normal']
  .forEach(e=> BETA_BASE[e]=.05);
const SPECIAL_ELEM = ['time','star','chaos'];
const NEIGHBOR = {
  water:['fire','grass'], fire:['grass','steel'], grass:['water','earth'],
  earth:['fire','thunder'], wind:['grass','poison'], steel:['ice','bug'],
  ice:['grass','wind'], thunder:['water','wind'], poison:['grass','bug'],
  light:['ghost','bug'], ghost:['fight','dark'], fight:['earth','steel'],
  dark:['psy','ghost'], bug:['grass','psy'], psy:['fight','earth'],
  normal:[],
  time:['water','star'], star:['time','chaos'], chaos:['star','earth'],
};
function baseBeta(elem){
  const b = {...BETA_BASE};
  if(elem) b[elem] = 1;
  (NEIGHBOR[elem]||[]).forEach(n => b[n] = .3);
  return b;
}
function betaElems(){
  return Object.keys(ELEM).filter(e=> SPECIAL_ELEM.indexOf(e)<0);
}
/* 动态相性 β：基础相性 + 专长 β 加成，再乘亲和力因子（50 亲和 = ×1.0）。
   表外属性不在默认表里，未写明时为 0。 */
function betaOf(s, e){
  const sp = allSpeciesDef(s.speciesId);
  let b = baseBeta(sp && sp.elem)[e];
  if(b==null) b = 0;
  (s.perks||[]).forEach(pid=>{
    const p = perkDef(pid);
    if(p && p.beta && p.beta[e]!=null) b += p.beta[e];
  });
  return Math.round(b * (affOf(s,e)/50) * 100) / 100;
}