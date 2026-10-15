import type { NextRequest } from 'next/server';
import { notFoundResponse } from '@/app/_lib/route-responses';
import { getRecipeImageService } from '@/composition/services';
import { imageCacheMaxAgeSeconds, imageCacheTag } from '@/lib/image-paths';
import { getLogger } from '@/lib/logger';

const logger = getLogger('images');

// Vercel's image optimizer adds this parameter when it fetches a source image.
const optimizerParameter = '_vercel_system';

// The CDN keys on the query string, so any other query would bypass the cache.
function isAllowedQuery(params: URLSearchParams): boolean {
	const names = [...params.keys()];
	return names.length === 0 || (names.length === 1 && names[0] === optimizerParameter);
}

// Dish photos and scans alike: anyone may see either, so every cache may keep it.
export async function GET(request: NextRequest, context: RouteContext<'/api/images/[...path]'>) {
	const { path } = await context.params;
	const pathname = path.join('/');
	const params = request.nextUrl.searchParams;
	if (!isAllowedQuery(params)) {
		logger.warn('Image request refused for its query', {
			pathname,
			parameters: [...params.keys()],
		});
		return notFoundResponse();
	}

	const image = await getRecipeImageService().getPublicImage(pathname);
	if (image === null) {
		return notFoundResponse();
	}

	return new Response(image.body, {
		headers: {
			'Content-Type': image.contentType,
			ETag: image.etag,
			'X-Content-Type-Options': 'nosniff',
			// Vercel's CDN caches on s-maxage and strips it, so browsers keep max-age and immutable.
			'Cache-Control': `public, max-age=${imageCacheMaxAgeSeconds}, s-maxage=${imageCacheMaxAgeSeconds}, immutable`,
			// Deleting the image purges the CDN's copies by this tag.
			'Vercel-Cache-Tag': imageCacheTag(pathname),
		},
	});
}
