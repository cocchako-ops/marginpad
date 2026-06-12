/* Injects a "Related guides" block into every blog article (idempotent).
   Links concentrate on evergreen pillar guides for internal SEO + retention.
   Run after gen-blog.js: node build/add-related.js */
const fs = require('fs');
const path = require('path');
const BLOG = path.join(__dirname, '..', 'dist', 'blog');

const GUIDES = [
  ['how-to-calculate-liquidation-price', 'How to Calculate Liquidation Price'],
  ['crypto-position-sizing-risk-management', 'Crypto Position Sizing (1% Rule)'],
  ['crypto-leverage-explained', 'Crypto Leverage Explained'],
  ['risk-reward-ratio-explained', 'Risk/Reward Ratio Explained'],
  ['what-is-liquidation-in-crypto', 'What Is Liquidation in Crypto'],
  ['cross-vs-isolated-margin', 'Cross vs Isolated Margin'],
];

let n = 0, skip = 0;
for (const e of fs.readdirSync(BLOG, { withFileTypes: true })) {
  if (!e.isDirectory()) continue;
  const slug = e.name;
  const p = path.join(BLOG, slug, 'index.html');
  if (!fs.existsSync(p)) continue;
  let h = fs.readFileSync(p, 'utf8');
  if (h.indexOf('>Related guides<') >= 0) { skip++; continue; }
  const picks = GUIDES.filter(g => g[0] !== slug).slice(0, 4);
  const block = '\n    <h2>Related guides</h2>\n    <div class="related">\n'
    + picks.map(g => '      <a href="/blog/' + g[0] + '/">' + g[1] + '</a>').join('\n')
    + '\n    </div>\n  ';
  if (h.indexOf('</article>') < 0) continue;
  h = h.replace('</article>', block + '</article>');
  fs.writeFileSync(p, h);
  n++;
}
console.log('related guides injected into', n, 'articles,', skip, 'already had it');
