import type { NextRequest } from 'next/server';
import { getRecipeImageService } from '@/composition/services';

// Pathnames are never reused, so a stored image never changes.
const cacheMaxAgeSeconds = 365 * 24 * 60 * 60;

function notFoundResponse(): Response {
	return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

export async function GET(request: NextRequest, context: RouteContext<'/api/images/[...path]'>) {
	// The CDN keys on the query string, so any query would bypass the cache.
	if (request.nextUrl.search !== '') {
		return notFoundResponse();
	}

	const { path } = await context.params;
	const image = await getRecipeImageService().getPublicImage(path.join('/'));
	if (image === null) {
		return notFoundResponse();
	}

	return new Response(image.body, {
		headers: {
			'Content-Type': image.contentType,
			ETag: image.etag,
			'X-Content-Type-Options': 'nosniff',
			// Vercel's CDN caches on s-maxage and strips it, so browsers keep max-age and immutable.
			'Cache-Control': `public, max-age=${cacheMaxAgeSeconds}, s-maxage=${cacheMaxAgeSeconds}, immutable`,
		},
	});
}
