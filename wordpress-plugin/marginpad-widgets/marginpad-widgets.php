<?php
/**
 * Plugin Name:       MarginPad Crypto Widgets
 * Plugin URI:        https://marginpad.io/wordpress-crypto-widgets/
 * Description:       Free crypto widgets for WordPress: liquidation calculator, Fear &amp; Greed index, live liquidation feed and an economic calendar. Shortcodes and blocks, no API key, no account.
 * Version:           1.0.0
 * Requires at least: 5.0
 * Requires PHP:      7.0
 * Author:            MarginPad
 * Author URI:        https://marginpad.io/
 * License:           GPLv2 or later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       marginpad-widgets
 *
 * The widgets are rendered as sandboxed iframes served from marginpad.io. No data is collected by
 * the plugin, nothing is written to your database, and no API key is required.
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'MARGINPAD_WIDGETS_VERSION', '1.0.0' );
define( 'MARGINPAD_WIDGETS_BASE', 'https://marginpad.io' );

/**
 * Widget catalogue. Each entry: iframe path, default height, minimum height, accessible title.
 */
function marginpad_widgets_catalogue() {
	return array(
		'liquidation_calculator' => array(
			'path'   => '/widget/liquidation-calculator/',
			'height' => 440,
			'min'    => 380,
			'title'  => 'Liquidation Calculator by MarginPad',
			'credit' => array( '/calculators?c=liq', 'Liquidation calculator by MarginPad' ),
		),
		'fear_greed'             => array(
			'path'   => '/widget/fear-greed/',
			'height' => 260,
			'min'    => 200,
			'title'  => 'Crypto Fear &amp; Greed Index by MarginPad',
			'credit' => array( '/fear-greed/', 'Crypto Fear &amp; Greed Index by MarginPad' ),
		),
		'liquidations'           => array(
			'path'   => '/widget/liquidations/',
			'height' => 320,
			'min'    => 240,
			'title'  => 'Live Crypto Liquidations by MarginPad',
			'credit' => array( '/rekt/', 'Live crypto liquidation feed by MarginPad' ),
		),
		'calendar'               => array(
			'path'   => '/embed/calendar/',
			'height' => 420,
			'min'    => 300,
			'title'  => 'Crypto Economic Calendar by MarginPad',
			'credit' => array( '/calendar/', 'Crypto economic calendar by MarginPad' ),
		),
	);
}

/**
 * Build the iframe markup for one widget.
 *
 * @param string $key   Catalogue key.
 * @param array  $atts  Shortcode attributes (coin, width, height, credit).
 * @return string
 */
function marginpad_widgets_render( $key, $atts ) {
	$all = marginpad_widgets_catalogue();
	if ( ! isset( $all[ $key ] ) ) {
		return '';
	}
	$w = $all[ $key ];

	$atts = shortcode_atts(
		array(
			'coin'   => '',
			'width'  => '100%',
			'height' => $w['height'],
			'credit' => 'yes',
		),
		$atts,
		'marginpad_' . $key
	);

	$src = MARGINPAD_WIDGETS_BASE . $w['path'];
	$coin = preg_replace( '/[^A-Za-z0-9]/', '', (string) $atts['coin'] );
	if ( '' !== $coin ) {
		$src .= ( false === strpos( $src, '?' ) ? '?' : '&' ) . 'coin=' . strtoupper( $coin );
	}

	$height = (int) $atts['height'];
	if ( $height < $w['min'] ) {
		$height = $w['min'];
	}
	if ( $height > 1200 ) {
		$height = 1200;
	}

	// Width accepts "100%", "360" or "360px".
	$width = trim( (string) $atts['width'] );
	if ( preg_match( '/^\d+$/', $width ) ) {
		$width .= 'px';
	}
	if ( ! preg_match( '/^\d+(px|%)$/', $width ) ) {
		$width = '100%';
	}

	$html = sprintf(
		'<iframe src="%1$s" title="%2$s" loading="lazy" scrolling="no" style="display:block;width:%3$s;max-width:100%%;height:%4$dpx;border:0;border-radius:14px;color-scheme:dark"></iframe>',
		esc_url( $src ),
		esc_attr( html_entity_decode( $w['title'], ENT_QUOTES, 'UTF-8' ) ),
		esc_attr( $width ),
		$height
	);

	if ( 'no' !== strtolower( (string) $atts['credit'] ) ) {
		$html .= sprintf(
			'<a href="%1$s" target="_blank" rel="noopener" style="display:inline-block;margin-top:6px;font-size:12px;opacity:.8">%2$s</a>',
			esc_url( MARGINPAD_WIDGETS_BASE . $w['credit'][0] ),
			esc_html( html_entity_decode( $w['credit'][1], ENT_QUOTES, 'UTF-8' ) )
		);
	}

	return '<div class="marginpad-widget marginpad-widget-' . esc_attr( str_replace( '_', '-', $key ) ) . '">' . $html . '</div>';
}

