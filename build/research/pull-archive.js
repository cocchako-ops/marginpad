// Pulls archived market-data days from R2 (marginpad-market/v1/<ds>/<day>.csv.gz) into build/research/arch/<ds>/ - skips days already here.
// node build/research/pull-archive.js <ds> <fromDay> [toDay]
const { execFile } = require('child_process'), fs = require('fs'), path = require('path');
const [ds, from, to] = process.argv.slice(2);
const end = to || new Date(Date.now() - 86400000).toISOString().slice(0, 10);
const days = []; for (let d = new Date(from + 'T00:00:00Z'); d.toISOString().slice(0, 10) <= end; d = new Date(d.getTime() + 86400000)) days.push(d.toISOString().slice(0, 10));
const dir = path.join(__dirname, 'arch', ds); fs.mkdirSync(dir, { recursive: true });
let i = 0, ok = 0, miss = 0;
const one = () => { const day = days[i++]; if (!day) return Promise.resolve(); const f = path.join(dir, day + '.csv.gz'); if (fs.existsSync(f) && fs.statSync(f).size > 0) { ok++; return one(); }
  return new Promise(res => execFile('npx.cmd', ['wrangler', 'r2', 'object', 'get', 'marginpad-market/v1/' + ds + '/' + day + '.csv.gz', '--remote', '--file', f], { shell: true, timeout: 120000 }, (e) => { if (e || !fs.existsSync(f)) { miss++; try { fs.unlinkSync(f); } catch (x) {} } else ok++; res(); })).then(one); };
Promise.all([one(), one(), one(), one()]).then(() => console.log(ds, 'days', days.length, 'have', ok, 'missing', miss));
