/* Injects Academy course 0 - "Start Here: MarginPad" - into dist/academy/index.html.

   Idempotent: run it as often as you like. It REFUSES rather than guessing if the page has
   changed shape, and it never touches the "new course visuals" generated block.

   What it writes, all into dist/academy/index.html:
     1. seven VIZ functions, in their own marked block right after `var GRID=`
     2. the `flag` entry in ICONS
     3. the course itself, FIRST in #acadData.courses
     4. the four hardcoded counts (hero stats, meta description, og:description, JSON-LD)

   It does NOT touch: ACAD_COURSES in src/worker.js (edit by hand - the worker is the grader and
   must agree), the syllabus block (`node build/gen-academy-syllabus.js`), or the i18n packs.

   Run:  node build/add-academy-start.js [--dry]
*/
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'dist', 'academy', 'index.html');
const COURSE = require('./data/academy-mpstart.js');
const DRY = process.argv.includes('--dry');
const VIZ_START = '/* ===== start-here course visuals (build/add-academy-start.js) :start ===== */';
const VIZ_END = '/* ===== start-here course visuals :end ===== */';

const die = m => { console.error('add-academy-start: ' + m); process.exit(1); };

let html = fs.readFileSync(PAGE, 'utf8');
const N = html.indexOf('\r\n') >= 0 ? '\r\n' : '\n';   // the file is CRLF; a bare \n marker matches nothing

