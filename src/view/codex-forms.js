
function renderSkillPoolInto(box, flt, opts){
  opts = opts||{};
  box.innerHTML='';
  const skGroups = [['direct','直接攻击 <span class="sub">0 能耗</span>'],['ult','绝技 <span class="sub">耗能 + 机制</span>'],['burst','爆发技 <span class="sub">条件触发 · 清空能量</span>'],['mechanic','机制 <span class="sub">不占容量 · 默认携带</span>']];
  const allSk = filterSkills(flt);
  const mechN = {execute:'斩杀',heal:'治愈',guard:'铁壁',sunder:'破甲',surge:'回能'};  skGroups.forEach(function(g){
    const list = allSk.filter(x=>x.kind===g[0]);
    if(!list.length) return;
    // 独立技能视图：直接攻击默认收起（普攻无花活，纯展示占位，节省视野）；主动筛选 direct 时展开
    const isDirect = g[0]==='direct';
    const collapse = isDirect && opts.directCollapsed && !(flt&&flt.kind==='direct');
    const group = el('div', collapse?'codex-group shelf-group collapsed':'codex-group'+(isDirect?' shelf-group':''));
    const hd = el('h4',null, g[1]+' <span class="sub">共 '+list.length+' 个</span>');
    if(isDirect){
      const foldUI = {fold:collapse};
      hd.onclick = ()=>{
        foldUI.fold = !foldUI.fold;
        group.classList.toggle('collapsed', foldUI.fold);
        const f = group.querySelector('.shelf-fold');
        if(f) f.textContent = foldUI.fold?'▸':'▾';
      };
      const fold = el('span','shelf-fold', collapse?'▸':'▾');
      fold.title = collapse?'展开本组':'收起本组';
      fold.onclick = ()=>{ hd.onclick(); };
      group.appendChild(hd); group.appendChild(fold);
    } else {
      group.appendChild(hd);
    }
    const body = el('div','shelf-body');
    // 绝技组排序：先状态技能（无威力）再攻击技能，组内按代价（能耗+容量-1）从低到高
    const powerTxt = function(sk){ return (sk.power||0)>0 ? sk.power : '-'; };
    const skCost = function(sk){ return (sk.energy||0)+((sk.cost||0)-1); };
    // v1.14.0：type 大类序 防御0 < 状态1 < 攻击2（所有技能 list 统一）
    const typeRank = function(sk){ return sk.type==='防御'?0 : (sk.type==='状态'?1 : 2); };
    const isState = function(sk){ return (sk.power||0)<=0; };
    list.sort((a,b)=> typeRank(a)-typeRank(b) || skCost(a)-skCost(b) || String(a.name).localeCompare(String(b.name),'zh'));
    list.forEach(function(sk){
      const row = el('div','codex-row');
      const edited = S.skillEdits&&S.skillEdits[sk.id];
      row.innerHTML = '<div class="cr-name">'+(ELEM[sk.elem]?'<span class="elem-dot '+(ELEM[sk.elem].dot||'dot-rare')+'"></span>':'')+esc(sk.name)+
        '<span class="quality-tag '+(sk.kind==='burst'?'good':(sk.kind==='ult'?'fine':'poor'))+'">'+(sk.kind==='direct'?'普攻':sk.kind==='ult'?'绝技':sk.kind==='burst'?'爆发':'机制')+'</span>'+
        (sk.kind==='burst'?'<span class="tag src">能量≥'+(sk.energy||0)+'</span>':'')+
        (edited?' <span class="tag src">已改</span>':'')+'</div>'+
        '<div class="cr-meta">'+(ELEM[sk.elem]?ELEM[sk.elem].name+'系':'')+' · '+skillBattleType(sk)+' · 威力 '+powerTxt(sk)+(sk.hits>1?' ×'+sk.hits+'段':'')+' · 能耗 '+(sk.energy||0)+' · 占容 '+(sk.cost||0)+(skillEffectsOf(sk).length?' · <span class="hl">'+skillEffectsOf(sk).map(function(ef){ return SKILL_STATUS[ef.type]?SKILL_STATUS[ef.type].name+'×'+ef.layers:''; }).filter(Boolean).join('+')+'</span>':'')+(sk.tags&&sk.tags.length?' · '+esc(sk.tags.join('/')):'')+'</div>';
      row.onclick = ()=> openSkillForm(sk.id);
      body.appendChild(row);
    });
    group.appendChild(body);
    box.appendChild(group);
  });
  if(!allSk.length) box.appendChild(el('div','muted','暂无技能数据。点击「新增技能」创建。'));
  return allSk;
}

