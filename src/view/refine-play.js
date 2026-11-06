
function renderPreview(){
  const box = $('#refine-preview'); box.innerHTML='';
  const info = comboInfo();
  const v1 = el('div','preview-line','<span>素材价值</span><b>'+info.value.toFixed(1)+'</b>');
  setTip(v1,'投入素材总数（份）。剩余未产出素材每 4 单位折算 1 点灵息结晶。');
  box.appendChild(v1);
  // v1.16.7: 预计技能石/专长石（逐素材 extractInfo ≥200 分）
  const stoneTally = {};
  furnaceMats().forEach(m=>{
    const ei = extractInfoOf(m);
    for(const sid in (ei.skillScore||{})){
      const cnt = Math.floor(ei.skillScore[sid]/200);
      if(cnt>0){ const dj = Object.keys(ITEMS).find(x=>ITEMS[x].skillId===sid); if(dj) stoneTally[dj]=(stoneTally[dj]||0)+cnt; }
    }
    for(const pid in (ei.talentScore||{})){
      const cnt = Math.floor(ei.talentScore[pid]/200);
      if(cnt>0){ const dj = Object.keys(ITEMS).find(x=>ITEMS[x].perkId===pid); if(dj) stoneTally[dj]=(stoneTally[dj]||0)+cnt; }
    }
  });
  const stoneKeys = Object.keys(stoneTally);
  if(stoneKeys.length>0){
    const stoneTxt = stoneKeys.map(k=>itemInfo(k).name+' ×'+stoneTally[k]).join('、');
    const vStone = el('div','preview-line','<span>预计技能石</span><b>'+stoneTxt+'</b>');
    setTip(vStone,'逐素材独立判定：该素材任一技能/专长分 ≥200 即出石（每 200 分 1 块，余数弃）。出石素材不再走素材路径。');
    box.appendChild(vStone);
  }
  const candTxt = info.cands.length===0 ? '未命中定向配方'
    : (info.cands.map(id=>allSpeciesDef(id).name).join('、')+' · 出灵兽概率 '+(info.chance*100).toFixed(info.chance<.1?2:0)+'%');
  const v2 = el('div','preview-line','<span>可出灵兽</span><b>'+candTxt+'</b>');
  setTip(v2,'仅投入符合定向配方的素材才可能出灵兽；命中 3 种以上配方时掷 1% 出灵概率（演示模式大幅提高）。出灵兽则本炉不再出素材。');
  box.appendChild(v2);
  const pb = el('div','prob-bar'); pb.appendChild(el('i',null,''));
  requestAnimationFrame(()=>{ pb.querySelector('i').style.width = (info.chance*100)+'%'; });
  box.appendChild(pb);
  const v3 = el('div','preview-line','<span>异色概率</span><b>'+(info.shiny*100).toFixed(0)+'%</b>');
  setTip(v3,'炼出灵兽之后单独再判定一次。只有已放出异色立绘的物种才会出异色，异色不占普通灵兽之位。');
  box.appendChild(v3);
  const pb2 = el('div','prob-bar'); pb2.appendChild(el('i','gold',''));
  requestAnimationFrame(()=>{ pb2.querySelector('i').style.width = (info.shiny*100)+'%'; });
  box.appendChild(pb2);
  const candBox = el('div','candidate-list');
  if(info.cands.length===0){
    candBox.appendChild(el('span','muted','未命中任何灵兽配方：此炉只出常规素材产出（见下）'));
  }else{
    const fateCap = S.demo ? 60 : 120;
    info.cands.forEach(sid=>{
      const sp = allSpeciesDef(sid);
      const fate = S.refineFate[sid]||0;
      const near = fate>=fateCap*0.83;
      candBox.appendChild(el('span','cand'+(near?' near':'')+'', sp.name+(sp.rarity!=='normal'?' · '+gradeName(sp):'')+' <span class="tiny muted">缘分 '+fate+'/'+fateCap+'</span>'));
    });
  }
  box.appendChild(candBox);
  if(info.extras.length>0){
    const v4 = el('div','preview-line','<span>常规产出</span><b>'+info.extras.map(r=>r.name).join('、')+'</b>');
    setTip(v4,'未出灵兽时，按素材萃取规则逐轮抽取的产出：每命中一个规则抽一次，并消耗对应的词条单位。');
    box.appendChild(v4);
  }
  // 词条单位汇总（一鱼多吃：每素材每条词条各计一份，含少量/大量/巨量换算）
  const wTop = Object.entries(info.bPool||{}).sort((a,b)=>b[1]-a[1]);
  if(wTop.length>0){
    const v5 = el('div','preview-line','<span>词条单位</span><b>'+wTop.map(([w,u])=>(ELEM[w]?ELEM[w].name:w)+' '+u.toFixed(1)).join(' · ')+'</b>');
    setTip(v5,'每个素材的每条词条各计一份，用于灵兽配方。少量、大量、巨量会改变这一份的重量。');
    box.appendChild(v5);
  }
  const spTop = Object.entries(info.sPool||{}).sort((a,b)=>b[1]-a[1]).slice(0,3);
  if(spTop.length>0){
    const v6 = el('div','preview-line','<span>萃取提纯</span><b>'+spTop.map(([w,u])=>elemName(w)+' '+u.toFixed(1)+' 单位').join(' · ')+'</b>');
    setTip(v6,'素材判定池：多词条素材按「单位最多的词条」逐轮归并萃取后的结果 Top3，此池用于素材产出匹配。');
    box.appendChild(v6);
  }
  // 素材规则触发次数预览
  const mC = matCandidates(refineRules(), info.sPool||{}, furnaceMats());
  if(mC.length>0){
    const v7 = el('div','preview-line','<span>素材触发</span><b>'+mC.map(x=>x.r.name+' ×'+x.times).join('、')+'</b>');
    setTip(v7,'按当前萃取池，各素材产出规则分别可触发几次：每次抽取消耗对应的词条单位，抽完会重新计算剩余可触发次数。');
    box.appendChild(v7);
  }
  box.appendChild(el('div','tiny','须命中定向配方，词条和品质都要达标。炼出灵兽后，异色另算一次概率。'));
}

