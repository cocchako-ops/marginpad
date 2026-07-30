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
//   - an INTERNAL timeout (default 4 min) that fires BEFORE an external Bash-tool timeout can SIGKILL node — because a
//     hard external kill can't run our handlers, and would orphan the chrome tree. Self-terminating first avoids that.
// Teardown is SURGICAL: `taskkill /F /T /PID <puppeteer-chrome-pid>` kills only OUR chrome tree by pid (never //IM,
// never the user's default-profile browser). Every browser also gets a tagged userDataDir (mp-e2e-profile-*) so a
// manual sweep (`node build/e2e-browser.js --kill`) can also target only ours.

const puppeteer = require('puppeteer-core');
const os = require('os'), path = require('path'), { execSync } = require('child_process');

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
async function withBrowser(fn, { args = [], extraLaunch = {}, timeoutMs = 240000 } = {}) {
  const userDataDir = path.join(os.tmpdir(), TAG + '-' + process.pid + '-' + Date.now());
  const browser = await puppeteer.launch({
    executablePath: CHROME,
    headless: 'new',
    userDataDir,
    args: ['--no-sandbox', '--ignore-certificate-errors', ...args],
    ...extraLaunch,
  });
  const pid = browser.process() && browser.process().pid;
  let done = false;
  const teardown = () => { if (done) return; done = true; killTree(pid); };
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
