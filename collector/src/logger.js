// Minimal structured logger. Boring on purpose.
const stamp = () => new Date().toISOString();
const line = (lvl, msg, ctx) => `${stamp()} ${lvl.padEnd(5)} ${msg}${ctx ? ' ' + safe(ctx) : ''}`;
function safe(o) { try { return JSON.stringify(o); } catch { return '[unserializable]'; } }

export const log = {
  info: (m, c) => console.log(line('INFO', m, c)),
  warn: (m, c) => console.warn(line('WARN', m, c)),
  error: (m, c) => console.error(line('ERROR', m, c)),
};
