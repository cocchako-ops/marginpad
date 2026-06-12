// Load collector/.env into process.env BEFORE anything reads config (ES imports run top-to-bottom, so this
// module is imported first in index.js). Uses the built-in process.loadEnvFile (Node >=20.12) — no dependency.
// Loads by absolute path so it works regardless of pm2's cwd. A missing .env (envs set via pm2 instead) is a
// no-op, not a crash. This is how secrets like BINANCE_PROXY stay OUT of git (.env is gitignored).
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

try {
  process.loadEnvFile(join(dirname(fileURLToPath(import.meta.url)), '..', '.env'));
} catch { /* no .env file — fine, rely on real env / pm2 */ }
