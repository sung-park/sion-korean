import { SCENES, PAIRS, CONNS } from '../js/content.js';
console.log(JSON.stringify({ a: SCENES.map(s => [s.id, s.a]), b: PAIRS.map(p => [p.key, p.s.id + '_' + CONNS.indexOf(p.c), p.b]) }));
