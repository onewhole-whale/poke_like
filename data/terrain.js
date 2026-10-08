// 自动从 index.html 抽出的数据块，供主 script 以全局 var 引用
// ===== TERRAIN =====

var TERRAIN = {
  lake:           {id:'lake',           name:'湖泊',     type:'水域', veg:'无',   size:1, icon:'🌊', attribAffinity:['water']},
  river:          {id:'river',          name:'河流',     type:'水域', veg:'无',   size:1, icon:'🏞️', attribAffinity:['water']},
  mudflat:        {id:'mudflat',        name:'滩涂',     type:'水域', veg:'无',   size:1, icon:'🏖️', attribAffinity:['water','earth']},
  beach:          {id:'beach',          name:'沙滩',     type:'水域', veg:'无',   size:1, icon:'🏝️', attribAffinity:['water','earth']},
  grassland:      {id:'grassland',      name:'草原',     type:'平原', veg:'草原', size:1, icon:'🌾', attribAffinity:['grass','normal']},
  gobi:           {id:'gobi',           name:'戈壁',     type:'平原', veg:'荒漠', size:1, icon:'🏜️', attribAffinity:['earth','normal']},
  swamp:          {id:'swamp',         name:'沼泽',     type:'平原', veg:'沼泽', size:1, icon:'🟢', attribAffinity:['poison','water','grass']},
  tundra:         {id:'tundra',        name:'冻原',     type:'平原', veg:'冻原', size:1, icon:'❄️', attribAffinity:['water','normal']},
  savanna:        {id:'savanna',        name:'稀树草原', type:'平原', veg:'草原', size:1, icon:'🌿', attribAffinity:['grass','wind']},
  plain_forest:   {id:'plain_forest',   name:'平原森林', type:'平原', veg:'森林', size:1, icon:'🌲', attribAffinity:['grass','wind']},
  hill:           {id:'hill',           name:'丘陵',     type:'山地', veg:'无',   size:1, icon:'⛰️', attribAffinity:['earth','normal']},
  mountain:       {id:'mountain',       name:'高山',     type:'山地', veg:'无',   size:1, icon:'🏔️', attribAffinity:['earth','normal']},
  valley:         {id:'valley',         name:'山谷',     type:'山地', veg:'无',   size:1, icon:'🏞️', attribAffinity:['earth','normal']},
  mountain_forest:{id:'mountain_forest',name:'高山森林', type:'山地', veg:'森林', size:1, icon:'🌲', attribAffinity:['earth','grass']},
  valley_forest:  {id:'valley_forest',  name:'谷底森林', type:'山地', veg:'森林', size:1, icon:'🌲', attribAffinity:['earth','grass']},
  plateau:        {id:'plateau',        name:'平坦高原', type:'高原', veg:'无',   size:1, icon:'🛤️', attribAffinity:['earth','normal']},
  plateau_cut:    {id:'plateau_cut',   name:'切割高原', type:'高原', veg:'无',   size:1, icon:'⛰️', attribAffinity:['earth','normal']},
  plateau_forest: {id:'plateau_forest', name:'高原森林', type:'高原', veg:'森林', size:1, icon:'🌲', attribAffinity:['earth','grass']},
  poison_swamp:   {id:'poison_swamp',  name:'毒瘴沼泽', type:'平原', veg:'积毒烂泥', size:1, icon:'☠️', attribAffinity:['poison','water','grass'], isVariant:true, baseTerrain:'swamp'},
  volcano:        {id:'volcano',       name:'火山',     type:'山地', veg:'火山岩', size:1, icon:'🌋', attribAffinity:['fire','earth']},
}
