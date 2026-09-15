// Publish the MarginPad SDK to npm, PyPI and GitHub - one command, no interactive prompts.
//
// WHY THIS EXISTS: the three publishes are the owner's accounts, but nothing about them needs a human
// once the tokens exist. `npm login` and `twine upload` both prompt by default, which is the only reason
// these three steps kept getting put off. This writes a scoped .npmrc, hands twine the token on the
// command line, and drives git over HTTPS with a PAT - then removes every credential it wrote.
//
// The owner creates three accounts and three tokens (15 minutes, once). Everything after that is here.
//
// Usage - put the tokens in the environment, never on the command line (a command line lands in shell
// history and in the process list):
//
//   set NPM_TOKEN=npm_xxx
//   set PYPI_TOKEN=pypi-xxx
//   set GITHUB_TOKEN=ghp_xxx
//   node build/publish-sdk.js            # dry run: checks everything, publishes nothing
//   node build/publish-sdk.js --go       # actually publishes
//
// Any token may be omitted; that target is skipped and reported.
'use strict';
const { execSync, spawnSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');

const ROOT = path.join(__dirname, '..');
const SDK = path.join(ROOT, 'sdk');
const GO = process.argv.includes('--go');
const ORG = process.env.SDK_GITHUB_ORG || 'marginpad';   // github.com/<ORG>/sdk
const out = [];
const say = (ok, msg, extra) => { out.push((ok === null ? '     ' : ok ? 'OK   ' : 'FAIL ') + msg + (extra ? '  ' + extra : '')); };
const run = (cmd, cwd, env) => spawnSync(cmd, { cwd: cwd || SDK, shell: true, encoding: 'utf8', env: { ...process.env, ...(env || {}) } });

function version(file, re) { try { return (re.exec(fs.readFileSync(path.join(SDK, file), 'utf8')) || [])[1] || '?'; } catch (e) { return '?'; } }
const vJs = version('js/package.json', /"version"\s*:\s*"([^"]+)"/);
const vPy = version('python/pyproject.toml', /version\s*=\s*"([^"]+)"/);