/* 技能编辑器（M3-P0）：管理员新增/修改技能，改动覆盖查询（skillById/dgSkillDef），持久化 */
function openSkillForm(id){
  const ov = $('#overlay'), mb = $('#modal-box'); mb.innerHTML='';
  const base = id ? (skillById(id)||{}) : {};
  const isNew = !id;
  const isCustom = id && !!S.skillEdits[id];
  mb.appendChild(el('h2',null, id?('编辑技能 · '+base.name):'新增技能'));
  mb.appendChild(el('div','m-sub','直接攻击 = 0 能耗纯威力；绝技 = 耗能 + 机制；爆发技 = 满足条件后清空全部能量。词条参与副本存在分匹配。'));
  const form = el('div','');
  const nameI = el('input','inp',null); nameI.value = base.name||'';
  form.appendChild(fld('技能名称', nameI));
  const elemSel = el('select','inp');
  Object.keys(TYPE_CRUSH).forEach(k=>{
    const v=ELEM[k]; const o=el('option',null,v.name); o.value=k; if((base.elem||'grass')===k) o.selected=true; elemSel.appendChild(o);
  });
  form.appendChild(fld('元素属性', elemSel));
  const kindSel = el('select','inp');
  [['direct','直接攻击（普攻）'],['ult','绝技'],['burst','爆发技'],['mechanic','机制']].forEach(([k,v])=>{ const o=el('option',null,v); o.value=k; if((base.kind||'ult')===k) o.selected=true; kindSel.appendChild(o); });
  form.appendChild(fld('技能类型', kindSel));
  // v1.14.0：功能分类 type（攻击/状态/防御）。老存档 type='机制' 归并为'状态'（v1.14.0 热修）
  const typeSel = el('select','inp');
  let curType = base.type || ((base.power>0)?'攻击':'状态');
  if(curType==='机制') curType = '状态';   // 兼容老数据
  [['攻击','攻击（有威力）'],['状态','状态（无威力，威力显示 -）'],['防御','防御（无威力，威力显示 -）']].forEach(([k,v])=>{
    const o=el('option',null,v); o.value=k;
    if(curType===k) o.selected=true;
    typeSel.appendChild(o);
  });
  form.appendChild(fld('功能分类', typeSel));
  const trackSel = el('select','inp');
  [['phys','物理（吃攻击/防御）'],['spec','特殊（吃特攻/特防）']].forEach(([k,v])=>{ const o=el('option',null,v); o.value=k; if((base.track||'phys')===k) o.selected=true; trackSel.appendChild(o); });
  form.appendChild(fld('攻击轨道', trackSel));
  const powerI = el('input','inp',null); powerI.type='number'; powerI.min=0; powerI.max=500; powerI.value = base.power||0;
  form.appendChild(fld('总威力（状态技能填 0，列表显示为 -）', powerI));
  const hitsI = el('input','inp',null); hitsI.type='number'; hitsI.min=1; hitsI.max=6; hitsI.value = base.hits||1;
  form.appendChild(fld('连击段数', hitsI));
  const energyI = el('input','inp',null); energyI.type='number'; energyI.min=0; energyI.max=10; energyI.value = base.energy||0;
  form.appendChild(fld('能耗（爆发技 = 触发条件：剩余能量 ≥ 此值）', energyI));
  const costI = el('input','inp',null); costI.type='number'; costI.min=1; costI.max=10; costI.value = base.cost||2;
  form.appendChild(fld('容量占用（受亲和力修正）', costI));
  const accI = el('input','inp',null); accI.type='number'; accI.min=1; accI.max=100; accI.value = (base.accuracy!=null)?base.accuracy:100;
  form.appendChild(fld('命中率（技能顶层字段，默认 100 全命中；<100 按此概率命中）', accI));
  const cdI = el('input','inp',null); cdI.type='number'; cdI.min=0; cdI.max=10; cdI.value = (base.cooldown||0);
  form.appendChild(fld('冷却（回合数；0=无冷却。释放后 N 回合内不可用）', cdI));
  // 附加效果（唯一效果系统）：多行 [目标 + 类型 + 层数/数值]，覆盖状态类与机制类
  const effRows = el('div','eff-rows','');
  form.appendChild(el('h4',null,'技能效果 <span style="display:inline-block;width:14px;height:14px;border-radius:50%;background:#555;color:#fff;font-size:10px;text-align:center;line-height:14px;cursor:help;margin-left:4px;" title="属性状态类每层 ±10% / 速度每层 ±10 点">?</span>'));
  const addEffRow = (ef)=>{
    // v1.19.5：effectGroup 可编辑卡片
    if(ef && ef.type==='effectGroup'){
      const grp = ef;
      const card = el('div','eff-card eff-group','');
      card.style.cssText='border:1px solid #4a6fa5;border-radius:6px;padding:8px 10px;margin:6px 0;background:#1e2430';
      // 顶部：模式下拉 + 删除
      const top = el('div','',''); top.style.cssText='display:flex;align-items:center;gap:8px;margin-bottom:6px';
      const modeSel = el('select','inp');
      [['all','全部执行（all）'],['randomOne','随机选一（randomOne）'],['randomRoll','独立掷骰（randomRoll）']].forEach(([k,v])=>{
        const o=el('option',null,v); o.value=k; if((grp.mode||'all')===k) o.selected=true; modeSel.appendChild(o);
      });
      top.appendChild(el('b','','效果组：')); top.appendChild(modeSel);
      const grpRm = el('button','btn mini','×'); grpRm.title='删除此效果组'; grpRm.onclick=()=>card.remove();
      top.appendChild(grpRm);
      card.appendChild(top);
      // 合计显示（randomOne 模式）
      const sumLab = el('div','',''); sumLab.style.cssText='font-size:11px;color:#888;margin-bottom:6px';
      card.appendChild(sumLab);
      // 分支容器
      const branchesWrap = el('div','',''); card.appendChild(branchesWrap);
      // 加分支按钮
      const addBr = el('button','btn mini','+ 加分支');
      card.appendChild(addBr);
      // 渲染一个分支
      const renderBr = (br)=>{
        const brCard = el('div','','');
        brCard.style.cssText='border:1px solid #3a4a6a;border-radius:4px;padding:6px 8px;margin:4px 0;background:#181c28';
        const sub = (br&&br.effects&&br.effects[0])||{};
        // 第一行：分支概率 + 效果类型 + ×删除
        const row1 = el('div','',''); row1.style.cssText='display:flex;align-items:center;gap:6px';
        const probWrap = el('div','','');
        probWrap.style.cssText='display:none;align-items:center;gap:4px';
        const probLab = el('span','','分支概率'); probLab.style.cssText='font-size:11px;color:#888';
        const probI = el('input','inp',null); probI.type='number'; probI.min=0; probI.max=100; probI.value=(br&&br.prob)||0; probI.style.width='50px';
        probWrap.appendChild(probLab); probWrap.appendChild(probI);
        const eSel = el('select','inp');
        STATUS_EFFECT_TYPES.forEach(t=>{ const o=el('option',null,SKILL_STATUS[t].name); o.value=t; if(sub.type===t) o.selected=true; eSel.appendChild(o); });
        eSel.style.flex='1';
        const rm = el('button','btn mini','×'); rm.title='删除此分支'; rm.onclick=()=>{ brCard.remove(); updateSum(); };
        row1.appendChild(probWrap); row1.appendChild(eSel); row1.appendChild(rm);
        // 第二行：目标 + 层数 + 概率%
        const row2 = el('div','',''); row2.style.cssText='display:flex;align-items:flex-end;gap:12px;margin-top:6px';
        const tSel = el('select','inp');
        [['enemy','敌方'],['self','自己']].forEach(([k,v])=>{ const o=el('option',null,v); o.value=k; if((sub.target||'enemy')===k) o.selected=true; tSel.appendChild(o); });
        tSel.style.width='60px'; tSel.style.marginBottom='1px';
        const lWrap = el('div','','');
        const lLab = el('div','','层数'); lLab.style.cssText='font-size:11px;color:#888;margin-bottom:2px';
        const lI = el('input','inp',null); lI.type='number'; lI.min=1; lI.max=20; lI.value=sub.layers||1; lI.style.width='60px';
        lWrap.appendChild(lLab); lWrap.appendChild(lI);
        const pWrap = el('div','','');
        const pLab = el('div','','概率%'); pLab.style.cssText='font-size:11px;color:#888;margin-bottom:2px';
        const pI = el('input','inp',null); pI.type='number'; pI.min=1; pI.max=100; pI.value=Math.round((sub.prob!=null?sub.prob:1)*100); pI.style.width='60px';
        pWrap.appendChild(pLab); pWrap.appendChild(pI);
        row2.appendChild(tSel); row2.appendChild(lWrap); row2.appendChild(pWrap);
        brCard.appendChild(row1); brCard.appendChild(row2);
        brCard._tSel=tSel; brCard._eSel=eSel; brCard._lI=lI; brCard._pI=pI; brCard._probI=probI;
        branchesWrap.appendChild(brCard);
        return brCard;
      };
      // 初始分支
      (grp.children||[]).forEach(renderBr);
      // 加分支
      addBr.onclick=()=>{ renderBr({prob:50,effects:[{target:'enemy',type:'',layers:1,prob:1}]}); updateSum(); };
      // 模式切换时显示/隐藏概率列 + 更新合计
      const updateSum = ()=>{
        const mode = modeSel.value;
        const showProb = (mode==='randomOne'||mode==='randomRoll');
        branchesWrap.querySelectorAll('div').forEach(bc=>{
          if(bc._probI) bc._probI.parentElement.style.display = showProb?'flex':'none';
        });
        if(mode==='randomOne'){
          let sum=0;
          branchesWrap.querySelectorAll('div').forEach(bc=>{ if(bc._probI) sum += (parseInt(bc._probI.value)||0); });
          sumLab.textContent = '当前合计：'+sum+'%';
          sumLab.style.color = (sum===100?'#8f8':'#f88');
        } else {
          sumLab.textContent = '';
        }
      };
      modeSel.onchange=updateSum;
      branchesWrap.addEventListener('input', updateSum);
      updateSum();
      // 存到 card 供 save 重建
      card._grpEl = {modeSel, branchesWrap, sumLab};
      effRows.appendChild(card);
      return;
    }
    const card = el('div','eff-card','');
    card.style.cssText='border:1px solid #444;border-radius:6px;padding:8px 10px;margin:6px 0;background:#1e1e24';
    // 第一行：目标 + 类型 + 删除
    const row1 = el('div','',''); row1.style.cssText='display:flex;align-items:center;gap:8px';
    const tSel = el('select','inp');
    [['enemy','敌方'],['self','自己']].forEach(([k,v])=>{ const o=el('option',null,v); o.value=k; if((ef&&ef.target||'enemy')===k) o.selected=true; tSel.appendChild(o); });
    tSel.style.width='70px';
      const eSel = el('select','inp');
      STATUS_EFFECT_TYPES.forEach(t=>{ const o=el('option',null,SKILL_STATUS[t].name); o.value=t; if((ef&&ef.type||'')===t) o.selected=true; eSel.appendChild(o); });
      eSel.style.flex='1';
    const rm = el('button','btn mini','×'); rm.title='删除此效果'; rm.onclick = ()=> card.remove();
    row1.appendChild(tSel); row1.appendChild(eSel); row1.appendChild(rm);
    // 第二行：层数 + 概率（带小标签）
    const row2 = el('div','',''); row2.style.cssText='display:flex;gap:12px;margin-top:6px';
    const defL = SKILL_STATUS[ef&&ef.type||''] ? (SKILL_STATUS[ef&&ef.type||''].defLayers||SKILL_STATUS[ef&&ef.type||''].layers||1) : 1;
    const lWrap = el('div','','');
    const lLab = el('div','','层数'); lLab.style.cssText='font-size:11px;color:#888;margin-bottom:2px';
    const lI = el('input','inp',null); lI.type='number'; lI.min=1; lI.max=20; lI.value = (ef&&ef.layers)||defL||1; lI.style.width='60px';
    lWrap.appendChild(lLab); lWrap.appendChild(lI);
    const pWrap = el('div','','');
    const pLab = el('div','','概率%'); pLab.style.cssText='font-size:11px;color:#888;margin-bottom:2px';
    const pI = el('input','inp',null); pI.type='number'; pI.min=1; pI.max=100; pI.value = Math.round(((ef&&ef.prob!=null?ef.prob:1))*100); pI.style.width='60px'; pI.title='附加概率（%）';
    pWrap.appendChild(pLab); pWrap.appendChild(pI);
    row2.appendChild(lWrap); row2.appendChild(pWrap);
    card.appendChild(row1); card.appendChild(row2);
    effRows.appendChild(card);
  };
  (base.effects||[]).forEach(addEffRow);
  // 旧式 mech 兼容：打开老技能时若只有 mech 无 effects，自动翻译成 effects 展示
  if(!(base.effects&&base.effects.length) && base.mech){
    const legacy = mechToEffects(base);
    if(legacy.length) legacy.forEach(addEffRow);
  }
  const addEffBtn = el('button','btn mini','+ 加效果'); addEffBtn.onclick = ()=> addEffRow(null);
  form.appendChild(effRows);
  form.appendChild(addEffBtn);
  const tagsIn = el('input','inp',null); tagsIn.value = (base.tags||[]).join('、');
  form.appendChild(fld('词条标签（、分隔，如：草、吸血、群体）', tagsIn));
  const descIn = el('textarea','inp',null); descIn.rows=3; descIn.value = base.desc||'';
  form.appendChild(fld('描述', descIn));
  mb.appendChild(form);
  const ma = el('div','modal-actions','');
  const save = el('button','btn primary','保存');
  save.onclick = ()=>{
    const name = nameI.value.trim();
    if(!name){ toast('名称不能为空','bad'); return; }
    const pv = Math.max(0, parseInt(powerI.value)||0);
    const def = {id: id || 'custom_s'+Math.random().toString(36).slice(2,6), name, elem:elemSel.value, kind:kindSel.value, track:trackSel.value,
      power:pv, hits:Math.max(1, parseInt(hitsI.value)||1), energy:Math.max(0, parseInt(energyI.value)||0),
      cost:Math.max(1, parseInt(costI.value)||1), type: typeSel.value,
      tags: tagsIn.value.split(/[、,，]/).map(function(x){return x.trim();}).filter(Boolean), desc: descIn.value.trim()};
    // v1.14.0：冷却顶层字段（>0 才写）
    const cdV = Math.max(0, parseInt(cdI.value)||0);
    if(cdV>0) def.cooldown = cdV;
    // 命中率顶层字段：<100 才写（100 或空 = 默认全命中，不落库）
    const accV = parseInt(accI.value)||100;
    if(accV < 100) def.accuracy = Math.max(1, Math.min(100, accV));
    // 技能效果（唯一系统）：收集各行 [target, type, layers, prob?]
    const effects = [];
    effRows.querySelectorAll('.eff-card').forEach(card=>{
      // v1.19.5：effectGroup 卡片从 DOM 重建
      if(card.classList.contains('eff-group')){
        const {modeSel, branchesWrap} = card._grpEl;
        const mode = modeSel.value;
        const children = [];
        let sum = 0;
        branchesWrap.querySelectorAll('div').forEach(bc=>{
          if(!bc._tSel) return;
          const sub = {target:bc._tSel.value, type:bc._eSel.value, layers:Math.max(1,parseInt(bc._lI.value)||1)};
          const p = parseInt(bc._pI.value); if(p&&p<100) sub.prob = p/100;
          const br = {effects:[sub]};
          if(mode!=='all'){ br.prob = parseInt(bc._probI.value)||0; sum += br.prob; }
          children.push(br);
        });
        if(mode==='randomOne' && sum!==100){ toast('randomOne 模式下分支概率合计应为 100%（当前 '+sum+'%）','bad'); return; }
        if(children.length) effects.push({type:'effectGroup', mode, children});
        return;
      }
      if(card._origEff){ effects.push(card._origEff); return; }
      const ts = card.querySelector('select'); const es = card.querySelectorAll('select')[1];
      const li = card.querySelector('input[type=number]'); const pi = card.querySelectorAll('input[type=number]')[1];
      if(ts && es && SKILL_STATUS[es.value]){
        const eff = {target:ts.value, type:es.value, layers:Math.max(1, parseInt(li.value)||1)};
        const p = pi ? Math.min(100, Math.max(1, parseInt(pi.value)||100)) : 100;
        if(p<100) eff.prob = p/100;
        effects.push(eff);
      }
    });
    if(effects.length) def.effects = effects;
    delete def.mech;  // 旧「主机制」枚举废弃，效果统一由 effects 表达
    S.skillEdits[def.id] = def;
    saveDraft(); closeOverlay(); renderCodex();
    toast((isNew?'新增技能「':'技能「')+name+'」'+(isNew?'已入池':'已更新'));
  };
  ma.appendChild(save);
  const cancel = el('button','btn ghost','取消'); cancel.onclick = closeOverlay;
  ma.appendChild(cancel);
  if(id && isCustom){
    const del = el('button','btn danger','删除');
    del.onclick = ()=>{ delete S.skillEdits[id]; saveDraft(); closeOverlay(); renderCodex(); toast('已删除自定义技能'); };
    ma.appendChild(del);
  }
  mb.appendChild(ma);
  ov.classList.add('open');
}

