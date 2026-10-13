import type { NextRequest } from 'next/server';
import { notFoundResponse } from '@/app/_lib/route-responses';
import { getRecipeImageService, verifyCleanupWorkflowToken } from '@/composition/services';
import { env } from '@/lib/env';
import { getLogger } from '@/lib/logger';

const bearerPrefix = 'Bearer ';

const logger = getLogger('images');

function bearerToken(authorization: string | null): string | null {
	return authorization?.startsWith(bearerPrefix) ? authorization.slice(bearerPrefix.length) : null;
}

// The cleanup workflow calls this when a pull request closes, past Vercel Authentication as a Trusted
// Source. Vercel admits others to a preview too (share links, team members), so the workflow also
// sends its GitHub Actions token as a bearer token, which is verified here. It names the pull
// request's branch, since one commit can be deployed on several branches and each branch has its own
// image folders.
export async function POST(request: NextRequest): Promise<Response> {
	// Hides the endpoint elsewhere; the service's own preview check is the authority.
	if (env.VERCEL_ENV !== 'preview') {
		return notFoundResponse();
	}

	const token = bearerToken(request.headers.get('authorization'));
	if (token === null || !(await verifyCleanupWorkflowToken(token))) {
		logger.warn('Preview image deletion refused without the workflow token');
		return new Response(null, { status: 401 });
	}

	if (request.nextUrl.searchParams.get('branch') !== env.VERCEL_GIT_COMMIT_REF) {
		return new Response(null, { status: 409 });
	}

	return Response.json(await getRecipeImageService().deletePreviewImages());
}