// ---------------------------------------------------------------- 1. the visuals
// One per lesson that needs one. Same contract as every other figure on the page:
// svgWrap(inner, viewBox, caption) - caption may carry <b>, and <text> bodies are what the
// per-language viz packs translate, so keep them short and literal.
const VIZ = VIZ_START + N +
`  VIZ.mpreal=function(h){
    h.innerHTML=svgWrap(
    '<rect x="8" y="10" width="156" height="126" rx="8" fill="#12161d" stroke="#2f3742"/>'+
    '<text x="20" y="28" fill="#7ce8bd" font-size="9" font-family="monospace">LIVE MARKET</text>'+
    '<polyline points="22,112 48,96 74,104 100,72 126,84 150,54" fill="none" stroke="#2ebd85" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="vzdraw" style="animation-duration:.9s;animation-delay:.2s"/>'+
    '<text x="20" y="128" fill="#9aa3ad" font-size="9" font-family="monospace" class="vzfade" style="animation-delay:.9s">real prices</text>'+
    '<rect x="176" y="10" width="156" height="126" rx="8" fill="#12161d" stroke="#2f3742"/>'+
    '<text x="188" y="28" fill="#c2f64a" font-size="9" font-family="monospace">YOUR BALANCE</text>'+
    '<text x="254" y="82" text-anchor="middle" fill="#e8ecf1" font-size="22" font-family="monospace" class="vzgrow" style="transform-box:fill-box;transform-origin:center;animation-delay:.5s">$10,000</text>'+
    '<text x="188" y="128" fill="#9aa3ad" font-size="9" font-family="monospace" class="vzfade" style="animation-delay:.9s">practice money</text>',
    '0 0 340 150','Real market, <b>practice balance</b>. Nothing to deposit.');};

  VIZ.mpxp=function(h){
    h.innerHTML=svgWrap(
    '<text x="16" y="34" fill="#9aa3ad" font-size="10" font-family="monospace">UNRANKED</text>'+
    '<text x="324" y="34" text-anchor="end" fill="#cd7f32" font-size="10" font-family="monospace">BRONZE</text>'+
    '<rect x="16" y="44" width="308" height="20" rx="10" fill="#12161d" stroke="#2f3742"/>'+
    '<rect x="18" y="46" width="260" height="16" rx="8" fill="#c2f64a" class="vzgrow" style="transform-box:fill-box;transform-origin:left center;animation-delay:.3s"/>'+
    '<text x="16" y="86" fill="#9aa3ad" font-size="10" font-family="monospace">0 XP</text>'+
    '<text x="324" y="86" text-anchor="end" fill="#e8ecf1" font-size="10" font-family="monospace">500 XP</text>'+
    '<g class="vzfade" style="animation-delay:1s"><line x1="278" y1="40" x2="278" y2="68" stroke="#e8ecf1" stroke-width="1.5"/><text x="278" y="108" text-anchor="middle" fill="#e8ecf1" font-size="11" font-family="monospace">this course</text><text x="278" y="124" text-anchor="middle" fill="#9aa3ad" font-size="10" font-family="monospace">gets you here</text></g>',
    '0 0 340 150','Then one trade, or one more day, and the rewards <b>open</b>.');};

  VIZ.mpmoney=function(h){
    function row(y,l,v,d){return '<g class="vzfade" style="animation-delay:'+d+'s"><text x="20" y="'+y+'" fill="#9aa3ad" font-size="11" font-family="monospace">'+l+'</text><text x="320" y="'+y+'" text-anchor="end" fill="#c2f64a" font-size="12" font-family="monospace">'+v+'</text><line x1="20" y1="'+(y+7)+'" x2="320" y2="'+(y+7)+'" stroke="#1b212b"/></g>';}
    h.innerHTML=svgWrap(
    '<rect x="8" y="8" width="324" height="132" rx="8" fill="#12161d" stroke="#2f3742"/>'+
    row(34,'Welcome bonus','$0.50',.2)+
    row(60,'Faucet, per day','$0.20',.4)+
    row(86,'Moon or Fomo account','$1.00',.6)+
    row(112,'A friend who trades','$0.50',.8),
    '0 0 340 150','Small, real, <b>capped</b>. A thank-you, not an income.');};

  VIZ.mplev=function(h){
    h.innerHTML=svgWrap(
    '<text x="16" y="30" fill="#9aa3ad" font-size="10" font-family="monospace">YOU PUT DOWN</text>'+
    '<rect x="16" y="38" width="46" height="26" rx="5" fill="#1a212b" stroke="#3a434f"/>'+
    '<text x="39" y="56" text-anchor="middle" fill="#e8ecf1" font-size="12" font-family="monospace">$100</text>'+
    '<text x="76" y="56" fill="#ffcf3f" font-size="12" font-family="monospace">x 10</text>'+
    '<text x="16" y="92" fill="#9aa3ad" font-size="10" font-family="monospace">YOU ARE MOVING</text>'+
    '<rect x="16" y="100" width="308" height="26" rx="5" fill="#1a212b" stroke="#ffcf3f" class="vzgrow" style="transform-box:fill-box;transform-origin:left center;animation-delay:.5s"/>'+
    '<text x="170" y="118" text-anchor="middle" fill="#ffcf3f" font-size="13" font-family="monospace" class="vzfade" style="animation-delay:1s">$1,000</text>'+
    '<text x="324" y="56" text-anchor="end" fill="#9aa3ad" font-size="10" font-family="monospace" class="vzfade" style="animation-delay:1.2s">1% move = 10% of your money</text>',
    '0 0 340 150','Leverage changes the <b>size</b>, not the odds.');};

  VIZ.mpliq=function(h){
    h.innerHTML=svgWrap(
    '<rect x="6" y="6" width="328" height="138" rx="8" fill="#151b24"/>'+GRID+
    '<g class="vzfade"><line x1="16" y1="40" x2="324" y2="40" stroke="#9aa3ad" stroke-width="1.5" stroke-dasharray="4 3"/><text x="20" y="34" fill="#9aa3ad" font-size="9" font-family="monospace">ENTRY</text></g>'+
    '<g class="vzfade" style="animation-delay:.2s"><line x1="16" y1="120" x2="324" y2="120" stroke="#ff5a4d" stroke-width="1.5" stroke-dasharray="4 3"/><text x="20" y="114" fill="#ff5a4d" font-size="9" font-family="monospace">LIQUIDATION</text></g>'+
    '<polyline points="30,40 72,56 114,48 156,78 198,70 240,104 282,120" fill="none" stroke="#3fd8e6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="vzdraw" style="animation-duration:1.2s;animation-delay:.5s"/>'+
    '<circle cx="282" cy="120" r="5" fill="#ff5a4d" class="vzgrow" style="transform-box:fill-box;transform-origin:center;animation-delay:1.7s"/>'+
    '<text x="278" y="138" text-anchor="end" fill="#ff5a4d" font-size="10" font-family="monospace" class="vzfade" style="animation-delay:1.8s">margin gone</text>',
    '0 0 340 150','The line is on your chart <b>before</b> you need it.');};

  VIZ.mpexits=function(h){
    h.innerHTML=svgWrap(
    '<rect x="6" y="6" width="328" height="138" rx="8" fill="#151b24"/>'+GRID+
    '<g class="vzfade"><line x1="16" y1="34" x2="324" y2="34" stroke="#2ebd85" stroke-width="1.5" stroke-dasharray="4 3"/><text x="20" y="28" fill="#2ebd85" font-size="9" font-family="monospace">TAKE-PROFIT</text></g>'+
    '<g class="vzfade" style="animation-delay:.2s"><line x1="16" y1="78" x2="324" y2="78" stroke="#9aa3ad" stroke-width="1.5"/><text x="20" y="72" fill="#9aa3ad" font-size="9" font-family="monospace">ENTRY</text></g>'+
    '<g class="vzfade" style="animation-delay:.4s"><line x1="16" y1="120" x2="324" y2="120" stroke="#ff5a4d" stroke-width="1.5" stroke-dasharray="4 3"/><text x="20" y="114" fill="#ff5a4d" font-size="9" font-family="monospace">STOP-LOSS</text></g>'+
    '<polyline points="40,78 84,92 128,70 172,88 216,58 260,44 300,34" fill="none" stroke="#3fd8e6" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" class="vzdraw" style="animation-duration:1.2s;animation-delay:.6s"/>'+
    '<circle cx="300" cy="34" r="5" fill="#2ebd85" class="vzgrow" style="transform-box:fill-box;transform-origin:center;animation-delay:1.8s"/>',
    '0 0 340 150','Both exits chosen <b>while you are calm</b>.');};

  VIZ.mpseason=function(h){
    var t='';for(var i=0;i<14;i++){var on=i<7;t+='<rect x="'+(20+i*22)+'" y="'+(on?52:58)+'" width="14" height="'+(on?44:32)+'" rx="3" fill="'+(on?'#c2f64a':'#232932')+'" class="vzgrow" style="transform-box:fill-box;transform-origin:center bottom;animation-delay:'+(.15+i*.05)+'s"/>';}
    h.innerHTML=svgWrap(
    '<text x="20" y="34" fill="#9aa3ad" font-size="10" font-family="monospace">ONE SEASON</text>'+
    '<text x="320" y="34" text-anchor="end" fill="#9aa3ad" font-size="10" font-family="monospace">14 DAYS</text>'+t+
    '<text x="20" y="122" fill="#c2f64a" font-size="10" font-family="monospace" class="vzfade" style="animation-delay:1.1s">day 7</text>'+
    '<text x="320" y="122" text-anchor="end" fill="#9aa3ad" font-size="10" font-family="monospace" class="vzfade" style="animation-delay:1.1s">boards pay, then it resets</text>',
    '0 0 340 150','Nobody is ever a year behind. It <b>starts again</b>.');};
` + '  ' + VIZ_END;

