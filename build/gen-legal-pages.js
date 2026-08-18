/* Legal pages: /terms/ and /privacy/ — hand-authored, generated so both stay in one place and in one design.
 *
 * WHY THIS EXISTS (2026-08-19): the site had no Terms of Service at all, while running things that
 * genuinely need one — a rewards ledger that pays real money, a paid subscription, a public API, user
 * chat and profiles, affiliate links, and market data we produce ourselves. And the existing privacy
 * policy still claimed "we have no accounts, no logins, and no database of users", which stopped being
 * true a long time ago: there are registered accounts, sessions, a rewards ledger, chat and profiles.
 * A privacy policy that describes a different product is a liability rather than a protection.
 *
 * Both documents describe what the code ACTUALLY does — the cookies it really sets, the processors it
 * really calls, the session recording that is really enabled on desktop. Written to be read, because a
 * term nobody can follow protects nobody.
 *
 * NOT LEGAL ADVICE and not a substitute for review: the operating entity and governing law are marked
 * PLACEHOLDER and must be completed by the owner, then the whole thing read by a lawyer in that
 * jurisdiction before it is relied on.
 */
const fs = require('fs');
const path = require('path');
const OUT = path.join(__dirname, '..', 'dist');
const UPDATED = 'August 2026';

const shell = (slug, title, desc, body) => `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
<title>${title} | MarginPad</title>
<meta name="description" content="${desc}" />
<link rel="canonical" href="https://marginpad.io/${slug}/" />
<meta name="robots" content="index,follow" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="/assets/fonts.css" />
<link rel="stylesheet" href="/assets/blog.css" />
<style>
  article ol{padding-left:22px}
  article ol > li{margin:10px 0}
  article h2{margin-top:34px}
  .lgl-note{border-left:2px solid #ffb347;background:rgba(255,179,71,.06);padding:13px 16px;border-radius:0 10px 10px 0;margin:22px 0;font-size:14.5px;color:#c8d0d9}
  .lgl-note b{color:#ffb347}
  .lgl-toc{display:flex;flex-wrap:wrap;gap:7px;margin:18px 0 26px}
  .lgl-toc a{font:600 12px 'Space Mono',ui-monospace,monospace;color:#8b95a1;background:#111419;border:1px solid #232932;border-radius:8px;padding:6px 11px;text-decoration:none}
  .lgl-toc a:hover{color:#c2f64a;border-color:#3a434f}
  article table{width:100%;border-collapse:collapse;font-size:13.5px;margin:16px 0}
  article th{text-align:left;font:700 11px 'Space Mono',ui-monospace,monospace;letter-spacing:.08em;text-transform:uppercase;color:#5c656f;padding:9px 10px;border-bottom:1px solid #232932}
  article td{padding:9px 10px;border-bottom:1px solid rgba(35,41,50,.6);color:#c8d0d9;vertical-align:top}
  .tw{overflow-x:auto}
</style>
</head>
<body>
<div class="wrap">
  <header>
    <a class="brand" href="/">MARGIN<b>PAD</b></a>
    <nav class="nav"><a href="/">Tools</a><a href="/blog/">Blog</a><a href="/terms/">Terms</a><a href="/privacy/">Privacy</a></nav>
  </header>
  <div class="crumb"><a href="/">Home</a> / ${title}</div>
  <article>
${body}
  </article>
</div>
<script defer src="/assets/mp-nav.js"></script>
</body>
</html>`;

