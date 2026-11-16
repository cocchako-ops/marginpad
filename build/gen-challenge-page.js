/* /prop-firm-challenge/ (2026-11-16, owner: "odradi sve ovo za funded vezbanje ... detaljno, bez bagova ... sa stilom i da izgleda lepo").
   The landing page AND the app of Challenge Mode: pick a rule set and an account size, then a live dashboard of the run the SERVER is
   scoring (handleChallenge / chalCompute in the worker), the member's history, the certificate of a passed run (?c=<id>), and the public
   board of passed challenges. Crawler-first: the rules, the explanation and the FAQ are static HTML; the script only fills the live parts.
   Run: node build/gen-challenge-page.js  then the post-processor chain (see CLAUDE.md, the prop-firm round). */
'use strict';
const fs = require('fs'), path = require('path');
const DIST = path.join(__dirname, '..', 'dist');
const SLUG = 'prop-firm-challenge';
const URL = 'https://marginpad.io/' + SLUG + '/';
const GTAG = '\n<!-- Google tag (gtag.js) -->\n<script async src="https://www.googletagmanager.com/gtag/js?id=AW-18230384038"></script>\n<script>window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag(\'js\',new Date());gtag(\'config\',\'AW-18230384038\');</script>';
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const TITLE = 'Crypto Prop Firm Challenge Simulator - Practice a Funded Account Free';
const DESC = 'Take a crypto prop firm challenge for free: one-step, two-step or end-of-day rules on a $5k-$100k account, scored by our server on live prices. Daily loss and drawdown are enforced like a real firm, and a pass earns a shareable certificate.';
// the three rule sets, written out for the crawler; the live page reads the same table from /api/challenge (CHAL_TYPES in the worker)
const UI = require('./data/challenge-ui.js'); // the rule cards, the rule studio and their CSS
const FAQ = [
  ['Is the MarginPad prop firm challenge free?', 'Yes. There is no fee, no deposit and no card. You start a challenge on your free MarginPad account, trade it on live crypto prices in the paper-trading terminal, and the server scores it against the rules. You can retry as often as you like.'],
  ['Do I get funded if I pass?', 'No - MarginPad does not fund traders and sells no challenges. A pass earns a certificate you can share and proves to yourself that you can hit a target without breaking the limits. Take that to a real prop firm only once you can do it repeatedly.'],
  ['How is the daily loss limit measured?', 'From your closed balance at 00:00 UTC. Your equity - balance plus the open profit and loss of your challenge positions - may not fall more than the daily limit, as a percentage of the account size, below it. Closed trades are checked the moment they close; open losses are checked every ten minutes and whenever you open the challenge.'],
  ['What counts as a challenge trade?', 'Every position you open in the MarginPad terminal (or through the Bot API) while the challenge runs and is not paused. Those trades count for the challenge only - not for the leaderboards, XP, Ticks or missions. Positions you held before starting are ignored. Leverage above the rule set and margin above your free challenge balance are refused, as a real firm would refuse them.'],
  ['Can I pause a challenge?', 'Yes, whenever you have no open challenge position. While it is paused your trades are ordinary trades again (they count for the leaderboards), the time limit stops, and nothing about the run changes. Resume and your new trades count for the challenge again. You can also end it at any time.'],
  ['Can I set my own rules?', 'Yes. Pick Custom rules and set the target, one or two steps, the daily loss limit (or none), the drawdown and whether it is static, trailing or end-of-day, minimum trading days, max leverage, a max loss per trade with how many breaches end the run, a best-day consistency rule and a time limit. The server scores your rules exactly like a preset. A custom pass gets a certificate that prints its rules, but no XP.'],
  ['Which rule sets can I choose?', 'Our three shapes (one-step, two-step, one-step end-of-day), the shapes of FTMO\'s 1-Step and 2-Step challenges and IQ Capital\'s Core challenge, or your own. The firm presets copy each firm\'s published rule shape so you can practise the evaluation before you buy it. FTMO and IQ Capital are MarginPad partners, but a pass here is not a pass with them - it tells you whether you are ready to take theirs.'],
  ['Which rule fails the most challenges?', 'The daily loss limit. Measured on our own traders, it ends far more runs than the overall drawdown, because it resets every day and ignores how far ahead you were. Size every trade so two full stops in a row still leave you trading tomorrow.'],
];

