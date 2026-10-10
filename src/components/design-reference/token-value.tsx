'use client';

import { useSyncExternalStore } from 'react';

type TokenName = `--${string}`;

let colorProbe: HTMLSpanElement | undefined;

function subscribeToThemeChange(onChange: () => void) {
	// The theme toggle swaps a class on <html>, which changes every token's computed value.
	const observer = new MutationObserver(onChange);
	observer.observe(document.documentElement, { attributeFilter: ['class'] });
	return () => observer.disconnect();
}

function readToken(name: TokenName) {
	return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

// The CSS pipeline ships color tokens as lab() with hex fallbacks. Relative color syntax converts
// them back to the oklch space globals.css authors them in; the round trip blurs hue at low
// chroma, so hue is rounded to whole degrees.
function readColorToken(name: TokenName) {
	if (!CSS.supports('color', 'oklch(from red l c h)')) {
		return readToken(name);
	}

	if (!colorProbe) {
		colorProbe = document.createElement('span');
		colorProbe.hidden = true;
		document.body.append(colorProbe);
	}

	colorProbe.style.color = `oklch(from var(${name}) l c h)`;
	const [lightness, chroma, hue] = (getComputedStyle(colorProbe).color.match(/[\d.]+/g) ?? []).map(
		Number
	);

	if (lightness === undefined || chroma === undefined || hue === undefined) {
		return readToken(name);
	}

	return `oklch(${+lightness.toFixed(3)} ${+chroma.toFixed(3)} ${Math.round(hue)})`;
}

// Both render nothing on the server: computed values exist only in the browser.
function TokenValue({ name }: { name: TokenName }) {
	return useSyncExternalStore(
		subscribeToThemeChange,
		() => readToken(name),
		() => null
	);
}

function ColorTokenValue({ name }: { name: TokenName }) {
	return useSyncExternalStore(
		subscribeToThemeChange,
		() => readColorToken(name),
		() => null
	);
}

export { ColorTokenValue, TokenValue };
