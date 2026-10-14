// The color tokens in src/app/globals.css as sRGB hex, for what cannot read the CSS variables: the
// share cards (Satori reads no oklch either), the web manifest, and the theme color. Each value
// converts its token; change them together.
export const tokenColors = {
	light: {
		background: '#fdfaf3',
		foreground: '#241c17',
		mutedForeground: '#64584f',
		primary: '#31231c',
	},
	dark: {
		background: '#171310',
	},
};