const PAGE_JS = fs.readFileSync(path.join(__dirname, 'data', 'challenge-page.js.txt'), 'utf8').trim();
const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />${GTAG}
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover" />
<meta name="robots" content="index,follow,max-image-preview:large" />
<meta name="theme-color" content="#08090b" />
<title>${esc(TITLE)} | MarginPad</title>
<meta name="description" content="${esc(DESC)}" />
<meta name="keywords" content="crypto prop firm challenge, prop firm challenge simulator, funded account practice, free prop firm challenge, crypto funded trader, prop firm evaluation practice, pass prop firm challenge" />
<link rel="canonical" href="${URL}" />
<link rel="alternate" hreflang="en" href="${URL}" />
<link rel="alternate" hreflang="x-default" href="${URL}" />
<meta property="og:type" content="website" />
<meta property="og:url" content="${URL}" />
<meta property="og:title" content="${esc(TITLE)} | MarginPad" />
<meta property="og:description" content="${esc(DESC)}" />
<meta property="og:site_name" content="MarginPad" />
<meta name="twitter:card" content="summary_large_image" />
<meta name="twitter:title" content="${esc(TITLE)} | MarginPad" />
<meta name="twitter:description" content="${esc(DESC)}" />
<link rel="icon" type="image/png" sizes="32x32" href="/assets/favicon-32.png" />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/lab.css" />
<style>
  .cx-stats{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:10px;margin:18px 0 6px}
  .cx-stat{padding:13px 15px;border:1px solid var(--line);border-radius:13px;background:linear-gradient(180deg,var(--panel),var(--bg2))}
  .cx-stat b{display:block;font-family:'Bricolage Grotesque',sans-serif;font-size:26px;font-weight:800;color:var(--ink);letter-spacing:-.02em}
  .cx-stat span{font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink3)}
  .cx-app{margin:22px 0 8px;padding:20px;border:1px solid var(--line);border-radius:18px;background:radial-gradient(90% 60% at 100% 0,rgba(194,246,74,.07),transparent 60%),var(--panel)}
  .cx-app[data-state="loading"]{min-height:260px}
  .cx-types{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px}
  .cx-type{position:relative;text-align:left;padding:15px 15px 13px;border:1px solid var(--line);border-radius:14px;background:var(--bg2);color:var(--ink2);cursor:pointer;font:inherit;transition:border-color .15s,transform .12s,background .15s}
  .cx-type:active{transform:scale(.99)}
  .cx-type.on{border-color:var(--lime);background:rgba(194,246,74,.06)}
  .cx-type h3{margin:0 0 9px;font-family:'Bricolage Grotesque',sans-serif;font-size:18px;color:var(--ink)}
  .cx-type dl{margin:0;display:grid;grid-template-columns:auto 1fr;gap:5px 10px;font-size:12.5px}
  .cx-type dt{color:var(--ink3)}.cx-type dd{margin:0;color:var(--ink2);text-align:right;font-family:'Space Mono',monospace;font-size:11.5px}
  .cx-type .tick{position:absolute;top:13px;right:13px;width:18px;height:18px;border-radius:50%;border:1px solid var(--line);display:flex;align-items:center;justify-content:center}
  .cx-type.on .tick{background:var(--lime);border-color:var(--lime)}
  .cx-type.on .tick::after{content:'';width:5px;height:9px;border:solid #0a0b0d;border-width:0 2px 2px 0;transform:rotate(45deg) translate(-1px,-1px)}
  .cx-row{display:flex;flex-wrap:wrap;align-items:center;gap:10px;margin-top:16px}
  .cx-lbl{font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);margin-right:4px}
  .cx-chip{height:34px;padding:0 13px;border:1px solid var(--line);border-radius:10px;background:var(--bg2);color:var(--ink2);font-family:'Space Mono',monospace;font-size:12.5px;cursor:pointer;transition:border-color .13s,color .13s}
  .cx-chip.on{border-color:var(--lime);color:var(--lime);background:rgba(194,246,74,.07)}
  .cx-go{display:inline-flex;align-items:center;justify-content:center;gap:8px;height:46px;padding:0 22px;border:0;border-radius:13px;background:var(--lime);color:#0a0b0d;font-family:'Space Mono',monospace;font-weight:700;font-size:14px;cursor:pointer;text-decoration:none;transition:filter .15s,transform .12s}
  .cx-go:active{transform:scale(.98)}.cx-go:disabled{filter:grayscale(.6) brightness(.8)}
  .cx-ghost{display:inline-flex;align-items:center;height:46px;padding:0 18px;border:1px solid var(--line);border-radius:13px;background:transparent;color:var(--ink2);font-family:'Space Mono',monospace;font-size:12.5px;cursor:pointer;text-decoration:none}
  .cx-start{display:flex;flex-wrap:wrap;align-items:center;gap:12px;margin-top:20px}
  .cx-fine{font-size:12.5px;color:var(--ink3);line-height:1.5}
  .cx-dash{display:grid;grid-template-columns:minmax(0,1.1fr) minmax(0,1fr);gap:20px}
  .cx-eqk{font-family:'Space Mono',monospace;font-size:10.5px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3)}
  .cx-eq{font-family:'Bricolage Grotesque',sans-serif;font-size:46px;font-weight:800;letter-spacing:-.03em;color:var(--ink);line-height:1.05;margin:4px 0 2px}
  .cx-ret{font-family:'Space Mono',monospace;font-size:13px}.cx-ret.up{color:var(--green,#2ebd85)}.cx-ret.dn{color:var(--red)}
  .cx-badge{display:inline-flex;align-items:center;gap:7px;height:24px;padding:0 10px;border-radius:99px;border:1px solid rgba(194,246,74,.4);color:var(--lime);font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.08em;text-transform:uppercase}
  .cx-badge i{width:7px;height:7px;border-radius:50%;background:var(--lime);box-shadow:0 0 8px var(--lime)}
  .cx-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:9px;margin-top:16px}
  .cx-cell{padding:10px 12px;border:1px solid var(--line);border-radius:11px;background:var(--bg2)}
  .cx-cell b{display:block;font-family:'Space Mono',monospace;font-size:14px;color:var(--ink)}.cx-cell span{font-size:11px;color:var(--ink3)}
  .cx-m{margin-bottom:15px}
  .cx-mh{display:flex;justify-content:space-between;align-items:baseline;gap:8px;font-size:13.5px;color:var(--ink2)}
  .cx-mh b{font-family:'Space Mono',monospace;font-size:12.5px;color:var(--ink)}.cx-mh b.warn{color:#ffb020}.cx-mh b.bad{color:var(--red)}.cx-mh b.tgt{color:var(--lime)}
  .cx-bar{height:9px;margin-top:7px;border-radius:99px;background:#161b22;overflow:hidden}
  .cx-bar i{display:block;height:100%;border-radius:99px;background:#2ebd85;transition:width .6s cubic-bezier(.2,.8,.2,1)}.cx-bar i.warn{background:#ffb020}.cx-bar i.bad{background:var(--red)}.cx-bar i.tgt{background:linear-gradient(90deg,#8fc23a,#c2f64a)}
  .cx-ms{margin-top:5px;font-family:'Space Mono',monospace;font-size:10.5px;color:var(--ink3)}
  .cx-acts{display:flex;flex-wrap:wrap;gap:10px;margin-top:18px}
  .cx-cert{display:grid;grid-template-columns:minmax(0,1.5fr) minmax(0,1fr);gap:20px;align-items:center}
  .cx-cert img{width:100%;height:auto;border-radius:14px;border:1px solid var(--line);display:block}
  .cx-partner{margin-top:14px;padding:13px 15px;border:1px dashed rgba(194,246,74,.4);border-radius:13px;font-size:13px;color:var(--ink2);line-height:1.55}
  .cx-partner a{color:var(--lime);font-weight:700}
  .cx-hist{margin-top:22px}.cx-hist h3{font-size:15px;margin:0 0 8px}
  .tblw{overflow-x:auto;border:1px solid var(--line);border-radius:13px}
  table.cx-t{width:100%;border-collapse:collapse;font-size:13px;min-width:560px}
  .cx-t th{text-align:left;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink3);font-weight:700;padding:10px 12px;border-bottom:1px solid var(--line)}
  .cx-t td{padding:10px 12px;border-bottom:1px solid rgba(255,255,255,.04);color:var(--ink2)}.cx-t tr:last-child td{border-bottom:0}
  .cx-t td.n{font-family:'Space Mono',monospace;font-size:12px;color:var(--ink)}
  .cx-st{font-family:'Space Mono',monospace;font-size:10.5px;font-weight:700;letter-spacing:.06em;text-transform:uppercase}.cx-st.passed{color:var(--lime)}.cx-st.failed{color:var(--red)}.cx-st.abandoned{color:var(--ink3)}.cx-st.active{color:#46e0e6}
  .cx-empty{padding:18px;text-align:center;color:var(--ink3);font-size:13px}
  .cx-steps{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:12px 0}
  .cx-step{padding:15px;border:1px solid var(--line);border-radius:14px;background:var(--panel)}
  .cx-step b{display:block;font-family:'Space Mono',monospace;color:var(--lime);font-size:12px;margin-bottom:6px}
  .cx-step p{margin:0;font-size:13.5px;line-height:1.6;color:var(--ink2)}
  .content{max-width:780px;margin-top:8px}
  .content p{color:var(--ink2);font-size:14.5px;line-height:1.7;margin:0 0 14px}
  .faq{margin-top:10px}
  .faq details{border:1px solid var(--line);border-radius:12px;background:linear-gradient(180deg,var(--panel),var(--bg2));margin-bottom:10px;overflow:hidden}
  .faq summary{cursor:pointer;padding:15px 18px;font-weight:700;font-size:15px;color:var(--ink);list-style:none;display:flex;justify-content:space-between;align-items:center;gap:12px}
  .faq summary::-webkit-details-marker{display:none}
  .faq summary::after{content:'+';color:var(--cyan);font-family:'Space Mono',monospace;font-size:18px;font-weight:700}
  .faq details[open] summary::after{content:'\\2212'}
  .faq details[open] summary{border-bottom:1px solid var(--line)}
  .faq .a{padding:14px 18px 17px;color:var(--ink2);font-size:14px;line-height:1.7}
  .cta{display:flex;flex-wrap:wrap;gap:10px;margin:18px 0 4px}
  .cta a{flex:1;min-width:200px;text-align:center;text-decoration:none;font-family:'Space Mono',monospace;font-weight:700;font-size:13px;padding:13px 14px;border-radius:11px;border:1px solid var(--line);color:var(--ink);background:var(--panel)}
  .cx-gl{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin:18px 0 9px;font-family:'Space Mono',monospace;font-size:10px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}
  .cx-gl:first-child{margin-top:0}.cx-gl a{color:var(--lime);text-decoration:none;letter-spacing:.06em}
  .cx-type.firm.ftmo.on{border-color:#3b8bff;background:rgba(59,139,255,.07)}.cx-type.firm.ftmo.on .tick{background:#3b8bff;border-color:#3b8bff}
  .cx-type.firm.iq.on{border-color:#2fe0a0;background:rgba(47,224,160,.07)}.cx-type.firm.iq.on .tick{background:#2fe0a0;border-color:#2fe0a0}
  .cx-type h3 img{height:15px;width:auto;vertical-align:-1px;margin-right:2px}
  .iqwm{font-weight:800;letter-spacing:-.03em}.iqwm b{color:#2fe0a0}
  .cx-type.cust{border-style:dashed;display:flex;flex-direction:column;justify-content:center;gap:6px}
  .cx-type.cust p{margin:0;font-size:12.5px;line-height:1.5;color:var(--ink3)}
  .cb{margin-top:16px;padding:16px;border:1px solid rgba(194,246,74,.3);border-radius:15px;background:rgba(194,246,74,.03)}
  .cb[hidden]{display:none}
  .cb-h{display:flex;justify-content:space-between;align-items:baseline;gap:10px;margin-bottom:10px}.cb-h b{font-family:'Bricolage Grotesque',sans-serif;font-size:17px;color:var(--ink)}.cb-h span{font-size:12px;color:var(--ink3)}
  .cb-f{display:grid;grid-template-columns:170px minmax(0,1fr);gap:10px;align-items:center;padding:9px 0;border-top:1px solid rgba(255,255,255,.05)}
  .cb-f.hide{display:none}
  .cb-l{font-size:13px;color:var(--ink2)}.cb-l small{display:block;font-size:11px;color:var(--ink3)}
  .cb-v{display:flex;flex-wrap:wrap;align-items:center;gap:6px}
  .cb-c{height:30px;padding:0 10px;border:1px solid var(--line);border-radius:9px;background:var(--bg2);color:var(--ink2);font-family:'Space Mono',monospace;font-size:11.5px;cursor:pointer}
  .cb-c.on{border-color:var(--lime);color:var(--lime);background:rgba(194,246,74,.07)}
  .cb-in{display:inline-flex;align-items:center;gap:6px;height:30px;padding:0 9px;border:1px solid var(--line);border-radius:9px;background:#0b0e12}
  .cb-in input{width:62px;border:0;background:transparent;color:var(--ink);font-family:'Space Mono',monospace;font-size:13px;outline:none}
  .cb-in span{font-family:'Space Mono',monospace;font-size:10.5px;color:var(--ink3)}
  .cb-sum{margin-top:12px;padding:11px 13px;border-radius:11px;background:#0b0e12;font-size:13px;line-height:1.55;color:var(--ink2)}.cb-sum b{color:var(--ink)}
  .cb-err{color:#ff8a7d}
  .cx-pause{display:flex;flex-direction:column;gap:3px;margin:12px 0 0;padding:11px 13px;border-radius:12px;border:1px dashed rgba(255,179,71,.5);background:rgba(255,179,71,.07)}
  .cx-pause b{font-family:'Space Mono',monospace;font-size:11px;letter-spacing:.08em;text-transform:uppercase;color:#ffb347}.cx-pause span{font-size:13px;color:#c9bfa8;line-height:1.5}
  .cx-badge.paused{border-color:rgba(255,179,71,.5);color:#ffb347}.cx-badge.paused i{background:#ffb347;box-shadow:0 0 8px #ffb347}
  .cx-amber{display:inline-flex;align-items:center;height:46px;padding:0 18px;border:1px solid rgba(255,179,71,.5);border-radius:13px;background:rgba(255,179,71,.08);color:#ffcf8a;font-family:'Space Mono',monospace;font-size:12.5px;cursor:pointer}
  .cx-only{margin:12px 0 0;font-size:12.5px;line-height:1.5;color:var(--ink3)}
  .cx-ads{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:20px}
  .cx-ad{position:relative;display:flex;flex-direction:column;gap:8px;padding:15px 16px;border-radius:15px;overflow:hidden;text-decoration:none;color:var(--ink);border:1px solid color-mix(in srgb,var(--pc) 40%,transparent);background:radial-gradient(120% 140% at 100% 0,color-mix(in srgb,var(--pc) 18%,transparent),transparent 60%),#0d1016;transition:transform .15s,border-color .15s}
  .cx-ad:hover{transform:translateY(-2px);border-color:var(--pc)}
  .cx-ad .t{display:flex;align-items:center;justify-content:space-between;gap:8px}.cx-ad img{height:19px;width:auto}
  .cx-ad .k{font-family:'Space Mono',monospace;font-size:9.5px;letter-spacing:.12em;text-transform:uppercase;color:var(--pc)}
  .cx-ad b{font-family:'Bricolage Grotesque',sans-serif;font-size:17px;line-height:1.2}
  .cx-ad p{margin:0;font-size:12.5px;line-height:1.5;color:var(--ink3)}
  .cx-ad .g{font-family:'Space Mono',monospace;font-size:11.5px;font-weight:700;color:var(--pc)}
  .cx-adk{grid-column:1/-1;font-family:'Space Mono',monospace;font-size:10px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3)}
  .cx-amber.locked{border-color:#2b333d;background:transparent;color:#6f7a86;cursor:not-allowed}
  .cx-end{border-color:rgba(255,122,110,.4);color:#ff9a90}
  .cx-lock{margin:10px 0 0;font-size:12.5px;color:var(--ink3)}
  .cx-cf{margin-top:18px;padding:16px;border-radius:15px;border:1px solid rgba(255,179,71,.45);background:linear-gradient(180deg,rgba(255,179,71,.09),rgba(255,179,71,.02))}
  .cx-cf.quit{border-color:rgba(255,122,110,.5);background:linear-gradient(180deg,rgba(255,122,110,.10),rgba(255,122,110,.02))}
  .cx-cf b{display:block;font-family:'Bricolage Grotesque',sans-serif;font-size:18px;color:var(--ink)}
  .cx-cf p{margin:6px 0 14px;font-size:13.5px;line-height:1.55;color:var(--ink2)}
  .cx-cfb{display:flex;flex-wrap:wrap;gap:10px}
  .cx-cfy{height:46px;padding:0 20px;border:0;border-radius:13px;background:#ffb347;color:#0a0b0d;font-family:'Space Mono',monospace;font-weight:700;font-size:13px;cursor:pointer}.cx-cf.quit .cx-cfy{background:#ff7a6e}
  .cx-flash{margin:0 0 16px;padding:11px 14px;border-radius:12px;font-size:13.5px;border:1px solid rgba(46,189,133,.4);background:rgba(46,189,133,.08);color:#9fe7c6}
  .cx-flash.pause{border-color:rgba(255,179,71,.45);background:rgba(255,179,71,.08);color:#ffcf8a}.cx-flash.end{border-color:var(--line);background:var(--bg2);color:var(--ink2)}
  table.cx-ht{table-layout:fixed}
  .cx-ht th,.cx-ht td{text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .cx-ht th:first-child,.cx-ht td.nm{text-align:left}
  .cx-ht td.n.up{color:var(--green,#2ebd85)}.cx-ht td.n.dn{color:var(--red)}
  .cx-ht td.go a{color:var(--lime);text-decoration:none;font-family:'Space Mono',monospace;font-size:11.5px}
  .cx-ht .cx-st{display:inline-block;padding:4px 9px;border-radius:99px;border:1px solid currentColor;line-height:1}
  .cx-st.paused{color:#ffb347}
  .cx-livetag{font-family:'Space Mono',monospace;font-size:10.5px;color:#46e0e6;text-transform:uppercase;letter-spacing:.1em}
  @media(max-width:760px){.cb-f{grid-template-columns:1fr;gap:6px}.cx-ads{grid-template-columns:1fr}}
  @media(max-width:760px){.cx-types,.cx-steps{grid-template-columns:1fr}.cx-dash,.cx-cert{grid-template-columns:1fr}.cx-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.cx-eq{font-size:38px}.cx-app{padding:15px}.cx-stats{grid-template-columns:repeat(3,minmax(0,1fr))}.cx-stat b{font-size:21px}}
${UI.CSS}</style>
<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@type': 'WebApplication', name: 'Crypto Prop Firm Challenge Simulator', applicationCategory: 'FinanceApplication', operatingSystem: 'Web', url: URL, description: DESC, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' } })}
</script>
<script type="application/ld+json">
${JSON.stringify({ '@context': 'https://schema.org', '@type': 'FAQPage', mainEntity: FAQ.map(q => ({ '@type': 'Question', name: q[0], acceptedAnswer: { '@type': 'Answer', text: q[1] } })) })}
</script>
</head>
<body>
<header class="topbar"><a class="brand" href="/">MARGIN<b>PAD</b></a><nav class="tool-switch"><a href="/tools/">All tools</a><a href="/${SLUG}/" class="on">Challenge</a><a href="/prop-firm-drawdown-calculator/">Drawdown</a><a href="/crypto-prop-firms/">Prop firms</a><a href="/practice-for-a-funded-account/">Pass rate</a></nav><a class="home" href="/">&larr; marginpad.io</a></header>

<div class="wrap">
  <section class="hero">
    <span class="eyebrow">Free prop firm challenge</span>
    <h1>Crypto Prop Firm Challenge Simulator</h1>
    <p class="sub">Take a funded-account evaluation for free before you pay for one. Pick our rules, FTMO's or IQ Capital's - or set your own - and an account size, trade it in the MarginPad terminal on live crypto prices, and our server enforces the daily loss limit, the drawdown and the target exactly as a prop firm would. Pass it and you get a certificate you can share.</p>
  </section>

  ${UI.statsHtml}

  <section class="cx-app" id="cxApp" data-state="loading" aria-live="polite">
    ${UI.pickHtml}
    <div class="cx-row"><span class="cx-lbl">Account size</span>${[5000, 10000, 25000, 50000, 100000].map(b => `<button type="button" class="cx-chip${b === 10000 ? ' on' : ''}" data-book="${b}">$${b / 1000}k</button>`).join('')}</div>
    <div class="cx-start"><button type="button" class="cx-go" id="cxGo" data-auth-open>Sign in to start - free</button><span class="cx-fine">No fee, no card, no deposit. Retry as often as you like.</span></div>
  </section>

  <section class="content" id="board">
    <h2>Passed challenges</h2>
    <p>Every challenge passed on MarginPad, newest first. Each one was scored by our server on live prices, rule by rule, from the moment it started.</p>
    <div class="tblw"><table class="cx-t"><thead><tr><th>Trader</th><th>Rule set</th><th>Account</th><th>Return</th><th>Max DD</th><th>Days</th><th>Passed</th></tr></thead><tbody id="cxBoard"><tr><td colspan="7" class="cx-empty">Loading the board&hellip;</td></tr></tbody></table></div>
  </section>

  <section class="content">
    <h2>How it works</h2>
    <div class="cx-steps">
      <div class="cx-step"><b>01 / Pick the rules</b><p>Our one-step, two-step or end-of-day shapes, FTMO's 1-Step or 2-Step, IQ Capital's Core - or your own rules - on a $5,000 to $100,000 account.</p></div>
      <div class="cx-step"><b>02 / Trade the terminal</b><p>Every position you open in the <a href="/paper-trade">paper trading terminal</a> while it runs counts for the challenge - and only for the challenge, never the leaderboards. Pause it whenever you have no open position.</p></div>
      <div class="cx-step"><b>03 / Pass or learn</b><p>Hit the target on closed trades with the minimum trading days and no rule broken, and the run is certified. Break a rule and the run ends at that moment - start another one.</p></div>
    </div>
    <h2>The rules, exactly as we score them</h2>
    <p><strong>What counts.</strong> Every server-filled position you open while the challenge runs and is not paused. Those trades count for the challenge only - not for the leaderboards, XP, Ticks or missions. Positions you already held are ignored, so a challenge always starts clean. Partial closes count when they close.</p>
    <p><strong>Pausing.</strong> Pause whenever no challenge position is open. While paused your trades are ordinary trades again, the time limit stops, and the run keeps its balance, days and floors. Resume and new trades count for the challenge again.</p>
    <p><strong>Optional rules.</strong> Max loss per trade: a trade that loses more than that share of the account is a breach, and the set number of breaches ends the run (IQ Capital's shape ends it on the third). Best day: a pass needs your best day to be under that share of the total profit - going over is not a breach, you keep trading (FTMO's shape). Time limit: the run ends if the target is not reached in that many active days.</p>
    <p><strong>Daily loss.</strong> Measured from your closed balance at 00:00 UTC: your equity - closed balance plus the open profit and loss of your challenge positions - may not fall further below it than the daily limit, taken as a percentage of the account size. It resets every day and does not care how far ahead you were.</p>
    <p><strong>Maximum drawdown.</strong> Static sits at the account size minus the limit and never moves. Trailing rises with your highest closed balance. End-of-day trailing rises with your highest balance at the close of a UTC day. None of them ever move down.</p>
    <p><strong>When it is checked.</strong> Every close is checked the moment it lands. Open losses are checked every ten minutes and whenever you open the challenge in the terminal or here. A breach ends the run on the spot - a later recovery does not undo it, exactly as at a firm.</p>
    <p><strong>Passing.</strong> Your closed balance reaches the target and you have traded on at least the minimum number of days (a day with a challenge trade opened or closed). Two-step runs phase 2 from a fresh balance. A pass earns a certificate, and a preset pass also earns 100 XP (a custom pass does not - its rules can be made easy).</p>
    <div class="cta">
      <a href="/prop-firm-drawdown-calculator/">Prop firm drawdown calculator</a>
      <a href="/crypto-prop-firms/">Compare crypto prop firms</a>
      <a href="/academy/?lesson=pf1">Free course: passing a challenge</a>
    </div>
  </section>

  <section class="content faq">
    <h2>FAQ</h2>
${FAQ.map(q => `    <details>\n      <summary>${esc(q[0])}</summary>\n      <div class="a">${esc(q[1])}</div>\n    </details>`).join('\n')}
  </section>
</div>

<div class="wrap" style="padding-bottom:0">
<footer class="toolfoot"><div class="cols"><div><a class="brand" href="/" style="font-size:18px">MARGIN<b>PAD</b></a><p class="blurb">Free crypto futures tools - calculators, a live charts workspace, a paper-trading terminal and a real-time liquidation feed. No signup.</p></div><div><h4>Funded practice</h4><a href="/${SLUG}/">Prop Firm Challenge</a><a href="/prop-firm-drawdown-calculator/">Drawdown Calculator</a><a href="/crypto-prop-firms/">Crypto Prop Firms</a><a href="/practice-for-a-funded-account/">Our Pass Rate</a></div><div><h4>MarginPad</h4><a href="/paper-trade">Paper Trade</a><a href="/charts">Charts</a><a href="/calculators">Calculators</a><a href="/screener">Screener</a><a href="/rekt/">Liquidations</a></div></div><div class="bottom">&copy; 2026 MarginPad &middot; Free crypto trading tools &middot; Not financial advice</div></footer>
</div>

${PAGE_JS}
${fs.readFileSync(path.join(__dirname, "data", "us-swap.js.txt"), "utf8").trim()}
<script defer src="/assets/mp-auth.js"></script>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>
`;
fs.mkdirSync(path.join(DIST, SLUG), { recursive: true });
fs.writeFileSync(path.join(DIST, SLUG, 'index.html'), html);
console.log('wrote dist/' + SLUG + '/index.html (' + Math.round(html.length / 1024) + ' KB)');
