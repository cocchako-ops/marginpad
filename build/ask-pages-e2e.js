// The five question pages, checked the way both readers meet them: a crawler that runs no JavaScript, and a
// person on a phone. Every figure has to be in the served bytes, the answer has to be the first thing on the
// page, and the document must stay well-formed - a surplus </div> once put the whole FAQ outside <article>.
const { withBrowser } = require('./e2e-browser.js');
const ORIGIN = 'https://marginpad.io';
const SLUGS = ['how-many-traders-liquidated-today', 'longs-or-shorts-liquidated-more', 'biggest-liquidation-today', 'is-funding-positive-or-negative', 'where-can-i-test-a-trading-bot', 'mcp-server-for-crypto-trading', 'practice-for-a-funded-account'];
const SIBN = SLUGS.length - 1; // each page links every OTHER page in the family. A COUNT, not a constant to restate: adding the sixth page turned fifteen checks red in a suite where nothing was actually wrong.
let pass = 0, fail = 0;
const chk = (n, ok, d) => { (ok ? pass++ : fail++); console.log((ok ? '  ok   ' : '  FAIL ') + n + (d !== undefined && (!ok || process.env.V) ? '   ' + JSON.stringify(d) : '')); };

(async () => {
  // ── a crawler: raw bytes, no JS. ?nc=1 renders past the 5-minute edge copy; a bare ?cb= reads the SAME cache. ──
  for (const slug of SLUGS) {
    const h = await (await fetch(ORIGIN + '/' + slug + '/?nc=1')).text();
    const body = h.slice(h.indexOf('<body'));
    let depth = 0, o = 0, c = 0, m; const re = /<(\/?)div[\s>\/]/gi;
    while ((m = re.exec(body))) { m[1] === '/' ? (c++, depth--) : (o++, depth++); }
    const box = (h.match(/<div class="ansbox">([\s\S]*?)<div class="prov">/) || [])[1] || '';
    const bigTxt = ((box.match(/<p class="big">([\s\S]*?)<\/p>/) || [])[1] || '').replace(/<[^>]*>/g, '').trim();
    const prov = ((h.match(/<div class="prov">([\s\S]*?)<\/div>/) || [])[1] || '').split('</span>').length - 1;
    chk(slug + ': the document is well-formed', depth === 0 && o === c, { open: o, close: c });
    chk(slug + ': the answer is in the served HTML, before any script runs', bigTxt.length > 8, { answer: bigTxt.slice(0, 64) });
    chk(slug + ': it names when and from what it was measured', prov >= 2 && /Measured|Medido/.test(h), { provItems: prov });
    chk(slug + ': the FAQ sits inside the article, not after it', h.indexOf('<details>') < h.indexOf('</article>'), { d: h.indexOf('<details>'), a: h.indexOf('</article>') });
    chk(slug + ': it links the other ' + SIBN + ' questions', (h.match(/class="sibs"/) || []).length === 1 && (h.match(/<div class="sibs">[\s\S]*?<\/div>/) || [''])[0].split('<li>').length - 1 === SIBN);
    chk(slug + ': structured data declares a dataset and the FAQ', /"@type":"Dataset"/.test(h) && /"@type":"FAQPage"/.test(h));
  }

  // ── a person ──────────────────────────────────────────────────────────────────────────────────────────
  await withBrowser(async browser => {
    for (const [lab, w, hh] of [['desktop', 1366, 900], ['phone', 390, 844]]) {
      for (const slug of SLUGS) {
        const p = await browser.newPage();
        await p.setViewport({ width: w, height: hh });
        const errs = []; p.on('pageerror', e => errs.push(String(e.message)));
        await p.goto(ORIGIN + '/' + slug + '/?nc=1', { waitUntil: 'networkidle2', timeout: 60000 });
        const r = await p.evaluate(() => {
          const box = document.querySelector('.ansbox'), big = document.querySelector('.ansbox .big');
          const br = box && box.getBoundingClientRect();
          return {
            fs: big ? Math.round(parseFloat(getComputedStyle(big).fontSize)) : 0,
            // the answer must be readable without scrolling - it is the whole reason the page exists
            inView: !!br && br.top >= 0 && br.top < innerHeight - 60,
            prov: document.querySelectorAll('.prov span').length,
            faqInArticle: document.querySelectorAll('article details').length,
            faqStyled: (() => { const s2 = document.querySelector('article details summary'); return !!s2 && getComputedStyle(s2).cursor === 'pointer'; })(),
            sibs: document.querySelectorAll('.sibs a').length,
            doc: document.documentElement.scrollWidth, win: innerWidth,
          };
        });
        chk(lab.padEnd(7) + ' ' + slug, r.fs >= 26 && r.inView && r.prov >= 2 && r.faqInArticle >= 4 && r.faqStyled && r.sibs === SIBN && r.doc <= r.win + 1 && !errs.length, { ...r, errs: errs.slice(0, 1) });
        await p.close();
      }
    }
  }, { timeout: 230000 });

  // ── the Spanish twins ─────────────────────────────────────────────────────────────────────────────────
  // Four of these five had NO Spanish branch in askRender: the handler detected /es/ correctly - the response
  // even said x-mp-ssr: ask-count-es - and then rendered the English answer under the Spanish headline. And the
  // magnitude words are false friends: Spanish 'billon' is 10^12, so an English ' billion' here overstates by a
  // thousand. Both were wrong, so both are checked.
  const EN_TELL = / in the last | of the damage| on Bitcoin|Positive across|Negative across| long on | short on /;
  for (const slug of SLUGS) {
    const h = await (await fetch(ORIGIN + '/es/' + slug + '/?nc=1&z=' + Date.now())).text();
    const big = ((h.match(/<p class="big">([\s\S]*?)<\/p>/) || [])[1] || '').replace(/<[^>]*>/g, '').trim();
    chk('es/' + slug + ': the answer is Spanish, not English under a Spanish headline', !!big && !EN_TELL.test(big), { answer: big.slice(0, 58) });
    const ff = (h.match(/bill[o\u00f3]n\b|trill[o\u00f3]n\b|\bbillion\b/) || [])[0];
    chk('es/' + slug + ': no false-friend magnitude word', !ff, { found: ff });
  }

  console.log('\nask-pages-e2e: pass ' + pass + '  fail ' + fail);
  process.exit(fail ? 1 : 0);
})();