// Remove an older copy of our block, then insert after `var GRID=...;`
// Cut back over the whitespace we inserted BEFORE the marker as well - stripping only the tail left a
// blank line behind on every run, so the file grew three bytes each time and "idempotent" was a lie.
const oldA = html.indexOf(VIZ_START);
if (oldA >= 0) {
  const oldB = html.indexOf(VIZ_END, oldA);
  if (oldB < 0) die('found the visuals start marker but not the end marker - refusing to guess');
  let a = oldA; while (a > 0 && /[ \t\r\n]/.test(html[a - 1])) a--;
  let b = oldB + VIZ_END.length; while (b < html.length && /[ \t\r\n]/.test(html[b])) b++;
  html = html.slice(0, a) + N + html.slice(b);
}
const gridAt = html.indexOf("  var GRID='");
if (gridAt < 0) die('could not find `var GRID=` - the page has changed shape');
const gridEnd = html.indexOf(N, gridAt);
if (gridEnd < 0) die('could not find the end of the GRID line');
html = html.slice(0, gridEnd + N.length) + N + '  ' + VIZ + N + html.slice(gridEnd + N.length);

// ---------------------------------------------------------------- 2. the icon
if (html.indexOf('ICONS={flag:') < 0 && !/[,{]flag:'/.test(html.slice(html.indexOf('ICONS={'), html.indexOf('ICONS={') + 4000))) {
  const ic = html.indexOf('ICONS={');
  if (ic < 0) die('ICONS object not found');
  const FLAG = "flag:'<svg viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"1.9\" stroke-linecap=\"round\" stroke-linejoin=\"round\"><path d=\"M6 21V3.6\"/><path d=\"M6 4.2h11.6l-2.3 4 2.3 4H6\"/><circle cx=\"6\" cy=\"3.2\" r=\"1.4\" fill=\"currentColor\" stroke=\"none\"/></svg>',";
  html = html.slice(0, ic + 'ICONS={'.length) + FLAG + html.slice(ic + 'ICONS={'.length);
}

// ---------------------------------------------------------------- 3. the course
const DM = html.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/);
if (!DM) die('#acadData not found');
const data = JSON.parse(DM[1]);
const before = data.courses.length;
data.courses = data.courses.filter(c => c.id !== COURSE.id);
data.courses.unshift(COURSE);
if (data.courses[0].id !== COURSE.id) die('the course did not land first');

// Guards that would otherwise fail silently at render time.
const ids = {};
data.courses.forEach(c => c.lessons.forEach(L => { if (ids[L.id]) die('duplicate lesson id ' + L.id); ids[L.id] = 1; }));
COURSE.lessons.forEach(L => {
  if (!L.cards || !L.cards.length) die(L.id + ' has no cards');
  if (!L.quiz || !L.quiz.length) die(L.id + ' has no quiz');
  L.quiz.forEach((q, i) => {
    if (!Array.isArray(q.o) || q.o.length < 2) die(L.id + ' q' + i + ': needs at least two options');
    if (!(q.a >= 0 && q.a < q.o.length)) die(L.id + ' q' + i + ': answer index ' + q.a + ' is outside the options');
  });
  L.cards.forEach(c => { if (c.v && html.indexOf('VIZ.' + c.v + '=function') < 0) die(L.id + ': card names viz "' + c.v + '" which is not defined on the page'); });
});
if (!COURSE.free) die('the course MUST be free:true, or it locks the course after the one every existing member is in');

const lessons = data.courses.reduce((n, c) => n + c.lessons.length, 0);
html = html.slice(0, DM.index) + '<script type="application/json" id="acadData">' + JSON.stringify(data) + '</script>' +
  html.slice(DM.index + DM[0].length);

// ---------------------------------------------------------------- 4. the hardcoded counts
const nC = data.courses.length;
const swaps = [
  [/<span>\d+ lessons<\/span><i><\/i><span>\d+ courses<\/span>/, '<span>' + lessons + ' lessons</span><i></i><span>' + nC + ' courses</span>'],
  [/\d+ bite-size lessons across \d+ courses/g, lessons + ' bite-size lessons across ' + nC + ' courses'],
  [/\d+ bite-size interactive lessons/g, lessons + ' bite-size interactive lessons'],
  [/all \d+ lessons, quizzes/g, 'all ' + lessons + ' lessons, quizzes'],
  [/: \d+ lessons across crypto basics/g, ': ' + lessons + ' lessons across crypto basics'],
  // the pre-JS value of the progress counter: the script overwrites it, a crawler reads it as-is
  [/(id="pgN">)0\/\d+(<)/, '$1' + '0/' + lessons + '$2']
];
swaps.forEach(([re, to]) => { html = html.replace(re, (m, a, b) => to.replace('$1', a || '').replace('$2', b || '')); });

// Every count that a reader or a crawler can see must now agree. The literal also appears inside
// lesson prose ("a $140 hostage situation") and in SVG coordinates, so check only the four surfaces.
['<meta name="description"', '<meta property="og:description"', '"@type":"Course"', 'id="pgN"', 'class="hero-stats"'].forEach(sel => {
  const i = html.indexOf(sel); if (i < 0) return;
  const seg = html.slice(i, i + 600);
  const m = seg.match(/\b(\d{2,4}) (?:bite-size |)lessons|\b0\/(\d{2,4})\b/);
  if (m) { const got = +(m[1] || m[2]); if (got !== lessons) die('count not updated at ' + sel + ' - reads ' + got + ', should be ' + lessons); }
});

if (DRY) { console.log('--dry: would write ' + nC + ' courses / ' + lessons + ' lessons (was ' + before + ')'); process.exit(0); }
const tmp = PAGE + '.tmp';
fs.writeFileSync(tmp, html);
fs.renameSync(tmp, PAGE);
console.log('add-academy-start: ok - ' + nC + ' courses, ' + lessons + ' lessons; "' + COURSE.name + '" is course 0 with ' + COURSE.lessons.length + ' lessons');
console.log('  next: update ACAD_COURSES in src/worker.js, then `node build/gen-academy-syllabus.js`');
