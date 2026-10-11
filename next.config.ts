import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
};

export default nextConfig;
