// 自动从 index.html 抽出的数据块，供主 script 以全局 var 引用
// ===== MAP_CONFIGS =====

var MAP_CONFIGS = {
  gentlebreeze:{
    id:'gentlebreeze', name:'微风平原', size:7,
    desc:'草原与平原森林铺展，丘陵山谷错落，一弯河流穿境而过。',
    challengeLvl:[1,15],   // M3-1-5a 挑战等级区间
    // 锚点配置：4 类型锚各 1（全随机）+ 河流锚（最后落）
    anchors:{
      types:[
        {id:'plain',  terrains:['grassland','plain_forest']},
        {id:'water',  terrains:['lake']},
        {id:'mountain',terrains:['hill','valley']},
        {id:'plateau',terrains:['plateau']},
      ],
      priority:['plain','water','mountain','plateau'],   // 同格被多锚侵占时的归属优先级
      river:{last:true, len:[2,4], edgeOr:['plateau']},
    },
    // 派生地形表：各地形产出与品质分布
    tileMats:{
      grassland:     {plant:[2,4], ore:[0,1], qualityDist:{normal:.65, good:.25, fine:.08, rare:.02}},
      plain_forest: {plant:[3,5], ore:[0,0], qualityDist:{normal:.55, good:.30, fine:.13, rare:.02}},
      lake:          {plant:[1,3], ore:[0,1], qualityDist:{normal:.65, good:.25, fine:.10}},
      river:         {plant:[1,2], ore:[0,0], qualityDist:{normal:.75, good:.20, fine:.05}},
      hill:          {plant:[1,2], ore:[1,2], qualityDist:{normal:.60, good:.25, fine:.13, rare:.02}},
      valley:        {plant:[1,3], ore:[2,3], qualityDist:{normal:.55, good:.25, fine:.15, rare:.05}},
      plateau:       {plant:[1,2], ore:[1,2], qualityDist:{normal:.65, good:.25, fine:.10}},
    },
    // 派生事件表
    eventConfig:{
      eventCounts:{fight_normal:10, fight_elite:3, fight_boss:1, adventure:2, wonder:2},
      difficultyDist:{easy:.25, normal:.5, hard:.25},
      fightPools:{
        fight_normal:{species:['JL_fire_normal_0001','JL_water_normal_0023','JL_thunder_normal_0038','JL_wind_normal_0041','JL_earth_normal_0046','JL_light_normal_0087','JL_ghost_normal_0094','JL_dark_normal_0070','JL_poison_normal_0080','JL_fire_elite_0002','JL_fire_perfect_0003'], weights:{normal:8, elite:3, perfect:.8}},
        fight_elite:{species:['JL_fire_elite_0007','JL_water_elite_0024','JL_thunder_elite_0039','JL_earth_elite_0047','JL_light_elite_0088','JL_ghost_elite_0095','JL_dark_elite_0071','JL_poison_elite_0081','JL_fire_perfect_0003'], weights:{elite:8, perfect:3, normal:1}},
        fight_boss:{species:['JL_fire_perfect_0003','JL_water_perfect_0025','JL_thunder_perfect_0040','JL_earth_perfect_0048','JL_light_perfect_0089'], weights:{perfect:8, elite:2}},
      },
      // M3-1-6：地块级敌人池（按属性偏向）
      tilePools:{
        grassland:    {fight_normal:{species:['JL_wind_normal_0077','JL_wind_normal_0041','JL_fire_normal_0001'], weights:{normal:8, elite:2}}, fight_elite:{species:['JL_wind_elite_0078','JL_wind_elite_0042'], weights:{elite:8, perfect:2}}, fight_boss:{species:['JL_wind_perfect_0079'], weights:{perfect:8}}},
        plain_forest: {fight_normal:{species:['JL_wind_normal_0077','JL_wind_normal_0041'], weights:{normal:8, elite:2}}, fight_elite:{species:['JL_wind_elite_0078'], weights:{elite:8}}, fight_boss:{species:['JL_wind_perfect_0079'], weights:{perfect:8}}},
        lake:         {fight_normal:{species:['JL_water_normal_0023'], weights:{normal:8, elite:2}}, fight_elite:{species:['JL_water_elite_0024'], weights:{elite:8}}, fight_boss:{species:['JL_water_perfect_0025'], weights:{perfect:8}}},
        river:        {fight_normal:{species:['JL_water_normal_0023'], weights:{normal:8, elite:2}}, fight_elite:{species:['JL_water_elite_0024'], weights:{elite:8}}, fight_boss:{species:['JL_water_perfect_0025'], weights:{perfect:8}}},
        hill:         {fight_normal:{species:['JL_earth_normal_0046'], weights:{normal:8, elite:2}}, fight_elite:{species:['JL_earth_elite_0047'], weights:{elite:8}}, fight_boss:{species:['JL_earth_perfect_0048'], weights:{perfect:8}}},
        valley:       {fight_normal:{species:['JL_earth_normal_0046'], weights:{normal:8, elite:2}}, fight_elite:{species:['JL_earth_elite_0047'], weights:{elite:8}}, fight_boss:{species:['JL_earth_perfect_0048'], weights:{perfect:8}}},
        plateau:      {fight_normal:{species:['JL_earth_normal_0046'], weights:{normal:8, elite:2}}, fight_elite:{species:['JL_earth_elite_0047'], weights:{elite:8}}, fight_boss:{species:['JL_earth_perfect_0048'], weights:{perfect:8}}},
      },
      buffRule:{count:1, pool:['b-regen','b-energy-5','b-harden','b-vuln']},
      // M3-1-5a 事件链条目池 + 战斗分支敌人参数
      eventPools:{
        adventure:['adv_starfall'],
        wonder:['w_fire','w_water','w_thunder','w_light'],
      },
      eventParams:{
        fight_weak: {enemies:[{speciesId:'JL_fire_normal_0001', template:'normal'}]},
        fight_clean:{enemies:[{speciesId:'JL_fire_normal_0001', template:'normal'},{speciesId:'JL_thunder_normal_0038', template:'normal'}]},
        fight_beat: {enemies:[{speciesId:'JL_fire_elite_0007', template:'elite'},{speciesId:'JL_wind_normal_0041', template:'elite'}]},
      },
      extraDrops:{
        fight_normal:[],
        fight_elite:[{itemId:'DJ_none_002012', weight:1},{itemId:'DJ_none_002014', weight:1}],
        fight_boss:  [{itemId:'DJ_none_002013', weight:1},{itemId:'DJ_none_002015', weight:1}],
      },
    },
  },
  stillswamp:{
    id:'stillswamp', name:'静水沼泽', size:7,
    desc:'沼泽泥泞，毒瘴弥漫，湖泊点缀其间。',
    challengeLvl:[1,15],
    anchors:{
      types:[
        {id:'plain',  terrains:['swamp','grassland']},
        {id:'water',  terrains:['lake']},
      ],
      priority:['plain','water'],
    },
    variants:[
      {id:'poison_swamp', base:'swamp', spreadSize:[2,5]},
    ],
    tileMats:{
      swamp:        {plant:[2,4], ore:[0,1], qualityDist:{normal:.65, good:.25, fine:.08, rare:.02}},
      grassland:    {plant:[2,3], ore:[0,0], qualityDist:{normal:.70, good:.20, fine:.08}},
      lake:         {plant:[1,2], ore:[0,1], qualityDist:{normal:.65, good:.25, fine:.10}},
      poison_swamp: {plant:[1,3], ore:[0,1], qualityDist:{normal:.60, good:.25, fine:.12, rare:.03}},
    },
    eventConfig:{
      eventCounts:{fight_normal:10, fight_elite:3, fight_boss:1, adventure:2, wonder:2},
      difficultyDist:{easy:.25, normal:.5, hard:.25},
      fightPools:{
        fight_normal:{species:['JL_water_normal_0023','JL_poison_normal_0080','JL_wind_normal_0077','JL_ghost_normal_0094'], weights:{normal:8, elite:3}},
        fight_elite:{species:['JL_water_elite_0024','JL_poison_elite_0081'], weights:{elite:8, perfect:2}},
        fight_boss:{species:['JL_poison_perfect_0082','JL_water_perfect_0025'], weights:{perfect:8, elite:2}},
      },
      buffRule:{count:1, pool:['b-regen','b-vuln','b-thorn']},
      eventPools:{
        adventure:['adv_starfall'],
        wonder:['w_water','w_thunder','w_light'],
      },
      eventParams:{
        fight_weak: {enemies:[{speciesId:'JL_water_normal_0023', template:'normal'}]},
        fight_clean:{enemies:[{speciesId:'JL_poison_normal_0080', template:'normal'},{speciesId:'JL_wind_normal_0077', template:'normal'}]},
        fight_beat: {enemies:[{speciesId:'JL_poison_elite_0081', template:'elite'}]},
      },
      extraDrops:{fight_normal:[],fight_elite:[],fight_boss:[]},
    },
  },
  smokevolcano:{
    id:'smokevolcano', name:'冒烟火山', size:7,
    desc:'火山为核心，山地为主，热浪逼人。',
    challengeLvl:[1,25],
    anchors:{
      types:[
        {id:'mountain',terrains:['volcano','mountain','hill','valley']},
      ],
      priority:['mountain'],
    },
    tileMats:{
      volcano:   {plant:[0,0], ore:[2,4], qualityDist:{normal:.50, good:.30, fine:.15, rare:.05}},
      mountain:  {plant:[0,1], ore:[2,3], qualityDist:{normal:.55, good:.28, fine:.13, rare:.04}},
      hill:      {plant:[1,2], ore:[1,2], qualityDist:{normal:.60, good:.25, fine:.13, rare:.02}},
      valley:    {plant:[1,3], ore:[1,2], qualityDist:{normal:.55, good:.25, fine:.15, rare:.05}},
    },
    eventConfig:{
      eventCounts:{fight_normal:10, fight_elite:3, fight_boss:1, adventure:2, wonder:2},
      difficultyDist:{easy:.25, normal:.5, hard:.25},
      fightPools:{
        fight_normal:{species:['JL_fire_normal_0001','JL_earth_normal_0046','JL_thunder_normal_0038'], weights:{normal:8, elite:3}},
        fight_elite:{species:['JL_fire_elite_0002','JL_earth_elite_0047','JL_thunder_elite_0039'], weights:{elite:8, perfect:2}},
        fight_boss:{species:['JL_fire_perfect_0003','JL_earth_perfect_0048'], weights:{perfect:8, elite:2}},
      },
      buffRule:{count:1, pool:['b-fury','b-berserk','b-thorn']},
      eventPools:{
        adventure:['adv_starfall'],
        wonder:['w_fire','w_thunder'],
      },
      eventParams:{
        fight_weak: {enemies:[{speciesId:'JL_fire_normal_0001', template:'normal'}]},
        fight_clean:{enemies:[{speciesId:'JL_fire_normal_0001', template:'normal'},{speciesId:'JL_earth_normal_0046', template:'normal'}]},
        fight_beat: {enemies:[{speciesId:'JL_fire_elite_0002', template:'elite'}]},
      },
      extraDrops:{fight_normal:[],fight_elite:[],fight_boss:[]},
    },
  },
}

