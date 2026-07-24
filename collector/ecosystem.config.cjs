// pm2 process config: keeps the collector running 24/7 with auto-restart.
// Deploy/update flow = `git pull && npm i && pm2 restart marginpad-collector` (reconnect logic fills the gap).
module.exports = {
  apps: [{
    name: 'marginpad-collector',
    script: 'src/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 50,
    restart_delay: 3000,
    max_memory_restart: '300M',
    kill_timeout: 4000,           // give graceful SIGTERM shutdown time to flush aggregates
    env: { NODE_ENV: 'production', PORT: 8787, DB_DRIVER: 'sqlite' },
    out_file: 'logs/out.log',
    error_file: 'logs/err.log',
    time: true,
  }],
};
