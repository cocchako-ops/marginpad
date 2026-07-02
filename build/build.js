/* MarginPad full site build — runs every generator in the correct order, stops on first error.
   Usage:  node build/build.js          (full rebuild of dist/, then `npx wrangler deploy`)
   For a quick homepage-only change, the manual flow in CLAUDE.md is faster:
     cp app/index.html dist/index.html && node build/add-gtag.js && node build/gen-i18n-pages.js && node build/add-sweepliq.js
   This orchestrator exists so the ordering (which previously lived only in someone's head) is captured in code. */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const ROOT = path.join(__dirname, '..');

function run(label, cmd) {
  process.stdout.write('\n▸ ' + label + '\n');
  execSync(cmd, { cwd: ROOT, stdio: 'inherit' });
}

// 1) homepage source → dist (the generators + gtag operate on dist/index.html)
process.stdout.write('▸ copy homepage app/index.html → dist/index.html\n');
fs.copyFileSync(path.join(ROOT, 'app', 'index.html'), path.join(ROOT, 'dist', 'index.html'));

// 2) standalone SEO / landing-page generators (independent of each other)
run('SEO exchange pages', 'node build/gen-seo-pages.js');
run('Per-coin liquidation pages', 'node build/gen-coin-pages.js');
run('Exchange comparison pages', 'node build/gen-compare-pages.js');
run('"Best for" pages', 'node build/gen-bestfor-pages.js');
run('Liquidation-map pages', 'node build/gen-liqmap-pages.js');
run('Liquidations data page', 'node build/gen-liquidations-page.js');
run('Funding data page', 'node build/gen-funding-page.js');
run('Long/short data page', 'node build/gen-longshort-page.js');
run('Open-interest data page', 'node build/gen-openinterest-page.js');
run('Per-coin dashboards', 'node build/gen-coin-dashboard-pages.js');
run('DeFi dashboard', 'node build/gen-defi-page.js');
run('Markets hub', 'node build/gen-markets-hub.js');
run('How-to guides', 'node build/gen-guides-pages.js');
run('Where-to-start beginner academy', 'node build/gen-where-to-start.js');
run('About / Contact pages', 'node build/gen-about-pages.js');
run('Leverage / funding-fee / glossary pages', 'node build/gen-bigupdate.js');

// 3) blog (index + articles + flagship translations + related links)
run('Blog', 'node build/gen-blog.js');
run('Blog i18n (flagship translations)', 'node build/gen-blog-i18n.js');
run('Blog i18n (MiCA/USDT news, EU langs)', 'node build/gen-news-mica-i18n.js');
run('Blog i18n (exchanges)', 'node build/gen-blog-i18n-exchanges.js');
run('Blog i18n (leverage)', 'node build/gen-blog-i18n-leverage.js');
run('Blog i18n (pnl)', 'node build/gen-blog-i18n-pnl.js');
run('Blog i18n (position size)', 'node build/gen-blog-i18n-size.js');
run('Related-post links', 'node build/add-related.js');

// 4) i18n assets — slim loader + per-language lazy packs (from build/i18n-master.js)
run('i18n assets (slim + packs)', 'node build/gen-i18n-assets.js');

// 5) language homepages — translated copies of dist/index.html (must run AFTER the homepage copy)
run('Language homepages', 'node build/gen-i18n-pages.js');

// 6) patch the overnight-liquidation sweep into the language homepages (must run AFTER gen-i18n-pages)
run('Patch sweepLiq into lang homepages', 'node build/add-sweepliq.js');

// 7) swap Google Fonts → self-hosted fonts on every html (faster LCP, no external DNS)
run('Self-host fonts', 'node build/self-host-fonts.js');

// 8) inject the shared mobile nav drawer (/assets/mp-nav.js) into every standalone page (skips homepages/widgets; idempotent)
run('Inject mobile nav into every page', 'node build/add-mpnav.js');

// 9) normalise the viewport meta on every page (consistent app-like, no-pinch-zoom)
run('Normalise viewport (no-zoom)', 'node build/normalize-viewport.js');

// 10) inject the analytics tag into EVERY html (must run LAST so nothing it touched gets regenerated after)
run('Inject gtag into every page', 'node build/add-gtag.js');

// 11) warm the fonts.gstatic.com connection on every font-loading page (LCP perf; idempotent)
run('Inject font preconnect', 'node build/add-preconnect.js');

// 12) build the Browse search content index — scans EVERY page's <title>, so it must run LAST
run('Search index (Browse suggestions)', 'node build/gen-search-index.js');

process.stdout.write('\n✅ Build complete. Review dist/, then: npx wrangler deploy\n');