/** Shortcode: [marginpad_liquidation_calculator coin="BTC"] */
function marginpad_widgets_sc_liq( $atts ) {
	return marginpad_widgets_render( 'liquidation_calculator', (array) $atts );
}
add_shortcode( 'marginpad_liquidation_calculator', 'marginpad_widgets_sc_liq' );

/** Shortcode: [marginpad_fear_greed] */
function marginpad_widgets_sc_fg( $atts ) {
	return marginpad_widgets_render( 'fear_greed', (array) $atts );
}
add_shortcode( 'marginpad_fear_greed', 'marginpad_widgets_sc_fg' );

/** Shortcode: [marginpad_liquidations] */
function marginpad_widgets_sc_liqs( $atts ) {
	return marginpad_widgets_render( 'liquidations', (array) $atts );
}
add_shortcode( 'marginpad_liquidations', 'marginpad_widgets_sc_liqs' );

/** Shortcode: [marginpad_calendar] */
function marginpad_widgets_sc_cal( $atts ) {
	return marginpad_widgets_render( 'calendar', (array) $atts );
}
add_shortcode( 'marginpad_calendar', 'marginpad_widgets_sc_cal' );

/**
 * Classic "Text" widget area support: allow the shortcodes inside sidebar text widgets.
 */
add_filter( 'widget_text', 'do_shortcode' );

/**
 * Settings page: a shortcode reference so the user never has to leave wp-admin to copy one.
 */
function marginpad_widgets_menu() {
	add_options_page(
		'MarginPad Crypto Widgets',
		'MarginPad Widgets',
		'manage_options',
		'marginpad-widgets',
		'marginpad_widgets_settings_page'
	);
}
add_action( 'admin_menu', 'marginpad_widgets_menu' );

function marginpad_widgets_settings_page() {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	$rows = array(
		array( '[marginpad_liquidation_calculator coin="BTC"]', 'Live liquidation calculator for any coin. Change coin to ETH, SOL, XRP, and so on.' ),
		array( '[marginpad_fear_greed]', 'Crypto Fear &amp; Greed index with yesterday and last-week readings.' ),
		array( '[marginpad_liquidations]', 'Real-time liquidation feed aggregated from ten exchanges.' ),
		array( '[marginpad_calendar]', 'Crypto economic calendar: FOMC, CPI, NFP and crypto-native events.' ),
	);
	echo '<div class="wrap"><h1>MarginPad Crypto Widgets</h1>';
	echo '<p>Paste any shortcode below into a post, a page or a text widget. Everything is free, needs no API key and collects nothing from your visitors.</p>';
	echo '<table class="widefat striped" style="max-width:900px"><thead><tr><th>Shortcode</th><th>What it shows</th></tr></thead><tbody>';
	foreach ( $rows as $r ) {
		echo '<tr><td><code>' . esc_html( $r[0] ) . '</code></td><td>' . wp_kses_post( $r[1] ) . '</td></tr>';
	}
	echo '</tbody></table>';
	echo '<h2>Options</h2><p>Every shortcode accepts <code>width</code> (for example <code>360</code> or <code>100%</code>), <code>height</code> in pixels, and <code>credit="no"</code> to hide the credit link. The liquidation calculator also accepts <code>coin</code>.</p>';
	echo '<p><a href="https://marginpad.io/wordpress-crypto-widgets/" target="_blank" rel="noopener">Full documentation and live previews</a></p></div>';
}

/**
 * Plugin list: a direct link to the shortcode reference.
 */
function marginpad_widgets_action_links( $links ) {
	$url = admin_url( 'options-general.php?page=marginpad-widgets' );
	array_unshift( $links, '<a href="' . esc_url( $url ) . '">Shortcodes</a>' );
	return $links;
}
add_filter( 'plugin_action_links_' . plugin_basename( __FILE__ ), 'marginpad_widgets_action_links' );