/* 炼化主流程 */
function doRefine(){
  if(S.furnace.length===0) return;
  // ===== 药剂：普通植物×2+生命精华×1→血瓶；普通矿物×2+生命精华×1→蓝瓶 =====
  const plantN = S.furnace.filter(id=>id==='SC_none_normal_000002').length;
  const oreN = S.furnace.filter(id=>id==='SC_none_normal_000008').length;
  const lifeIn = S.furnace.filter(id=>id==='SC_none_fine_000001').length;
  if(lifeIn>=1 && plantN>=2){
    if((matState['SC_none_normal_000002']||0)<2 || (matState['SC_none_fine_000001']||0)<1){
      toast('需要普通植物素材 ×2 与生命精华 ×1','bad'); return;
    }
    matState['SC_none_normal_000002']-=2;
    matState['SC_none_fine_000001']--;
    S.toolInv = S.toolInv||{};
    S.toolInv['DJ_none_002020'] = (S.toolInv['DJ_none_002020']||0)+1;
    S.furnace = [];
    saveDraft();
    toast('炼出：血瓶 ×1');
    renderRefine();
    return;
  }
  if(lifeIn>=1 && oreN>=2){
    if((matState['SC_none_normal_000008']||0)<2 || (matState['SC_none_fine_000001']||0)<1){
      toast('需要普通矿物素材 ×2 与生命精华 ×1','bad'); return;
    }
    matState['SC_none_normal_000008']-=2;
    matState['SC_none_fine_000001']--;
    S.toolInv = S.toolInv||{};
    S.toolInv['DJ_none_002021'] = (S.toolInv['DJ_none_002021']||0)+1;
    S.furnace = [];
    saveDraft();
    toast('炼出：蓝瓶 ×1');
    renderRefine();
    return;
  }
  // ===== v1.17.0 锻造模式：蓝图分支（优秀/精良工具）=====
  const bpId = S.furnace.find(id=>{const it=ITEMS[id]; return it && it.type==='blueprint';});
  if(bpId){
    const bp = ITEMS[bpId];
    const targetId = Object.keys(ITEMS).find(tid=>{
      const it=ITEMS[tid];
      return it.type==='tool' && it.kind===bp.kind && it.quality===bp.quality;
    });
    if(!targetId){ toast('蓝图无对应工具配方','bad'); S.furnace=[]; renderRefine(); return; }
    const target = ITEMS[targetId];
    // 单大类同品质素材×3（斧→植物、镐→矿物）+ 生命精华×1
    const kindMat = (bp.kind==='pick') ? 'ore' : 'plant';
    const idx = (kindMat==='ore'?8:2)+(QUALITY_RANK[bp.quality]||0);
    const matId = 'SC_none_'+bp.quality+'_'+String(idx).padStart(6,'0');
    if((matState[matId]||0)<3){ toast('素材不足：需要 '+matInfo(matId).name+' ×3','bad'); return; }
    if((matState['SC_none_fine_000001']||0)<1){ toast('需要生命精华 ×1','bad'); return; }
    if((S.blueprintInv[bpId]||0)<1){ toast('蓝图不足','bad'); return; }
    S.blueprintInv[bpId]--;
    matState[matId]-=3;
    matState['SC_none_fine_000001']--;
    S.toolInv = S.toolInv||{};
    S.toolInv[targetId] = (S.toolInv[targetId]||0)+1;
    S.toolDur = S.toolDur||{};
    S.toolDur[targetId] = target.durability;
    S.furnace = [];
    saveDraft();
    toast('锻造成功：'+target.name);
    renderRefine();
    return;
  }
  // ===== 普通工具分支：无蓝图，同大类普通素材×3 + 生命精华×1 → 普通工具 =====
  // 检测投料中 plant/ore 类普通测试素材数
  const plainPlant = S.furnace.filter(id=> id.startsWith('SC_none_normal_') && ['000002'].includes(id.slice(-6))).length;
  const plainOre = S.furnace.filter(id=> id==='SC_none_normal_000008').length;
  const hasLife = S.furnace.includes('SC_none_fine_000001');
  if(hasLife && (plainPlant>=3 || plainOre>=3)){
    const kind = plainPlant>=3 ? 'axe' : 'pick';
    const targetId = Object.keys(ITEMS).find(tid=>{
      const it=ITEMS[tid];
      return it.type==='tool' && it.kind===kind && it.quality==='normal';
    });
    const target = ITEMS[targetId];
    const kindMat = (kind==='pick') ? 'ore' : 'plant';
    const matId = kindMat==='ore' ? 'SC_none_normal_000008' : 'SC_none_normal_000002';
    if((matState[matId]||0)<3){ toast('素材不足：需要 '+matInfo(matId).name+' ×3','bad'); return; }
    if((matState['SC_none_fine_000001']||0)<1){ toast('需要生命精华 ×1','bad'); return; }
    matState[matId]-=3;
    matState['SC_none_fine_000001']--;
    S.toolInv = S.toolInv||{};
    S.toolInv[targetId] = (S.toolInv[targetId]||0)+1;
    S.toolDur = S.toolDur||{};
    S.toolDur[targetId] = target.durability;
    S.furnace = [];
    saveDraft();
    toast('锻造成功：'+target.name);
    renderRefine();
    return;
  }
  const mats = furnaceMats();
  const bPool = spiritPool(mats);      // 灵兽判定池（一鱼多吃，不萃取）
  const cauldron = $('#cauldron');
  $('#btn-refine').disabled = true;
  $('#cauldron-state').textContent = '炉火正盛';
  cauldron.classList.remove('idle'); cauldron.classList.add('burning');
  setTimeout(()=>{
    // 判定
    const now = new Date();
    const stamp = now.getHours().toString().padStart(2,'0')+':'+now.getMinutes().toString().padStart(2,'0');
    // 消耗素材：普通素材扣 matState，妖兽移除出库（名称先取好，出库后即不可查）
    const usedNames = S.furnace.map(id=> id.startsWith('beast:') ? '妖兽「'+beastNameById(id)+'」' : (matInfo(id)?matInfo(id).name:id)).join('、');
    S.furnace.forEach(id=>{
      if(id.startsWith('beast:')) S.beasts = S.beasts.filter(b=>'beast:'+b.id!==id);
      else if(matState[id]!=null) matState[id]--;
    });
    S.furnace = [];
    let outcome = null;
    // ===== 阶段1：灵兽判定（B池）——仅定向配方可出灵兽，命中即 roll 1% =====
    const sc = spiritCandidates(bPool, mats);
    const cands = sc.cands;
    if(cands.length>0 && sc.directed){
      // M3-1 缘分保底：候选池非空 → 池中每只 fate+1
      const fateCap = S.demo ? 60 : 120;
      cands.forEach(sid=>{ S.refineFate[sid]=(S.refineFate[sid]||0)+1; });
      // 必出：池中存在 fate≥cap 的 → 直接出（多只按品质权重）
      const guaranteed = cands.filter(sid=>(S.refineFate[sid]||0)>=fateCap);
      let sid = null;
      let rolled = false;
      if(guaranteed.length>0){
        sid = pickSpiritByRarity(guaranteed);
        rolled = true;
      } else if(roll(S.demo ? .28 : .01)){
        sid = pickSpiritByRarity(cands);
        rolled = true;
      }
      if(rolled && sid){
        delete S.refineFate[sid];   // 出后只清被出那只
        const shiny = hasShinyArt(sid) && roll(S.demo ? .18 : .05);
        outcome = {kind:'spirit', speciesId:sid, shiny, used:usedNames, stamp};
      }
    }
    // ===== 阶段2：技能石/专长石判定（素材独立，不跨素材聚合） =====
    if(!outcome){
      const gains = [];
      // 2a. 逐素材看 extractInfo：任一技能/专长分 ≥200 → 该素材出石头（每 200 分 1 块，余数弃）
      const matsLeft = [];
      for(const m of mats){
        const ei = extractInfoOf(m);
        let usedForStone = false;
        for(const sid in (ei.skillScore||{})){
          const sc = ei.skillScore[sid];
          const cnt = Math.floor(sc/200);
          if(cnt>0){
            // 找 DJ_ 道具
            const djId = Object.keys(ITEMS).find(id=>ITEMS[id].skillId===sid);
            if(djId) gains.push({id:djId, name:ITEMS[djId].name, n:cnt, tag:'技能石'});
            usedForStone = true;
          }
        }
        for(const pid in (ei.talentScore||{})){
          const sc = ei.talentScore[pid];
          const cnt = Math.floor(sc/200);
          if(cnt>0){
            const djId = Object.keys(ITEMS).find(id=>ITEMS[id].perkId===pid);
            if(djId) gains.push({id:djId, name:ITEMS[djId].name, n:cnt, tag:'专长石'});
            usedForStone = true;
          }
        }
        if(!usedForStone) matsLeft.push(m);
      }
      // 2b. 未出石头的素材走素材炼化路径（默认规则仅 r-chr-fine/r-chr-perf/r-gel，r-micro/r-ling/r-sprout 已删）
      const sPool = extractPool(matsLeft);
      const rules = refineRules();
      let guard = 0;
      while(guard++<60){
        const c2 = matCandidates(rules, sPool, matsLeft);
        if(c2.length===0) break;
        const total = c2.reduce((a,x)=>a+x.times,0);
        let rnd = Math.random()*total, picked=null;
        for(const x of c2){ rnd-=x.times; if(rnd<0){ picked=x; break; } }
        if(!picked) break;
        const got = resolveRulePoolByWord(picked.r, picked.word);
        if(!got) break;
        gains.push(got);
        sPool[picked.word] = (sPool[picked.word]||0) - picked.cost;
        if((sPool[picked.word]||0)<=0) delete sPool[picked.word];
      }
      // 生命精华特例：可视为任意同品质纯洁灵材 → 生命之凝材
      if((sPool['life']||0)>=1){
        gains.push({id:'ling-life-mat', name:'生命之凝材', n:Math.floor(sPool['life']), tag:'标准灵材'});
        delete sPool['life'];
      }
      // 2c. 剩余词条单位转灵息结晶：outLing = 1 + floor(剩余单位/4)；剩余 0 → 不出
      const remainUnits = Object.values(sPool).reduce((a,x)=>a+x,0);
      if(remainUnits>0){
        const lingN = 1 + Math.floor(remainUnits/4);
        gains.push({id:'__ling__', name:'灵息结晶', n:lingN, tag:'门票'});
      }
      if(gains.length>0){
        outcome = {kind:'mats', gains, used:usedNames, stamp};
      } else {
        outcome = {kind:'mat', n:0, used:usedNames, stamp};
      }
    }
    cauldron.classList.remove('burning'); cauldron.classList.add('idle');
    $('#cauldron-state').textContent = '炉火渐熄';
    resolveRefine(outcome);
  }, 1500);
}