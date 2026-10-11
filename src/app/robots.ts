import type { MetadataRoute } from 'next';

// Nothing is blocked: crawlers must reach pages to read their noindex, and previews fetch OG images.
export default function robots(): MetadataRoute.Robots {
	return { rules: { userAgent: '*', allow: '/' } };
}
