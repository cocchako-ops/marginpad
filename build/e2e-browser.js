// Shared puppeteer harness for E2E / measurement scripts.
//
// WHY THIS EXISTS (2026-07-31): ad-hoc test scripts each wrote their own launch/close. When a script threw or hit a
// timeout, browser.close() on the success path never ran, so headless Chrome leaked — ~30 procs piled up per run →
// resource exhaustion → FALSE failures (pages=0, hangs). Worse, the ad-hoc cleanup was `taskkill //IM chrome.exe`,
// which kills the USER'S real browser too ("Chrome closes itself"). This harness fixes both:
//   1. withBrowser() ALWAYS closes in a finally (success, throw, OR process signals) — no leaks.
//   2. every browser gets a distinctive tagged userDataDir (mp-e2e-profile-*), so cleanup can target ONLY our chrome
//      and NEVER the user's default profile. Kill helper: `node build/e2e-browser.js --kill`.
//
// USAGE (from a scratchpad script — set NODE_PATH to the repo node_modules or require puppeteer-core resolves via here):
//   const { withBrowser, newPage } = require('D:/part1/money-mission/build/e2e-browser.js');
//   const out = await withBrowser(async (browser) => {
//     const page = await newPage(browser, { mobile: true, auth: { username: 'staging', password: PASS } });
//     await page.goto(BASE + '/charts', { waitUntil: 'domcontentloaded' });
//     return await page.evaluate(() => document.title);
//   });                       // browser is guaranteed closed here, even if the callback throws.

const puppeteer = require('puppeteer-core');
const os = require('os'), path = require('path'), { execSync } = require('child_process');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TAG = 'mp-e2e-profile'; // distinctive user-data-dir marker → identifies ONLY our chrome (never the user's default profile)

// Run fn(browser) with a GUARANTEED close. The finally covers success + throw; the signal handlers cover a killed
// node process (Ctrl-C, SIGTERM, timeout wrapper). browser.close() is idempotent-safe (try/catch).
async function withBrowser(fn, { args = [], extraLaunch = {} } = {}) {
  const userDataDir = path.join(os.tmpdir(), TAG + '-' + process.pid + '-' + Date.now());
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    userDataDir,                       // tagged → all child procs inherit --user-data-dir → surgical cleanup
    args: ['--no-sandbox', '--ignore-certificate-errors', ...args],
    ...extraLaunch,
  });
  const hardKill = () => { try { const p = browser.process(); if (p) p.kill('SIGKILL'); } catch (e) {} };
  const onSig = () => { hardKill(); process.exit(1); };
  process.once('exit', hardKill);
  process.once('SIGINT', onSig);
  process.once('SIGTERM', onSig);
  try {
    return await fn(browser);
  } finally {
    try { await browser.close(); } catch (e) {}
    hardKill();                        // belt: if close() hung/failed, SIGKILL the process tree
  }
}

const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

// Preset page: desktop 1400x900 or mobile iPhone 844x390. Optional basic-auth (staging) + UA override.
async function newPage(browser, { mobile = false, ua, auth } = {}) {
  const page = await browser.newPage();
  if (auth) await page.authenticate(auth);
  if (mobile) { await page.setUserAgent(ua || UA_MOBILE); await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true }); }
  else { await page.setUserAgent(ua || UA_DESKTOP); await page.setViewport({ width: 1400, height: 900 }); }
  return page;
}

// Surgical cleanup: kill ONLY chrome whose user-data-dir carries our TAG (or a puppeteer temp profile). Never the
// user's default-profile Chrome. Windows-only (PowerShell CIM); no-op elsewhere.
function killOurChrome() {
  try {
    const ps = "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'user-data-dir=[^ ]*(" + TAG + "|puppeteer_dev_chrome)' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }; (Get-CimInstance Win32_Process -Filter \"Name='node.exe'\" | Measure-Object).Count";
    execSync('powershell -NoProfile -Command "' + ps.replace(/"/g, '\\"') + '"', { stdio: 'inherit' });
  } catch (e) { console.error('killOurChrome:', e && e.message); }
}

if (require.main === module && process.argv.includes('--kill')) { killOurChrome(); }

module.exports = { withBrowser, newPage, killOurChrome, TAG, CHROME, UA_DESKTOP, UA_MOBILE };
