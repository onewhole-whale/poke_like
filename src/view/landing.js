

/* 个体值编辑器（M2-A3）：6 属性各一输入 0-20，最多 3 项非 0；返回读取函数 {iv} 或 {err} */
function buildIVEditor(container, current, opts){
  opts = opts||{};
  const wrap = el('div','','');
  wrap.style.margin='8px 0 2px';
  wrap.appendChild(el('div','tiny', opts.hint || '选择个体值 <span class="sub">最多 3 个面板属性拥有个体值，单项 1–20 点；个体值 = 先天资质，其余属性为 0</span>'));
  const inputs = {};
  IV_KEYS.forEach(k=>{
    const row = el('div','','');
    row.style.cssText='display:flex;align-items:center;gap:8px;margin:5px 0;';
    const lbl = el('span',null, IV_NAME[k]); lbl.style.cssText='width:44px;font-size:12px;color:var(--paper-dim);';
    const inp = document.createElement('input');
    inp.type='number'; inp.min=0; inp.max=20; inp.value=(current&&current[k])||0;
    inp.className='inp'; inp.style.cssText='width:60px;';
    row.appendChild(lbl); row.appendChild(inp);
    wrap.appendChild(row); inputs[k]=inp;
  });
  container.appendChild(wrap);
  return function readIV(){
    const out = {}; let cnt=0;
    for(const k of IV_KEYS){
      const v = parseInt(inputs[k].value,10)||0;
      if(v<0 || v>20) return {err:'个体值须在 0–20 之间'};
      if(v>0){ out[k]=v; cnt++; }
    }
    if(cnt>3) return {err:'最多 3 个面板属性拥有个体值'};
    return {iv:out};
  };
}

