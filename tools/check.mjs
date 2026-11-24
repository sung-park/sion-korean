import { SCENES, PAIRS } from '../js/content.js';
let n=0; for (const s of SCENES){ console.log(`\n[${s.id}] ${s.a}`); for (const [c,x] of Object.entries(s.next)){ n++; console.log(`  ${c} ${x.b}  =>  ${x.joined}`); } }
console.log('\nscenes', SCENES.length, 'pairs', PAIRS.length, 'full triples', SCENES.filter(s=>Object.keys(s.next).length===3).length);
const ids = new Set(); for (const s of SCENES){ if (ids.has(s.id)) throw new Error('dup '+s.id); ids.add(s.id); }
