// Shared puppeteer harness for E2E / measurement scripts.
//
// WHY THIS EXISTS (2026-07-31): ad-hoc test scripts each wrote their own launch/close. When a script threw, hit a
// timeout, or was interrupted by a signal, the success-path close() never ran → headless Chrome leaked (~30 procs
// piled up per run) → resource exhaustion → FALSE failures (pages=0, hangs). Worse, the ad-hoc cleanup was
// `taskkill //IM chrome.exe`, which kills the USER'S real browser too ("Chrome closes itself").
//
// This harness guarantees the browser is torn down on EVERY exit path:
//   - finally (success OR throw)
//   - SIGINT / SIGTERM (manual Ctrl-C, or a wrapper sending a signal)
//   - process 'exit' (any other reason)
//   - an INTERNAL timeout (default 4 min) that fires BEFORE an external Bash-tool timeout can SIGKILL node - because a
//     hard external kill can't run our handlers, and would orphan the chrome tree. Self-terminating first avoids that.
// Teardown is SURGICAL: `taskkill /F /T /PID <puppeteer-chrome-pid>` kills only OUR chrome tree by pid (never //IM,
// never the user's default-profile browser). Every browser also gets a tagged userDataDir (mp-e2e-profile-*) so a
// manual sweep (`node build/e2e-browser.js --kill`) can also target only ours.

const puppeteer = require('puppeteer-core');
const os = require('os'), path = require('path'), fs = require('fs'), { execSync } = require('child_process');

const CHROME = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const TAG = 'mp-e2e-profile';
const isWin = process.platform === 'win32';

// Kill a specific process TREE by pid. /T = children (renderers) too, /F = force. pid-scoped → never the user's Chrome.
function killTree(pid) {
  if (!pid) return;
  try {
    if (isWin) execSync('taskkill /F /T /PID ' + pid, { stdio: 'ignore' });
    else process.kill(-pid, 'SIGKILL');
  } catch (e) {}
}

// Run fn(browser) with a GUARANTEED teardown. opts.timeoutMs (default 240000) self-terminates before an external kill.
let swept = false;
function sweepOldProfiles() { // older than 6h: certainly not a live run, including a crashed one
  if (swept) return; swept = true;
  try {
    const tmp = os.tmpdir(), cut = Date.now() - 6 * 3600 * 1000;
    for (const name of fs.readdirSync(tmp)) {
      if (name.indexOf(TAG) !== 0) continue;
      const full = path.join(tmp, name);
      try { if (fs.statSync(full).mtimeMs < cut) fs.rmSync(full, { recursive: true, force: true }); } catch (e) {}
    }
  } catch (e) {}
}

// NETWORKIDLE ON THIS SITE NEVER FIRES (2026-10-27 font-preload round, fixed here 2026-11-14): puppeteer keeps the four
// gstatic preload fonts and the preloaded mp-nav.js as in-flight requests for ever, so `networkidle2` timed out on every
// page that carries them - 79 suites. Instead of rewriting each, a goto/reload/waitForNavigation asking for networkidle
// waits for `load` and then for OUR idle: no more than 2 (idle2) or 0 (idle0) requests in flight that are younger than
// STUCK_MS, for IDLE_MS. A request older than STUCK_MS is the stuck kind and is ignored, exactly what puppeteer could not.
const STUCK_MS = 5000, IDLE_MS = 500;
function patchIdle(page) {
  const P = Object.getPrototypeOf(page);
  if (!P || P.__mpIdle) return;
  P.__mpIdle = true;
  const fly = (pg) => {
    if (pg.__mpFly) return pg.__mpFly;
    const m = new Map();
    pg.on('request', (r) => m.set(r, Date.now()));
    pg.on('requestfinished', (r) => m.delete(r));
    pg.on('requestfailed', (r) => m.delete(r));
    pg.__mpFly = m;
    return m;
  };
  const idleOf = (o) => {
    const w = o && o.waitUntil;
    const list = Array.isArray(w) ? w : [w];
    if (list.indexOf('networkidle2') >= 0) return 2;
    if (list.indexOf('networkidle0') >= 0) return 0;
    return -1;
  };
  const settle = async (pg, max, allow) => {
    const m = fly(pg), t0 = Date.now();
    let quietSince = 0;
    while (Date.now() - t0 < max) {
      const now = Date.now();
      let fresh = 0;
      for (const ts of m.values()) if (now - ts < STUCK_MS) fresh++;
      if (fresh <= allow) { if (!quietSince) quietSince = now; if (now - quietSince >= IDLE_MS) return; }
      else quietSince = 0;
      await new Promise((r) => setTimeout(r, 100));
    }
  };
  const wrap = (name) => {
    const orig = P[name];
    if (typeof orig !== 'function') return;
    P[name] = async function (...a) {
      const oi = name === 'goto' ? 1 : 0;
      const o = a[oi];
      const allow = idleOf(o);
      if (allow < 0) return orig.apply(this, a);
      fly(this);
      const no = Object.assign({}, o, { waitUntil: 'load' });
      a[oi] = no;
      const res = await orig.apply(this, a);
      await settle(this, Math.min(+(o.timeout) || 30000, 30000), allow);
      return res;
    };
  };
  wrap('goto'); wrap('reload'); wrap('waitForNavigation');
}

