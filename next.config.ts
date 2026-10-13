import { withBotId } from 'botid/next/config';
import type { NextConfig } from 'next';
import { PHASE_DEVELOPMENT_SERVER } from 'next/constants';

// Static, because nonces force dynamic rendering, so Partial Prerendering's inline scripts need
// 'unsafe-inline'. vercel.live, Pusher, vercel.com's images, and assets.vercel.com's fonts serve the
// Vercel Toolbar on previews.
function contentSecurityPolicy(development: boolean): string {
	return [
		"default-src 'self'",
		// React's development build uses eval to rebuild server error stacks.
		`script-src 'self' 'unsafe-inline'${development ? " 'unsafe-eval'" : ''} https://vercel.live`,
		"style-src 'self' 'unsafe-inline' https://vercel.live",
		// Photos show from blob: URLs before they upload.
		"img-src 'self' data: blob: https://vercel.live https://vercel.com",
		"font-src 'self' https://vercel.live https://assets.vercel.com",
		// Photos upload from the browser straight to Blob's API.
		"connect-src 'self' https://vercel.com/api/blob/ https://vercel.live wss://ws-us3.pusher.com",
		"frame-src 'self' https://vercel.live",
		"object-src 'none'",
		"base-uri 'self'",
		"form-action 'self'",
		"frame-ancestors 'none'",
		// The dev server is plain HTTP, and Safari would upgrade even localhost.
		...(development ? [] : ['upgrade-insecure-requests']),
	].join('; ');
}

function nextConfig(phase: string): NextConfig {
	const development = phase === PHASE_DEVELOPMENT_SERVER;
	return {
		cacheComponents: true,
		partialPrefetching: true,
		images: {
			// Dish photos through the delivery route; the optimizer refuses every other local path.
			localPatterns: [{ pathname: '/api/images/dish/**', search: '' }],
		},
		turbopack: {
			rules: {
				'*.css': {
					loaders: ['@tailwindcss/turbopack'],
					as: '*.css',
				},
			},
		},
		async headers() {
			return [
				{
					source: '/:path*',
					headers: [
						{ key: 'Content-Security-Policy', value: contentSecurityPolicy(development) },
						{ key: 'X-Content-Type-Options', value: 'nosniff' },
						{ key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
						{ key: 'X-Frame-Options', value: 'DENY' },
						{
							key: 'Permissions-Policy',
							value:
								'camera=(), microphone=(), geolocation=(), payment=(), usb=(), browsing-topics=()',
						},
						{ key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
					],
				},
			];
		},
	};
}

// Adds the rewrites that carry BotID's browser check through this site's own origin. Its own framing
// headers on that path come after these, so they replace the policy and X-Frame-Options there.
export default withBotId(nextConfig);
