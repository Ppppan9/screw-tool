import fs from 'fs';
import { initState, platePins, referenceLevel, generateLevel } from '../src/level.js';
import { DEFS } from '../src/settings.js';
function bad(L) { const st = initState(L); const out = []; L.plates.forEach((p, pi) => platePins(L, st, pi).forEach(si => { const h = L.screws[si].hole; const own = L.plates.filter(q => q.holes.includes(h)).map(q => q.layer); if (!p.holes.includes(h) && Math.max(...own) < p.layer) out.push(pi + '<-s' + si); })); return out; }
console.log('reference', bad(referenceLevel()));
const S = { ...DEFS }; console.log('random1', bad(generateLevel(S, 1)).length);
for (const n of ['heart', 'star_hole', 'cat']) { const { out } = JSON.parse(fs.readFileSync(`/tmp/lv_${n}.json`)); console.log(n, out.map(L => bad(L).length).join(' ')); }
