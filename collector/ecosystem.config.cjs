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
    /* V8 IS TOLD WHERE THE CEILING IS (2026-11-12). Measured 11-10 -> 11-11: RSS 377 -> 659 MB in 29 h at ~5.5 MB/h with heapUsed
       sawtoothing to 371 MB and heapTotal to 490 - no unbounded structure anywhere in the code (every ring, memo, dedupe set
       and whale memory was walked and is capped), but ~100-200 MB/min of RESPONSE GARBAGE (the 30-day catalyst dump, tape,
       bookmap, live) against a default old-space limit of ~1 GB per isolate: V8 grows the heap toward live x 4 instead of
       collecting, and pm2 kills on RSS long before V8 feels any pressure. 360 MB for the main isolate (the measured warm steady
       state is 150-200 MB) makes it collect early; the reader thread gets its own 160 MB in storage/index.js. The pm2 ceiling
       is untouched - it is the guard against a real leak - and if a genuine retainer exists this turns the daily RSS kill
       into an OOM at the limit, which is the one signal that names it. */
    node_args: '--max-old-space-size=360',
    kill_timeout: 4000,           // give graceful SIGTERM shutdown time to flush aggregates
    // MALLOC_ARENA_MAX (2026-11-12): RSS kept climbing ~110 MB/h with the V8 heap FLAT at ~150 MB - memory outside the isolates, which on
    // glibc is the per-thread malloc arenas (the reader worker, libuv's pool, the sockets) each keeping freed pages. Two arenas is the
    // standard Node setting for a long-running box; it costs nothing measurable in throughput here.
    env: { NODE_ENV: 'production', PORT: 8787, DB_DRIVER: 'sqlite', MALLOC_ARENA_MAX: '2' },
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
    env: { NODE_ENV: 'production', HL_PORT: 8788, HL_WEIGHT_MIN: 450 },
    out_file: 'logs/hl-out.log',
    error_file: 'logs/hl-err.log',
    time: true,
  }],
};
