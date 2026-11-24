// Progress lives in localStorage under a versioned key. New fields are only ever ADDED with defaults (see DEFAULTS),
// so older saves keep working; never rename or repurpose a field.
const KEY = 'sk.v1';
const DEFAULTS = () => ({ v:1, created: Date.now(), gems:0, gemsTotal:0, streak:{count:0, best:0, last:null}, days:{}, stamps:{},
  owned:{}, pairs:{}, stats:{conn:{}, type:{}}, log:[], sessions:[], chestsOpened:0,
  settings:{ sound:true, voice:true, len:12 } });
function merge(def, cur){
  if (cur === null || typeof cur !== 'object' || Array.isArray(def)) return cur === undefined ? def : cur;
  const out = { ...cur };
  for (const k of Object.keys(def)) out[k] = (k in cur) ? merge(def[k], cur[k]) : def[k];
  return out;
}
let S;
try { S = merge(DEFAULTS(), JSON.parse(localStorage.getItem(KEY) || 'null') || {}); } catch(e){ S = DEFAULTS(); }
export const state = () => S;
export function save(){ try { localStorage.setItem(KEY, JSON.stringify(S)); } catch(e){} }
export function reset(){ S = DEFAULTS(); save(); }
export const today = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const bump = (obj, k, ok) => { const a = obj[k] || (obj[k] = [0,0]); if (ok) a[0]++; a[1]++; };
/** record one answer. first = was it right on the first try */
export function record({ key, conn, type, ok }){
  const p = S.pairs[key] || (S.pairs[key] = { box:0, seen:0, wrong:0, last:0 });
  p.seen++; p.last = Date.now();
  if (ok) p.box = Math.min(5, p.box + 1); else { p.box = 0; p.wrong++; }
  bump(S.stats.conn, conn, ok); bump(S.stats.type, type, ok);
  const d = S.days[today()] || (S.days[today()] = { items:0, correct:0, sessions:0, ms:0 });
  d.items++; if (ok) d.correct++;
  S.log.push({ t: Date.now(), key, conn, type, ok }); if (S.log.length > 600) S.log.splice(0, S.log.length - 600);
  save();
}
export function finishSession({ n, correct, ms }){
  const t = today(), d = S.days[t] || (S.days[t] = { items:0, correct:0, sessions:0, ms:0 });
  d.sessions++; d.ms += ms;
  S.sessions.push({ d:t, ts:Date.now(), n, correct, ms }); if (S.sessions.length > 200) S.sessions.shift();
  // streak counts days with at least one finished session
  const y = new Date(); y.setDate(y.getDate() - 1);
  if (S.streak.last !== t){ S.streak.count = (S.streak.last === today(y)) ? S.streak.count + 1 : 1; S.streak.last = t; }
  S.streak.best = Math.max(S.streak.best, S.streak.count);
  save();
}