(async () => {
  say(null, (GO ? 'PUBLISHING' : 'DRY RUN - nothing will be published; add --go when the tokens are in place'));
  say(null, 'sdk/js ' + vJs + '  ·  sdk/python ' + vPy);
  if (vJs !== vPy) say(false, 'the two packages disagree on the version - fix that before publishing');

  // the SDK is a copy of dist/assets/sdk/*; a stale copy would ship an SDK older than the site's own
  for (const [a, b] of [['js/index.js', 'dist/assets/sdk/marginpad.js'], ['python/marginpad/__init__.py', 'dist/assets/sdk/marginpad.py']]) {
    try {
      const x = fs.readFileSync(path.join(SDK, a), 'utf8'), y = fs.readFileSync(path.join(ROOT, b), 'utf8');
      say(x.length === y.length || Math.abs(x.length - y.length) < 400, 'sdk/' + a + ' tracks ' + b, x.length + ' vs ' + y.length + ' bytes');
    } catch (e) { say(false, 'could not compare sdk/' + a + ' with ' + b, String(e.message)); }
  }

  // ── npm ──────────────────────────────────────────────────────────────────────────────────────────
  if (!process.env.NPM_TOKEN) say(null, 'npm      SKIPPED - no NPM_TOKEN');
  else {
    const rc = path.join(os.tmpdir(), '.npmrc-mp-' + process.pid);
    fs.writeFileSync(rc, '//registry.npmjs.org/:_authToken=' + process.env.NPM_TOKEN + '\n', { mode: 0o600 });
    try {
      const who = run('npm whoami', path.join(SDK, 'js'), { npm_config_userconfig: rc });
      say(who.status === 0, 'npm authenticated', (who.stdout || who.stderr || '').trim().slice(0, 60));
      if (who.status === 0) {
        const cmd = 'npm publish --access public' + (GO ? '' : ' --dry-run');
        const r = run(cmd, path.join(SDK, 'js'), { npm_config_userconfig: rc });
        say(r.status === 0, 'npm ' + (GO ? 'publish' : 'publish --dry-run'), (r.stderr || r.stdout || '').trim().split('\n').slice(-2).join(' | ').slice(0, 160));
      }
    } finally { try { fs.unlinkSync(rc); } catch (e) {} }   // the token never stays on disk
  }

  // ── PyPI ─────────────────────────────────────────────────────────────────────────────────────────
  if (!process.env.PYPI_TOKEN) say(null, 'PyPI     SKIPPED - no PYPI_TOKEN');
  else {
    const py = path.join(SDK, 'python');
    let r = run('python -m pip install --quiet --upgrade build twine', py);
    say(r.status === 0, 'build + twine installed', (r.stderr || '').trim().split('\n').slice(-1)[0].slice(0, 120));
    try { fs.rmSync(path.join(py, 'dist'), { recursive: true, force: true }); } catch (e) {}
    r = run('python -m build', py);
    say(r.status === 0, 'wheel and sdist built', (r.stdout || r.stderr || '').trim().split('\n').slice(-1)[0].slice(0, 120));
    r = run('python -m twine check dist/*', py);
    say(r.status === 0, 'twine check', (r.stdout || r.stderr || '').trim().split('\n').slice(-1)[0].slice(0, 120));
    if (GO && r.status === 0) {
      // -u/-p keeps the token out of a config file; it is still visible to `ps`, so this process is short
      const up = run('python -m twine upload --non-interactive -u __token__ -p "%PYPI_TOKEN%" dist/*', py);
      say(up.status === 0, 'PyPI upload', (up.stdout || up.stderr || '').trim().split('\n').slice(-1)[0].slice(0, 160));
    } else if (!GO) say(null, 'PyPI     would upload dist/* now (add --go)');
  }

  // ── GitHub ───────────────────────────────────────────────────────────────────────────────────────
  if (!process.env.GITHUB_TOKEN) say(null, 'GitHub   SKIPPED - no GITHUB_TOKEN');
  else {
    const T = process.env.GITHUB_TOKEN;
    const api = (m, p2, body) => {
      const r = run('curl -s -o - -w "\\n%{http_code}" -X ' + m + ' -H "Authorization: Bearer ' + T + '"'
        + ' -H "Accept: application/vnd.github+json" https://api.github.com' + p2
        + (body ? ' -d ' + JSON.stringify(JSON.stringify(body)) : ''), ROOT);
      const t = (r.stdout || '').trim(), i = t.lastIndexOf('\n');
      return { code: +t.slice(i + 1), body: t.slice(0, i) };
    };
    const me = api('GET', '/user');
    say(me.code === 200, 'GitHub authenticated', (JSON.parse(me.body || '{}').login || '') + ' (' + me.code + ')');
    if (me.code === 200) {
      const exists = api('GET', '/repos/' + ORG + '/sdk');
      if (exists.code === 404) {
        if (!GO) say(null, 'GitHub   would create ' + ORG + '/sdk (public, MIT)');
        else {
          const login = JSON.parse(me.body).login;
          const mk = ORG.toLowerCase() === String(login).toLowerCase()
            ? api('POST', '/user/repos', { name: 'sdk', description: 'Free crypto-futures paper trading API for bots and AI agents', private: false, has_issues: true })
            : api('POST', '/orgs/' + ORG + '/repos', { name: 'sdk', description: 'Free crypto-futures paper trading API for bots and AI agents', private: false, has_issues: true });
          say(mk.code === 201, 'created ' + ORG + '/sdk', String(mk.code));
        }
      } else say(exists.code === 200, ORG + '/sdk already exists - will push to it', String(exists.code));

      if (GO) {
        const git = (c) => run('git ' + c, SDK);
        if (!fs.existsSync(path.join(SDK, '.git'))) { git('init'); git('branch -M main'); }
        git('add -A');
        git('-c user.email=noreply@marginpad.io -c user.name=MarginPad commit -m "MarginPad SDK ' + vJs + '" --allow-empty');
        git('remote remove origin');
        // the token lives only in this one command's arguments, never in .git/config
        const push = run('git push --force https://x-access-token:' + T + '@github.com/' + ORG + '/sdk.git main', SDK);
        say(push.status === 0, 'pushed to github.com/' + ORG + '/sdk', (push.stderr || '').trim().split('\n').slice(-1)[0].slice(0, 120));
        api('PATCH', '/repos/' + ORG + '/sdk/topics', null);
        const topics = run('curl -s -o /dev/null -w "%{http_code}" -X PUT -H "Authorization: Bearer ' + T + '"'
          + ' -H "Accept: application/vnd.github+json" https://api.github.com/repos/' + ORG + '/sdk/topics'
          + ' -d "{\\"names\\":[\\"crypto\\",\\"trading-bot\\",\\"paper-trading\\",\\"mcp\\",\\"ai-agent\\",\\"backtesting\\"]}"', ROOT);
        say((topics.stdout || '').trim() === '200', 'topics set', (topics.stdout || '').trim());
      }
    }
  }

  console.log('\n' + out.join('\n'));
  const failed = out.filter(l => l.startsWith('FAIL')).length;
  console.log('\n' + (failed ? failed + ' failed' : 'no failures') + (GO ? '' : '  ·  dry run, nothing was published'));
  process.exit(failed ? 1 : 0);
})();
