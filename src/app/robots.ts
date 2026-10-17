import type { MetadataRoute } from 'next';

// Crawlers that gather pages to train AI models, which the site asks out. Search engines' crawlers,
// and the fetchers assistants send when a person asks about a page, stay allowed.
const trainingCrawlers = [
	'GPTBot',
	'ClaudeBot',
	'Google-Extended',
	'Applebot-Extended',
	'CCBot',
	'Meta-ExternalAgent',
	'Bytespider',
];

// Nothing else is blocked: crawlers must reach pages to read their noindex, and previews of shared
// links fetch the Open Graph images.
export default function robots(): MetadataRoute.Robots {
	return {
		rules: [
			{ userAgent: '*', allow: '/' },
			{ userAgent: trainingCrawlers, disallow: '/' },
		],
	};
}
