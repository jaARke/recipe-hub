import { createHash, timingSafeEqual } from 'node:crypto';
import { notFoundResponse } from '@/app/_lib/route-responses';
import { getCleanupService } from '@/composition/services';
import { cronSecret } from '@/lib/env';

// The image sweep holds the image move lock's transaction open while it runs, and Neon ends a
// transaction left idle for 5 minutes, so the run ends well before that.
export const maxDuration = 120;

// Each response is final: Vercel's CDN must never answer the cron in the function's place.
const noStore = { 'Cache-Control': 'no-store' };

// Compares digests, which always have the same length, in constant time, so timing reveals nothing.
function isCronRequest(authorization: string | null, secret: string): boolean {
	const digest = (value: string) => createHash('sha256').update(value).digest();
	return (
		authorization !== null && timingSafeEqual(digest(authorization), digest(`Bearer ${secret}`))
	);
}

// Vercel's daily cron calls this on production with the secret as its bearer token. A run with a
// failed step still answers 200, since its line and the step's error say what failed and Vercel
// retries no run either way.
export async function GET(request: Request): Promise<Response> {
	// Read first, so no build prerenders the 404 a deployment without the cron answers.
	const authorization = request.headers.get('authorization');
	if (cronSecret === undefined) {
		return notFoundResponse();
	}
	if (!isCronRequest(authorization, cronSecret)) {
		return new Response(null, { status: 401, headers: noStore });
	}

	const report = await getCleanupService().runCleanup();
	return Response.json(report, { headers: noStore });
}
