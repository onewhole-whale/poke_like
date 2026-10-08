
/* 副本视图：战斗 + 结果 */
function renderSettle(){
  const root = $('#settle-root'); root.innerHTML='';
  const st = S.settle;
  if(!st || !st.spiritId || !spById(st.spiritId)){
    root.appendChild(el('div','card','<h3>尚无冒险在途</h3><div class="muted" style="margin-top:6px">请先在「副本构建」选好灵兽、投入素材，再起程入秘境。</div>'));
    return;
  }
  const sp = spById(st.spiritId);
  const hd = el('div','card','');
  hd.innerHTML = '<div class="wn-tag">秘境 · 连战 '+(st.idx)+'/'+st.enemies.length+' · 已击杀 '+st.kills+'</div>'+
    '<div class="wn-title">'+sp.name+' 的秘境试炼</div>'+
    '<div class="tiny" style="margin-top:4px">常驻增益：'+dgBuffText()+'</div>';
  root.appendChild(hd);
  if(st.phase==='done'){
    renderDgResult(root, st, sp);
    return;
  }
  const b = st.battle;
  if(!b){ root.appendChild(el('div','muted','秘境正在苏醒…')); return; }
  // B1：副本战斗接入通用渲染引擎（废弃 bp- 旧布局，统一走 renderBattle）
  const battleCard = renderBattle({battle:b, sp:sp, ctx:{
    source:'dungeon',
    defOf:dgSkillDef,
    usableOf:dgSkillUsable,
    onSkill:dgBattleSkill,
    onResult:(b,sp)=>dgResultModal(b, st, spById(st.spiritId))
  }});
  root.appendChild(battleCard);
  const bottom = el('div','card','');
  bottom.appendChild(el('h3',null,'本趟战报'));
  st.logs.slice(-8).forEach(l=> bottom.appendChild(el('div','blog good', l)));
  root.appendChild(bottom);
}
function renderDgResult(root, st, sp){
  const card = el('div','result-card','');
  const won = st.won;
  card.innerHTML = '<div class="rc-name">'+(won?'秘境通关':'力竭败退')+'</div>'+
    '<div class="rc-type">击杀 '+st.kills+' 只 · 经验 +'+st.exp+'（5 倍）</div>'+
    '<div class="rc-desc">'+(won?'敌影尽散，'+sp.name+' 踏出秘境。':'它记住了这次的败退，下次会更强。')+'</div>';
  root.appendChild(card);
  st.logs.slice(-6).forEach(l=> root.appendChild(el('div','blog good', l)));
  if(st.record){
    root.appendChild(el('div','tiny','已留下副本记录：'+wordsText(st.record.words)+'（修炼页可复刻挂机）'));
  }
  if(st.rewards && st.rewards.length){
    root.appendChild(el('h3',null,'收获'));
    st.rewards.forEach(r=>{
      const c = el('div','result-card');
      if(r.wonder){
        c.innerHTML = '<div class="rc-name">'+r.wonder.desc+'</div><div class="rc-type">奇遇兑现 · '+ELEM[r.elem].name+'系</div>';
      } else if(r.kind==='skill'){
        const exist = sp.skills.find(x=>x.id===r.item.id);
        c.innerHTML = '<div class="rc-name">'+(exist?'熟练度精进 · '+r.item.name:'习得技能 · '+r.item.name)+'</div>'+
          '<div class="rc-type">技能 · '+ELEM[r.elem].name+'系'+(exist?' · 熟练度 '+exist.mastery:' · 已入技能库')+'</div>'+
          '<div class="rc-desc">'+r.item.desc+'</div>';
      } else if(r.kind==='perk'){
        c.innerHTML = '<div class="rc-name">获得专长 · '+r.item.name+'</div>'+
          '<div class="rc-type">专长 · 占容量 '+r.item.cost+' / '+sp.capacity+'</div>'+
          '<div class="rc-desc">'+r.item.desc+'</div>';
      }
      root.appendChild(c);
    });
  } else if(won && st.gainType==='roll' && matsCount(st.mats)>0){
    root.appendChild(el('div','muted','存在分未能命中（或投入素材不足 1000 分被抽空）。'));
  }
  const ar = el('div','action-row','');
  const back = el('button','action-btn primary2','<span class="ab-t">返回副本构建</span><span class="ab-d">再来一趟</span>');
  back.onclick = ()=>{ S.settle={spiritId:null, enemies:[], idx:0, kills:0, buffs:[], phase:'idle', battle:null, exp:0, plan:{}, gainType:'roll', logs:[], mats:{}, words:{}}; location.hash='#/build'; };
  const home = el('button','action-btn','<span class="ab-t">返回灵兽仓</span><span class="ab-d">清点收获</span>');
  home.onclick = ()=>{ location.hash='#/stable'; };
  ar.appendChild(back); ar.appendChild(home);
  root.appendChild(ar);
}


/* ================= 野外冒险视图 ================= */;

/* 奇遇故事：完美结局的收获会在副本结算时替代对应属性的一次判定 */;

/* ================= M3-1-5a 事件链（群星式 choice/check/end 节点引擎） =================
   事件条目 = {id, kind, name, once, entry, nodes:{}}
   choice 节点：{kind:'choice', text, choices:[{label, cond?, check?, battle?, rewards?, effects?, next?, end?}]}
   check  节点：{kind:'check', text, check:{stat,race,iv,lvlRef}, success, fail, failEffects?}
   end    节点：{kind:'end', text, rewards?, effects?} */;