// ===== ZONES =====

var ZONES = {
  burning:{id:'burning', name:'焚风原', elem:'fire', desc:'火山与焦土，火系妖兽盘踞', species:['JL_fire_normal_0001','JL_fire_normal_0009','JL_fire_normal_0016','JL_fire_normal_0053','JL_fire_elite_0007','JL_fire_elite_0002','JL_fire_perfect_0003','JL_fire_elite_0010','JL_fire_perfect_0011','JL_fire_elite_0017','JL_fire_perfect_0018','JL_fire_elite_0054','JL_fire_perfect_0055','JL_fire_normal_0006','JL_fire_perfect_0008','JL_fire_legend_0109']},
  rain:{id:'rain', name:'夜雨泽', elem:'water', desc:'常年夜雨的泽地，水汽蒸腾', species:['JL_water_normal_0023','JL_water_elite_0085','JL_poison_elite_0081','JL_water_elite_0024','JL_water_perfect_0025','JL_water_perfect_0086','JL_poison_normal_0080','JL_poison_perfect_0082']},
  thunder:{id:'thunder', name:'雷殛岭', elem:'thunder', desc:'雷云终年不散的山岭', species:['JL_thunder_normal_0038','JL_thunder_normal_0030','JL_thunder_normal_0033','JL_thunder_elite_0039','JL_thunder_perfect_0040','JL_thunder_elite_0031','JL_thunder_perfect_0032','JL_thunder_elite_0034','JL_thunder_perfect_0035']},
  wind:{id:'wind', name:'风吼峡', elem:'wind', desc:'风刃削壁的峡谷，无处落脚', species:['JL_wind_normal_0041','JL_thunder_normal_0038','JL_wind_normal_0056','JL_wind_normal_0077','JL_wind_elite_0042','JL_wind_perfect_0043','JL_wind_elite_0057','JL_wind_perfect_0058','JL_wind_elite_0078','JL_wind_perfect_0079']},
  earth:{id:'earth', name:'沉沙谷', elem:'earth', desc:'沙尘与岩脉交错的谷地', species:['JL_earth_normal_0046','JL_fire_normal_0009','JL_earth_normal_0063','JL_earth_elite_0105','JL_earth_elite_0047','JL_earth_perfect_0048','JL_earth_elite_0064','JL_earth_perfect_0065','JL_earth_normal_0104','JL_earth_perfect_0106']},
  twilight:{id:'twilight', name:'暮光林', elem:'light', desc:'星辉漏进林间的暮色林地', species:['JL_light_elite_0088','JL_water_normal_0023','JL_ghost_elite_0095','JL_dark_normal_0070','JL_poison_elite_0102','JL_dark_legend_0108','JL_dark_legend_0107','JL_light_normal_0087','JL_light_perfect_0089','JL_ghost_normal_0094','JL_ghost_perfect_0096','JL_dark_elite_0071','JL_dark_perfect_0072','JL_poison_normal_0101','JL_poison_perfect_0103']},
}
