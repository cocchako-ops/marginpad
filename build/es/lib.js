/* Spanish site layer — HTML segmenter shared by extract.js / check.js / gen-pages.js (2026-09-12).
   No parser dependency: a tolerant tokenizer for our own generated markup.
   A SEGMENT is the smallest run of text + inline elements inside a block container, kept as raw HTML
   ("Practice on <b>live</b> prices" is ONE segment) so a translator sees whole sentences.
   Also extracted: <title>, meta description / og / twitter, alt / title / placeholder / aria-label attributes,
   and JSON-LD text fields. <script>, <style>, <svg>, <pre>, <textarea> bodies are never touched.            */
'use strict';
const crypto = require('crypto');

const VOID = new Set(['br', 'img', 'input', 'meta', 'link', 'hr', 'source', 'wbr', 'area', 'col', 'base', 'embed', 'track', 'param']);
const RAW = new Set(['script', 'style', 'svg', 'pre', 'textarea', 'noscript', 'iframe', 'template']);
const BLOCK = new Set(['p', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'td', 'th', 'dt', 'dd', 'label', 'button', 'figcaption', 'summary',
  'option', 'title', 'blockquote', 'caption', 'legend', 'div', 'section', 'article', 'nav', 'header', 'footer', 'main', 'aside', 'ul', 'ol',
  'table', 'tr', 'thead', 'tbody', 'tfoot', 'form', 'details', 'fieldset', 'figure', 'body', 'html', 'head', 'address', 'hgroup', 'menu',
  'dialog', 'select', 'optgroup', 'datalist', 'output', 'picture', 'video', 'audio', 'canvas', 'map', 'object']);
const ATTRS = ['title', 'alt', 'placeholder', 'aria-label', 'data-tip', 'data-hint', 'data-label', 'data-empty', 'data-title'];
const META_NAMES = new Set(['description', 'twitter:title', 'twitter:description', 'twitter:image:alt', 'application-name', 'apple-mobile-web-app-title']);
const META_PROPS = new Set(['og:title', 'og:description', 'og:image:alt']);
const LD_KEYS = new Set(['name', 'headline', 'description', 'text', 'alternateName', 'caption', 'alternativeHeadline', 'abstract', 'slogan', 'answerText']);

function tokenize(src) {
  const out = []; let i = 0; const n = src.length;
  let textStart = 0;
  const flushText = (end) => { if (end > textStart) out.push({ t: 'text', s: textStart, e: end }); };
  while (i < n) {
    const lt = src.indexOf('<', i);
    if (lt === -1) break;
    // comment / doctype / cdata
    if (src.startsWith('<!--', lt)) { const ce = src.indexOf('-->', lt + 4); const e = ce === -1 ? n : ce + 3; flushText(lt); out.push({ t: 'comment', s: lt, e }); i = textStart = e; continue; }
    if (src[lt + 1] === '!' || src[lt + 1] === '?') { const ce = src.indexOf('>', lt); const e = ce === -1 ? n : ce + 1; flushText(lt); out.push({ t: 'decl', s: lt, e }); i = textStart = e; continue; }
    const m = /^<(\/?)([a-zA-Z][a-zA-Z0-9:-]*)/.exec(src.slice(lt, lt + 40));
    if (!m) { i = lt + 1; continue; }
    // scan attributes honouring quotes
    let j = lt + m[0].length; let q = null;
    while (j < n) { const c = src[j]; if (q) { if (c === q) q = null; } else if (c === '"' || c === "'") q = c; else if (c === '>') break; j++; }
    const e = Math.min(j + 1, n);
    const name = m[2].toLowerCase(); const close = m[1] === '/';
    const attrsRaw = src.slice(lt + m[0].length, j);
    const selfClosing = /\/\s*$/.test(attrsRaw);
    flushText(lt);
    if (!close && RAW.has(name) && !selfClosing) {
      // raw body until matching close (svg may nest — count depth for svg only)
      let depth = 1, k = e, re = new RegExp('<(/?)' + name + '\\b', 'ig'); re.lastIndex = e; let mm, endTag = -1;
      while ((mm = re.exec(src))) { if (mm[1]) { depth--; if (depth === 0) { endTag = mm.index; break; } } else if (name === 'svg') depth++; }
      const closeEnd = endTag === -1 ? n : src.indexOf('>', endTag) + 1;
      out.push({ t: 'raw', name, s: lt, e: closeEnd, openEnd: e, bodyEnd: endTag === -1 ? n : endTag, attrsRaw, attrsS: lt + m[0].length });
      i = textStart = closeEnd; continue;
    }
    out.push({ t: close ? 'close' : 'open', name, s: lt, e, attrsRaw, attrsS: lt + m[0].length, void: VOID.has(name) || selfClosing });
    i = textStart = e;
  }
  flushText(n);
  return out;
}

