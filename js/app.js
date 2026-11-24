import { SCENES, PAIRS, CONNS, MEANING, TOPICS } from './content.js';
import { TYPES, makeItem, planSession, shuffle } from './session.js';
import { state, save, record, finishSession, today, reset } from './store.js';
import { gi } from './grammar.js';
import { BLOCKS, block } from './sprites.js';
import * as A from './audio.js';

const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c]));
const wait = ms => new Promise(r => setTimeout(r, ms));
const S = state;
const CC = c => `c-${CONNS.indexOf(c)}`;               // css class per connective (colour)
const chip = (c, extra = '') => `<span class="conn ${CC(c)} ${extra}">${c}</span>`;
const blank = (txt = '?') => `<span class="blank">${txt}</span>`;
const STAMPS = ['⭐','🌈','🦸','🧱','💎','🚀','🏆','🍀','🔥','🎈','🌟','🐉'];
const stampFor = d => STAMPS[[...d].reduce((a, c) => a + c.charCodeAt(0), 0) % STAMPS.length];
const PRAISE = ['ok1','ok2','ok3','ok4','ok5'];

function sound(){ const st = S().settings; A.configure({ sfx: st.sound, ko: st.voice }); }
const sfx = n => A.sfx(n);
const say = (cat, key) => A.play(cat, key);
function readPair(p, withConn = true, withB = true){
  const items = [['a', p.s.id]]; if (withConn) items.push(['c', p.c]); if (withB) items.push(['b', p.key]);
  return A.seq(items.filter(([c, k]) => A.has(c, k)), 250);
}
const spk = (label = '듣기') => A.has('a', SCENES[0].id) ? `<button class="spk" aria-label="${label}">🔊</button>` : '';

