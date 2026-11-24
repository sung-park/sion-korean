// Tiny Korean conjugator for the three joins this app teaches. Every stem whose last consonant is irregular-prone
// (ㅂ, ㄷ, ㅅ, ㅎ, 르) must be listed in IRR or REG, otherwise aeo() throws — so a new item can never silently get a
// wrong form. tools/check.mjs prints every generated sentence for a human read-through.
const B = 0xAC00;
const split = ch => { const c = ch.charCodeAt(0) - B; return [Math.floor(c / 588), Math.floor((c % 588) / 28), c % 28]; };
const join3 = (i, m, f) => String.fromCharCode(B + i * 588 + m * 28 + f);
const V = { a:0, ae:1, eo:4, e:5, yeo:6, o:8, wa:9, wae:10, oe:11, u:13, wo:14, wi:16, eu:18, ui:19, i:20 };
const F = { n:4, l:8, ss:20, b:17 };
// 아/어 form of irregular-prone stems (last syllable rule would get these wrong)
const IRR = { '맵':'매워','춥':'추워','덥':'더워','어렵':'어려워','쉽':'쉬워','무섭':'무서워','귀엽':'귀여워','무겁':'무거워','가볍':'가벼워',
  '즐겁':'즐거워','반갑':'반가워','차갑':'차가워','뜨겁':'뜨거워','시끄럽':'시끄러워','고맙':'고마워','눕':'누워','줍':'주워','돕':'도와',
  '듣':'들어','걷':'걸어','모르':'몰라','부르':'불러','고르':'골라','빠르':'빨라','다르':'달라','자르':'잘라','누르':'눌러','마르':'말라',
  '낫':'나아','짓':'지어','하얗':'하얘','노랗':'노래','빨갛':'빨개','파랗':'파래','까맣':'까매' };
// regular stems that look irregular-prone
const REG = new Set(['입','잡','좁','씹','받','닫','믿','웃','씻','벗','좋','놓','넣','낳']);
const IRR_PRONE = new Set([F.b, 7 /*ㄷ*/, 19 /*ㅅ*/, 27 /*ㅎ*/]);
export function stemOf(v){ if (!v.endsWith('다')) throw new Error('not a dictionary form: '+v); return v.slice(0, -1); }
function lastWord(stem){ const i = stem.lastIndexOf(' '); return [stem.slice(0, i + 1), stem.slice(i + 1)]; }
export function aeo(v){
  const [head, w] = lastWord(stemOf(v));
  for (const k of Object.keys(IRR)) if (w.endsWith(k)) return head + w.slice(0, -k.length) + IRR[k];
  const last = w.at(-1), [i, m, f] = split(last), pre = w.slice(0, -1);
  if (/르$/.test(w)) throw new Error('르 stem not in table: ' + v);
  if (IRR_PRONE.has(f) && !REG.has(w.slice(-1)) && !REG.has(w)) throw new Error('irregular-prone stem not in table: ' + v);
  if (w.endsWith('하')) return head + pre + '해';
  if (f) return head + w + ((m === V.a || m === V.o) ? '아' : '어');
  switch (m){
    case V.a: case V.eo: case V.ae: case V.e: case V.yeo: case V.wae: return head + w;
    case V.o: return head + pre + join3(i, V.wa, 0);
    case V.u: return head + pre + join3(i, V.wo, 0);
    case V.i: return head + pre + join3(i, V.yeo, 0);
    case V.oe: return head + pre + join3(i, V.wae, 0);
    case V.wi: return head + w + '어';
    case V.eu: { const pm = pre ? split(pre.at(-1))[1] : -1; return head + pre + join3(i, (pm === V.a || pm === V.o) ? V.a : V.eo, 0); }
  }
  throw new Error('unhandled stem: ' + v);
}
const addFinal = (s, fin) => { const [i, m] = split(s.at(-1)); return s.slice(0, -1) + join3(i, m, fin); };
const pastStem = v => addFinal(aeo(v), F.ss);                 // 먹었, 왔, 했, 매웠
/** sentence-final polite form: t 'p' past, 'n' present */
export const polite = (v, t) => t === 'p' ? pastStem(v) + '어요' : aeo(v) + '요';
/** 그리고 → -고 (no tense: 먹고, 오고, 맵고) */
export const go = v => stemOf(v) + '고';
/** 그래서 → -아서/-어서/-해서 (never past: 와서, not 왔어서) */
export const seo = v => aeo(v) + '서';
/** 그런데 → past -었는데 · verb/있다/없다 -는데 · adjective -(으)ㄴ데 */
export function nde(v, t, pos){
  if (t === 'p') return pastStem(v) + '는데';
  const stem = stemOf(v), [head, w] = lastWord(stem);
  const last = w.at(-1), [i, m, f] = split(last), pre = w.slice(0, -1);
  if (pos === 'v' || /(있|없)$/.test(w)){
    if (f === F.l) return head + pre + join3(i, m, 0) + '는데';    // 놀다 → 노는데
    return stem + '는데';
  }
  // adjective
  for (const k of ['맵','춥','덥','어렵','쉽','무섭','귀엽','무겁','가볍','즐겁','반갑','차갑','뜨겁','시끄럽','고맙'])
    if (w.endsWith(k)){ const s = w.slice(0, -1) + join3(i, m, 0); return head + s + '운데'; }
  if (f === 27) return head + pre + join3(i, m, F.n) + '데';         // 하얗다 → 하얀데
  if (f === F.l) return head + pre + join3(i, m, F.n) + '데';         // 멀다 → 먼데
  if (f) return stem + '은데';
  return head + pre + join3(i, m, F.n) + '데';                        // 크다 → 큰데, 조용하다 → 조용한데
}
export const forms = (v, t, pos) => ({ 그리고: go(v), 그런데: nde(v, t, pos), 그래서: seo(v) });
/** "-기 때문에" form, used in kid explanations for 그래서 (먹었기 때문에, 아프기 때문에) */
export const gi = (v, t) => (t === 'p' ? pastStem(v) : stemOf(v)) + '기 때문에';
