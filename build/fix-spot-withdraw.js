// THE WITHDRAW STEP IS WHERE DEMO SPOT LOSES TWO THIRDS OF THE PEOPLE WHO GET THAT FAR (2026-09-19).
//
// MEASURED on 155 real accounts: 95 finish buying USDT on the exchange and only 32 ever move any of it to
// their own wallet - a 66% drop at one screen. Walked by hand on a 390px phone, that screen is 776px tall
// with 679 characters of text, four networks, TWO empty inputs and five buttons, against 221px and zero
// inputs for the step before it. It asks for four decisions at once and opens with the destination address
// blank, while the one control that fills it sits BELOW the field, styled as a secondary chip.
//
// Two changes, neither of which removes a lesson:
//   1. "Use my <network> address" moves ABOVE the field and reads as the main way to fill it. The field stays
//      editable and the wrong-network warning stays exactly as it was - pasting by hand is still possible and
//      still the thing being taught, it is simply no longer the only visible path.
//   2. The amount starts at half the exchange balance instead of empty. Nothing is learned by typing a number
//      into an empty box, and the fee estimate under it now appears immediately rather than after a keystroke.
//
// Idempotent, refuses rather than guesses. `node build/fix-spot-withdraw.js [--dry]`
const fs = require('fs');
const F = 'dist/spot/index.html';
const DRY = process.argv.indexOf('--dry') >= 0;
let h = fs.readFileSync(F, 'utf8');
const before = h;
if (h.indexOf('wd-mine-lead') >= 0) { console.log('already applied'); process.exit(0); }

const ADDR = "      +'<input class=\"tin sm\" id=\"wdAddr\" type=\"text\" autocomplete=\"off\" spellcheck=\"false\" placeholder=\"'+esc(L('wd_ph'))+'\" />'";
const BTN_START = "      +'<button class=\"wd-mine\" id=\"wdPaste\" type=\"button\">";
if (h.indexOf(ADDR) < 0) { console.error('REFUSING: the address input line moved'); process.exit(1); }
const bs = h.indexOf(BTN_START);
if (bs < 0) { console.error('REFUSING: the paste button line moved'); process.exit(1); }
const be = h.indexOf("'\n", bs);
const btnLine = h.slice(bs, h.indexOf('\n', bs) + 1);
if (btnLine.indexOf('wdPaste') < 0) { console.error('REFUSING: could not isolate the button line'); process.exit(1); }

// 1. lift the button above the input, and mark it as the lead control
h = h.replace(btnLine, '');
const btnLead = btnLine.replace('class="wd-mine"', 'class="wd-mine wd-mine-lead"');
h = h.split(ADDR).join(btnLead.replace(/\r?\n$/, '') + (h.indexOf('\r\n') >= 0 ? '\r\n' : '\n') + ADDR);

// 2. the amount starts filled - half of what is on the exchange
const AMT = "<input class=\"tin\" id=\"wdAmt\" type=\"number\" inputmode=\"decimal\" min=\"5\" step=\"any\" placeholder=\"500\" />";
if (h.indexOf(AMT) < 0) { console.error('REFUSING: the amount input moved'); process.exit(1); }
h = h.split(AMT).join("<input class=\"tin\" id=\"wdAmt\" type=\"number\" inputmode=\"decimal\" min=\"5\" step=\"any\" placeholder=\"500\" value=\"'+(Math.max(5,Math.floor(((PORT&&PORT.usdtUsd)||0)/2))||'')+'\" />");

// and the estimate should be on screen from the first frame, not after a keystroke
// the page is CRLF - build every multi-line marker from its own ending, never a bare \n
const NL = h.indexOf('\r\n') >= 0 ? '\r\n' : '\n';
const PAINT = "    paintMine();" + NL + "    $('wdAmt').addEventListener('input',est);";
if (h.indexOf(PAINT) < 0) { console.error('REFUSING: the wiring block moved'); process.exit(1); }
h = h.split(PAINT).join("    paintMine();est(); /* the amount starts filled, so show what arrives and what it costs straight away */" + NL + "    $('wdAmt').addEventListener('input',est);");

// 3. the lead button looks like the way in rather than an afterthought
const CSS_A = '.wd-mine{';
if (h.indexOf(CSS_A) < 0) { console.error('REFUSING: .wd-mine css not found'); process.exit(1); }
h = h.split(CSS_A).join('.wd-mine-lead{width:100%;justify-content:center;margin:0 0 7px;padding:10px 12px;font-size:12.5px;}\n  ' + CSS_A);

if (h === before) { console.log('no change'); process.exit(0); }
if ((h.match(/id="wdPaste"/g) || []).length !== 1) { console.error('REFUSING: wdPaste is not unique'); process.exit(1); }
if (h.indexOf('id="wdPaste"') > h.indexOf('id="wdAddr"')) { console.error('REFUSING: the button is still below the field'); process.exit(1); }
if (DRY) { console.log('(dry run) would lift the address button above the field and prefill the amount'); process.exit(0); }

fs.writeFileSync(F + '.tmp', Buffer.from(h, 'utf8'));
fs.renameSync(F + '.tmp', F);
console.log('withdraw step: one obvious way to fill the address, and an amount already in the box');