// ---------------------------------------------------------------- screens
const routes = { home, play, pick, dex, rules, parent };
function go(h){ location.hash = h; }
window.addEventListener('hashchange', route);
function route(){ A.stop(); const [r, arg] = location.hash.replace(/^#\/?/, '').split('/'); (routes[r] || home)(arg); window.scrollTo(0, 0); }

function topbar(title, back = '#/home'){
  return `<header class="top"><a class="back" href="${back}" aria-label="뒤로">◀</a><h2>${title}</h2><span class="gems">💎 ${S().gems}</span></header>`;
}

function home(){
  const st = S(), t = today(), doneToday = st.days[t]?.sessions > 0;
  const week = [...Array(7)].map((_, i) => { const d = new Date(); d.setDate(d.getDate() - 6 + i); const k = today(d);
    const has = st.days[k]?.sessions > 0; return `<div class="day ${has ? 'on' : ''} ${k === t ? 'today' : ''}"><b>${'일월화수목금토'[d.getDay()]}</b><span>${has ? stampFor(k) : '·'}</span></div>`; }).join('');
  const owned = Object.keys(st.owned).length;
  app.innerHTML = `<section class="screen home">
    <div class="hero-row">${block('grass', { size: 76, face: true })}<div><h1>시온이의 <em>이음말</em> 탐험</h1>
      <p class="sub">${chip('그리고')} ${chip('그런데')} ${chip('그래서')}</p></div></div>
    <button class="big go" id="today">${doneToday ? '한 번 더 연습하기' : '오늘의 연습 시작!'} <small>10분 · ${st.settings.len}문제</small></button>
    <div class="week">${week}</div>
    <div class="stat-row"><div class="stat">🔥 <b>${st.streak.count}</b>일 연속</div><div class="stat">💎 <b>${st.gems}</b></div><div class="stat">🧱 <b>${owned}</b>/${Object.keys(BLOCKS).length}</div></div>
    <nav class="menu">
      <a href="#/pick" class="tilebtn"><span>🎮</span>골라서 연습</a>
      <a href="#/rules" class="tilebtn"><span>📜</span>이음말 비법</a>
      <a href="#/dex" class="tilebtn"><span>🧱</span>블록 도감</a>
    </nav>
    <button class="parent-link" id="par">👪 부모님</button>
  </section>`;
  $('#today').onclick = () => { sfx('tap'); go('#/play'); };
  $('#par').onclick = gate;
}

function pick(){
  app.innerHTML = `<section class="screen">${topbar('골라서 연습')}
    <div class="pick-grid">${Object.entries(TYPES).map(([k, t]) => `<a class="tilebtn" href="#/play/${k}"><span>${t.icon}</span>${t.name}<small>${t.hint}</small></a>`).join('')}</div></section>`;
}

function rules(){
  const ex = { 그리고:'tteok', 그런데:'tteok', 그래서:'tteok' };
  app.innerHTML = `<section class="screen">${topbar('이음말 비법')}
    ${CONNS.map(c => { const m = MEANING[c], p = PAIRS.find(x => x.key === ex[c] + ':' + c);
      return `<div class="rule ${CC(c)}"><div class="rule-h"><span class="ricon">${m.icon}</span>${chip(c)}<b>${m.name}</b></div>
      <p class="kid">${m.kid}</p>
      <p class="sent">${esc(p.s.a)} ${chip(c)} ${esc(p.b)}</p>
      <p class="arrow">⬇️ 한 문장으로 줄이면 <span class="endg">${m.join}</span></p>
      <p class="sent">${esc(p.s.pre)} <u>${p.form}</u> ${esc(p.b)}</p></div>`; }).join('')}
    <div class="rule tip"><p class="kid">💡 <b>${chip('그래서')}</b> 뒤에는 앞에서 생긴 일 때문에 일어난 일이 와요.<br>
    💡 <b>${chip('그런데')}</b> 뒤에는 “어? 생각이랑 다르네!” 하는 일이 와요.<br>💡 <b>${chip('그리고')}</b> 뒤에는 “~도” 하고 하나 더 말하는 일이 와요.</p></div>
  </section>`;
  app.querySelectorAll('.rule .ricon').forEach((el, i) => el.parentElement.parentElement.onclick = () => say('fx', 'm_' + CONNS[i]));
}

// ---------------------------------------------------------------- practice
let run = null;
function play(only){
  sound();
  const st = S(), first = st.sessions.length === 0;
  const items = only && TYPES[only] ? (() => { const u = new Set(); return [...Array(8)].map(() => makeItem(only, u)); })()
                                    : planSession(st.settings.len, st.sessions.length);
  run = { items, i: 0, correct: 0, gems: 0, start: Date.now(), only: !!only, retried: new Set(), total: items.length };
  if (!only) say('fx', first ? 'start1' : 'start');
  next();
}
function shell(it){
  const done = run.i, tot = run.items.length;
  const bar = [...Array(tot)].map((_, k) => `<i class="${k < done ? 'f' : ''}"></i>`).join('');
  app.innerHTML = `<section class="screen play">
    <header class="top"><a class="back" href="#/home" aria-label="그만하기">✕</a><div class="bar">${bar}</div><span class="gems">💎 ${S().gems}</span></header>
    <div class="qtype">${TYPES[it.type].icon} ${TYPES[it.type].name}</div>
    <div class="card" id="card"></div>
    <div id="opts" class="opts"></div>
    <div id="fb" class="fb hidden"></div></section>`;
  return { card: $('#card'), opts: $('#opts') };
}
async function next(){
  if (!run) return;
  if (run.i >= run.items.length) return endSession();
  const it = run.items[run.i];
  const el = shell(it);
  RENDER[it.type](it, el);
  const s = $('.spk'); if (s) s.onclick = e => { e.stopPropagation(); it.read ? it.read() : readPair(it.pair); };
}
/** called by each renderer: ok = right on the first try */
async function answered(it, ok, { pairs = null, quiet = false } = {}){
  if (pairs) pairs.forEach(([p, o]) => record({ key: p.key, conn: p.c, type: it.type, ok: o }));
  else record({ key: it.pair.key, conn: it.pair.c, type: it.type, ok });
  if (ok){ run.correct++; run.gems++; S().gems++; S().gemsTotal++; save(); sfx('ok'); say('fx', PRAISE[Math.floor(Math.random() * PRAISE.length)]);
    const g = $('.gems'); if (g){ g.textContent = `💎 ${S().gems}`; g.classList.add('pop'); } }
  else if (!run.retried.has(it.pair?.key || it.s?.id)){
    // missed items come back once, a few questions later, as the same kind of question
    run.retried.add(it.pair?.key || it.s?.id);
    const again = it.type === 'match' ? makeItem('match', new Set(), it.pairs[0]) : makeItem(it.type, new Set(), it.pair);
    run.items.splice(Math.min(run.items.length, run.i + 3), 0, again);
  }
}
function advance(ms = 1100){ setTimeout(() => { if (!run) return; run.i++; next(); }, ms); }
/** wrong-answer sheet: the right answer + a short kid explanation */
function explain(it, html){
  const fb = $('#fb'); fb.classList.remove('hidden');
  fb.innerHTML = `<div class="sheet"><div class="sheet-h">괜찮아! 같이 알아보자 🙂</div>${html}<button class="big ok" id="gotit">알겠어! ➜</button></div>`;
  say('fx', 'wrong');
  $('#gotit').onclick = () => { sfx('tap'); fb.classList.add('hidden'); run.i++; next(); };
}
function meaningBox(p){
  const m = MEANING[p.c];
  let why = m.kid;
  if (p.c === '그래서') why += `<br><span class="because">“${esc(p.s.pre)} <b>${gi(p.s.v, p.s.t)}</b>” ➡️ ${esc(p.b)}</span>`;
  if (p.c === '그런데') why += `<br><span class="because">“${esc(p.s.a)}” 그런데… 어? ${esc(p.b)}</span>`;
  if (p.c === '그리고' && /도 /.test(p.b)) why += `<br><span class="because">“~도”가 보이면 하나 더 말하는 거예요.</span>`;
  return `<div class="mbox ${CC(p.c)}"><span class="ricon">${m.icon}</span>${chip(p.c)} <b>${m.name}</b><p>${why}</p></div>`;
}
const fullSent = p => `<p class="sent ans">${esc(p.s.a)} ${chip(p.c)} ${esc(p.b)}</p>`;
const joinRule = p => `<div class="mbox ${CC(p.c)}">${chip(p.c)} ➡️ <b class="endg">${MEANING[p.c].join}</b>
  <p class="trans"><s>${esc(p.s.pred)}</s> + ${p.c} ➡️ <u>${p.form}</u></p></div><p class="sent ans">${esc(p.s.pre)} <u>${p.form}</u> ${esc(p.b)}</p>`;

function optButtons(el, list, onPick, cls = ''){
  el.opts.className = 'opts ' + cls;
  el.opts.innerHTML = list.map((o, k) => `<button class="opt ${o.cls || ''}" data-k="${k}">${o.html}</button>`).join('');
  el.opts.querySelectorAll('.opt').forEach(b => b.onclick = () => { if (el.opts.dataset.lock) return; onPick(list[+b.dataset.k], b); });
}
function lock(el){ el.opts.dataset.lock = 1; }
function mark(b, ok){ b.classList.add(ok ? 'right' : 'wrong'); if (!ok) sfx('soft'); }
const connOpts = () => CONNS.map(c => ({ c, html: chip(c), cls: CC(c) }));

const RENDER = {
  fill(it, el){
    const p = it.pair;
    el.card.innerHTML = `${spk()}<p class="hint">${TYPES.fill.hint}</p><div class="pic">${p.s.emoji}<span>${p.e}</span></div>
      <p class="sent">${esc(p.s.a)}</p><p class="sent">${blank()} ${esc(p.b)}</p>`;
    it.read = () => readPair(p, false);
    optButtons(el, connOpts(), (o, b) => { lock(el); const ok = o.c === p.c; mark(b, ok);
      el.card.querySelector('.blank').outerHTML = chip(p.c, 'in');
      answered(it, ok); if (ok) advance(1300); else setTimeout(() => explain(it, fullSent(p) + meaningBox(p)), 700); }, 'row3');
  },
  next(it, el){
    const p = it.pair, opts = shuffle(CONNS.filter(c => p.s.next[c]).map(c => ({ c, html: `<span class="em">${p.s.next[c].e}</span>${esc(p.s.next[c].b)}` })));
    el.card.innerHTML = `${spk()}<p class="hint">${TYPES.next.hint}</p><div class="pic">${p.s.emoji}</div>
      <p class="sent">${esc(p.s.a)}</p><p class="sent">${chip(p.c, 'in')} ${blank('…')}</p>`;
    it.read = () => readPair(p, true, false);
    optButtons(el, opts, (o, b) => { lock(el); const ok = o.c === p.c; mark(b, ok);
      el.card.querySelector('.blank').outerHTML = `<span class="filled">${esc(p.b)}</span>`;
      answered(it, ok); if (ok) advance(1500); else setTimeout(() => explain(it, fullSent(p) + meaningBox(p)), 700); }, 'col');
  },
  meaning(it, el){
    const p = it.pair;
    el.card.innerHTML = `${spk()}<p class="hint">${TYPES.meaning.hint}</p>
      <div class="two"><p class="sent box">${p.s.emoji} ${esc(p.s.a)}</p><div class="q">❓</div><p class="sent box">${p.e} ${esc(p.b)}</p></div>`;
    it.read = () => readPair(p, false);
    optButtons(el, CONNS.map(c => ({ c, html: `<span class="ricon">${MEANING[c].icon}</span>${MEANING[c].name}`, cls: CC(c) })), (o, b) => {
      lock(el); const ok = o.c === p.c; mark(b, ok);
      el.card.querySelector('.q').innerHTML = chip(p.c, 'in');
      answered(it, ok); if (ok) advance(1500); else setTimeout(() => explain(it, fullSent(p) + meaningBox(p)), 700); }, 'col');
  },
  join(it, el){
    const p = it.pair, f = p.s.forms;
    el.card.innerHTML = `${spk()}<p class="hint">${TYPES.join.hint}</p>
      <p class="sent small">${esc(p.s.a)} ${chip(p.c)} ${esc(p.b)}</p><p class="arrow">⬇️ ✂️</p>
      <p class="sent">${esc(p.s.pre)} ${blank()} ${esc(p.b)}</p>`;
    it.read = () => readPair(p);
    optButtons(el, shuffle(CONNS.map(c => ({ c, html: f[c] }))), (o, b) => { lock(el); const ok = o.c === p.c; mark(b, ok);
      el.card.querySelector('.blank').outerHTML = `<u class="in">${p.form}</u>`;
      answered(it, ok); if (ok) advance(1600); else setTimeout(() => explain(it, joinRule(p)), 700); }, 'row3 words');
  },
  hidden(it, el){
    const p = it.pair;
    el.card.innerHTML = `${spk()}<p class="hint">${TYPES.hidden.hint}</p><div class="pic">${p.s.emoji}<span>${p.e}</span></div>
      <p class="sent">${esc(p.s.pre)} <u class="hl">${p.form}</u> ${esc(p.b)}</p>
      <div class="reveal hidden"><p class="arrow">⬇️ 두 문장으로 나누면</p><p class="sent small">${esc(p.s.a)} ${chip(p.c)} ${esc(p.b)}</p></div>`;
    optButtons(el, connOpts(), (o, b) => { lock(el); const ok = o.c === p.c; mark(b, ok);
      el.card.querySelector('.reveal').classList.remove('hidden');
      answered(it, ok); if (ok) advance(2000); else setTimeout(() => explain(it, joinRule(p)), 900); }, 'row3');
  },
  spot(it, el){
    const p = it.pair, right = it.shown === p.c;
    el.card.innerHTML = `${spk()}<p class="hint">${TYPES.spot.hint}</p><div class="pic">${p.s.emoji}<span>${p.e}</span></div>
      <p class="sent">${esc(p.s.a)} ${chip(it.shown, 'hl')} ${esc(p.b)}</p>`;
    it.read = () => A.seq([['a', p.s.id], ['c', it.shown], ['b', p.key]].filter(([c, k]) => A.has(c, k)), 250);
    let miss = false;
    const step2 = () => {
      el.card.insertAdjacentHTML('beforeend', `<p class="hint">그럼 어떤 이음말로 바꿀까요?</p>`); delete el.opts.dataset.lock;
      optButtons(el, connOpts().filter(o => o.c !== it.shown), (o, b) => { lock(el); const ok = o.c === p.c; mark(b, ok);
        el.card.querySelector('.conn.hl').outerHTML = chip(p.c, 'in'); answered(it, ok && !miss);
        if (ok && !miss) advance(1500); else setTimeout(() => explain(it, fullSent(p) + meaningBox(p)), 700); }, 'row3');
    };
    optButtons(el, [{ v: true, html: '⭕ 맞아요', cls: 'yes' }, { v: false, html: '❌ 틀렸어요', cls: 'no' }], (o, b) => {
      lock(el); const ok = o.v === right; mark(b, ok);
      if (!ok){ miss = true; answered(it, false); el.card.querySelector('.conn.hl').outerHTML = chip(p.c, 'in');
        return setTimeout(() => explain(it, (right ? `<p class="kid">“${it.shown}”가 알맞았어요.</p>` : `<p class="kid">“${it.shown}”가 아니라 “${p.c}”가 알맞아요.</p>`) + fullSent(p) + meaningBox(p)), 700); }
      if (right){ answered(it, true); advance(1300); } else setTimeout(step2, 500);
    }, 'row2');
  },
  build(it, el){
    const p = it.pair, halves = s => { const w = s.split(' '), k = Math.ceil(w.length / 2); return w.length > 1 ? [w.slice(0, k).join(' '), w.slice(k).join(' ')] : [s]; };
    const target = [...halves(p.s.pre), p.form, ...halves(p.b)];
    const other = shuffle(CONNS.filter(c => c !== p.c))[0];
    const tiles = shuffle([...target.map((t, k) => ({ t, k })), { t: p.s.forms[other], k: -1 }]);
    el.card.innerHTML = `${spk()}<p class="hint">${TYPES.build.hint}</p>
      <p class="sent small">${esc(p.s.a)} ${chip(p.c)} ${esc(p.b)}</p><p class="arrow">⬇️ 🧱</p><p class="sent line" id="line">${blank('…')}</p>`;
    it.read = () => readPair(p);
    let at = 0, miss = false; const line = $('#line', el.card);
    el.opts.className = 'opts tiles'; el.opts.innerHTML = tiles.map((x, j) => `<button class="tile" data-j="${j}">${esc(x.t)}</button>`).join('');
    el.opts.querySelectorAll('.tile').forEach(b => b.onclick = () => {
      const x = tiles[+b.dataset.j];
      if (x.k === at || (x.t === target[at] && x.k !== -1)){
        sfx('place'); b.classList.add('used'); b.disabled = true; at++;
        line.innerHTML = target.slice(0, at).map(t => t === p.form ? `<u>${esc(t)}</u>` : esc(t)).join(' ') + (at < target.length ? ' ' + blank('…') : '');
        if (at === target.length){ answered(it, !miss); advance(miss ? 2200 : 1600); if (miss) $('.hint', el.card).innerHTML = '다 만들었어요! 👍'; }
      } else {
        sfx('soft'); b.classList.add('shake'); setTimeout(() => b.classList.remove('shake'), 500);
        if (!miss){ miss = true; }
        $('.hint', el.card).innerHTML = x.k === -1 || target[at] === p.form ? `💡 ${chip(p.c)} ➡️ <b>${MEANING[p.c].join}</b>` : '💡 앞에서부터 차례대로 눌러 봐요';
      }
    });
  },
  match(it, el){
    const s = it.s, cards = shuffle(it.pairs);
    el.card.innerHTML = `${spk()}<p class="hint">${TYPES.match.hint}</p><div class="pic">${s.emoji}</div><p class="sent">${esc(s.a)}</p>`;
    it.read = () => A.seq([['a', s.id]].filter(([c, k]) => A.has(c, k)));
    const miss = {}; let sel = null, placed = 0;
    el.opts.className = 'opts match';
    el.opts.innerHTML = `<div class="mcards">${cards.map((p, k) => `<button class="mcard" data-k="${k}"><span class="slot">?</span><span class="em">${p.e}</span>${esc(p.b)}</button>`).join('')}</div>
      <div class="mconns">${CONNS.map(c => `<button class="opt ${CC(c)}" data-c="${c}">${chip(c)}</button>`).join('')}</div>`;
    const mcs = el.opts.querySelectorAll('.mcard');
    mcs.forEach(b => b.onclick = () => { if (b.classList.contains('done')) return; sfx('tap'); mcs.forEach(x => x.classList.remove('sel')); b.classList.add('sel'); sel = +b.dataset.k; });
    el.opts.querySelectorAll('.mconns .opt').forEach(b => b.onclick = () => {
      if (sel === null){ $('.hint', el.card).textContent = '👆 먼저 문장을 하나 눌러요'; return; }
      const p = cards[sel], c = b.dataset.c, card = mcs[sel];
      if (c === p.c){ sfx('place'); card.classList.remove('sel'); card.classList.add('done', CC(c)); card.querySelector('.slot').outerHTML = chip(c); sel = null; placed++;
        if (placed === 3){ const res = it.pairs.map(q => [q, !miss[q.key]]); const ok = res.every(r => r[1]);
          answered(it, ok, { pairs: res }); if (!ok){ /* counted in answered */ } advance(1600); } }
      else { miss[p.key] = true; sfx('soft'); card.classList.add('shake'); setTimeout(() => card.classList.remove('shake'), 500);
        $('.hint', el.card).innerHTML = `💡 ${MEANING[p.c].icon} 이 문장은 <b>${MEANING[p.c].name}</b> 같아요`; }
    });
  },
};

// ---------------------------------------------------------------- end of session & rewards
function eligibleBlocks(){
  const n = S().chestsOpened, max = n < 4 ? 2 : n < 12 ? 3 : n < 25 ? 4 : 5;
  return Object.entries(BLOCKS).filter(([, b]) => b.rarity <= max).map(([k]) => k);
}
function rollBlock(){
  const el = eligibleBlocks(), fresh = el.filter(k => !S().owned[k]);
  const pool = fresh.length ? fresh : el; const k = pool[Math.floor(Math.random() * pool.length)];
  S().owned[k] = (S().owned[k] || 0) + 1; S().chestsOpened++; save(); return k;
}
function chest(where, after){
  where.innerHTML = `<button class="chest" id="chest">${block('plank', { size: 150 })}<span>눌러서 열기!</span></button>`;
  say('fx', 'chest');
  $('#chest').onclick = async () => {
    sfx('knock'); $('#chest').classList.add('wobble'); await wait(700);
    const k = rollBlock(), isNew = S().owned[k] === 1; sfx(BLOCKS[k].rarity >= 3 ? 'rare' : 'chest');
    where.innerHTML = `<div class="loot">${block(k, { size: 150, glow: true })}<b>${BLOCKS[k].name}</b>${isNew ? '<span class="new">NEW!</span>' : '<span>하나 더 모았어요!</span>'}</div>`;
    after && after();
  };
}
function endSession(){
  const r = run; run = null;
  const ms = Date.now() - r.start, t = today();
  const firstToday = !(S().days[t]?.sessions > 0);
  if (!r.only) finishSession({ n: r.items.length, correct: r.correct, ms });
  const pct = r.correct / r.items.length, stars = pct >= .85 ? 3 : pct >= .6 ? 2 : 1;
  say('fx', 'done');
  app.innerHTML = `<section class="screen end">
    <h1>${r.only ? '연습 끝!' : '오늘 연습 끝!'} 🎉</h1>
    <div class="stars">${'⭐'.repeat(stars)}${'☆'.repeat(3 - stars)}</div>
    <p class="sum">${r.items.length}문제 중 <b>${r.correct}</b>개를 한 번에 맞혔어요 · 💎 +${r.gems}</p>
    ${!r.only && firstToday ? `<div class="stamp"><span>${stampFor(t)}</span>오늘의 도장 쾅!</div>` : ''}
    <div id="reward"></div>
    <div class="end-btns"><a class="big ok" href="#/home">처음으로</a><a class="big ghost" href="#/dex">블록 도감</a></div></section>`;
  if (!r.only && firstToday) chest($('#reward'));
  else $('#reward').innerHTML = `<p class="kid">💎 보석 15개를 모으면 블록 도감에서 상자를 열 수 있어요!</p>`;
}
function dex(){
  const st = S(), cost = 15;
  app.innerHTML = `<section class="screen">${topbar('블록 도감')}
    <p class="kid center">모은 블록 <b>${Object.keys(st.owned).length}</b> / ${Object.keys(BLOCKS).length}</p>
    <div id="reward" class="center"><button class="big ok" id="buy" ${st.gems < cost ? 'disabled' : ''}>💎 ${cost}개로 상자 열기</button></div>
    <div class="dex">${Object.entries(BLOCKS).map(([k, b]) => st.owned[k]
      ? `<div class="dx on">${block(k, { size: 72 })}<b>${b.name}</b>${st.owned[k] > 1 ? `<i>×${st.owned[k]}</i>` : ''}</div>`
      : `<div class="dx">${block(k, { size: 72 })}<b>???</b></div>`).join('')}</div></section>`;
  const buy = $('#buy'); if (buy) buy.onclick = () => { if (S().gems < cost) return; S().gems -= cost; save(); $('.gems').textContent = `💎 ${S().gems}`;
    chest($('#reward'), () => setTimeout(dex, 2600)); };
}

// ---------------------------------------------------------------- parent view (behind a small math gate)
function gate(){
  const a = 6 + Math.floor(Math.random() * 4), b = 6 + Math.floor(Math.random() * 4);
  const fb = document.createElement('div'); fb.className = 'fb'; document.body.appendChild(fb);
  let v = '';
  const draw = () => fb.innerHTML = `<div class="sheet gate"><div class="sheet-h">부모님 확인</div><p class="sent">${a} × ${b} = <b class="inp">${v || '?'}</b></p>
    <div class="pad">${[1,2,3,4,5,6,7,8,9,'지움',0,'확인'].map(k => `<button data-k="${k}">${k}</button>`).join('')}</div><button class="ghost" id="gx">닫기</button></div>`;
  const bind = () => { fb.querySelectorAll('.pad button').forEach(x => x.onclick = () => { const k = x.dataset.k;
      if (k === '지움') v = v.slice(0, -1); else if (k === '확인'){ if (+v === a * b){ fb.remove(); go('#/parent'); return; } v = ''; }
      else if (v.length < 3) v += k; draw(); bind(); }); $('#gx', fb).onclick = () => fb.remove(); };
  draw(); bind();
}
function pctBar(label, [r, t] = [0, 0], cls = ''){
  const p = t ? Math.round(r / t * 100) : null;
  return `<div class="pbar"><span class="pl">${label}</span><span class="track"><i class="${cls}" style="width:${p ?? 0}%"></i></span><span class="pv">${p === null ? '—' : p + '%'} <small>(${r}/${t})</small></span></div>`;
}
function parent(){
  const st = S();
  const days = Object.entries(st.days).sort((a, b) => b[0].localeCompare(a[0])).slice(0, 14);
  const weak = Object.entries(st.pairs).filter(([, p]) => p.wrong > 0).sort((a, b) => (b[1].wrong - b[1].box) - (a[1].wrong - a[1].box)).slice(0, 10)
    .map(([k, p]) => { const q = PAIRS.find(x => x.key === k); return q ? `<li>${esc(q.s.a)} ${chip(q.c)} ${esc(q.b)} <small>틀림 ${p.wrong} · 단계 ${p.box}/5</small></li>` : ''; }).join('');
  // per-connective accuracy over the last 7 days, from the answer log
  const wk = Date.now() - 7 * 864e5, recent = {}; st.log.filter(l => l.t >= wk).forEach(l => { const a = recent[l.conn] || (recent[l.conn] = [0, 0]); if (l.ok) a[0]++; a[1]++; });
  app.innerHTML = `<section class="screen parent">${topbar('부모님 화면')}
    <div class="panel"><h3>이음말별 정답률</h3>${CONNS.map(c => pctBar(chip(c), st.stats.conn[c], CC(c))).join('')}
      <p class="note">최근 7일: ${CONNS.map(c => { const a = recent[c]; return `${c} ${a ? Math.round(a[0] / a[1] * 100) + '%' : '—'}`; }).join(' · ')}</p></div>
    <div class="panel"><h3>문제 유형별 정답률</h3>${Object.entries(TYPES).map(([k, t]) => pctBar(`${t.icon} ${t.name}`, st.stats.type[k])).join('')}
      <p class="note">“한 번에 맞힘” 기준입니다. 틀린 문제는 같은 연습 안에서 한 번 더, 다음 날들에도 더 자주 나와요.</p></div>
    <div class="panel"><h3>날짜별 기록</h3><table><tr><th>날짜</th><th>연습</th><th>문제</th><th>정답률</th><th>시간</th></tr>
      ${days.map(([d, x]) => `<tr><td>${d.slice(5)}</td><td>${x.sessions}회</td><td>${x.items}</td><td>${x.items ? Math.round(x.correct / x.items * 100) : 0}%</td><td>${Math.round(x.ms / 60000)}분</td></tr>`).join('') || '<tr><td colspan="5">아직 기록이 없어요</td></tr>'}</table>
      <p class="note">연속 ${st.streak.count}일 · 최고 ${st.streak.best}일 · 총 연습 ${st.sessions.length}회</p></div>
    <div class="panel"><h3>자주 틀린 문장</h3><ul class="weak">${weak || '<li>아직 없어요 👍</li>'}</ul></div>
    <div class="panel"><h3>설정</h3>
      <label class="set"><input type="checkbox" id="s-sound" ${st.settings.sound ? 'checked' : ''}> 효과음</label>
      <label class="set"><input type="checkbox" id="s-voice" ${st.settings.voice ? 'checked' : ''}> 칭찬·읽어 주기 목소리</label>
      <label class="set">하루 문제 수 <select id="s-len">${[8, 10, 12, 15].map(n => `<option ${st.settings.len === n ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <p class="note">문장 ${SCENES.length}세트 · 이음말 짝 ${PAIRS.length}개 · 문제 유형 ${Object.keys(TYPES).length}가지</p>
      <button class="ghost danger" id="s-reset">기록 모두 지우기</button></div></section>`;
  $('#s-sound').onchange = e => { st.settings.sound = e.target.checked; save(); sound(); };
  $('#s-voice').onchange = e => { st.settings.voice = e.target.checked; save(); sound(); };
  $('#s-len').onchange = e => { st.settings.len = +e.target.value; save(); };
  $('#s-reset').onclick = () => { if (confirm('시온이의 기록을 모두 지울까요? 되돌릴 수 없어요.')){ reset(); go('#/home'); } };
}

// ---------------------------------------------------------------- boot
A.initGestures(); sound();
Promise.race([A.initAudio(), wait(1500)]).then(route);   // manifest first, so 🔊 buttons know which clips exist
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js');
window.__dbg = { S, PAIRS, SCENES, audio: A.audioDebug, run: () => run };
