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
    // 300M was right for the 458 MB droplet; the box has 1,967 MB since 2026-10 and the whale tracker
    // (1,000 wallets since 2026-10-11) sits at ~300 MB steady state, so the old ceiling killed it every
    // five minutes - 119 times before it was noticed. Twice the measured steady state, half of free RAM.
    max_memory_restart: '700M',
    kill_timeout: 4000,           // give graceful SIGTERM shutdown time to flush aggregates
    env: { NODE_ENV: 'production', PORT: 8787, DB_DRIVER: 'sqlite' },
    out_file: 'logs/out.log',
    error_file: 'logs/err.log',
    time: true,
  }, {
    name: 'marginpad-hlstate',
    script: 'src/hl/index.js',
    instances: 1,
    exec_mode: 'fork',
    autorestart: true,
    max_restarts: 50,
    restart_delay: 5000,
    max_memory_restart: '350M',
    kill_timeout: 4000,
    env: { NODE_ENV: 'production', HL_PORT: 8788, HL_WEIGHT_MIN: 200 },
    out_file: 'logs/hl-out.log',
    error_file: 'logs/hl-err.log',
    time: true,
  }],
};
