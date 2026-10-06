// Streams the Hyperliquid leaderboard (~39 MB, ~47k rows) WITHOUT ever holding the whole body or the
// parsed tree. On 2026-10-05 23:42 UTC `r.json()` on that file killed the collector with
// "JavaScript heap out of memory": the box has 458 MB, V8 gave the process a 259 MB heap, the rings,
// books and film already sat at ~190 MB, and the hourly refresh then needed the 39 MB string plus a
// ~51 MB object tree on top. The mark-compact it forced ran 6.6 s, which is also where the "event loop
// stalled" lines and the slow site came from. Here each row is cut out of the byte stream as it
// arrives, parsed on its own (~450 bytes), reduced by `onRow` and dropped, so the transient cost is
// one chunk, not the file.
//
// Shape it relies on: `{"leaderboardRows":[{...},{...}]}` - rows are the objects directly inside the
// array under that key. Nested arrays/objects inside a row (windowPerformances) are handled by depth.

async function scanLeaderboard(res, onRow) {
  const reader = res.body.getReader();
  const dec = new TextDecoder('utf-8');
  let buf = '';          // unconsumed tail of the stream
  let depth = 0;         // brace + bracket depth
  let inStr = false, esc = false;
  let strStart = -1;     // index in buf where the current string began (for keys at depth 1)
  let lastKey = '';      // last string closed at depth 1 - the key the next value belongs to
  let rowsDepth = -1;    // depth at which row objects open (array depth + 1), once the key is seen
  let rowStart = -1;     // index in buf where the current row object began
  let rows = 0, bytes = 0;
  let pos = 0;           // where the scan resumes in buf - the part before it has been read already
  for (;;) {
    const { value, done } = await reader.read();
    if (done) break;
    bytes += value.length;
    buf += dec.decode(value, { stream: true });
    let i = pos;
    for (; i < buf.length; i++) {
      const c = buf[i];
      if (inStr) {
        if (esc) { esc = false; continue; }
        if (c === '\\') { esc = true; continue; }
        if (c === '"') {
          inStr = false;
          if (depth === 1 && rowsDepth < 0) lastKey = buf.slice(strStart + 1, i);
        }
        continue;
      }
      if (c === '"') { inStr = true; strStart = i; continue; }
      if (c === '{' || c === '[') {
        depth++;
        if (c === '[' && depth === 2 && rowsDepth < 0 && lastKey === 'leaderboardRows') rowsDepth = 3;
        else if (c === '{' && depth === rowsDepth && rowStart < 0) rowStart = i;
        continue;
      }
      if (c === '}' || c === ']') {
        if (depth === rowsDepth && rowStart >= 0 && c === '}') {
          let row = null;
          try { row = JSON.parse(buf.slice(rowStart, i + 1)); } catch (e) { row = null; }
          if (row) { rows++; onRow(row); }
          rowStart = -1;
        }
        depth--;
        continue;
      }
    }
    // Keep only what a row still in progress needs: everything before it is consumed. While not inside
    // a row the buffer can be dropped to the last few bytes (a string open across a chunk boundary at
    // depth 1 is the only state that spans chunks, and that is the key, which is tiny).
    if (rowStart >= 0) { pos = buf.length - rowStart; buf = buf.slice(rowStart); rowStart = 0; }
    else if (inStr) { pos = buf.length - strStart; buf = buf.slice(strStart); strStart = 0; }
    else { buf = ''; pos = 0; }
  }
  return { rows, bytes };
}

export { scanLeaderboard };
