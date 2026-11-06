/* Academy diagram labels that carry a figure ("you lose -12%") are written in the page source as a template
   ('you lose -'+l+'%') and drawn with the figure filled in, so an exact dictionary lookup on the drawn text never
   matched and those labels stayed English in every language. tv() now falls back to the template keys: a key with
   '+expr+' segments becomes a regex whose groups are put back into the translation in the same order.
   Idempotent; run before es/gen-pages (the twins copy this page). node build/fix-academy-viz-patterns.js [--dry] */
'use strict';
const fs = require('fs'), path = require('path');
const F = path.join(__dirname, '..', 'dist', 'academy', 'index.html');
const OLD = "function tv(x){return (T&&T[x])||x;}";
const NEW = "function tv(x){if(!T)return x;if(T[x])return T[x];var P=window.__vizP;if(!P){P=window.__vizP=[];var SEG=/'\\+[\\s\\S]+?\\+'/g;Object.keys(T).forEach(function(k){if(k.indexOf(\"'+\")<0)return;var parts=k.split(SEG);if(parts.length<2)return;var tp=String(T[k]).split(SEG);if(tp.length!==parts.length||!/[A-Za-z]{2}/.test(parts.join('')))return;P.push({re:new RegExp('^'+parts.map(function(p){return p.replace(/[.*+?^${}()|[\\]\\\\]/g,'\\\\$&');}).join('(.+?)')+'$'),tp:tp,w:parts.join('').length});});P.sort(function(x,y){return y.w-x.w;});}for(var i=0;i<P.length;i++){var m=P[i].re.exec(x);if(m){var o=P[i].tp[0];for(var j=1;j<P[i].tp.length;j++)o+=m[j]+P[i].tp[j];return o;}}return x;}";
let h = fs.readFileSync(F, 'utf8');
if (h.indexOf('window.__vizP') >= 0) { console.log('already applied'); process.exit(0); }
const n = h.split(OLD).length - 1; if (n !== 1) { console.log('anchor found', n, 'times - refusing'); process.exit(1); }
h = h.split(OLD).join(NEW);
if (process.argv.includes('--dry')) { console.log('would apply'); process.exit(0); }
const tmp = F + '.tmp'; fs.writeFileSync(tmp, h); fs.renameSync(tmp, F); console.log('applied');
