// The color tokens in src/app/globals.css as sRGB hex, for what cannot read the CSS variables: the
// share cards (Satori reads no oklch either), the web manifest, the theme color, and emails. Each
// value converts its token; change them together.
export const tokenColors = {
	light: {
		background: '#fdfaf3',
		foreground: '#241c17',
		muted: '#f4ede2',
		mutedForeground: '#64584f',
		primary: '#31231c',
		border: '#e0d8cc',
	},
	dark: {
		background: '#171310',
	},
};
