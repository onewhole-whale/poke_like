
/* 本机设置（不跟玩法槽走）：自动战斗用药与回能策略 */
const SETTINGS_KEY = 'refine-proto-settings';
function defaultAutoCfg(){
  return {useHpPotion:true, useMpPotion:true, regenStrategy:'noAttack'};
}
function readStoredSettings(){
  try{
    const raw = localStorage.getItem(SETTINGS_KEY);
    if(!raw) return null;
    return JSON.parse(raw);
  }catch(e){ return null; }
}
function applyStoredSettings(){
  const d = readStoredSettings() || {};
  const base = defaultAutoCfg();
  S.autoCfg = {
    useHpPotion: d.useHpPotion!=null ? !!d.useHpPotion : base.useHpPotion,
    useMpPotion: d.useMpPotion!=null ? !!d.useMpPotion : base.useMpPotion,
    regenStrategy: (d.regenStrategy==='maxSkill'||d.regenStrategy==='zero'||d.regenStrategy==='noAttack')
      ? d.regenStrategy : base.regenStrategy
  };
  if(d.battleSpeed==='1x'||d.battleSpeed==='2x'||d.battleSpeed==='skip') S.battleSpeed = d.battleSpeed;
}
function persistSettings(){
  try{
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({
      useHpPotion: !!(S.autoCfg&&S.autoCfg.useHpPotion),
      useMpPotion: !!(S.autoCfg&&S.autoCfg.useMpPotion),
      regenStrategy: (S.autoCfg&&S.autoCfg.regenStrategy)||'noAttack',
      battleSpeed: S.battleSpeed||'1x'
    }));
  }catch(e){}
}
function renderSettings(){
  const root = $('#settings-root'); if(!root) return;
  root.innerHTML = '';
  if(!S.autoCfg) S.autoCfg = defaultAutoCfg();
  const cfg = normalizeAutoCfg(S.autoCfg);

  const card = el('div','card settings-card','');
  card.appendChild(el('h3',null,'自动战斗'));
  card.appendChild(el('p','settings-lead','战斗里点「自」后按下列规则行动。默认不跳过整场战斗，「跳过」只跳过演出。'));

  function toggleRow(key, label, tip){
    const row = el('label','settings-row','');
    const inp = document.createElement('input');
    inp.type = 'checkbox';
    inp.checked = !!cfg[key];
    inp.onchange = ()=>{
      S.autoCfg[key] = !!inp.checked;
      persistSettings();
      toast(label+'：'+(inp.checked?'开':'关'));
    };
    row.appendChild(inp);
    const txt = el('span',null,'');
    txt.innerHTML = '<b>'+esc(label)+'</b><span class="settings-tip">'+esc(tip)+'</span>';
    row.appendChild(txt);
    card.appendChild(row);
  }
  toggleRow('useHpPotion','自动使用血瓶','生命低于 50% 时，若背包有血瓶则喝一瓶（占一回合）');
  toggleRow('useMpPotion','自动使用蓝瓶','当前能量不够释放「期望伤害最高」的那招时，若有蓝瓶则喝一瓶');

  card.appendChild(el('div','settings-subhd','回能策略'));
  card.appendChild(el('p','settings-tip','在不喝蓝瓶、或蓝瓶关掉/用完时，决定何时用「回能」而不是打较弱的招。'));
  const stratBox = el('div','settings-radios','');
  [
    ['noAttack','无法使用攻击技能才回能','有任何可用伤害技就打期望最高的；全都放不出才回能'],
    ['zero','能量为 0 才回能','能量 >0 时优先打当前能放的伤害技；能量归零才回能'],
    ['maxSkill','最大期望伤害技能无法使用才回能','放不出全队期望最高的那招就回能，不改打较弱技能']
  ].forEach(([id,lab,tip])=>{
    const row = el('label','settings-row','');
    const inp = document.createElement('input');
    inp.type = 'radio';
    inp.name = 'regenStrategy';
    inp.value = id;
    inp.checked = cfg.regenStrategy===id;
    inp.onchange = ()=>{
      if(!inp.checked) return;
      S.autoCfg.regenStrategy = id;
      persistSettings();
      toast('回能策略已更新');
    };
    row.appendChild(inp);
    const txt = el('span',null,'');
    txt.innerHTML = '<b>'+esc(lab)+'</b><span class="settings-tip">'+esc(tip)+'</span>';
    row.appendChild(txt);
    stratBox.appendChild(row);
  });
  card.appendChild(stratBox);

  const spdCard = el('div','card settings-card','');
  spdCard.appendChild(el('h3',null,'战斗演出速度'));
  spdCard.appendChild(el('p','settings-tip','只影响演出快慢，不跳过战斗本身。战斗界面不再提供临时切换。'));
  const spdRow = el('div','settings-speed','');
  [['1x','1× 正常'],['2x','2× 加速'],['skip','跳过演出']].forEach(([k,lab])=>{
    const btn = el('button','btn sm'+(S.battleSpeed===k?' primary':''), lab);
    btn.onclick = ()=>{
      S.battleSpeed = k;
      persistSettings();
      renderSettings();
      toast(k==='skip'?'已设为跳过演出（不跳过战斗）':'演出速度：'+lab);
    };
    spdRow.appendChild(btn);
  });
  spdCard.appendChild(spdRow);

  root.appendChild(card);
  root.appendChild(spdCard);
}
