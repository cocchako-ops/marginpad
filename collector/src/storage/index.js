// Storage factory. Driver chosen by config (DB_DRIVER). Every driver returns the SAME interface:
//   migrate(dir), insert(ev)->bool, aggregateNew()->n, histogram(symbol,minutes)->[],
//   live(symbol,limit,minNotional)->[], prune(days)->n, stats()->{}, close()
import { config } from '../../config.js';
import { createSqliteStorage } from './sqlite.js';

export function createStorage() {
  if (config.db.driver === 'sqlite') return createSqliteStorage(config.db.sqlitePath);
  // For production you'll add ./pg.js (node-postgres) exposing the same interface, then set
  // DB_DRIVER=postgres + DATABASE_URL. See README "Switching to Postgres".
  throw new Error(`Unsupported DB_DRIVER '${config.db.driver}'. Use 'sqlite' (default) or implement the pg driver.`);
}
