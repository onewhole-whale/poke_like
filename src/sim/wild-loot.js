

/* 节点结果落袋 + 推进 */
function wildLoot(desc, drops){
  const w = S.wild;
  if(drops && Object.values(drops).some(v=>v>0)){
    applyLoot(drops);
    const names = Object.keys(drops).filter(k=>drops[k]>0).map(k=>matInfo(k).name+' ×'+drops[k]).join('、');
    w.loots.push({desc, names});
  } else {
    w.loots.push({desc, names:''});
  }
  w.phase = 'result';
  renderWild();
}
function wildNodeDone(){
  const w = S.wild;
  // M3-1 沙盒：当前格标记 resolved，回到网格
  const c = w.grid && w.grid.cells[w.py] && w.grid.cells[w.py][w.px];
  if(c) c.resolved = true;
  w.phase = 'move';
  w.battle = null;
  renderWild();
}

/* 战斗渲染 */
/* 技能按钮描述：三分类 × 威力/段数/能耗 + 附加效果摘要 */
function skillMeta(def){
  if(!def) return '';
  const e = def.energy||0;
  const tr = def.track==='spec' ? '特殊' : '物理';
  const effTxt = skillEffectsOf(def).length ? ' · '+skillEffectsOf(def).map(x=>SKILL_STATUS[x.type]?SKILL_STATUS[x.type].name+'×'+x.layers:'').filter(Boolean).join('+') : '';
  if(def.kind==='mechanic') return '机制 · '+effTxt.replace(' · ','');
  if(def.kind==='burst') return tr+' · 能量≥'+e+' · 用后清空'+effTxt;
  if(def.kind==='ult') return tr+' · 绝技 · 耗能'+e+effTxt;
  return tr+' · 每段'+Math.round(def.power/def.hits)+' × '+def.hits+' 段 · 总威'+def.power+(e?' · 耗能'+e:' · 0耗');
}
/* M3-2 补丁 2.1：立绘 emoji 占位（按属性区分，M3-3 立绘接入前先用于区分形象） */
const ELEM_ICON = {water:'💧',fire:'🔥',grass:'🌿',earth:'🪨',wind:'🌪️',steel:'⚙️',ice:'❄️',thunder:'⚡',poison:'☠️',light:'✨',ghost:'👻',fight:'🥋',dark:'🌑',bug:'🐛',psy:'🔮',normal:'⭐'};
function elemIcon(e, fb){ return ELEM_ICON[e] || fb || '🐾'; }