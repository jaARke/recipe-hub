import { createHash, timingSafeEqual } from 'node:crypto';
import { notFoundResponse } from '@/app/_lib/route-responses';
import { getRecipeImageService } from '@/composition/services';
import { env } from '@/lib/env';
import { getLogger } from '@/lib/logger';

const logger = getLogger('images');

function sha256(value: string): Buffer {
	return createHash('sha256').update(value).digest();
}

// Compared as hashes, so the time taken says nothing about the secret, its length included.
function isCronRequest(authorization: string | null, secret: string): boolean {
	return (
		authorization !== null && timingSafeEqual(sha256(authorization), sha256(`Bearer ${secret}`))
	);
}

// Vercel's cron calls this daily on production (vercel.json), with CRON_SECRET as a bearer token.
export async function GET(request: Request): Promise<Response> {
	// src/lib/env.ts requires the secret in production.
	if (env.VERCEL_ENV !== 'production' || env.CRON_SECRET === undefined) {
		return notFoundResponse();
	}

	if (!isCronRequest(request.headers.get('authorization'), env.CRON_SECRET)) {
		logger.warn('Image sweep refused without the cron secret');
		return new Response(null, { status: 401 });
	}

	return Response.json(await getRecipeImageService().sweepImages());
}
