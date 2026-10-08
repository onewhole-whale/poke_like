
function roll(p){ return Math.random() < p; }
function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function spById(id){ return S.spirits.find(s=>s.id===id); }
function hasNormal(speciesId){ return S.spirits.some(s=>s.speciesId===speciesId && !s.shiny); }
function hasAnyShiny(speciesId){ return S.spirits.some(s=>s.speciesId===speciesId && s.shiny); }