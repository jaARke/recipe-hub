import type { NextRequest } from 'next/server';
import { SignInRequiredError } from '@/application/authorization';
import type { StoredImage } from '@/application/ports/image-store';
import { getRecipeImageService } from '@/composition/services';
import { isScanImagePathname } from '@/domain/recipe/recipe-image';
import { imageCacheMaxAgeSeconds, imageCacheTag } from '@/lib/image-paths';
import { getLogger } from '@/lib/logger';

const logger = getLogger('images');

// Vercel's image optimizer adds this parameter when it fetches a source image.
const optimizerParameter = '_vercel_system';

function notFoundResponse(): Response {
	return new Response(null, { status: 404, headers: { 'Cache-Control': 'no-store' } });
}

function refusedQueryResponse(pathname: string, params: URLSearchParams): Response {
	logger.warn('Image request refused for its query', {
		pathname,
		parameters: [...params.keys()],
	});
	return notFoundResponse();
}

// The CDN keys on the query string, so any other query would bypass the cache.
function isAllowedQuery(params: URLSearchParams): boolean {
	const names = [...params.keys()];
	return names.length === 0 || (names.length === 1 && names[0] === optimizerParameter);
}

async function publicImageResponse(pathname: string, params: URLSearchParams): Promise<Response> {
	if (!isAllowedQuery(params)) {
		return refusedQueryResponse(pathname, params);
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
			// Deleting the photo purges the CDN's copies by this tag.
			'Vercel-Cache-Tag': imageCacheTag(pathname),
		},
	});
}

// A signed-out visitor gets the same 404 as a missing scan.
async function findMemberImage(pathname: string): Promise<StoredImage | null> {
	try {
		return await getRecipeImageService().getMemberImage(pathname);
	} catch (error) {
		if (error instanceof SignInRequiredError) {
			return null;
		}
		throw error;
	}
}

// Scans are never optimized, so any query is refused, and no cache keeps them.
async function scanResponse(pathname: string, params: URLSearchParams): Promise<Response> {
	if (params.size > 0) {
		return refusedQueryResponse(pathname, params);
	}

	const image = await findMemberImage(pathname);
	if (image === null) {
		return notFoundResponse();
	}

	return new Response(image.body, {
		headers: {
			'Content-Type': image.contentType,
			'X-Content-Type-Options': 'nosniff',
			'Cache-Control': 'private, no-store',
		},
	});
}

export async function GET(request: NextRequest, context: RouteContext<'/api/images/[...path]'>) {
	const { path } = await context.params;
	const pathname = path.join('/');
	const params = request.nextUrl.searchParams;
	return isScanImagePathname(pathname)
		? scanResponse(pathname, params)
		: publicImageResponse(pathname, params);
}