function openRuleForm(ruleId, isNew){
  const ov = $('#overlay'), mb = $('#modal-box');
  mb.innerHTML='';
  const rules = refineRules();
  const r = ruleId ? rules.find(x=>x.id===ruleId) : null;
  const isE = !!r;
  const c = (r&&r.cond)||{};
  const isWord = (c.unit!=null || c.anyUnit);
  mb.appendChild(el('h2',null, ruleId?('编辑规则 · '+r.name):'新增炼化规则'));
  mb.appendChild(el('div','m-sub','条件与产出池自由配置，像配置素材与精灵一样。改动保存后立即生效，持久化到本机。'));
  const form = el('div','rule-form');
  const nameI = el('input','inp',null); nameI.value = r?r.name:'';
  form.appendChild(fld('规则名称', nameI));
  const poolSel = el('select','inp');
  [['micro','元素微粒（口粮）'],['chr','元素结晶（亲和训练）'],['gel','元素凝胶（洗亲和）'],['ling','标准灵材（凝材）'],['sprout','元素萌芽（培养精灵）'],['spirit','灵兽（配方）']].forEach(p=>{
    const op=el('option',null,p[1]); op.value=p[0]; poolSel.appendChild(op);
  });
  poolSel.value = r?r.pool:'micro';
  form.appendChild(fld('产出池', poolSel));
  const chanceI = el('input','inp',null); chanceI.type='number'; chanceI.min=0; chanceI.max=1; chanceI.step=.01; chanceI.value = r&&r.chance!=null?r.chance:1;
  form.appendChild(fld('触发概率（0~1，1=必出）', chanceI));
  // 条件（词条单位制）
  form.appendChild(el('h4',null,'条件（词条单位制）'));
  const unitI = el('input','inp',null); unitI.type='number'; unitI.min=.5; unitI.step=.5; unitI.value = (isWord?(c.unit||2):(c.minN||2));
  form.appendChild(fld('词条单位阈值（≥X 单位命中）', unitI));
  const costI = el('input','inp',null); costI.type='number'; costI.min=.5; costI.step=.5; costI.value = r&&r.cost!=null?r.cost:(c.unit||(c.minN||2));
  form.appendChild(fld('单次消耗单位（素材规则：每次抽取消耗）', costI));
  const qSel = el('select','inp');
  [['','不限品质'],['good','优秀以上'],['fine','精良以上'],['rare','稀有以上']].forEach(p=>{
    const op=el('option',null,p[1]); op.value=p[0]; qSel.appendChild(op);
  });
  qSel.value = c.minQuality||'';
  form.appendChild(fld('最低素材品质', qSel));
  const chaosI = el('input','chk',null); chaosI.type='checkbox'; chaosI.checked=!!c.chaos;
  form.appendChild(fld('需要混沌词条', chaosI));
  const lowI = el('input','chk',null); lowI.type='checkbox'; lowI.checked=!!c.lowValue;
  form.appendChild(fld('仅普通品质杂料', lowI));
  // 特征词条（多行：词条名 + 单位；全部达标才命中）
  const initWords = (c.words && c.words.length) ? c.words.map(x=>({w:x.w, n:x.n})) : (c.word?[{w:c.word, n:c.wordUnit||c.unit||1}]:[]);
  const wordsRows = el('div','word-rows','');
  const addWordRow = (w,n)=>{
    const row = el('div','word-row','');
    const wi = el('input','inp',null); wi.placeholder='词条名（如 爪/月/血）'; wi.value = w||'';
    const ni = el('input','inp',null); ni.type='number'; ni.min=.5; ni.step=.5; ni.value = n!=null?n:''; ni.style.width='70px';
    const rm = el('button','btn mini','×'); rm.onclick = ()=> row.remove();
    row.appendChild(wi); row.appendChild(ni); row.appendChild(rm);
    wordsRows.appendChild(row);
  };
  initWords.forEach(x=>addWordRow(x.w, x.n));
  const addWBtn = el('button','btn mini','+ 加特征词条'); addWBtn.onclick = ()=> addWordRow('','');
  form.appendChild(fld('特征词条（可选：要求投入含此词条的素材，全部达标才命中）', wordsRows));
  form.appendChild(addWBtn);
  // 灵兽定向配方：产出精灵多选
  const spiritsSel = el('div','spirits-multi','');
  const selSpirits = new Set(c.spirits||[]);
  allSpecies().forEach(sp=>{
    const chip = el('span','cand'+(selSpirits.has(sp.id)?' on':''), sp.name);
    chip.onclick = ()=>{ if(selSpirits.has(sp.id)) selSpirits.delete(sp.id); else selSpirits.add(sp.id); chip.classList.toggle('on'); };
    chip.title = sp.elem+'系'+(sp.rarity!=='normal'?' · '+gradeName(sp):'');
    spiritsSel.appendChild(chip);
  });
  form.appendChild(fld('灵兽定向（必选：灵兽配方必须指定产出精灵；无泛匹配兜底）', spiritsSel));
  form.appendChild(el('div','tiny','提示：灵兽规则命中定向即共享 1% 概率（演示 28%）；同品质均分，每高一个品质概率衰减 90%；出灵兽即炼化结束，不再出素材。素材规则按萃取后词条单位循环抽取，每次消耗「单次消耗单位」。'));
  mb.appendChild(form);
  // 操作
  const ops = el('div','modal-ops');
  const delBtn = el('button','btn danger', isE?'删除此规则':'');
  if(isE) delBtn.onclick = ()=>{
    if(!confirm('删除规则「'+r.name+'」？')) return;
    S.refineRules = S.refineRules.filter(x=>x.id!==r.id);
    saveDraft(); closeOverlay(); renderCodex(); renderRefine();
    toast('规则已删除');
  };
  ops.appendChild(delBtn);
  const cancelBtn = el('button','btn', '取消'); cancelBtn.onclick = closeOverlay;
  ops.appendChild(cancelBtn);
  const saveBtn = el('button','btn primary','保存规则');
  saveBtn.onclick = ()=>{
    const name = nameI.value.trim();
    if(!name){ toast('请填写规则名称','bad'); return; }
    const unit = Math.max(.5, parseFloat(unitI.value)||1);
    const ncond = {
      unit,
      anyUnit: true,
      words: (()=>{ const ws=[]; wordsRows.querySelectorAll('.word-row').forEach(r=>{ const i=r.querySelectorAll('input'); const w=i[0].value.trim(); if(w){ ws.push({w, n: i[1].value? Math.max(.5, parseFloat(i[1].value)) : undefined}); } }); return ws.length? ws : undefined; })(),
      minQuality: qSel.value||undefined,
      chaos: chaosI.checked,
      lowValue: lowI.checked,
      spirits: selSpirits.size>0 ? [...selSpirits] : undefined,
    };
    const nrule = {
      id: r?r.id : 'r-'+(Date.now().toString(36)),
      name, pool: poolSel.value,
      chance: Math.max(0, Math.min(1, parseFloat(chanceI.value)||0)),
      cost: Math.max(.5, parseFloat(costI.value)||unit),
      cond: ncond,
      note: ruleCondDesc({cond:ncond})
    };
    if(!S.refineRules) S.refineRules = REFINE_RULES_DEFAULT.map(x=>({...x, cond:{...x.cond}}));
    if(isE) S.refineRules = S.refineRules.map(x=> x.id===r.id?nrule:x);
    else S.refineRules = [...S.refineRules, nrule];
    saveDraft(); closeOverlay(); renderCodex(); renderRefine();
    toast('炼化规则已保存');
  };
  ops.appendChild(saveBtn);
  mb.appendChild(ops);
  ov.classList.add('open');
}

