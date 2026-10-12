import type { NextRequest } from 'next/server';
import { getRecipeImageService } from '@/composition/services';
import { getLogger } from '@/lib/logger';

const logger = getLogger('images');

// Pathnames are never reused, so a stored image never changes.
const cacheMaxAgeSeconds = 365 * 24 * 60 * 60;

// Vercel's image optimizer adds this parameter when it fetches a source image.
const optimizerParameter = '_vercel_system';

function notFoundResponse(): Response {
	return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

// The CDN keys on the query string, so any other query would bypass the cache.
function isAllowedQuery(params: URLSearchParams): boolean {
	const names = [...params.keys()];
	return names.length === 0 || (names.length === 1 && names[0] === optimizerParameter);
}

export async function GET(request: NextRequest, context: RouteContext<'/api/images/[...path]'>) {
	const { path } = await context.params;
	if (!isAllowedQuery(request.nextUrl.searchParams)) {
		logger.warn('Image request refused for its query', {
			pathname: path.join('/'),
			parameters: [...request.nextUrl.searchParams.keys()],
		});
		return notFoundResponse();
	}

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
