# MarginPad — Launch & Outreach Pack (ready-to-post)

Sve je napisano. Ti samo nalepiš i objaviš. Linkovi ka sajtu daju backlink + saobraćaj.
> Savet: ne objavljuj sve u isti dan. Razmakni: Dan 1 Show HN, Dan 2 Dev.to, Dan 3 Indie Hackers, Product Hunt kad si spreman.

---

## 1) Hacker News — "Show HN"
**Naslov:**
Show HN: MarginPad – free crypto futures calculators (no signup)

**Tekst (prvi komentar):**
I kept reaching for the same calculations on every leveraged trade — liquidation price, position size, PnL — and the existing tools were either buried inside exchanges or covered in ads. So I built MarginPad: 6 calculators (liquidation, position size by risk, PnL/ROI, DCA average, take-profit ladder, risk/reward) that run entirely in the browser. No signup, nothing sent to a server, 12 languages. Feedback welcome — especially on the formulas and anything you'd want added.
Link: https://marginpad.io

---

## 2) Product Hunt
**Name:** MarginPad
**Tagline (≤60):** Free crypto futures calculators — no signup
**Description:**
MarginPad gives crypto futures traders the 6 numbers they need on every trade: liquidation price, risk-based position size, PnL/ROI, DCA average entry, take-profit targets, and risk/reward. Everything runs locally in your browser — instant, private, no account. Works with Bybit, Binance, OKX, KuCoin, Gate and Kraken, in 12 languages.

**First comment (maker):**
Hi PH! I built MarginPad because planning a leveraged trade meant juggling spreadsheets or digging through exchange menus. This puts liquidation, position size, PnL, DCA, take-profit and risk/reward one click away — free, no signup, all in-browser. Would love your feedback on what calculator to add next.

**Topics/tags:** Crypto, Fintech, Bitcoin, Trading, Developer Tools

---

## 3) Indie Hackers (post)
**Title:** I built 6 free crypto calculators that run entirely in the browser
**Body:**
After getting tired of clunky, ad-heavy trading calculators, I shipped MarginPad — a free toolkit for crypto futures traders: liquidation price, position size by risk, PnL/ROI, DCA average, take-profit ladder and risk/reward. No backend, no signup; everything runs client-side so nothing you type leaves your device. Built it as a static site on Cloudflare (so it's basically free to run), added 12 languages, and dedicated per-exchange calculator pages for SEO. Happy to share what worked / what didn't. Link: https://marginpad.io

---

## 4) Dev.to article (FULL — daje dofollow backlink, samo nalepi)
**Title:** I built 6 free crypto trading calculators with zero backend

**Tags:** webdev, javascript, showdev, crypto

**Body (markdown):**

> I trade crypto futures occasionally, and every single trade needed the same maths: *where do I get liquidated, how big should this position be, what's my PnL?* The existing tools were either locked inside exchanges or buried in ads. So I built [MarginPad](https://marginpad.io) — six calculators that run **entirely in the browser**.

### What it does
- **Liquidation price** — for any leverage, long or short
- **Position size** — by risk, using the 1% rule
- **PnL / ROI / ROE** — leverage-aware
- **DCA average entry**, **Take-profit ladder**, **Risk/Reward ratio**

### The interesting constraint: no backend
Everything is a static site. No server ever sees what you type — the calculators are plain JavaScript. That means:
- **Privacy by default** (your numbers never leave the tab)
- **Basically free to host** (static files on Cloudflare)
- **Instant** (no round-trips)

### A couple of formulas
Liquidation price for isolated margin:

```js
// long
liq = entry * (1 - 1/leverage + maintenanceMarginRate);
// short
liq = entry * (1 + 1/leverage - maintenanceMarginRate);
```

Position size by risk (the habit that keeps you alive):

```js
const riskAmount = balance * riskPercent;     // e.g. 1% of account
const size = riskAmount / Math.abs(entry - stop);
```

### Lessons
- A live candlestick `<canvas>` background looks great but I had to **respect `prefers-reduced-motion`** carefully (and later make the decorative one opt-in).
- `i18n` for 12 languages via a tiny `data-i18n` attribute + dictionary kept it dependency-free.
- Per-exchange landing pages (generated from one template) are great for long-tail SEO.

It's free, no signup: **https://marginpad.io**. Feedback and formula nitpicks welcome!

---

## 5) GitHub — awesome-lists Pull Request
Pronađi repo (npr. `awesome-crypto`, `awesome-cryptocurrency`), nađi sekciju Tools/Calculators, dodaj red i otvori PR.

**Red za dodavanje:**
```
- [MarginPad](https://marginpad.io) - Free crypto futures calculators (liquidation, position size, PnL, DCA, take-profit, risk/reward). No signup, runs in-browser.
```
**PR naslov:** Add MarginPad (free crypto futures calculators)
**PR opis:** Adds MarginPad, a free, no-signup suite of crypto futures calculators that runs entirely client-side. Fits under Tools / Calculators.

---

## 6) Reddit — "value-first" (NIJE spam!)
Pravilo: ne lepi link nasumično. Odgovori na konkretno pitanje i pomeni alat usput.
Pogodni subovi: r/CryptoCurrency, r/BitcoinMarkets, r/Daytrading, r/Futures_Trading.

**Primer odgovora (kad neko pita o likvidaciji):**
For a quick sanity check, isolated-margin liquidation is roughly `entry × (1 − 1/leverage + mmr)` for a long. At 10x that's about a 9–10% move against you. I use a free calc for this (marginpad.io) but the formula above is the gist — keep your stop well inside it.

---

Izvori istraživanja za direktorijume su u `directory-submission-pack.md`.
