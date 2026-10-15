/* THE DOOR FILTER, RUN AGAINST THE REAL DESK (2026-10-15).
   A spam filter is only worth having if it is proven not to eat real mail, so this lifts `supportSenderJunk`
   out of the SHIPPED worker source and runs it over the exact sender list the support desk held on the day
   the phishing blast arrived: 44 junk from one forged sender against 94 real tickets from 40 people.

   Falsified by widening the rule (match "postmaster" or the lure's words) - the real senders then go red,
   which is the point: the subject line "URGENT: Please Refund My Mistaken Purchase" was a real member the
   same week. Urgency is a fact about a frightened person; the envelope domain is a fact about the sender.

   node build/support-junk-e2e.js */
const fs = require('fs');
const path = require('path');

// lift the predicate out of the shipped source - never a copy, or the test guards a function nobody runs
const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'worker.js'), 'utf8');
const at = src.indexOf('function supportSenderJunk(from)');
if (at < 0) { console.error('supportSenderJunk is not in src/worker.js - the door is unguarded'); process.exit(1); }
let depth = 0, end = -1;
for (let i = src.indexOf('{', at); i < src.length; i++) {
  if (src[i] === '{') depth++;
  else if (src[i] === '}') { depth--; if (!depth) { end = i + 1; break; } }
}
const supportSenderJunk = new Function('return (' + src.slice(at, end) + ')')();

let pass = 0, fail = 0;
const ok = (name, cond, detail) => { if (cond) { pass++; console.log('  ok   ' + name); } else { fail++; console.log('  FAIL ' + name + (detail !== undefined ? '  -> ' + JSON.stringify(detail) : '')); } };

// THE JUNK: the one sender behind all 44 threads on 2026-10-13
const JUNK = ['postmaster@[10.88.0.4]', 'POSTMASTER@[10.88.0.4]', 'noreply@[192.168.1.9]', 'x@[127.0.0.1]',
  'a@localhost', 'b@10.0.0.5', 'c@172.20.1.1', 'd@169.254.0.1', 'nodomain', ''];
// THE REAL SENDERS: every domain the desk actually held, plus shapes that must never be refused
const REAL = ['abdulsalamisiaq04@gmail.com', 'igbekwus@gmail.com', 'alirst2002@gmail.com',
  'vegapolako14@gmail.com', 'hesamnasiri2010@gmail.com', 'khannoddy765@gmail.com', 'wsmgmt78@gmail.com',
  'stephenpatrick468@gmail.com', 'dobbelsteensem@gmail.com', 'oxdimz48@gmail.com',
  'someone@icloud.com', 'someone@hotmail.co.uk', 'someone@hotmail.nl', 'someone@turu.ch',
  'first.last+tag@sub.domain.co.uk', 'Someone@GMail.com', '"odd name" <real@gmail.com>'];

console.log('the forged senders must all be refused:');
JUNK.forEach((f) => ok('refused: ' + (f || '(empty)'), !!supportSenderJunk(f), supportSenderJunk(f)));

console.log('\nevery real correspondent must get through:');
REAL.forEach((f) => ok('allowed: ' + f, supportSenderJunk(f) === '', supportSenderJunk(f)));

// the separation is the whole claim
const j = JUNK.filter((f) => supportSenderJunk(f)).length, r = REAL.filter((f) => !supportSenderJunk(f)).length;
ok('separation is total: every forged sender refused, every real one allowed', j === JUNK.length && r === REAL.length, { junkCaught: j + '/' + JUNK.length, realKept: r + '/' + REAL.length });

// THE LOAD-BEARING ONE: the rule must not be about the words, or it eats a frightened member
ok('a real member shouting URGENT is NOT junk (he asked for a refund and was right)',
  supportSenderJunk('abdulsalamisiaq04@gmail.com') === '');
ok('the rule names WHY it refused, so a drop can always be explained',
  /ip literal|no domain|no dot|private ip|bare ip|no sender/.test(supportSenderJunk('postmaster@[10.88.0.4]')),
  supportSenderJunk('postmaster@[10.88.0.4]'));

console.log('\n' + (pass + fail) + ' checks, ' + fail + ' failed');
process.exitCode = fail ? 1 : 0;
