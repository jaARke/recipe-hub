import 'server-only';
import { issueSignedToken } from '@vercel/blob';
import { handleUploadPresigned } from '@vercel/blob/client';
import { z } from 'zod';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import { InvalidImageUploadError } from '@/application/recipes/errors';
import type { ImageUploadGrant } from '@/application/recipes/recipe-dtos';
import { imageCacheMaxAgeSeconds } from '@/lib/image-paths';
import { getLogger } from '@/lib/logger';

// The browser asks for each photo's URL just before uploading it.
const uploadUrlLifetimeMs = 10 * 60 * 1000;

// What the browser's uploadPresigned sends. No completion callback is ever requested, since Blob
// cannot reach a dev server or a protected preview, and a photo is too small to need multipart.
const uploadRequestSchema = z.object({
	type: z.literal('blob.generate-presigned-url'),
	payload: z.object({ pathname: z.string(), multipart: z.literal(false) }),
});

const logger = getLogger('images');

type BlobUploadHandlerOptions = {
	storeId: string;
	// Verifies completion callbacks, which are never requested, but the SDK refuses to run without it.
	webhookPublicKey: string;
	// The hosts this deployment answers on, whose pages alone may ask for an upload.
	allowedHosts: readonly string[];
	// Throws when the pathname may not be uploaded.
	authorizeUpload: (pathname: string) => Promise<ImageUploadGrant>;
};

// Route Handlers get no Server Action origin check, and the site's sibling subdomains count as the
// same site for its SameSite=Lax session cookie, so a request must come from this deployment's own
// pages: the browser says so, or names one of its hosts as the origin.
function isFromOwnPage(request: Request, allowedHosts: readonly string[]): boolean {
	if (request.headers.get('sec-fetch-site') === 'same-origin') {
		return true;
	}

	const origin = request.headers.get('origin');
	return origin !== null && URL.canParse(origin) && allowedHosts.includes(new URL(origin).host);
}

async function readJson(request: Request): Promise<unknown> {
	try {
		return await request.json();
	} catch {
		return undefined;
	}
}

// The browser SDK reports every refusal alike, so statuses are for logs and tools.
function refusalStatus(error: unknown): number | undefined {
	if (error instanceof SignInRequiredError) {
		return 401;
	}
	if (error instanceof ForbiddenError) {
		return 403;
	}
	if (error instanceof InvalidImageUploadError) {
		return 400;
	}
	return undefined;
}

// Hands the browser a presigned URL that uploads one authorized pathname straight to Blob, which
// keeps photos clear of the function body limit.
export class BlobUploadHandler {
	private readonly storeId: string;
	private readonly webhookPublicKey: string;
	private readonly allowedHosts: readonly string[];
	private readonly authorizeUpload: (pathname: string) => Promise<ImageUploadGrant>;

	constructor(options: BlobUploadHandlerOptions) {
		this.storeId = options.storeId;
		this.webhookPublicKey = options.webhookPublicKey;
		this.allowedHosts = options.allowedHosts;
		this.authorizeUpload = options.authorizeUpload;
	}

	async handle(request: Request): Promise<Response> {
		if (!isFromOwnPage(request, this.allowedHosts)) {
			logger.warn('Image upload refused from another site', {
				fetchSite: request.headers.get('sec-fetch-site'),
				origin: request.headers.get('origin'),
			});
			return new Response(null, { status: 403 });
		}

		const body = uploadRequestSchema.safeParse(await readJson(request));
		if (!body.success) {
			return new Response(null, { status: 400 });
		}

		try {
			const result = await handleUploadPresigned({
				body: { type: body.data.type, payload: { ...body.data.payload, clientPayload: null } },
				request,
				webhookPublicKey: this.webhookPublicKey,
				getSignedToken: (pathname) => this.signUpload(pathname),
			});
			return Response.json(result);
		} catch (error) {
			const status = refusalStatus(error);
			if (status === undefined) {
				throw error;
			}
			return new Response(null, { status });
		}
	}

	// The token covers this one pathname, and the URL never overwrites or renames.
	private async signUpload(pathname: string) {
		const grant = await this.authorizeUpload(pathname);
		const limits = {
			allowedContentTypes: [grant.contentType],
			maximumSizeInBytes: grant.maximumSizeInBytes,
		};
		const token = await issueSignedToken({
			...limits,
			pathname,
			operations: ['put'],
			validUntil: Date.now() + uploadUrlLifetimeMs,
			storeId: this.storeId,
		});

		return {
			token,
			urlOptions: {
				...limits,
				addRandomSuffix: false,
				allowOverwrite: false,
				cacheControlMaxAge: imageCacheMaxAgeSeconds,
			},
		};
	}
}
