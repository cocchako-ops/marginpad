/* MarginPad full site build - runs every generator in the correct order, stops on first error.
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

// 1) tool-route shell - since go-live, app/index.html is NOT the homepage; it's the Paper-Trade/Charts/
//    Calculators/Screener shell served at /app. Stamp the home.css/home.js ?v= hash on it FIRST, then copy
//    it to dist/app.html so the shell ships the fresh bundle.
run('Version-stamp home.css/home.js', 'node build/bump-home-assets.js');
process.stdout.write('▸ copy tool shell app/index.html → dist/app.html\n');
fs.copyFileSync(path.join(ROOT, 'app', 'index.html'), path.join(ROOT, 'dist', 'app.html'));

// 1b) live homepage - render the hand-authored bento source (dist/demo-home/index.html) into dist/index.html
//     (indexable, real SEO head + gtag + JSON-LD). The generators + gtag below operate on this dist/index.html.
run('Live homepage (bento) from demo-home', 'node build/gen-home-live.js');

// 2) standalone SEO / landing-page generators (independent of each other)
run('SEO exchange pages', 'node build/gen-seo-pages.js');
run('Per-coin liquidation pages', 'node build/gen-coin-pages.js');
run('Exchange comparison pages', 'node build/gen-compare-pages.js');
run('"Best for" pages', 'node build/gen-bestfor-pages.js');
run('Liquidation-map pages', 'node build/gen-liqmap-pages.js');
run('Liquidations data page', 'node build/gen-liquidations-page.js');
// RETIRED 2026-08-18: the 20 /liquidations/<coin> pages were 99% identical to each other and drew 11
// pageviews with none from search over 90 days, while the /liquidations/ hub they fed earns steadily.
// Consolidated into that hub with 301s. The generator stays in the tree if we ever rebuild them properly.
// run('Per-coin liquidation SEO pages', 'node build/gen-liq-coin-pages.js');
run('Liquidation statistics page', 'node build/gen-liq-stats-page.js');
run('Alternative comparison pages', 'node build/gen-alternative-pages.js');
run('Funding data page', 'node build/gen-funding-page.js');
run('Long/short data page', 'node build/gen-longshort-page.js');
run('Open-interest data page', 'node build/gen-openinterest-page.js');
// RETIRED 2026-08-18: 754 pages (58 English + 696 translations) at 96% word overlap, returning 69
// pageviews and ONE Google visit in 90 days. Six symbols survive as hand-maintained pages; the rest 301
// to /coins/. Regenerating would recreate the duplicate estate this consolidation removed.
// run('Per-coin dashboards', 'node build/gen-coin-dashboard-pages.js');
run('DeFi dashboard', 'node build/gen-defi-page.js');
run('Bitcoin cycle', 'node build/gen-cycle-page.js');
run('ETF flows', 'node build/gen-etf-page.js');
run('Hyperliquid whales', 'node build/gen-whales-page.js');
run('Exchange comparison', 'node build/gen-exchanges-page.js');
run('Markets hub', 'node build/gen-markets-hub.js');
run('How-to guides', 'node build/gen-guides-pages.js');
run('Where-to-start beginner academy', 'node build/gen-where-to-start.js');
run('About / Contact pages', 'node build/gen-about-pages.js');
run('Leverage / funding-fee / glossary pages', 'node build/gen-bigupdate.js');
run('API + Widgets pages', 'node build/gen-api-widgets-pages.js');
run('Trading tools suite pages', 'node build/gen-tools-pages.js');

// 3) blog (index + articles + flagship translations + related links)
run('Blog', 'node build/gen-blog.js');
run('Blog i18n (flagship translations)', 'node build/gen-blog-i18n.js');
run('Blog i18n (MiCA/USDT news, EU langs)', 'node build/gen-news-mica-i18n.js');
run('Blog i18n (exchanges)', 'node build/gen-blog-i18n-exchanges.js');
run('Blog i18n (leverage)', 'node build/gen-blog-i18n-leverage.js');
run('Blog i18n (pnl)', 'node build/gen-blog-i18n-pnl.js');
run('Blog i18n (position size)', 'node build/gen-blog-i18n-size.js');
run('Related-post links', 'node build/add-related.js');

// 4) i18n assets - slim loader + per-language lazy packs (from build/i18n-master.js)
run('i18n assets (slim + packs)', 'node build/gen-i18n-assets.js');

// 5) language homepages - translated copies of dist/index.html (must run AFTER the homepage copy)
run('Language homepages', 'node build/gen-i18n-pages.js');
// 5b) translate the bento homepage BODY into each language (post-processes the pages gen-i18n-pages just wrote)
run('Language homepage body translation', 'node build/gen-home-i18n.js');

// 6) (retired) add-sweepliq.js - the homepage JS now ships as the shared /assets/home.js bundle,
//    so language homepages can never drift from it; the old string-anchored patcher is obsolete.

// 7) swap Google Fonts → self-hosted fonts on every html (faster LCP, no external DNS)
run('Self-host fonts', 'node build/self-host-fonts.js');

// 8) inject the shared mobile nav drawer (/assets/mp-nav.js) into every standalone page (skips homepages/widgets; idempotent)
run('Inject mobile nav into every page', 'node build/add-mpnav.js');

// 9) normalise the viewport meta on every page (consistent app-like, no-pinch-zoom)
run('Normalise viewport (no-zoom)', 'node build/normalize-viewport.js');

// 10) inject the analytics tag into EVERY html (must run LAST so nothing it touched gets regenerated after)
run('Inject gtag into every page', 'node build/add-gtag.js');
run('Inject Sentry reporter into every page', 'node build/add-sentry.js');
run('Inject Yandex.Metrica into every page', 'node build/add-metrica.js');

// 11) warm the fonts.gstatic.com connection on every font-loading page (LCP perf; idempotent)
run('Inject font preconnect', 'node build/add-preconnect.js');

// 11b) re-add hand-maintained pages the sitemap generator doesn't know about
run('Sitemap extras (hand-made pages)', 'node build/add-sitemap-extras.js');

// 11c) the translated-SEO sitemap. LANGS in that script has been empty since 2026-08-18 (those 1,008
// pages were removed), so this step now DELETES dist/sitemap-i18n.xml and its robots.txt line rather
// than writing an empty <urlset> - which Google read as an error, with 0 discovered pages, on every
// read for a month. Putting languages back into LANGS restores the file and the robots line together.
run('i18n sitemap (translated SEO pages)', 'node build/gen-i18n-sitemap.js');

// 11d) honest freshness: bump dateModified + visible "Updated" + sitemap lastmod ONLY on pages whose
// content actually changed since the last build (hash manifest in build/data/page-mod-hashes.json)
run('Stamp updated dates (changed pages only)', 'node build/stamp-updated.js');

// 11e) contextual exchange rail on pages that carry no affiliate link at all. Runs AFTER stamp-updated
// on purpose: the rail is monetisation, not editorial, so it must not bump dateModified/lastmod on 582
// pages at once (that reads as refresh-spam). Stamping therefore always hashes rail-free content.
run('Exchange rail on unmonetised pages', 'node build/add-exchange-rail.js');
run('Hyperliquid partner card on its pages', 'node build/add-hyperliquid-card.js');
// 11f) hub links for pages nothing linked to (per-coin maps/calculators, comparisons, translated hubs/posts) + og:image fallback - both idempotent, both before the charset pass.
run('Hub links for orphan pages', 'node build/add-hub-links.js');
run('share cards', 'node build/add-og-image.js');
// the feed injects <link rel=alternate> into every head, so it runs BEFORE fix-charset like the rest
run('rss + json feed', 'node build/gen-feed.js');

// 12) LAST: <meta charset> must be the FIRST tag in <head> (within the 1024-byte prescan) - the
// Yandex/gtag head injections once pushed it deeper and the whole site rendered as windows-1252 mojibake.
// dateModified before the charset pass, since it inserts before </head> and fix-charset must have the
// final say on head ordering.
run('dateModified stamps', 'node build/add-datemodified.js');
run('Charset meta first in head', 'node build/fix-charset.js');

// 12) build the Browse search content index - scans EVERY page's <title>, so it must run LAST
run('Search index (Browse suggestions)', 'node build/gen-search-index.js');

// 13) VERY LAST: ?v= content hashes on every shared bundle reference (generators + post-processors write bare
// /assets/mp-nav.js etc.; the stamper walks all HTML, home.js's loaders and the worker's injection). Without this the
// service worker serves those bundles network-first on every load. check-home-hash (predeploy) fails on a bare ref.
run('Stamp bundle versions (?v=)', 'node build/bump-home-assets.js');

// 14) SPANISH SITE (2026-09-12): /es/<path> twins written from the translated catalog (build/data/es/catalog.json) out of
// the SAME English markup - after the stamper so the twins inherit the ?v= references. Missing strings fall back to English
// and are listed by `node build/es/extract.js --chunks` for the translators.
run('Spanish site (/es/ twins)', 'node build/es/gen-pages.js');

process.stdout.write('\n Build complete. Review dist/, then: npm run deploy\n');
