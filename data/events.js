// 自动从 index.html 抽出的数据块，供主 script 以全局 var 引用
// ===== EVENT_CHAINS =====

var EVENT_CHAINS = {
  /* 《赤光坠地》（冒险事件，可重复） */
  adv_starfall:{
    id:'adv_starfall', kind:'adventure', name:'赤光坠地', once:false, entry:'n0',
    nodes:{
      n0:{kind:'choice', img:null, text:'赤光拖着尾巴坠落在山那头。地面还在发烫，烟尘未散——近山的野兽已经开始骚动。', choices:[
        {label:'抄近路翻山过去', next:'n1'},
        {label:'混进兽道绕过去', next:'n2'},
        {label:'等它消停一阵再去', next:'n3'},
      ]},
      n1:{kind:'check', img:null, text:'你手脚并用地翻过发烫的山脊，碎石在脚下打滑。', check:{stat:'spe', race:100, iv:10, lvlRef:'max'},
        success:'n4', fail:'n2'},
      n2:{kind:'choice', img:null, text:'你混在兽群里从兽道绕上去，避开了正面的乱石。', choices:[
        {label:'随兽群摸到坠星坑', next:'n5'},
      ]},
      n3:{kind:'choice', img:null, text:'你等到火光弱了才动身，赶到时坑边已经围了一圈野兽。', choices:[
        {label:'趁乱摸进去看看', next:'n6'},
      ]},
      n4:{kind:'choice', img:null, text:'你比兽群先到一步。坑底那团赤光还在微微搏动。', choices:[
        {label:'抓起就跑', check:{stat:'spe', race:100, iv:10, lvlRef:'max'}, successNext:'n7', failEffects:[{type:'loseMats', qty:2}]},
        {label:'看看伴生的是什么', next:'n5'},
      ]},
      n5:{kind:'choice', img:null, text:'坑边围着几头守着坠星的野兽，正虎视眈眈。', choices:[
        {label:'隐匿绕过去', check:{stat:'spe', race:100, iv:0, lvlRef:'mid'}, successNext:'n7', failEffects:[{type:'loseMats', qty:'1~2'}]},
        {label:'突袭抢下', check:{stat:'spe', race:100, iv:0, lvlRef:'mid'}, successNext:'n7', successEffects:[{type:'status', status:'burn'}], failEffects:[{type:'loseMats', qty:'1~2'}]},
        {label:'等它们打个两败俱伤', battle:'fight_weak', battleWin:'n7', battleLoseEffects:[{type:'loseMats', qty:'1~2'}]},
        {label:'直接打服领头的', battle:'fight_beat', battleWin:'n7', winRewards:[{id:'SC_fire_rare_000559', qty:1}], battleLoseEffects:[{type:'loseMats', qty:'1~2'}]},
      ]},
      n6:{kind:'choice', img:null, text:'几拨野兽在坑里混战，赤光溅得到处都是。', choices:[
        {label:'趁乱摸走一把碎晶', rewards:[{id:'SC_fire_normal_000560', qty:1}], end:true},
        {label:'等混战结束再捡', rewards:[{id:'SC_fire_normal_000560', qty:2},{id:'SC_none_normal_000561', qty:1}], end:true},
        {label:'收拾残局的那头', battle:'fight_clean', battleWin:'n7', battleLoseEffects:[{type:'loseMats', qty:'1~2'}]},
      ]},
      n7:{kind:'end', img:null, text:'你攥住那团还温热的赤光，它在你掌心凝成一颗透亮的星晶。', rewards:[{id:'SC_fire_rare_000559', qty:1}]},
    },
  },
  /* 4 条 WONDERS 迁移到事件链结构（once:true，一套代码渲染） */
  w_fire:{
    id:'w_fire', kind:'wonder', name:'地火裂隙', once:true, entry:'n0',
    nodes:{
      n0:{kind:'choice', img:null, text:'你听见裂隙深处传来微弱的啼鸣。一头雏鸟被困在流火中，羽尖已焦。', choices:[
        {label:'冲入火中救它', next:'n1'},
        {label:'先观察片刻', end:true},
      ]},
      n1:{kind:'choice', img:null, text:'你抱出雏鸟，掌心被烫出红痕。它在你怀里发抖，却啄了啄你的手指。', choices:[
        {label:'带回营地照料', end:true, rewards:[{id:'__wonder_perk__', elem:'fire'}]},
        {label:'放回裂隙边', end:true},
      ]},
    },
  },
  w_water:{
    id:'w_water', kind:'wonder', name:'雨夜龙潭', once:true, entry:'n0',
    nodes:{
      n0:{kind:'choice', img:null, text:'雨夜，你循着水声来到一处龙潭。潭心浮着一枚微微发光的鳞片，一只老蛟在潭底沉睡。', choices:[
        {label:'潜入潭中取鳞', next:'n1'},
        {label:'在岸边静候', end:true},
      ]},
      n1:{kind:'choice', img:null, text:'你取到鳞片，老蛟却睁开了眼。它没有发怒，只是静静看你——鳞片在你掌心化作一滴水。', choices:[
        {label:'对蛟深深一揖', end:true, rewards:[{id:'__wonder_skill__', elem:'water', skillId:'deluge'}]},
        {label:'转身就跑', end:true},
      ]},
    },
  },
  w_thunder:{
    id:'w_thunder', kind:'wonder', name:'雷殛古木', once:true, entry:'n0',
    nodes:{
      n0:{kind:'choice', img:null, text:'一棵古木被雷劈作两半，木心却仍在噼啪作响，雷光未散。', choices:[
        {label:'贴近木心听雷', next:'n1'},
        {label:'砍一段雷木带走', end:true},
      ]},
      n1:{kind:'choice', img:null, text:'你贴近木心，雷声灌入耳中，竟渐渐听懂了它的节拍。', choices:[
        {label:'与雷同鸣', end:true, rewards:[{id:'__wonder_perk__', elem:'thunder'}]},
        {label:'以指代槌击木', end:true},
      ]},
    },
  },
  w_light:{
    id:'w_light', kind:'wonder', name:'坠星遗迹', once:true, entry:'n0',
    nodes:{
      n0:{kind:'choice', img:null, text:'一颗流星坠入前方废墟，你赶到时，坑底还亮着微弱的星光。', choices:[
        {label:'跳入坑中触碰星光', next:'n1'},
        {label:'在坑边收集碎屑', end:true},
      ]},
      n1:{kind:'choice', img:null, text:'星光灼手，却没有烫伤你——它顺着指尖渗入，像在辨认什么。', choices:[
        {label:'放任星光流遍全身', end:true, rewards:[{id:'__wonder_skill__', elem:'light', skillId:'creatio'}]},
        {label:'甩手把它震落', end:true},
      ]},
    },
  },
}

