// Standalone migration runner: `npm run migrate`. Safe to run repeatedly (applied migrations are skipped).
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createStorage } from './storage/index.js';

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), '..', 'migrations');
const storage = createStorage();
storage.migrate(migrationsDir);
console.log('migrations up to date');
storage.close();
