/* Inline SVG diagrams for academy lessons (dark theme, brand colors). Keyed by the lesson's bare id.
   Each value = an <svg> (+ optional caption div). Rendered raw in the lesson modal. No external deps. */
const C = { up: '#2ebd85', red: '#ff6258', cyan: '#3fd8e6', lime: '#c2f64a', ink: '#e9e7df', dim: '#9aa3ad', faint: '#5c656f', line: '#232932', grid: '#1a1f26' };
const cap = t => `<div class="cap">${t}</div>`;
const F = 'font-family="Space Mono,monospace"';

const FIGS = {
  // ── Candlestick anatomy ──
  'read-candlestick': `<svg viewBox="0 0 320 170" role="img" aria-label="Candlestick anatomy">
  <line x1="78" y1="16" x2="78" y2="152" stroke="${C.up}" stroke-width="1.6"/>
  <rect x="64" y="52" width="28" height="64" rx="2" fill="${C.up}"/>
  <line x1="92" y1="20" x2="150" y2="20" stroke="${C.line}" stroke-width="1"/><text x="154" y="23" fill="${C.dim}" font-size="9" ${F}>High (upper wick)</text>
  <line x1="92" y1="52" x2="150" y2="52" stroke="${C.line}" stroke-width="1"/><text x="154" y="55" fill="${C.dim}" font-size="9" ${F}>Close</text>
  <line x1="92" y1="116" x2="150" y2="116" stroke="${C.line}" stroke-width="1"/><text x="154" y="119" fill="${C.dim}" font-size="9" ${F}>Open</text>
  <line x1="92" y1="150" x2="150" y2="150" stroke="${C.line}" stroke-width="1"/><text x="154" y="153" fill="${C.dim}" font-size="9" ${F}>Low (lower wick)</text>
  <text x="50" y="86" fill="${C.up}" font-size="9" ${F} text-anchor="end">body</text>
  <line x1="262" y1="20" x2="262" y2="150" stroke="${C.red}" stroke-width="1.6"/>
  <rect x="248" y="40" width="28" height="56" rx="2" fill="${C.red}"/>
  <text x="262" y="166" fill="${C.red}" font-size="9" ${F} text-anchor="middle">Bearish</text>
  <text x="78" y="166" fill="${C.up}" font-size="9" ${F} text-anchor="middle">Bullish</text>
</svg>${cap('Green = close above open (up). Red = close below open (down). Thin wicks mark the high &amp; low.')}`,

  // ── Trend + support/resistance ──
  'trend-support-resistance': `<svg viewBox="0 0 320 160" role="img" aria-label="Uptrend with support and resistance">
  <line x1="14" y1="44" x2="306" y2="30" stroke="${C.red}" stroke-width="1" stroke-dasharray="4 3"/><text x="306" y="24" fill="${C.red}" font-size="9" ${F} text-anchor="end">Resistance</text>
  <line x1="14" y1="138" x2="306" y2="108" stroke="${C.up}" stroke-width="1" stroke-dasharray="4 3"/><text x="14" y="152" fill="${C.up}" font-size="9" ${F}>Support (rising)</text>
  <polyline points="20,128 60,70 95,96 140,46 180,74 225,36 265,60 300,34" fill="none" stroke="${C.cyan}" stroke-width="2"/>
  <circle cx="60" cy="70" r="3" fill="${C.cyan}"/><circle cx="140" cy="46" r="3" fill="${C.cyan}"/><circle cx="225" cy="36" r="3" fill="${C.cyan}"/>
  <text x="160" y="14" fill="${C.dim}" font-size="9" ${F} text-anchor="middle">Uptrend = higher highs + higher lows</text>
</svg>${cap('Price stair-steps up between a rising support floor and resistance ceiling.')}`,

  // ── Moving averages: golden cross ──
  'moving-averages': `<svg viewBox="0 0 320 150" role="img" aria-label="Golden cross of two moving averages">
  <polyline points="14,120 70,110 120,96 175,70 230,52 300,30" fill="none" stroke="${C.lime}" stroke-width="2"/><text x="300" y="24" fill="${C.lime}" font-size="9" ${F} text-anchor="end">Fast MA (50)</text>
  <polyline points="14,96 80,94 150,90 210,80 270,66 300,58" fill="none" stroke="${C.dim}" stroke-width="2"/><text x="14" y="110" fill="${C.dim}" font-size="9" ${F}>Slow MA (200)</text>
  <circle cx="158" cy="84" r="5" fill="none" stroke="${C.up}" stroke-width="2"/><text x="158" y="134" fill="${C.up}" font-size="9" ${F} text-anchor="middle">Golden cross ↑</text>
</svg>${cap('When the fast MA crosses above the slow MA, momentum is turning up (a death cross is the reverse).')}`,

  // ── RSI gauge ──
  'rsi': `<svg viewBox="0 0 320 96" role="img" aria-label="RSI 0 to 100 scale">
  <rect x="20" y="40" width="280" height="16" rx="8" fill="${C.grid}"/>
  <rect x="20" y="40" width="84" height="16" rx="8" fill="${C.up}" opacity=".45"/>
  <rect x="216" y="40" width="84" height="16" rx="8" fill="${C.red}" opacity=".45"/>
  <text x="20" y="34" fill="${C.faint}" font-size="9" ${F}>0</text>
  <text x="104" y="34" fill="${C.up}" font-size="9" ${F} text-anchor="middle">30 oversold</text>
  <text x="216" y="34" fill="${C.red}" font-size="9" ${F} text-anchor="middle">70 overbought</text>
  <text x="300" y="34" fill="${C.faint}" font-size="9" ${F} text-anchor="end">100</text>
  <polygon points="182,30 176,40 188,40" fill="${C.cyan}"/><line x1="182" y1="40" x2="182" y2="56" stroke="${C.cyan}" stroke-width="2"/>
  <text x="182" y="78" fill="${C.cyan}" font-size="9" ${F} text-anchor="middle">RSI ≈ 58 (neutral)</text>
</svg>${cap('A momentum gauge 0–100. Above 70 = overbought, below 30 = oversold — alerts, not buy/sell signals.')}`,

  // ── MACD ──
  'macd': `<svg viewBox="0 0 320 150" role="img" aria-label="MACD lines and histogram">
  <line x1="14" y1="80" x2="306" y2="80" stroke="${C.line}" stroke-width="1"/><text x="306" y="76" fill="${C.faint}" font-size="8" ${F} text-anchor="end">zero</text>
  ${[['40','-14'],['72','-22'],['104','-12'],['136','8'],['168','20'],['200','16'],['232','10'],['264','6']].map(([x,hRaw])=>{const hh=+hRaw;const y=hh<0?80:80-hh;const col=hh>=0?C.up:C.red;return `<rect x="${+x-7}" y="${y}" width="14" height="${Math.abs(hh)}" fill="${col}" opacity=".55"/>`;}).join('')}
  <polyline points="14,108 70,96 120,82 168,60 230,56 300,52" fill="none" stroke="${C.cyan}" stroke-width="2"/><text x="14" y="122" fill="${C.cyan}" font-size="9" ${F}>MACD line</text>
  <polyline points="14,96 80,92 140,84 200,70 260,62 300,58" fill="none" stroke="${C.lime}" stroke-width="1.6" stroke-dasharray="4 3"/><text x="306" y="46" fill="${C.lime}" font-size="9" ${F} text-anchor="end">Signal</text>
  <circle cx="150" cy="80" r="4" fill="none" stroke="${C.up}" stroke-width="2"/>
</svg>${cap('MACD line vs signal line; the histogram is the gap. A cross up = bullish momentum (it lags price).')}`,

  // ── Bollinger Bands ──
  'bollinger-bands': `<svg viewBox="0 0 320 150" role="img" aria-label="Bollinger Bands squeeze and expansion">
  <path d="M14,40 C90,46 120,66 150,68 C200,70 240,40 306,30" fill="none" stroke="rgba(127,174,255,.7)" stroke-width="1.4"/>
  <path d="M14,108 C90,102 120,80 150,80 C200,80 240,108 306,118" fill="none" stroke="rgba(127,174,255,.7)" stroke-width="1.4"/>
  <path d="M14,74 C90,74 120,73 150,74 C200,75 240,74 306,74" fill="none" stroke="rgba(127,174,255,.5)" stroke-width="1.2" stroke-dasharray="4 3"/>
  <polyline points="14,72 50,66 90,78 130,70 150,74 180,60 220,52 260,40 300,34" fill="none" stroke="${C.cyan}" stroke-width="2"/>
  <text x="150" y="98" fill="${C.dim}" font-size="9" ${F} text-anchor="middle">squeeze</text>
  <line x1="138" y1="68" x2="138" y2="86" stroke="${C.faint}" stroke-width="1"/><line x1="162" y1="68" x2="162" y2="86" stroke="${C.faint}" stroke-width="1"/>
  <text x="306" y="22" fill="rgba(127,174,255,.9)" font-size="9" ${F} text-anchor="end">±2σ bands</text>
</svg>${cap('Bands sit 2 standard deviations from a middle SMA. They narrow (squeeze) before big moves, widen in volatility.')}`,

  // ── Long vs Short payoff ──
  'long-vs-short': `<svg viewBox="0 0 320 160" role="img" aria-label="Long vs short profit and loss">
  <line x1="30" y1="80" x2="306" y2="80" stroke="${C.line}" stroke-width="1"/><text x="306" y="76" fill="${C.faint}" font-size="8" ${F} text-anchor="end">price →</text>
  <line x1="60" y1="14" x2="60" y2="150" stroke="${C.line}" stroke-width="1"/>
  <line x1="60" y1="150" x2="300" y2="20" stroke="${C.up}" stroke-width="2"/><text x="296" y="34" fill="${C.up}" font-size="9" ${F} text-anchor="end">LONG profits ↑</text>
  <line x1="60" y1="20" x2="300" y2="150" stroke="${C.red}" stroke-width="2"/><text x="296" y="146" fill="${C.red}" font-size="9" ${F} text-anchor="end">SHORT profits ↓</text>
  <circle cx="60" cy="80" r="3.5" fill="${C.ink}"/><text x="60" y="100" fill="${C.dim}" font-size="9" ${F} text-anchor="middle">entry</text>
  <text x="40" y="30" fill="${C.faint}" font-size="8" ${F}>+P&amp;L</text><text x="40" y="146" fill="${C.faint}" font-size="8" ${F}>−P&amp;L</text>
</svg>${cap('Long gains as price rises; short gains as it falls. Both lose if price goes the other way.')}`,

  // ── Leverage → liquidation distance ──
  'leverage-explained': `<svg viewBox="0 0 320 160" role="img" aria-label="Leverage shrinks the liquidation distance">
  ${[['2× ','120','-50%'],['10×','100','-10%'],['50×','20','-2%']].map((r,i)=>{const y=30+i*42;const w=+r[1];return `<text x="8" y="${y+12}" fill="${C.ink}" font-size="10" ${F}>${r[0]}</text>
  <rect x="56" y="${y}" width="240" height="16" rx="3" fill="${C.grid}"/>
  <rect x="56" y="${y}" width="${w*2.4}" height="16" rx="3" fill="${C.up}" opacity=".4"/>
  <line x1="${56+w*2.4}" y1="${y-3}" x2="${56+w*2.4}" y2="${y+19}" stroke="${C.red}" stroke-width="2"/>
  <text x="${56+w*2.4+6}" y="${y+12}" fill="${C.red}" font-size="9" ${F}>liq ${r[2]}</text>`;}).join('')}
  <text x="160" y="156" fill="${C.dim}" font-size="9" ${F} text-anchor="middle">green = room to move before liquidation</text>
</svg>${cap('Higher leverage moves your liquidation price much closer to entry — a tiny move can wipe you out.')}`,

  // ── P&L / ROE: notional vs margin ──
  'pnl-roe-notional': `<svg viewBox="0 0 320 150" role="img" aria-label="Notional vs margin at 5x">
  <rect x="20" y="40" width="280" height="26" rx="4" fill="${C.cyan}" opacity=".25" stroke="${C.cyan}"/><text x="160" y="57" fill="${C.cyan}" font-size="10" ${F} text-anchor="middle">Notional = $1,000 (position size)</text>
  <rect x="20" y="84" width="56" height="26" rx="4" fill="${C.lime}" opacity=".3" stroke="${C.lime}"/><text x="48" y="101" fill="${C.lime}" font-size="9" ${F} text-anchor="middle">$200</text>
  <text x="86" y="101" fill="${C.dim}" font-size="9" ${F}>your margin (5× leverage)</text>
  <text x="160" y="134" fill="${C.dim}" font-size="9" ${F} text-anchor="middle">a 5% price move = $50 = +25% ROE on your margin</text>
</svg>${cap('Notional = margin × leverage. P&amp;L is in dollars; ROE measures it against your smaller margin.')}`,

  // ── Drawdown recovery asymmetry ──
  'why-risk-beats-being-right': `<svg viewBox="0 0 320 150" role="img" aria-label="Drawdown recovery is asymmetric">
  ${[['−10%','11%','40'],['−50%','100%','148'],['−80%','400%','236']].map((r,i)=>{const y=24+i*38;return `<text x="8" y="${y+12}" fill="${C.red}" font-size="10" ${F}>${r[0]}</text>
  <rect x="64" y="${y}" width="${r[2]}" height="16" rx="3" fill="${C.lime}" opacity=".5"/>
  <text x="${64+ +r[2]+6}" y="${y+12}" fill="${C.lime}" font-size="9" ${F}>needs +${r[1]} to recover</text>`;}).join('')}
  <text x="160" y="146" fill="${C.dim}" font-size="9" ${F} text-anchor="middle">losses hurt more than equal-sized gains help</text>
</svg>${cap('Down 50% needs +100% to get back to even; down 80% needs +400%. Protect capital first.')}`,

  // ── Position sizing ──
  'position-sizing-math': `<svg viewBox="0 0 320 130" role="img" aria-label="Position size from risk and stop distance">
  <text x="160" y="30" fill="${C.ink}" font-size="12" ${F} text-anchor="middle">Position size = Risk $ ÷ Stop distance</text>
  <text x="160" y="58" fill="${C.dim}" font-size="10" ${F} text-anchor="middle">$50 risk ÷ $5 stop = 10 units</text>
  <line x1="40" y1="92" x2="280" y2="92" stroke="${C.line}" stroke-width="1"/>
  <line x1="120" y1="84" x2="120" y2="100" stroke="${C.cyan}" stroke-width="2"/><text x="120" y="116" fill="${C.cyan}" font-size="9" ${F} text-anchor="middle">entry</text>
  <line x1="200" y1="84" x2="200" y2="100" stroke="${C.red}" stroke-width="2"/><text x="200" y="116" fill="${C.red}" font-size="9" ${F} text-anchor="middle">stop</text>
  <line x1="120" y1="80" x2="200" y2="80" stroke="${C.faint}" stroke-width="1" stroke-dasharray="3 2"/><text x="160" y="76" fill="${C.faint}" font-size="8" ${F} text-anchor="middle">stop distance</text>
</svg>${cap('Fix your dollar risk first; a wider stop means a smaller position. Leverage is just the leftover.')}`
};

// also reuse leverage figure for the liquidation lesson
FIGS['liquidation'] = FIGS['leverage-explained'];
FIGS['leverage-discipline'] = FIGS['leverage-explained'];

module.exports = { FIGS };
