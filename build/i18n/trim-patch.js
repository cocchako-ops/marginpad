/* One-shot (2026-11-06): pattern rows are anchored ^...$, so they must be applied to the TRIMMED text and the result put back
   inside the node's own whitespace; and placeholder/title/aria-label get the patterns too, not only the exact table.
   The freeze rule still holds: a node is written only when the result differs, and a result is never itself a key. Idempotent. */
'use strict';
const fs = require('fs'), path = require('path'), RT = path.join(__dirname, 'dom-runtime.js.txt');
let rt = fs.readFileSync(RT, 'utf8');
if (rt.indexOf('var w=pat(k);if(w!==k)') >= 0) { console.log('already patched'); process.exit(0); }
const a = 'if(k.length<=300&&own(k)){n.nodeValue=v.split(k).join(D[k]);return;}var w=pat(v);if(w!==v)n.nodeValue=w;}';
if (rt.split(a).length !== 2) throw new Error('txt anchor');
rt = rt.split(a).join('if(k.length<=300&&own(k)){n.nodeValue=v.split(k).join(D[k]);return;}var w=pat(k);if(w!==k)n.nodeValue=v.split(k).join(w);}');
const b = 'function att(e){for(var i=0;i<A.length;i++){var v=e.getAttribute(A[i]);if(v&&own(v.trim()))e.setAttribute(A[i],D[v.trim()]);}}';
if (rt.split(b).length !== 2) throw new Error('att anchor');
rt = rt.split(b).join('function att(e){for(var i=0;i<A.length;i++){var v=e.getAttribute(A[i]);if(!v)continue;var k=v.trim();if(own(k)){e.setAttribute(A[i],D[k]);continue;}var w=pat(k);if(w!==k)e.setAttribute(A[i],w);}}');
fs.writeFileSync(RT, rt); console.log('patched');
