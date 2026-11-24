// Builds a ~10-minute mixed session. Pairs are picked by a small Leitner-style weight: never-seen and recently-missed
// pairs come up more often; mastered pairs (box 4-5) still return now and then.
import { SCENES, PAIRS, CONNS } from './content.js';
import { state } from './store.js';
export const TYPES = {
  fill:    { name:'빈칸 채우기',   icon:'🧩', hint:'빈칸에 알맞은 이음말을 골라요' },
  next:    { name:'이어 말하기',   icon:'🔗', hint:'이음말 다음에 올 문장을 골라요' },
  meaning: { name:'어떤 사이?',    icon:'🤔', hint:'두 문장은 어떤 사이일까요?' },
  join:    { name:'문장 줄이기',   icon:'✂️', hint:'두 문장을 한 문장으로 줄여요' },
  build:   { name:'조각 맞추기',   icon:'🧱', hint:'조각을 순서대로 눌러 한 문장을 만들어요' },
  hidden:  { name:'숨은 이음말',   icon:'🔍', hint:'밑줄 친 말에 숨은 이음말을 찾아요' },
  spot:    { name:'틀린 곳 찾기',  icon:'🕵️', hint:'이음말을 알맞게 썼는지 살펴봐요' },
  match:   { name:'짝 맞추기',     icon:'🎯', hint:'문장을 누르고, 어울리는 이음말을 눌러요' },
};
const rnd = n => Math.floor(Math.random() * n);
export const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--){ const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function weight(key){
  const p = state().pairs[key]; if (!p) return 6;
  const days = (Date.now() - p.last) / 864e5;
  return Math.max(0.4, (6 - p.box) ** 1.6 / 3 + (p.box >= 4 && days > 3 ? 1.5 : 0));
}
function pick(list, used, w = x => weight(x.key)){
  const pool = list.filter(x => !used.has(x.s ? x.s.id : x.id));
  const src = pool.length ? pool : list;
  let tot = 0; const ws = src.map(x => (tot += w(x)));
  const r = Math.random() * tot; return src[ws.findIndex(x => x >= r)];
}
/** one item of the given type; used = set of scene ids already used this session (keeps the session varied) */
export function makeItem(type, used = new Set(), forced = null){
  let pair = forced;
  if (type === 'match'){
    const full = SCENES.filter(s => Object.keys(s.next).length === 3);
    const s = forced ? forced.s : pick(full, used, s => Math.max(...CONNS.map(c => weight(s.id + ':' + c))));
    used.add(s.id); return { type, s, pairs: CONNS.map(c => PAIRS.find(p => p.key === s.id + ':' + c)) };
  }
  if (type === 'next') { const ok = PAIRS.filter(p => Object.keys(p.s.next).length >= 2); pair = pair || pick(ok, used); }
  pair = pair || pick(PAIRS, used);
  used.add(pair.s.id);
  const it = { type, pair, key: pair.key, conn: pair.c };
  if (type === 'spot'){
    // show a wrong connective only where it is clearly wrong: 그래서 <-> 그런데 (result vs. surprise). 그리고 is shown only when right.
    const wrong = { 그래서:'그런데', 그런데:'그래서' }[pair.c];
    it.shown = (wrong && Math.random() < 0.55) ? wrong : pair.c;
  }
  return it;
}
/** a day's plan: easy kinds first, then the joining kinds, a match round in the middle */
export function planSession(len = 12, sessionsDone = 0){
  const plan = sessionsDone === 0
    ? ['meaning','fill','fill','next','meaning','fill','match','hidden','next','join','fill','join']
    : shuffle(['fill','fill','next','meaning','spot']).concat(['match'], shuffle(['join','join','build','hidden','next','spot']));
  while (plan.length < len) plan.push(['fill','join','build','next','spot'][rnd(5)]);
  const used = new Set();
  // weak pairs (box 0 with a miss) are fed back as the first few items' pairs, in a gentle type
  const weak = PAIRS.filter(p => (state().pairs[p.key]?.wrong || 0) > 0 && state().pairs[p.key].box < 2);
  const review = shuffle(weak).slice(0, 3);
  let ri = 0;
  return plan.slice(0, len).map((t, i) => {
    let r = null;
    if (i >= 1 && t !== 'match' && ri < review.length){ r = review[ri++]; if (used.has(r.s.id)) r = null; }
    return makeItem(t, used, r);
  });
}