/* ------------------------------------------------------------------ TERMS */
const terms = `    <h1>Terms of Service</h1>
    <div class="meta">Last updated: ${UPDATED}</div>

    <p>These terms govern your use of <strong>marginpad.io</strong>, its subdomains, the MarginPad browser extensions, the Telegram bots and the public API (together, <strong>the Service</strong>). By using the Service you accept them. If you do not accept them, do not use the Service.</p>

    <div class="lgl-note"><b>The short version.</b> MarginPad is an educational tool. Nothing here is financial advice. The trading is simulated with fake money. The data can be wrong or late. You are responsible for what you do with it, and for whether using it is legal where you live.</div>

    <div class="lgl-toc">
      <a href="#advice">1. Not advice</a><a href="#paper">2. Simulated trading</a><a href="#data">3. Data</a>
      <a href="#eligible">4. Eligibility</a><a href="#accounts">5. Accounts</a><a href="#rewards">6. Rewards</a>
      <a href="#premium">7. Premium</a><a href="#vault">8. Digital items</a><a href="#api">9. API</a>
      <a href="#content">10. Your content</a><a href="#affiliate">11. Affiliate links</a>
      <a href="#uptime">12. Availability</a><a href="#liability">13. Liability</a><a href="#law">14. Law</a>
    </div>

    <h2 id="advice">1. MarginPad is not financial advice</h2>
    <p>Everything on the Service &mdash; calculators, charts, screeners, market data, liquidation maps, articles, academy lessons, Telegram messages and anything produced by our AI features &mdash; is <strong>general information and educational material only</strong>. It is not investment advice, not a recommendation to buy or sell anything, not a solicitation, and it is not tailored to your circumstances, your finances or your risk tolerance.</p>
    <p>We are not a broker, not an exchange, not an investment firm and not a licensed financial adviser in any jurisdiction. We do not hold client money and we never execute a real trade on your behalf.</p>
    <p>Leveraged trading carries a high risk of losing money rapidly. Most retail accounts lose money trading derivatives. Decisions you take after reading anything here are entirely your own.</p>

    <h2 id="paper">2. Paper trading is simulated</h2>
    <p>The paper-trading terminal, Demo Spot, the simulators and the duels use <strong>fake money</strong>. No order is ever sent to a real market. Fills, funding, fees and liquidations are modelled by us to resemble real venues; they will not match what a real exchange would have done.</p>
    <p>Simulated results are not indicative of real results. Slippage, latency, partial fills, exchange outages, spread, insurance-fund behaviour and your own psychology under real risk all differ. Do not treat a profitable simulated record as evidence that the same approach will make money with real capital.</p>

    <h2 id="data">3. Market data is provided as-is</h2>
    <p>Prices, funding rates, open interest, liquidation feeds, heatmaps, clusters and statistics are gathered from exchanges and third-party providers, and in some cases produced by our own collector. They may be delayed, incomplete, interrupted or wrong.</p>
    <p>Liquidation <em>clusters</em> and heatmaps are explicitly <strong>estimates produced by a model</strong>, not observed orders. Nobody, including us, can see the real book of open leveraged positions. Treat them as a map of where pressure may sit, never as fact.</p>
    <p>We give no warranty as to accuracy, completeness or timeliness, and we are not liable for any decision taken in reliance on the data.</p>

    <h2 id="eligible">4. Eligibility and your local law</h2>
    <ol>
      <li>You must be at least <strong>18 years old</strong> and legally able to enter into these terms.</li>
      <li>Crypto derivatives are restricted or prohibited for retail users in many countries. <strong>It is your responsibility</strong> to know whether using the Service, and whether trading on any venue we link to, is lawful where you are.</li>
      <li>You must not use the Service if you are subject to sanctions, or located in a sanctioned territory, or if doing so would breach any law that applies to you.</li>
      <li>You must not use the Service on behalf of anyone who is barred from it.</li>
    </ol>

    <h2 id="accounts">5. Accounts</h2>
    <p>An account is optional; the tools work without one. If you create one, you are responsible for the security of your email inbox and for everything done through your account.</p>
    <p><strong>One account per person.</strong> Multiple accounts operated by the same person, or by a group acting together, to obtain rewards, prizes, referral credit or leaderboard position are prohibited.</p>
    <p>We may suspend or close an account, withhold unpaid balances, and remove content, where we reasonably believe there has been abuse, multi-accounting, automated manipulation of rewards or leaderboards, fraud, harassment, or a breach of these terms. Where the reason is not fraud, we will tell you why.</p>

    <h2 id="rewards">6. Rewards, missions, prizes and withdrawals</h2>
    <p>The rewards area may credit small real amounts and pay prizes. These are <strong>promotional and discretionary</strong>, not a wage, not a return on investment and not a financial product.</p>
    <ol>
      <li>Rates, caps, cooldowns, eligibility thresholds and the minimum withdrawal are set by us and <strong>can change at any time</strong>, including for balances already accrued but not yet withdrawn.</li>
      <li>Withdrawals are processed <strong>manually</strong> and are not instant. We may require verification, including proof that a destination account was opened through our referral link, before paying.</li>
      <li>A balance is not a deposit, is not client money, is not held on trust for you, and confers no right to interest. We may suspend or discontinue the rewards programme entirely.</li>
      <li>Balances obtained through abuse, exploitation of a bug, automation, or accounts we reasonably believe are duplicates <strong>may be forfeited</strong>.</li>
      <li>Prizes and leaderboards are settled on our records. Where a scoring error is found, we may correct it.</li>
      <li>You are responsible for any tax arising on amounts you receive.</li>
    </ol>

    <h2 id="premium">7. Premium subscription</h2>
    <p>Premium is a recurring subscription paid in cryptocurrency through a third-party payment processor. Because payment is on-chain, <strong>payments are generally irreversible</strong>.</p>
    <p>Access runs for the period paid for. We may change the price or the feature set for future periods, and will not reduce a period you have already paid for. Where a feature is withdrawn during a paid period we will offer either a comparable replacement or a pro-rata credit. We do not offer refunds for periods already used, except where the law requires it.</p>

    <h2 id="vault">8. Digital items</h2>
    <p>Frames, ticket skins, backgrounds and consumables are <strong>cosmetic digital items licensed to your account</strong>, not property, and they have no monetary value outside the Service. They cannot be sold, transferred for value, or redeemed for money. We may alter or retire an item, and we may change its price or the way it is earned. Items obtained through abuse may be removed.</p>

    <h2 id="api">9. The public API</h2>
    <p>The API is provided free, as-is, with <strong>no service level and no guarantee of continuity</strong>. We may change endpoints, add authentication, impose or lower limits, or withdraw it entirely.</p>
    <p>You must not exceed published rate limits, circumvent them by rotating addresses, or resell the data as a substitute for the Service. Attribution is appreciated. Data reaching us from exchanges remains subject to those exchanges' own terms, and it is your responsibility to comply with them for your use.</p>

    <h2 id="content">10. Chat, community and anything you post</h2>
    <p>You are responsible for what you post. Do not post anything unlawful, abusive, hateful, deceptive, or infringing; do not impersonate anyone; do not post other people's personal information; do not use the Service to promote a scheme, solicit investment, or give personalised financial advice to other users.</p>
    <p>We may remove content and restrict posting at our discretion, and we do not review everything before it appears. By posting you grant us a non-exclusive, worldwide, royalty-free licence to host, display and distribute that content within the Service. You keep ownership of it.</p>

    <h2 id="affiliate">11. Affiliate links and third parties</h2>
    <p>The Service contains <strong>affiliate links</strong>. If you open an account through one, we may receive a commission; you pay the same either way. Being linked, listed or compared is not an endorsement, and a commission does not make an exchange safe or suitable for you.</p>
    <p>We do not control third-party venues and we are <strong>not responsible for them</strong> &mdash; their security, solvency, execution, fees, geographic restrictions, account decisions or support. Any dispute is between you and them. Verify a platform's licence and status yourself before depositing.</p>

    <h2 id="uptime">12. Availability and changes</h2>
    <p>The Service is provided <strong>as-is and as-available</strong>, with no uptime guarantee. Features may change or be withdrawn. We may amend these terms; material changes will be reflected in the date at the top, and continuing to use the Service after that constitutes acceptance.</p>

    <h2 id="liability">13. Limitation of liability</h2>
    <p>To the fullest extent permitted by law:</p>
    <ol>
      <li>We exclude all warranties not expressly stated here, including fitness for a particular purpose.</li>
      <li>We are <strong>not liable for trading losses</strong>, lost profit, lost opportunity, lost data, or any indirect or consequential loss, however caused.</li>
      <li>Our total aggregate liability to you is limited to the greater of the amount you paid us in the twelve months before the claim, or <strong>USD 100</strong>.</li>
      <li>Nothing here excludes liability that cannot lawfully be excluded, including for fraud or for death or personal injury caused by negligence.</li>
    </ol>
    <p>You agree to indemnify us against claims arising from your breach of these terms, your content, or your unlawful use of the Service.</p>

    <h2 id="law">14. Governing law and contact</h2>
    <p class="lgl-note"><b>PLACEHOLDER &mdash; complete before relying on this document.</b> The operating entity and the governing law and forum must be stated here, and these terms should be reviewed by a lawyer qualified in that jurisdiction. Until that is done, treat this page as a statement of intent rather than a settled contract.</p>
    <p>If any provision is found unenforceable, the rest continues to apply. Our failure to enforce a term is not a waiver of it.</p>
    <p>Questions about these terms: <a href="/contact/">contact us</a>. See also our <a href="/privacy/">Privacy Policy</a>.</p>
`;