function parseAttrs(raw) {
  const res = []; const re = /([^\s=\/"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g; let m;
  while ((m = re.exec(raw))) { const v = m[2] != null ? m[2] : m[3] != null ? m[3] : m[4]; res.push({ name: m[1].toLowerCase(), val: v == null ? null : v, s: m.index, e: m.index + m[0].length, raw: m[0], quote: m[2] != null ? '"' : m[3] != null ? "'" : '' }); }
  return res;
}

// Build a light tree from tokens.
function build(tokens) {
  const root = { kind: 'el', name: '#root', children: [], parent: null };
  let cur = root;
  for (const tk of tokens) {
    if (tk.t === 'open') {
      const el = { kind: 'el', name: tk.name, tok: tk, children: [], parent: cur, attrs: null };
      cur.children.push(el);
      if (!tk.void) cur = el;
    } else if (tk.t === 'close') {
      let p = cur; while (p && p.name !== tk.name) p = p.parent;
      if (p && p.parent) { p.closeTok = tk; cur = p.parent; }
    } else if (tk.t === 'raw') {
      cur.children.push({ kind: 'raw', name: tk.name, tok: tk, parent: cur });
    } else if (tk.t === 'text') {
      cur.children.push({ kind: 'text', tok: tk, parent: cur });
    } else cur.children.push({ kind: tk.t, tok: tk, parent: cur });
  }
  return root;
}

function isContainer(el) {
  if (el._c != null) return el._c;
  let c = BLOCK.has(el.name);
  if (!c) for (const ch of el.children) if (ch.kind === 'el' && isContainer(ch)) { c = true; break; }
  el._c = c; return c;
}
function noTranslate(el) {
  for (let p = el; p && p.name !== '#root'; p = p.parent) {
    const a = p.tok && p.tok.attrsRaw || '';
    if (/translate\s*=\s*["']?no/i.test(a) || /notranslate/.test(a)) return true;
  }
  return false;
}

const HAS_WORD = /[A-Za-zÀ-ÿ]{2,}/;
function worthy(html) {
  const txt = html.replace(/<[^>]+>/g, ' ').replace(/&[#a-z0-9]+;/gi, ' ').trim();
  if (!txt || !HAS_WORD.test(txt)) return false;
  if (/^(https?:\/\/|\/)[^\s]*$/.test(txt)) return false;
  if (/^[A-Z0-9.\-\/]{2,12}$/.test(txt) && !/[a-z]/.test(txt)) return false; // ticker-like: BTC, BTC/USDT, OKX
  return true;
}
function norm(s) { return s.replace(/\s+/g, ' ').trim(); }
function idOf(s) { return crypto.createHash('sha1').update(norm(s)).digest('base64url').slice(0, 10); }

/* Returns { segs:[{s,e,html,id,kind}], attrs:[{s,e,val,id,tag,attr}], ld:[{s,e,json,items:[{path,val,id}]}], title } */
function extract(src) {
  const tokens = tokenize(src); const root = build(tokens);
  const segs = [], attrs = [], ld = [];
  const seenRange = [];
  function walk(el) {
    if (noTranslate(el)) return;
    // attributes on this element
    if (el.tok && el.tok.attrsRaw) {
      const list = parseAttrs(el.tok.attrsRaw);
      const get = (k) => { const a = list.find(x => x.name === k); return a ? (a.val || '') : null; };
      if (el.name === 'meta') {
        const nm = (get('name') || '').toLowerCase(), pr = (get('property') || '').toLowerCase();
        if (META_NAMES.has(nm) || META_PROPS.has(pr)) { const a = list.find(x => x.name === 'content'); if (a && a.val && worthy(a.val)) attrs.push({ s: el.tok.attrsS + a.s, e: el.tok.attrsS + a.e, val: a.val, id: idOf(a.val), tag: 'meta', attr: nm || pr, a }); }
      } else {
        for (const a of list) if (ATTRS.includes(a.name) && a.val && worthy(a.val)) attrs.push({ s: el.tok.attrsS + a.s, e: el.tok.attrsS + a.e, val: a.val, id: idOf(a.val), tag: el.name, attr: a.name, a });
      }
    }
    // children: group runs of text/inline between container children
    let run = [];
    const flush = () => {
      if (!run.length) { run = []; return; }
      const s = run[0].tok.s, e = run[run.length - 1].kind === 'el' ? endOf(run[run.length - 1]) : run[run.length - 1].tok.e;
      const html = src.slice(s, e);
      // trim leading/trailing whitespace from the range
      const lead = html.match(/^\s*/)[0].length, trail = html.match(/\s*$/)[0].length;
      const s2 = s + lead, e2 = e - trail;
      if (e2 > s2) { const h = src.slice(s2, e2); if (worthy(h) && !/^<[^>]*>$/.test(h)) segs.push({ s: s2, e: e2, html: h, id: idOf(h), kind: el.name === 'title' ? 'title' : 'html' }); }
      run = [];
    };
    for (const ch of el.children) {
      if (ch.kind === 'text') run.push(ch);
      else if (ch.kind === 'el') {
        if (isContainer(ch)) { flush(); walk(ch); }
        else { // inline: attributes inside inline elements (e.g. <a title>, <img alt>) are extracted too
          run.push(ch); collectInlineAttrs(ch);
        }
      } else if (ch.kind === 'raw') {
        flush();
        if (ch.name === 'script' && /application\/ld\+json/i.test(ch.tok.attrsRaw)) {
          const body = src.slice(ch.tok.openEnd, ch.tok.bodyEnd);
          try { const j = JSON.parse(body); const items = []; walkLd(j, '', items); if (items.length) ld.push({ s: ch.tok.openEnd, e: ch.tok.bodyEnd, json: j, items }); } catch (e) { /* not JSON */ }
        }
        if (ch.name === 'noscript') { /* skipped: images only */ }
      } else if (ch.kind === 'comment' || ch.kind === 'decl') { /* keep the run going across comments? no: flush */ flush(); }
    }
    flush();
  }
  function collectInlineAttrs(el) {
    if (el.tok && el.tok.attrsRaw) {
      const list = parseAttrs(el.tok.attrsRaw);
      for (const a of list) if (ATTRS.includes(a.name) && a.val && worthy(a.val)) attrs.push({ s: el.tok.attrsS + a.s, e: el.tok.attrsS + a.e, val: a.val, id: idOf(a.val), tag: el.name, attr: a.name, a });
    }
    for (const ch of el.children || []) if (ch.kind === 'el') collectInlineAttrs(ch);
  }
  function endOf(el) { if (el.closeTok) return el.closeTok.e; let last = el; while (last.children && last.children.length) last = last.children[last.children.length - 1]; return last.closeTok ? last.closeTok.e : last.tok.e; }
  function walkLd(v, path, items) {
    if (Array.isArray(v)) v.forEach((x, i) => walkLd(x, path + '[' + i + ']', items));
    else if (v && typeof v === 'object') for (const k of Object.keys(v)) {
      const val = v[k];
      if (typeof val === 'string') { if (LD_KEYS.has(k) && worthy(val) && !/^https?:/.test(val)) items.push({ path: path + '.' + k, val, id: idOf(val) }); }
      else walkLd(val, path + '.' + k, items);
    }
  }
  walk(root);
  return { segs, attrs, ld };
}

/* Apply a translation map {id → es} to the page. tx(id, en) returns the Spanish string or null (keep English). */
function apply(src, tx, opts) {
  opts = opts || {};
  const ex = extract(src);
  const edits = []; let missing = 0, hit = 0;
  for (const sg of ex.segs) { const t = tx(sg.id, sg.html); if (t != null && t !== '') { hit++; if (t !== sg.html) edits.push({ s: sg.s, e: sg.e, v: t }); } else missing++; }
  for (const at of ex.attrs) { const t = tx(at.id, at.val); if (t != null && t !== '') { hit++; if (t !== at.val) { const q = at.a.quote || '"'; const v = q === '"' ? t.replace(/"/g, '&quot;') : t.replace(/'/g, '&#39;'); edits.push({ s: at.s, e: at.e, v: at.a.name + '=' + q + v + q }); } } else missing++; }
  for (const L of ex.ld) {
    let changed = false; const j = L.json;
    for (const it of L.items) { const t = tx(it.id, it.val); if (t != null && t !== '') { hit++; if (t !== it.val) { setPath(j, it.path, t); changed = true; } } else missing++; }
    if (changed) edits.push({ s: L.s, e: L.e, v: JSON.stringify(j) });
  }
  edits.sort((a, b) => a.s - b.s);
  let out = '', pos = 0;
  for (const ed of edits) { if (ed.s < pos) continue; out += src.slice(pos, ed.s) + ed.v; pos = ed.e; }
  out += src.slice(pos);
  return { html: out, hit, missing };
}
function setPath(obj, path, val) {
  const parts = path.replace(/\[(\d+)\]/g, '.$1').split('.').filter(Boolean);
  let o = obj; for (let i = 0; i < parts.length - 1; i++) o = o[parts[i]];
  o[parts[parts.length - 1]] = val;
}

/* Tag skeleton for parity checks: multiset of tag names + hrefs. */
function tagSig(html) {
  const tags = []; const re = /<\/?([a-zA-Z][a-zA-Z0-9]*)\b([^>]*)>/g; let m;
  while ((m = re.exec(html))) { const nm = m[1].toLowerCase(); const href = /href\s*=\s*["']([^"']*)/.exec(m[2]); tags.push(nm + (href ? '@' + href[1] : '')); }
  return tags.sort().join('|');
}
function wordsOf(html) { return html.replace(/<[^>]+>/g, ' ').replace(/&[#a-z0-9]+;/gi, ' ').split(/\s+/).filter(w => w.length > 1).length; }

module.exports = { tokenize, extract, apply, idOf, norm, tagSig, wordsOf, worthy };