/* 落地二选一弹层 */
function openLandingModal(o, sp){
  const ov = $('#overlay');
  const mb = $('#modal-box'); mb.innerHTML='';
  const shiny = o.shiny;
  mb.appendChild(el('h2',null, (shiny?'异色 ':'')+sp.name+' · 灵兽'));
  mb.appendChild(el('div','m-sub', '炉火中一声清鸣，一头灵兽在壶中成形。灵兽资质圆满、性格自选，是真正的伙伴。请决定它的来处。'));
  // 说明
  mb.appendChild(el('div','choice-block disabled', '<div class="cb-title">壶中新生（本次炼化之姿）</div>'+
    '<div class="cb-desc">'+(shiny?'<span class="tag shiny">异色</span> 天生异色，独立于普通灵兽之位。':'普通之姿')+'　可投入素材：<b>'+o.used+'</b></div>'));
  // 选项A：直接落库（含性格自选）
  const a = el('div','choice-block', '<div class="cb-title">直接落库 · 就此入门</div>'+
    '<div class="cb-desc">档案记为「炼妖壶炼化而生」，从此随你冒险。</div>');
  let aDisabled = false;
  if(!shiny && hasNormal(sp.id)){
    aDisabled = true;
    a.classList.add('disabled');
    a.querySelector('.cb-desc').innerHTML = '仓库已有一只普通'+sp.name+'（同种普通灵兽唯一），再得将化作'+essenceName(sp.id)+'。';
  }
  if(!aDisabled){
    // 性格自选（M2-A1）：抄宝可梦，25 性格，面板 ±10%
    const natWrap = el('div','','');
    natWrap.style.margin='10px 0 2px';
    natWrap.appendChild(el('div','tiny','选择性格 <span class="sub">修正攻击/防御/特攻/特防/速度中的两项 ±10%，血量不受影响；落库后仍可在详情页以灵息 ×1 调整</span>'));
    const natSel = document.createElement('select');
    natSel.className = 'inp';
    NATURES.forEach(n=>{
      const op=document.createElement('option'); op.value=n.id; op.textContent=natureDesc(n.id);
      if(n.id==='serious') op.selected=true;
      natSel.appendChild(op);
    });
    natWrap.appendChild(natSel);
    a.appendChild(natWrap);
    // 个体值自选（M2-A3）：最多 3 项、单项 1-20，落库后可用洗髓露重选
    const readIV = buildIVEditor(a, {}, {hint:'选择个体值 <span class="sub">最多 3 个面板属性拥有个体值，单项 1–20 点；个体值 = 先天资质，其余属性为 0。落库后可在详情页用洗髓露重选</span>'});
    a.onclick = ()=>{
      if(aDisabled) return;
      const r = readIV();
      if(r.err){ toast(r.err,'bad'); return; }
      landSpirit({speciesId:sp.id, shiny, source:'由「'+o.used+'」炼化而生，先天资质圆满', fromRefine:true, nature:natSel.value, iv:r.iv});
      closeOverlay();
    };
  } else {
    a.onclick = ()=>{};
  }
  mb.appendChild(a);
  // 选项B：妖兽承接飞升
  const sameBeasts = S.beasts.filter(b=>b.speciesId===sp.id);
  const b = el('div','choice-block', '<div class="cb-title">妖兽飞升 · 以旧魂承新身</div>'+
    '<div class="cb-desc">选一只同种族妖兽承接这具灵体：妖兽舍肉身、魂魄重塑，全部战斗履历迁入新灵兽。选异色妖兽承接，无论本次炼化之姿，终得异色灵兽。</div>');
  mb.appendChild(b);
  const beastWrap = el('div','', '');
  beastWrap.style.marginTop='10px';
  mb.appendChild(beastWrap);
  function renderBeastChoices(){
    beastWrap.innerHTML='';
    if(sameBeasts.length===0){
      beastWrap.appendChild(el('div','muted','仓库中没有同种族妖兽。可先去秘境捕捉，或直接落库。'));
    }else{
      sameBeasts.forEach(bt=>{
        const spx = allSpeciesDef(bt.speciesId);
        let disabled = false, hint='';
        if(hasNormal(sp.id) && !bt.shiny){
          disabled = true;
          hint = '已有普通灵兽，普通妖兽承接后仍将化作'+essenceName(sp.id)+'，毫无意义';
        }
        const row = el('div','beast-row'+(disabled?'':' sel'), '');
        row.innerHTML = '<div><div class="b-name">'+spx.name+(bt.shiny?' <span class="tag shiny">异色</span>':'')+'</div>'+
          '<div class="b-info">捕获于 '+bt.caught+' · 性格 '+natureDesc(bt.nature)+(ivSummary(bt).length?' · 个体值 '+ivSummary(bt).map(([k,v])=>IV_NAME[k]+'+'+v).join(' '):'')+(disabled?' · '+hint:' · 点击承接（性格与个体值随旧魂继承）')+'</div></div>';
        if(!disabled){
          row.onclick = ()=>{
            landSpirit({speciesId:sp.id, shiny: bt.shiny ? true : shiny, source:'承接妖兽「'+spx.name+'」飞升重塑：'+bt.caught+' 起一路相伴的旧魂，脱胎为灵兽', fromRefine:true, beastId:bt.id, rainbow:!!bt.shiny, nature:bt.nature});
            closeOverlay();
          };
        } else {
          row.style.opacity='.45';
        }
        beastWrap.appendChild(row);
      });
    }
  }
  renderBeastChoices();
  mb.appendChild(el('div','modal-actions','<button class="btn ghost" id="m-cancel">先收着</button>'));
  $('#m-cancel').onclick = ()=>{
    // 未落地：灵兽散作灵息，材料不返还
    S.aura += 3;
    S.logs.unshift({t:stampNow(), cls:'ling', text:'犹豫片刻，壶中灵兽散作 <b>灵息结晶 ×3</b> 归于壶底。'});
    closeOverlay(); renderRefine();
    toast('灵兽散去，化作灵息 ×3');
  };
  ov.classList.add('open');
}