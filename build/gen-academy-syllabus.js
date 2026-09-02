/* Regenerates the crawlable syllabus block on /academy/ from the inline #acadData.

   The Academy path itself is rendered by JavaScript, so without this block a crawler sees a hero
   and nothing else — no lesson titles, no course names. The syllabus is the page's actual indexable
   body, which is why it must be rebuilt whenever a course or lesson is added, and why it lives
   between <!-- syllabus:start --> and <!-- syllabus:end --> markers instead of being hand-edited.

   The <style> that precedes the start marker is left alone.
   Run: node build/gen-academy-syllabus.js [--check]
*/
const fs = require('fs');
const path = require('path');

const PAGE = path.join(__dirname, '..', 'dist', 'academy', 'index.html');
const CHECK = process.argv.includes('--check');
const START = '<!-- syllabus:start -->';
const END = '<!-- syllabus:end -->';

const html = fs.readFileSync(PAGE, 'utf8');
const a = html.indexOf(START), b = html.indexOf(END);
if (a < 0 || b < 0) { console.error('gen-academy-syllabus: markers not found'); process.exit(1); }

const data = JSON.parse(html.match(/<script type="application\/json" id="acadData">([\s\S]*?)<\/script>/)[1]);
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const lessons = data.courses.reduce((n, c) => n + c.lessons.length, 0);

const lead = 'Every lesson in the Academy, in order. ' + lessons + ' lessons across ' + data.courses.length +
  ' courses, all free, no account needed to read and a free email-code sign-in only if you want your ' +
  'progress and XP saved across devices.';

const body = data.courses.map(c =>
  '<section class="syl-c"><h3>' + esc(c.name) + ' <span>' + c.lessons.length + ' lesson' +
  (c.lessons.length === 1 ? '' : 's') + '</span></h3><p>' + esc(c.sub) + '</p><ol>' +
  c.lessons.map(L => '<li>' + esc(L.t) + '</li>').join('') + '</ol></section>'
).join('');

const block = START + '<section class="syl" id="syllabus"><h2>The full syllabus</h2>' +
  '<p class="syl-lead">' + lead + '</p>' + body + '</section>' + END;

const old = html.slice(a, b + END.length);
if (old === block) { console.log('syllabus: unchanged (' + data.courses.length + ' courses, ' + lessons + ' lessons)'); process.exit(0); }
if (CHECK) { console.log('syllabus: OUT OF DATE — run node build/gen-academy-syllabus.js'); process.exit(1); }

const out = html.slice(0, a) + block + html.slice(b + END.length);
fs.writeFileSync(PAGE + '.tmp', out, 'utf8');
fs.renameSync(PAGE + '.tmp', PAGE);
console.log('syllabus: rebuilt — ' + data.courses.length + ' courses, ' + lessons + ' lessons, ' +
  (block.length - old.length > 0 ? '+' : '') + (block.length - old.length) + ' bytes');
