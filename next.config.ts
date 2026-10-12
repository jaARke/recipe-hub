import { withBotId } from 'botid/next/config';
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

// Adds the rewrites that carry BotID's browser check through this site's own origin.
export default withBotId(nextConfig);