function fld(label, inner){
  const d = el('div','fld'); d.appendChild(el('label',null,label)); d.appendChild(inner); return d;
}
/* 微信式标签选择器：从 tagLib 选择已有 / 输入新建。返回 {node, get()} */
function tagPicker(initTags){
  const wrap = el('div','tagpicker');
  const sel = el('div','tagp-selected');
  const iw = el('div','tagp-iwrap');
  const inp = document.createElement('input');
  inp.className = 'tagp-input'; inp.placeholder = '搜索或创建标签...';
  const drop = el('div','tagp-drop'); drop.style.display='none';
  iw.appendChild(inp); iw.appendChild(drop);
  wrap.appendChild(sel); wrap.appendChild(iw);
  const tags = [...(initTags||[])].filter(Boolean);
  function renderSel(){
    sel.innerHTML='';
    tags.forEach(t=>{
      const c = el('span','tagp-chip', escapeHtml(t));
      const x = el('span','tagp-x','×');
      x.onclick = ()=>{ const i=tags.indexOf(t); if(i>-1) tags.splice(i,1); renderSel(); inp.focus(); };
      c.appendChild(x); sel.appendChild(c);
    });
  }
  function closeDrop(){ drop.style.display='none'; }
  function pick(t){
    if(!tags.includes(t)) tags.push(t);
    if(!S.tagLib.includes(t)) S.tagLib.push(t);
    inp.value=''; renderSel(); closeDrop(); inp.focus();
  }
  function openDrop(){
    const kw = inp.value.trim();
    const lib = (S.tagLib||[]).filter(t=>!tags.includes(t));
    const hits = lib.filter(t=> !kw || t.includes(kw));
    drop.innerHTML='';
    if(hits.length===0 && !kw){
      drop.appendChild(el('div','tagp-empty','暂无更多标签，输入新名称创建'));
    }
    hits.forEach(t=>{
      const item = el('div','tagp-item', escapeHtml(t));
      item.onmousedown = (e)=>{ e.preventDefault(); pick(t); };
      drop.appendChild(item);
    });
    if(kw && !lib.includes(kw)){
      const item = el('div','tagp-item new','新建标签「'+escapeHtml(kw)+'」');
      item.onmousedown = (e)=>{ e.preventDefault(); pick(kw); };
      drop.appendChild(item);
    }
    drop.style.display='block';
  }
  inp.addEventListener('focus', openDrop);
  inp.addEventListener('input', openDrop);
  inp.addEventListener('keydown', e=>{
    if(e.key==='Enter'){
      e.preventDefault();
      const kw = inp.value.trim();
      if(kw) pick(kw);
    } else if(e.key==='Backspace' && !inp.value && tags.length){
      tags.pop(); renderSel();
    } else if(e.key==='Escape'){
      closeDrop();
    }
  });
  inp.addEventListener('blur', ()=> setTimeout(closeDrop, 160));
  renderSel();
  return {node: wrap, get: ()=>[...tags]};
}
function openMatForm(id, isPart, preset){
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  const isNew = !id;
  const m = id ? (allMatDef(id)||{name:'', elem:'none', quality:'normal', type:'ore', tags:[], desc:'', count:0}) : {name:'', elem:'none', quality:'normal', type:(preset&&preset.type)||'ore', tags:[], desc:'', count:0, from:preset&&preset.from};
  const isCustom = id && !!S.customMats[id];
  const isDrop = !!m.from;
  mb.appendChild(el('h2',null, isNew?'新增素材':('编辑素材 · '+m.name)));
  const f = el('div','');
  const nameIn = document.createElement('input'); nameIn.value = m.name||''; nameIn.placeholder='素材名称';
  f.appendChild(fld('名称', nameIn));
  const elemSel = document.createElement('select');
  [['none','无'],['life','生命'],...Object.entries(ELEM).map(([k,v])=>[k,v.name])].forEach(([k,v])=>{
    const o=document.createElement('option'); o.value=k; o.textContent=v; if((m.elem||'none')===k) o.selected=true; elemSel.appendChild(o);
  });
  f.appendChild(fld('元素属性', elemSel));
  const qSel = document.createElement('select');
  Object.entries(QUALITY).forEach(([k,v])=>{
    const note = k==='normal'?'垫材 · 不出灵兽':(k==='good'||k==='fine')?'中阶 · 可出灵兽':'高阶 · 高概率与稀有候选';
    const o=document.createElement('option'); o.value=k; o.textContent=v.name+'（'+note+'）';
    if((m.quality||'normal')===k) o.selected=true; qSel.appendChild(o);
  });
  f.appendChild(fld('品质（能级）', qSel));
  const tSel = document.createElement('select');
  Object.entries(MAT_TYPE).forEach(([k,v])=>{
    const o=document.createElement('option'); o.value=k; o.textContent=v.name; if((m.type||'ore')===k) o.selected=true; tSel.appendChild(o);
  });
  if(isDrop) tSel.disabled = true;
  f.appendChild(fld('类型（来源）', tSel));
  if(isDrop){
    f.appendChild(el('div','fld', '<label>归属精灵</label><div class="muted" style="font-size:12px">「'+allSpeciesDef(m.from).name+'」的专属掉落物，在精灵编辑页可调整。</div>'));
  }
  const tagPick = tagPicker(m.tags||[]);
  f.appendChild(fld('功能标签', tagPick.node));
  const cntIn = document.createElement('input'); cntIn.type='number'; cntIn.min=0;
  cntIn.value = id ? (matState[id]||0) : (m.count||0);
  f.appendChild(fld('持有数量', cntIn));
  const descIn = document.createElement('textarea'); descIn.value=m.desc||''; descIn.placeholder='一句风物描述';
  f.appendChild(fld('描述', descIn));
  const ecoIn = document.createElement('textarea'); ecoIn.value=m.ecology||''; ecoIn.placeholder='生态描述：素材的来历与来处，居民视角的一句话叙事（可选，与精灵「生态」同源）';
  f.appendChild(fld('生态描述', ecoIn));
  const appIn = document.createElement('textarea'); appIn.value=m.appearance||''; appIn.placeholder='外观描述：素材的具体形象描写（可选，与精灵「外观」同源）';
  f.appendChild(fld('外观描述', appIn));
  // —— 副本存在分：素材关联的技能/专长（可查看并修改） ——
  const exWrap = el('div','fld');
  exWrap.appendChild(el('label',null,'副本存在分 · 关联技能/专长'));
  exWrap.appendChild(el('div','tiny','该素材投入副本时，为下列技能/专长提供存在分（1 分 = 1/1000 抽取概率）。不修改则按 元素×品质 自动生成；手动改动后以本表为准。'));
  let exDirty = !!(m.extractInfo && (Object.keys(m.extractInfo.skillScore||{}).length || Object.keys(m.extractInfo.talentScore||{}).length));
  let exInfo = JSON.parse(JSON.stringify(m.extractInfo && exDirty ? m.extractInfo : defaultExtract(m)));
  const exBox = el('div','extract-box','');
  const elemKey = (m.elem && m.elem!=='none' && GLOBAL_SKILL_POOL[m.elem]) ? m.elem : 'universal';
  const skillCands = [...new Set([...(GLOBAL_SKILL_POOL[elemKey]||[]), ...(GLOBAL_SKILL_POOL.universal||[])])].filter(id=>id!=='regen');
  const perkCands = [...new Set([...(elemKey!=='universal'?GLOBAL_PERK_POOL[elemKey]:[]), ...(GLOBAL_PERK_POOL.universal||[])])];
  function renderExtract(){
    exBox.innerHTML='';
    exBox.appendChild(el('div','ex-sec','技能（'+Object.keys(exInfo.skillScore||{}).length+'）'));
    Object.entries(exInfo.skillScore||{}).forEach(([sid,score])=>{
      const row = el('div','extract-row');
      row.appendChild(el('span','ex-name', skillName(sid)));
      const sIn = document.createElement('input'); sIn.type='number'; sIn.min=1; sIn.max=1000; sIn.value=score;
      sIn.className='ex-score';
      sIn.onchange = ()=>{ exInfo.skillScore[sid]=Math.max(1,Math.min(1000,parseInt(sIn.value)||1)); exDirty=true; };
      row.appendChild(sIn);
      const x = el('button','chip-ctr','×'); x.title='移除该技能';
      x.onclick = ()=>{ delete exInfo.skillScore[sid]; exDirty=true; renderExtract(); };
      row.appendChild(x);
      exBox.appendChild(row);
    });
    const addSk = el('div','extract-row');
    const skSel = document.createElement('select'); skSel.className='ex-sel';
    skillCands.forEach(sid=>{ const o=document.createElement('option'); o.value=sid; o.textContent=skillName(sid)+'（'+sid+'）'; skSel.appendChild(o); });
    addSk.appendChild(skSel);
    const skAdd = el('button','btn sm','添加技能');
    skAdd.onclick = ()=>{
      const sid = skSel.value; if(!sid) return;
      exInfo.skillScore = exInfo.skillScore||{};
      if(exInfo.skillScore[sid]){ toast('该技能已在表中','bad'); return; }
      exInfo.skillScore[sid] = 80; exDirty=true; renderExtract();
    };
    addSk.appendChild(skAdd);
    exBox.appendChild(addSk);
    exBox.appendChild(el('div','ex-sec','专长（'+Object.keys(exInfo.talentScore||{}).length+'）'));
    Object.entries(exInfo.talentScore||{}).forEach(([pid,score])=>{
      const row = el('div','extract-row');
      row.appendChild(el('span','ex-name', perkName(pid)));
      const pIn = document.createElement('input'); pIn.type='number'; pIn.min=1; pIn.max=1000; pIn.value=score;
      pIn.className='ex-score';
      pIn.onchange = ()=>{ exInfo.talentScore[pid]=Math.max(1,Math.min(1000,parseInt(pIn.value)||1)); exDirty=true; };
      row.appendChild(pIn);
      const x = el('button','chip-ctr','×'); x.title='移除该专长';
      x.onclick = ()=>{ delete exInfo.talentScore[pid]; exDirty=true; renderExtract(); };
      row.appendChild(x);
      exBox.appendChild(row);
    });
    const addPk = el('div','extract-row');
    const pkSel = document.createElement('select'); pkSel.className='ex-sel';
    perkCands.forEach(pid=>{ const o=document.createElement('option'); o.value=pid; o.textContent=perkName(pid)+'（'+pid+'）'; pkSel.appendChild(o); });
    addPk.appendChild(pkSel);
    const pkAdd = el('button','btn sm','添加专长');
    pkAdd.onclick = ()=>{
      const pid = pkSel.value; if(!pid) return;
      exInfo.talentScore = exInfo.talentScore||{};
      if(exInfo.talentScore[pid]){ toast('该专长已在表中','bad'); return; }
      exInfo.talentScore[pid] = 60; exDirty=true; renderExtract();
    };
    addPk.appendChild(pkAdd);
    exBox.appendChild(addPk);
    const rs = el('button','btn sm ghost','重置为自动生成');
    rs.onclick = ()=>{ exInfo = JSON.parse(JSON.stringify(defaultExtract(m))); exDirty=true; renderExtract(); };
    exBox.appendChild(rs);
  }
  renderExtract();
  exWrap.appendChild(exBox);
  f.appendChild(exWrap);
  mb.appendChild(f);
  const ma = el('div','modal-actions','');
  const save = el('button','btn primary','保存');
  save.onclick = ()=>{
    const name = nameIn.value.trim();
    if(!name){ toast('名称不能为空','bad'); return; }
    const tags = tagPick.get();
    const cnt = Math.max(0, parseInt(cntIn.value)||0);
    if(isNew){
      let base = 'custom_'+Math.random().toString(36).slice(2,6);
      while(MATS[base]||S.customMats[base]) base='custom_'+Math.random().toString(36).slice(2,6);
      const def = {id:base, name, elem:elemSel.value, quality:qSel.value, type:tSel.value, tags, desc:descIn.value.trim(), count:cnt, ecology:ecoIn.value.trim(), appearance:appIn.value.trim()};
      if(m.from) def.from = m.from;
      if(exDirty){ def.extractInfo = {skillScore:exInfo.skillScore||{}, talentScore:exInfo.talentScore||{}}; }
      S.customMats[base] = def;
      matState[base] = cnt;
      if(cnt>0) markMatSeen(base);
      // 从精灵编辑页添加掉落物：挂到该精灵的 drops
      if(m.from){
        const sp = allSpeciesDef(m.from);
        const drops = [...(sp.drops||[]), base];
        if(S.customSpecies[m.from]) S.customSpecies[m.from].drops = drops;
        else S.speciesEdits[m.from] = {...(SPECIES[m.from]||{}), drops};
      }
      toast('新增素材「'+name+'」');
    } else {
      const old = MATS[id]||{};
      S.matEdits[id] = {...old, name, elem:elemSel.value, quality:qSel.value, type:tSel.value, tags, desc:descIn.value.trim(), ecology:ecoIn.value.trim(), appearance:appIn.value.trim()};
      if(m.from) S.matEdits[id].from = m.from;
      if(exDirty) S.matEdits[id].extractInfo = {skillScore:exInfo.skillScore||{}, talentScore:exInfo.talentScore||{}};
      else delete S.matEdits[id].extractInfo;
      matState[id] = cnt;
      if(cnt>0) markMatSeen(id);
      toast('素材「'+name+'」已更新');
    }
    collectTagLib();
    saveDraft();
    closeOverlay();
    renderCodex(); renderRefine();
  };
  ma.appendChild(save);
  if(isCustom){
    const del = el('button','btn danger','删除');
    del.onclick = ()=>{
      delete S.customMats[id]; delete matState[id];
      S.furnace = S.furnace.filter(x=>x!==id);
      // 同时从精灵 drops 移除
      allSpecies().forEach(sp=>{
        if((sp.drops||[]).includes(id)){
          const drops = sp.drops.filter(x=>x!==id);
          if(S.customSpecies[sp.id]) S.customSpecies[sp.id].drops = drops;
          else S.speciesEdits[sp.id] = {...(SPECIES[sp.id]||{}), drops};
        }
      });
      collectTagLib(); saveDraft(); closeOverlay(); renderCodex(); renderRefine();
      toast('已删除');
    };
    ma.appendChild(del);
  }
  const cancel = el('button','btn ghost','取消'); cancel.onclick = closeOverlay;
  ma.appendChild(cancel);
  mb.appendChild(ma);
  ov.classList.add('open');
}