/* ---------------------------------------------------------------- PRIVACY */
const privacy = `    <h1>Privacy Policy</h1>
    <div class="meta">Last updated: ${UPDATED}</div>

    <p>This policy describes what MarginPad actually collects and why. It covers <strong>marginpad.io</strong>, its subdomains, the browser extensions and the Telegram bots.</p>

    <div class="lgl-note"><b>Rewritten ${UPDATED}.</b> The previous version said MarginPad had no accounts, no logins and no user database. That stopped being true as the site grew, and a policy that describes a different product is worse than none. This one describes what the code does today.</div>

    <h2>Using the tools without an account</h2>
    <p>The calculators still run <strong>entirely in your browser</strong>. Numbers you type into them are never sent to us. You can use the calculators, charts, screener, heatmap and market data without giving us anything beyond what any web server sees.</p>

    <h2>What we collect</h2>
    <div class="tw"><table>
      <thead><tr><th>What</th><th>When</th><th>Why</th></tr></thead>
      <tbody>
        <tr><td>A device identifier (<code>mp_did</code> cookie, 2 years)</td><td>Every visit</td><td>To count returning visitors without an account, and to detect abuse of the rewards programme</td></tr>
        <tr><td>Pages visited, referrer, country, device and browser type</td><td>Every visit</td><td>Analytics &mdash; which pages work and where visitors come from</td></tr>
        <tr><td>IP address</td><td>Every request</td><td>Seen by our infrastructure; used for country detection, rate limiting and abuse prevention</td></tr>
        <tr><td>Email address</td><td>If you create an account</td><td>Sign-in codes, account notices, and messages you ask for</td></tr>
        <tr><td>Session cookies (<code>mp_sess</code>, <code>mp_uid</code>, <code>mp_un</code>)</td><td>While signed in</td><td>To keep you signed in and show your own data</td></tr>
        <tr><td>Your simulated trades, XP, missions, streaks and profile</td><td>If you create an account</td><td>To run the product you signed up for</td></tr>
        <tr><td>Chat messages, community posts, profile text and avatar</td><td>If you post</td><td>These are public by design</td></tr>
        <tr><td>Rewards balance, withdrawal requests and the destination you give us</td><td>If you use rewards</td><td>To pay you, and to prevent multi-accounting</td></tr>
        <tr><td>Telegram user id and username</td><td>If you link Telegram</td><td>To connect bot messages to your account</td></tr>
      </tbody>
    </table></div>

    <h2>Analytics and session recording</h2>
    <p>We use <strong>Google Analytics</strong> and <strong>Yandex Metrica</strong>. Yandex Metrica includes <strong>Webvisor, which records how a page is used &mdash; movement, scrolling and clicks &mdash; and is enabled on wider screens</strong>. We use it to find broken layouts and confusing flows. We also run <strong>Sentry</strong>, which captures error reports when something breaks, and those reports can include the page you were on.</p>
    <p>You can block all three with any standard content blocker, and the site works normally when you do.</p>

    <h2>Who else processes your data</h2>
    <div class="tw"><table>
      <thead><tr><th>Provider</th><th>For</th></tr></thead>
      <tbody>
        <tr><td>Cloudflare</td><td>Hosting, storage and delivery of the whole Service</td></tr>
        <tr><td>Google Analytics, Yandex Metrica</td><td>Traffic analytics and session recording</td></tr>
        <tr><td>Sentry</td><td>Error reporting</td></tr>
        <tr><td>Resend</td><td>Sending email &mdash; sign-in codes and notices</td></tr>
        <tr><td>NOWPayments</td><td>Processing Premium subscription payments</td></tr>
        <tr><td>Telegram</td><td>Bot messages, if you choose to link it</td></tr>
      </tbody>
    </table></div>
    <p>We do not sell your data, and we do not share it with advertisers.</p>

    <h2>Exchange links</h2>
    <p>Links to exchanges are <strong>affiliate links</strong> carrying a referral code. Following one tells that exchange the visit came from us. It does not send them your email, your account or anything you typed here. Once you are on their site, their privacy policy applies, not ours.</p>

    <h2>How long we keep things</h2>
    <p>Account data is kept while the account exists. Analytics is aggregated and retained in the ordinary course. The live activity feed used for operations is a rolling window of a few hours. Rewards and withdrawal records are kept longer, because we need them to resolve payment disputes and detect abuse.</p>

    <h2>Your choices</h2>
    <ol>
      <li><strong>Use the tools signed out.</strong> Most of the Service needs no account.</li>
      <li><strong>Block the analytics.</strong> A content blocker stops Google Analytics, Yandex Metrica and Sentry; nothing breaks.</li>
      <li><strong>Clear cookies</strong> to reset the device identifier.</li>
      <li><strong>Ask for a copy or a deletion.</strong> Write to us and we will action it. Deleting an account removes your profile and personal data; public chat messages may be removed on request, and anonymised aggregate statistics may remain.</li>
    </ol>

    <h2>Children</h2>
    <p>The Service is not intended for anyone under 18 and we do not knowingly collect data from children.</p>

    <h2>Contact</h2>
    <p>Privacy questions, data requests and deletions: <a href="/contact/">contact us</a>. See also our <a href="/terms/">Terms of Service</a>.</p>
`;

for (const [slug, title, desc, body] of [
  ['terms', 'Terms of Service', 'The terms governing use of MarginPad: educational only, simulated trading, data provided as-is, rewards and subscription terms, and limitation of liability.', terms],
  ['privacy', 'Privacy Policy', 'What MarginPad collects and why: cookies, analytics including session recording, accounts, rewards data, the processors involved, and how to opt out.', privacy],
]) {
  const dir = path.join(OUT, slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), shell(slug, title, desc, body));
  console.log('wrote /' + slug + '/');
}
