import 'server-only';
import { waitUntil } from '@vercel/functions';
import { headers } from 'next/headers';
import { connection } from 'next/server';
import { AccessRequestService } from '@/application/access/access-request-service';
import { AccountService } from '@/application/access/account-service';
import { InviteService } from '@/application/access/invite-service';
import { MemberService } from '@/application/members/member-service';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { RecipeService } from '@/application/recipes/recipe-service';
import { RecipeSearchService } from '@/application/search/recipe-search-service';
import { createAuth, type Auth } from '@/infrastructure/auth/better-auth';
import { BetterAuthActorProvider } from '@/infrastructure/auth/better-auth-actor-provider';
import { db } from '@/infrastructure/db/client';
import { DrizzleAccessRequestRepository } from '@/infrastructure/db/drizzle-access-request-repository';
import { DrizzleInviteRepository } from '@/infrastructure/db/drizzle-invite-repository';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { DrizzleRecipeSearch } from '@/infrastructure/db/drizzle-recipe-search';
import { ResendEmailSender } from '@/infrastructure/email/resend-email-sender';
import { BlobImageStore } from '@/infrastructure/storage/blob-image-store';
import { BlobUploadHandler } from '@/infrastructure/storage/blob-upload-handler';
import { appUrl, env, imageEnvironment, siteUrl } from '@/lib/env';

const emails = new ResendEmailSender({
	apiKey: env.RESEND_API_KEY,
	domain: env.RESEND_EMAIL_DOMAIN,
});

const imageFolders = new ImageFolders(imageEnvironment);

const images = new BlobImageStore({ storeId: env.BLOB_STORE_ID, folders: imageFolders });

// The hosts a deployment answers on: the one its links name, and its own Vercel hosts.
const authHosts = [
	...new Set(
		[appUrl.host, env.VERCEL_URL, env.VERCEL_BRANCH_URL].filter((host) => host !== undefined)
	),
];

let auth: Auth | undefined;

// Built on first use, so requests that never touch the session never construct it.
function getAuth(): Auth {
	auth ??= createAuth({
		db,
		secret: env.BETTER_AUTH_SECRET,
		allowedHosts: authHosts,
		productionHost: env.VERCEL_ENV === 'production' ? siteUrl.hostname : undefined,
		accounts: new AccountService(
			new DrizzleMemberRepository(db),
			new DrizzleInviteRepository(db),
			emails
		),
		runInBackground: waitUntil,
	});
	return auth;
}

// Reading the session is request work. With partial prefetching, headers resolve while the page's
// shell still prerenders, so the read waits for the request itself.
async function requestHeaders(): Promise<Headers> {
	await connection();
	return headers();
}

const actors = new BetterAuthActorProvider(getAuth, requestHeaders);

export function getRecipeService(): RecipeService {
	return new RecipeService(
		new DrizzleRecipeRepository(db),
		new DrizzleMemberRepository(db),
		images,
		actors,
		imageFolders
	);
}

export function getRecipeSearchService(): RecipeSearchService {
	return new RecipeSearchService(new DrizzleRecipeSearch(db));
}

export function getRecipeImageService(): RecipeImageService {
	return new RecipeImageService(images, actors, imageFolders);
}

export function getAccessRequestService(): AccessRequestService {
	return new AccessRequestService(
		new DrizzleAccessRequestRepository(db),
		new DrizzleMemberRepository(db),
		emails,
		actors,
		appUrl
	);
}

export function getInviteService(): InviteService {
	return new InviteService(
		new DrizzleInviteRepository(db),
		new DrizzleAccessRequestRepository(db),
		new DrizzleMemberRepository(db),
		emails,
		actors,
		appUrl
	);
}

export function getMemberService(): MemberService {
	return new MemberService(new DrizzleMemberRepository(db), actors);
}

// Better Auth's endpoint, which the Route Handler at /api/auth/[...all] mounts.
export function handleAuthRequest(request: Request): Promise<Response> {
	return getAuth().handler(request);
}

// Blob's client-upload endpoint, which the Route Handler at /api/uploads mounts.
export function handleImageUploadRequest(request: Request): Promise<Response> {
	const uploads = new BlobUploadHandler({
		storeId: env.BLOB_STORE_ID,
		webhookPublicKey: env.BLOB_WEBHOOK_PUBLIC_KEY,
		authorizeUpload: (pathname) => getRecipeImageService().authorizeUpload(pathname),
	});
	return uploads.handle(request);
}