// ===== WONDERS =====

var WONDERS = [
  {id:'w_fire', elem:'fire', title:'地火裂隙', story:[
    {text:'你听见裂隙深处传来微弱的啼鸣。一头雏鸟被困在流火中，羽尖已焦。', choices:[{label:'冲入火中救它', to:1},{label:'先观察片刻', to:2}]},
    {text:'你抱出雏鸟，掌心被烫出红痕。它在你怀里发抖，却啄了啄你的手指。', choices:[{label:'带回营地照料', to:3, good:true},{label:'放回裂隙边', to:4}]},
    {text:'你犹豫的工夫，流火吞没裂隙，雏鸟再无动静。只捡到几块被烤热的火石。', choices:[], outcome:'bad'},
    {text:'雏鸟化作一点流火没入你怀中——它把一缕本源赠予了你。', choices:[], outcome:'perfect'},
    {text:'雏鸟踉跄飞走，落下一枚温热的火羽。', choices:[], outcome:'normal'},
  ], perfect:{kind:'perk', elem:'fire', itemId:'blaze-affinity', desc:'地火雏鸟赠予的本源：火系相性 +0.3'}, normal:'', bad:''},
  {id:'w_water', elem:'water', title:'雨夜龙潭', story:[
    {text:'雨夜，你循着水声来到一处龙潭。潭心浮着一枚微微发光的鳞片，一只老蛟在潭底沉睡。', choices:[{label:'潜入潭中取鳞', to:1},{label:'在岸边静候', to:2}]},
    {text:'你取到鳞片，老蛟却睁开了眼。它没有发怒，只是静静看你——鳞片在你掌心化作一滴水。', choices:[{label:'对蛟深深一揖', to:3, good:true},{label:'转身就跑', to:4}]},
    {text:'你等到雨停，鳞片已被水波冲走，只余满潭寒凉。', choices:[], outcome:'bad'},
    {text:'水珠没入眉心——那是老蛟赠予的一段水之真意。', choices:[], outcome:'perfect'},
    {text:'你带着鳞片离开，它在怀中化作一粒水珠，再无奇处。', choices:[], outcome:'normal'},
  ], perfect:{kind:'skill', elem:'water', itemId:'deluge', desc:'老蛟真意所授：水系高阶技能「洪流」'}, normal:'', bad:''},
  {id:'w_thunder', elem:'thunder', title:'雷殛古木', story:[
    {text:'一棵古木被雷劈作两半，木心却仍在噼啪作响，雷光未散。', choices:[{label:'贴近木心听雷', to:1},{label:'砍一段雷木带走', to:2}]},
    {text:'你贴近木心，雷声灌入耳中，竟渐渐听懂了它的节拍。', choices:[{label:'与雷同鸣', to:3, good:true},{label:'以指代槌击木', to:4}]},
    {text:'雷木入手即枯，只剩一截焦炭。', choices:[], outcome:'bad'},
    {text:'雷光应你而鸣，一缕雷意顺着指尖游入经脉。', choices:[], outcome:'perfect'},
    {text:'你与雷意擦肩而过，只余耳鸣。', choices:[], outcome:'normal'},
  ], perfect:{kind:'perk', elem:'thunder', itemId:'storm-affinity', desc:'古木雷意：雷系相性 +0.3'}, normal:'', bad:''},
  {id:'w_light', elem:'light', title:'坠星遗迹', story:[
    {text:'一颗流星坠入前方废墟，你赶到时，坑底还亮着微弱的星光。', choices:[{label:'跳入坑中触碰星光', to:1},{label:'在坑边收集碎屑', to:2}]},
    {text:'星光灼手，却没有烫伤你——它顺着指尖渗入，像在辨认什么。', choices:[{label:'放任星光流遍全身', to:3, good:true},{label:'甩手把它震落', to:4}]},
    {text:'碎屑在你手中暗淡下去，化为一把灰。', choices:[], outcome:'bad'},
    {text:'星光在你体内凝成一团小小的星核——那是光明的亲睐。', choices:[], outcome:'perfect'},
    {text:'星光落回坑底，熄灭前似有叹息。', choices:[], outcome:'normal'},
  ], perfect:{kind:'skill', elem:'light', itemId:'creatio', desc:'星核所示：光系高阶技能「创世之光」'}, normal:'', bad:''},
]