async function withBrowser(fn, { args = [], extraLaunch = {}, timeoutMs = 240000 } = {}) {
  sweepOldProfiles();
  const userDataDir = path.join(os.tmpdir(), TAG + '-' + process.pid + '-' + Date.now());
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    userDataDir,
    args: ['--no-sandbox', '--ignore-certificate-errors', ...args],
    ...extraLaunch,
  });
  try { const pg0 = (await browser.pages())[0] || await browser.newPage(); patchIdle(pg0); } catch (e) {}
  const pid = browser.process() && browser.process().pid;
  let done = false;
  const rmProfile = () => { try { fs.rmSync(userDataDir, { recursive: true, force: true, maxRetries: 3, retryDelay: 120 }); } catch (e) {} };
  const teardown = () => { if (done) return; done = true; killTree(pid); rmProfile(); };
  const onExit = () => teardown();
  const onSig = (sig) => { teardown(); process.exit(sig === 'SIGINT' ? 130 : 143); };
  process.once('exit', onExit);
  process.once('SIGINT', () => onSig('SIGINT'));
  process.once('SIGTERM', () => onSig('SIGTERM'));
  // internal watchdog: fire BEFORE any external timeout so we self-terminate cleanly instead of being SIGKILLed
  const wd = setTimeout(() => { console.error('e2e-browser: timeout ' + timeoutMs + 'ms → tearing down'); teardown(); process.exit(3); }, timeoutMs);
  if (wd.unref) wd.unref();
  try {
    return await fn(browser);
  } finally {
    clearTimeout(wd);
    try { await browser.close(); } catch (e) {}   // graceful
    teardown();                                    // belt: SIGKILL the tree if close() hung/partial
    process.removeListener('exit', onExit);
  }
}

const UA_DESKTOP = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';
const UA_MOBILE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1';

async function newPage(browser, { mobile = false, ua, auth } = {}) {
  const page = await browser.newPage();
  if (auth) await page.authenticate(auth);
  if (mobile) { await page.setUserAgent(ua || UA_MOBILE); await page.setViewport({ width: 844, height: 390, isMobile: true, hasTouch: true }); }
  else { await page.setUserAgent(ua || UA_DESKTOP); await page.setViewport({ width: 1400, height: 900 }); }
  return page;
}

// Manual sweep: kill ONLY chrome whose user-data-dir carries our TAG (or a puppeteer temp profile). Never the user's.
function killOurChrome() {
  if (!isWin) return;
  try {
    const ps = "Get-CimInstance Win32_Process -Filter \"Name='chrome.exe'\" | Where-Object { $_.CommandLine -match 'user-data-dir=[^ ]*(" + TAG + "|puppeteer_dev_chrome)' } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }";
    execSync('powershell -NoProfile -Command "' + ps.replace(/"/g, '\\"') + '"', { stdio: 'ignore' });
  } catch (e) {}
}

if (require.main === module && process.argv.includes('--kill')) { killOurChrome(); }

module.exports = { withBrowser, newPage, killOurChrome, killTree, TAG, CHROME, UA_DESKTOP, UA_MOBILE };
