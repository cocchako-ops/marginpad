// Reader worker thread. Owns its own read-only SQLite connection and runs the read queries that the API
// serves, so a slow whole-day aggregate can no longer pause the main thread — the thread that reads the
// exchange websockets. The main thread talks to it through storage.async (see ./index.js).
import { parentPort, workerData } from 'node:worker_threads';
import { createSqliteStorage } from './sqlite.js';

const storage = createSqliteStorage(workerData.path, { readOnly: true });

parentPort.on('message', (m) => {
  const t0 = Date.now();
  try {
    const fn = storage[m.fn];
    if (typeof fn !== 'function') throw new Error('unknown read: ' + m.fn);
    const v = fn(...(m.args || []));
    parentPort.postMessage({ id: m.id, ok: true, v, ms: Date.now() - t0 });
  } catch (e) {
    parentPort.postMessage({ id: m.id, ok: false, err: String(e && e.message || e), ms: Date.now() - t0 });
  }
});
