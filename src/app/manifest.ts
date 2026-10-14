import type { MetadataRoute } from 'next';
import { siteDescription, siteName } from '@/lib/site';
import { tokenColors } from '@/lib/token-colors';

// A manifest takes one color of each kind, so an installed app's splash screen uses the light theme's.
export default function manifest(): MetadataRoute.Manifest {
	return {
		id: '/',
		name: siteName,
		short_name: siteName,
		description: siteDescription,
		start_url: '/',
		display: 'standalone',
		background_color: tokenColors.light.background,
		theme_color: tokenColors.light.background,
		icons: [
			{ src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
			{ src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
			{ src: '/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
		],
	};
}
