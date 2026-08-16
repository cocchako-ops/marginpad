=== MarginPad Crypto Widgets ===
Contributors: marginpad
Tags: crypto, bitcoin, trading, liquidation calculator, fear and greed
Requires at least: 5.0
Tested up to: 6.6
Requires PHP: 7.0
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Free crypto widgets for WordPress: liquidation calculator, Fear & Greed index, live liquidation feed and a crypto economic calendar. Shortcodes, no API key.

== Description ==

Four live crypto widgets you can drop into any post, page or sidebar with a shortcode. No account, no API key, no cost, and nothing is written to your database.

* **Liquidation calculator** — live price for any coin, long and short, isolated-margin liquidation price.
* **Crypto Fear & Greed index** — current sentiment score with yesterday and last-week readings.
* **Live liquidations** — real-time liquidation feed aggregated from ten exchanges, refreshed every ten seconds.
* **Crypto economic calendar** — FOMC, CPI and NFP dates plus crypto-native events.

Each widget is a sandboxed iframe served from marginpad.io. The plugin adds no scripts to your front end, sets no cookies, and collects no visitor data.

= Shortcodes =

`[marginpad_liquidation_calculator coin="BTC"]`
`[marginpad_fear_greed]`
`[marginpad_liquidations]`
`[marginpad_calendar]`

Every shortcode accepts `width` (`360` or `100%`), `height` in pixels and `credit="no"` to hide the credit link. The calculator also accepts `coin`.

== Installation ==

1. Upload the plugin zip through Plugins, Add New, Upload Plugin, or extract it into `wp-content/plugins/`.
2. Activate it.
3. Paste a shortcode into any post, page or text widget. Settings, MarginPad Widgets has the full reference.

== Frequently Asked Questions ==

= Do I need an API key or an account? =

No. The widgets are public and free.

= Does the plugin collect any data? =

No. It renders iframes hosted by marginpad.io and stores nothing in your database.

= Can I change the coin? =

Yes: `[marginpad_liquidation_calculator coin="ETH"]`. Any listed ticker works.

= Can I remove the credit link? =

Yes, with `credit="no"`. Keeping it is appreciated and helps keep the widgets free.

== Changelog ==

= 1.0.0 =
* First release: liquidation calculator, Fear & Greed, live liquidations and economic calendar shortcodes plus an admin reference page.
