/* 异色按版本放出，不跟全图鉴一起做。
   一只精灵能出异色，要同时满足两件：物种 id 写在下面，并且
   assets/portraits/shiny/ 里有「编号_物种id.png」。
   异色灵兽只能进化到同样开了异色的形态；目标没开，这条进化走不通。
   已放出：燎雀一家（016 燎雀 → 017 燎山 → 018 烧云），以及 058 蔽月。没单独画异色图的物种不在这里，炼不出异色。
   异色燎山的另一支落星还没有异色图，所以那条进化走不通。
   蔽月的上游月刃、穿影还没有异色图，异色进化到蔽月的那两条也走不通。 */
const SHINY_ART = {
  JL_fire_normal_0016:1,
  JL_fire_elite_0017:1,
  JL_fire_perfect_0018:1,
  JL_wind_perfect_0058:1
};
function hasShinyArt(speciesId){
  return !!(speciesId && SHINY_ART[speciesId]);
}