function openSpeciesForm(id){
  const ov = $('#overlay'); const mb = $('#modal-box'); mb.innerHTML='';
  const isNew = !id;
  const sp = id ? allSpeciesDef(id) : {name:'', elem:'fire', rarity:'normal', speed:50, desc:'', drops:[]};
  const isCustom = id && !!S.customSpecies[id];
  mb.appendChild(el('h2',null, isNew?'新增精灵物种':('编辑精灵 · '+sp.name)));
  const f = el('div','');
  const nameIn = document.createElement('input'); nameIn.value=sp.name||''; nameIn.placeholder='精灵名称';
  f.appendChild(fld('名称', nameIn));
  const elemSel = document.createElement('select');
  Object.keys(TYPE_CRUSH).forEach(k=>{   // 15 常驻系（表外属性无技能池/无克制，不可配置给精灵）
    const v=ELEM[k];
    const o=document.createElement('option'); o.value=k; o.textContent=v.name; if((sp.elem||'fire')===k) o.selected=true; elemSel.appendChild(o);
  });
  f.appendChild(fld('元素属性', elemSel));
  const rSel = document.createElement('select');
  [['normal','普通'],['elite','精英'],['perfect','完美'],['legend','传说']].forEach(([k,v])=>{
    const o=document.createElement('option'); o.value=k; o.textContent=v; if((sp.rarity||'normal')===k) o.selected=true; rSel.appendChild(o);
  });
  f.appendChild(fld('稀有度', rSel));
  const spdIn = document.createElement('input'); spdIn.type='number'; spdIn.min=1; spdIn.max=200; spdIn.value=sp.speed||50;
  f.appendChild(fld('速度（决定战斗先手）', spdIn));
  // 6 维种族值（M2-A2）：生命/攻击/防御/特攻/特防（速度在上方）
  const stIn = {};
  const stDef = sp.stats ? sp.stats : speciesBase({...sp, rarity:sp.rarity||'normal'});
  const stWrap = el('div','fld');
  stWrap.appendChild(el('label',null,'种族值 <span class="sub">6 维：生命/攻击/防御/特攻/特防/速度。物理技能吃攻/防，特殊技能吃特攻/特防</span>'));
  const stGrid = el('div','',''); stGrid.style.display='flex'; stGrid.style.flexWrap='wrap'; stGrid.style.gap='6px';
  [['hp','生命'],['atk','攻击'],['def','防御'],['spa','特攻'],['sdef','特防']].forEach(([k,label])=>{
    const w = el('div','',''); w.style.flex='1 1 90px';
    const inp = document.createElement('input'); inp.type='number'; inp.min=1; inp.max=120; inp.value=stDef[k]||0;
    inp.className='inp'; inp.style.width='100%';
    stIn[k]=inp;
    w.appendChild(el('div','tiny',label));
    w.appendChild(inp);
    stGrid.appendChild(w);
  });
  stWrap.appendChild(stGrid);
  f.appendChild(stWrap);
  const tagPick = tagPicker(sp.tags||[]);
  f.appendChild(fld('功能标签', tagPick.node));
  const essenceIn = document.createElement('input'); essenceIn.value = id ? essenceName(id) : '';
  essenceIn.placeholder = '默认「精灵名 + 精魄」';
  f.appendChild(fld('专属精魄名', essenceIn));
  const descIn = document.createElement('textarea'); descIn.value=sp.desc||''; descIn.placeholder='一句风物描述';
  f.appendChild(fld('描述', descIn));
  const ecoIn = document.createElement('textarea'); ecoIn.value=sp.ecology||''; ecoIn.placeholder='生态描述（栖息地/习性/食性，长文本，仅详情弹窗展示）';
  ecoIn.rows=3;
  f.appendChild(fld('生态描述', ecoIn));
  const appIn = document.createElement('textarea'); appIn.value=sp.appearance||''; appIn.placeholder='外观描述（形态/毛色/特征，长文本，仅详情弹窗展示）';
  appIn.rows=3;
  f.appendChild(fld('外观描述', appIn));
  // 掉落物配置（仅已有精灵）
  if(!isNew){
    const dropBox = el('div','fld');
    dropBox.appendChild(el('label',null,'掉落物 <span class="sub">决定野外击杀/捕捉掉什么素材</span>'));
    const dl = el('div','drop-list');
    const curDrops = (sp.drops||[]).map(did=>allMatDef(did)).filter(Boolean);
    if(curDrops.length===0) dl.appendChild(el('div','muted','尚未配置掉落物。点「添加掉落物」为该精灵配一个。'));
    curDrops.forEach(d=>{
      const row = el('div','drop-row');
      row.innerHTML = '<span class="dr-name">'+d.name+'</span>'+
        '<span class="quality-tag '+(QUALITY_RANK[d.quality]>=3?'good':(QUALITY_RANK[d.quality]>=2?'fine':'poor'))+'">'+QUALITY[d.quality].name+'</span>'+
        (d.elem&&d.elem!=='none'?elemTag(d.elem):'');
      const editB = el('button','btn sm','编辑');
      editB.onclick = ()=> openMatForm(d.id, false);
      const delB = el('button','btn sm danger','移除');
      delB.onclick = ()=>{
        const drops = (sp.drops||[]).filter(x=>x!==d.id);
        if(S.customSpecies[id]) S.customSpecies[id].drops = drops;
        else S.speciesEdits[id] = {...(SPECIES[id]||{}), drops};
        openSpeciesForm(id);
        renderCodex();
      };
      row.appendChild(editB); row.appendChild(delB);
      dl.appendChild(row);
    });
    const addB = el('button','btn sm','+ 添加掉落物');
    addB.onclick = ()=> openMatForm(null, false, {type:'beast', from:id});
    dl.appendChild(addB);
    dropBox.appendChild(dl);
    f.appendChild(dropBox);
  }
  // 进化路线配置（M2-B）：支持单分支（evoTo+evoCond）与网状多分支（evoToBranches）
  const evoWrap = el('div','fld');
  evoWrap.appendChild(el('label',null,'进化路线 <span class="sub">条件满足后可进化为目标形态；多分支=网状进化（一对多）；条件为 AND 关系。条件留空=无条件进化</span>'));
  const evoList = el('div','evo-admin-list');
  evoWrap.appendChild(evoList);
  const addEvoBtn = el('button','btn sm','+ 添加进化分支');
  evoWrap.appendChild(addEvoBtn);
  f.appendChild(evoWrap);
  let evoModel = evoBranchesOf(sp).map(b=>({to:b.to, cond:(b.cond||[]).map(c=>({...c}))}));
  const speciesOpts = allSpecies().filter(x=>x.id!==id).map(x=>({id:x.id, name:x.name, rarity:x.rarity}));
  function renderEvoAdmin(){
    evoList.innerHTML='';
    evoModel.forEach((br, idx)=>{
      const row = el('div','evo-admin-row');
      const head = el('div','',''); head.style.cssText='display:flex;gap:6px;align-items:center;margin-bottom:4px';
      const tgtSel = document.createElement('select'); tgtSel.className='inp';
      const emptyOpt = document.createElement('option'); emptyOpt.value=''; emptyOpt.textContent='— 无进化目标 —'; tgtSel.appendChild(emptyOpt);
      speciesOpts.forEach(o=>{
        const op = document.createElement('option');
        op.value=o.id; op.textContent = o.name+'（'+gradeName({rarity:o.rarity})+'）';
        if(br.to===o.id) op.selected=true;
        tgtSel.appendChild(op);
      });
      tgtSel.onchange = ()=>{ br.to = tgtSel.value; };
      const delBtn = el('button','btn sm danger','删分支');
      delBtn.onclick = ()=>{ evoModel.splice(idx,1); renderEvoAdmin(); };
      head.appendChild(tgtSel); head.appendChild(delBtn);
      row.appendChild(head);
      const condBox = el('div','evo-cond-list');
      br.cond = br.cond||[];
      br.cond.forEach((c, ci)=>{
        const cRow = el('div','evo-cond-row');
        cRow.style.cssText='display:flex;gap:4px;align-items:center;margin-top:4px';
        const typeSel = document.createElement('select'); typeSel.className='inp';
        [['lvl','等级≥'],['aff','某系亲和≥'],['stat','面板属性≥']].forEach(([v,label])=>{
          const op=document.createElement('option'); op.value=v; op.textContent=label; if(c.type===v) op.selected=true; typeSel.appendChild(op);
        });
        const affSel = document.createElement('select'); affSel.className='inp';
        Object.keys(TYPE_CRUSH).forEach(k=>{ const op=document.createElement('option'); op.value=k; op.textContent=ELEM[k].name; if(c.elem===k) op.selected=true; affSel.appendChild(op); });
        affSel.style.display = c.type==='aff' ? '' : 'none';
        affSel.onchange = ()=>{ c.elem = affSel.value; };
        const statSel = document.createElement('select'); statSel.className='inp';
        [['hp','生命'],['atk','攻击'],['def','防御'],['spa','特攻'],['sdef','特防'],['spe','速度']].forEach(([k,label])=>{
          const op=document.createElement('option'); op.value=k; op.textContent=label; if(c.k===k) op.selected=true; statSel.appendChild(op);
        });
        statSel.style.display = c.type==='stat' ? '' : 'none';
        statSel.onchange = ()=>{ c.k = statSel.value; };
        const vIn = document.createElement('input'); vIn.type='number'; vIn.className='inp'; vIn.style.width='70px'; vIn.value = c.v||0; vIn.min=0;
        vIn.oninput = ()=>{ c.v = parseInt(vIn.value)||0; };
        typeSel.onchange = ()=>{
          c.type = typeSel.value;
          if(c.type==='aff' && !c.elem) c.elem='fire';
          if(c.type==='stat' && !c.k) c.k='atk';
          renderEvoAdmin();
        };
        const delC = el('button','btn sm danger','×');
        delC.onclick = ()=>{ br.cond.splice(ci,1); renderEvoAdmin(); };
        cRow.appendChild(typeSel); cRow.appendChild(affSel); cRow.appendChild(statSel); cRow.appendChild(vIn); cRow.appendChild(delC);
        condBox.appendChild(cRow);
      });
      const addC = el('button','btn sm','+ 条件');
      addC.onclick = ()=>{ br.cond.push({type:'lvl', v:30}); renderEvoAdmin(); };
      condBox.appendChild(addC);
      row.appendChild(condBox);
      evoList.appendChild(row);
    });
  }
  addEvoBtn.onclick = ()=>{ evoModel.push({to:'', cond:[{type:'lvl', v:30}]}); renderEvoAdmin(); };
  renderEvoAdmin();
  mb.appendChild(f);
  const ma = el('div','modal-actions','');
  const save = el('button','btn primary','保存');
  save.onclick = ()=>{
    const name = nameIn.value.trim();
    if(!name){ toast('名称不能为空','bad'); return; }
    const def = {name, elem:elemSel.value, rarity:rSel.value, speed:Math.max(1, parseInt(spdIn.value)||50),
      stats:{hp:Math.max(1,parseInt(stIn.hp.value)||1), atk:Math.max(1,parseInt(stIn.atk.value)||1), def:Math.max(1,parseInt(stIn.def.value)||1), spa:Math.max(1,parseInt(stIn.spa.value)||1), sdef:Math.max(1,parseInt(stIn.sdef.value)||1)},
      tags:tagPick.get(), essenceName: essenceIn.value.trim()||undefined, drops:(sp.drops||[]), desc:descIn.value.trim(),
      ecology: ecoIn.value.trim()||undefined, appearance: appIn.value.trim()||undefined};
    // 进化配置收集（M2-B）：显式清空旧值，再按分支数写单目标或网状
    def.evoTo = undefined; def.evoCond = undefined; def.evoToBranches = undefined;
    const validBranches = evoModel.filter(b=>b.to && allSpeciesDef(b.to));
    if(validBranches.length===1){
      def.evoTo = validBranches[0].to;
      def.evoCond = (validBranches[0].cond||[]).filter(c=>c.v>0);
      if(!def.evoCond.length) def.evoCond = undefined;
    } else if(validBranches.length>1){
      def.evoToBranches = validBranches.map(b=>({to:b.to, cond:(b.cond||[]).filter(c=>c.v>0)}));
    }
    if(isNew){
      let base = 'custom_'+Math.random().toString(36).slice(2,6);
      while(SPECIES[base]||S.customSpecies[base]) base='custom_'+Math.random().toString(36).slice(2,6);
      def.id = base;
      S.customSpecies[base] = def;
      toast('新增精灵「'+name+'」');
    } else {
      def.id = id;
      S.speciesEdits[id] = {...(SPECIES[id]||{}), ...def};
      toast('精灵「'+name+'」已更新');
    }
    collectTagLib();
    saveDraft();
    closeOverlay();
    renderCodex();
    // 成套完整性提醒：精灵 + 掉落物 + 炼化配方 三者一体
    const miss = [];
    if(!(def.drops||[]).length) miss.push('掉落物');
    if(!refineRules().some(r=>r.pool==='spirit' && (r.cond&&r.cond.spirits||[]).includes(def.id))) miss.push('炼化配方');
    if(miss.length) toast('精灵「'+name+'」缺'+miss.join('、')+'（新增精灵须成套：精灵+掉落物+炼化配方）','bad');
  };
  ma.appendChild(save);
  if(isCustom){
    const del = el('button','btn danger','删除');
    del.onclick = ()=>{
      // 清理该精灵的自定义掉落物
      Object.keys(S.customMats).forEach(mid=>{
        if(S.customMats[mid].from===id){ delete S.customMats[mid]; delete matState[mid]; S.furnace = S.furnace.filter(x=>x!==mid); }
      });
      delete S.customSpecies[id]; delete S.speciesEdits[id];
      collectTagLib(); saveDraft(); closeOverlay(); renderCodex();
      toast('已删除');
    };
    ma.appendChild(del);
  }
  const cancel = el('button','btn ghost','取消'); cancel.onclick = closeOverlay;
  ma.appendChild(cancel);
  mb.appendChild(ma);
  ov.classList.add('open');
}