import 'server-only';
import { waitUntil } from '@vercel/functions';
import { checkBotId } from 'botid/server';
import { headers } from 'next/headers';
import { after, connection } from 'next/server';
import { cache } from 'react';
import { AccessRequestService } from '@/application/access/access-request-service';
import { AccountService } from '@/application/access/account-service';
import { InviteService } from '@/application/access/invite-service';
import { RecipeImportService } from '@/application/ingestion/recipe-import-service';
import { MemberService } from '@/application/members/member-service';
import type { ActorProvider } from '@/application/ports/actor-provider';
import { ImageFolders } from '@/application/recipes/image-folders';
import { RecipeImageService } from '@/application/recipes/recipe-image-service';
import { RecipeService } from '@/application/recipes/recipe-service';
import { RecipeSearchService } from '@/application/search/recipe-search-service';
import { AiPageRecipeExtractor } from '@/infrastructure/ai/ai-page-recipe-extractor';
import { AiScanRecipeExtractor } from '@/infrastructure/ai/ai-scan-recipe-extractor';
import { createAuth, type Auth } from '@/infrastructure/auth/better-auth';
import { BetterAuthActorProvider } from '@/infrastructure/auth/better-auth-actor-provider';
import { db } from '@/infrastructure/db/client';
import { DrizzleAccessRequestRepository } from '@/infrastructure/db/drizzle-access-request-repository';
import { DrizzleImageMoveLock } from '@/infrastructure/db/drizzle-image-move-lock';
import { DrizzleInviteRepository } from '@/infrastructure/db/drizzle-invite-repository';
import { DrizzleMemberRepository } from '@/infrastructure/db/drizzle-member-repository';
import { DrizzleRecipeImportRepository } from '@/infrastructure/db/drizzle-recipe-import-repository';
import { DrizzleRecipeRepository } from '@/infrastructure/db/drizzle-recipe-repository';
import { DrizzleRecipeSearch } from '@/infrastructure/db/drizzle-recipe-search';
import { ResendEmailSender } from '@/infrastructure/email/resend-email-sender';
import { BlobImageStore } from '@/infrastructure/storage/blob-image-store';
import { BlobUploadHandler } from '@/infrastructure/storage/blob-upload-handler';
import { GuardedWebPageFetcher } from '@/infrastructure/web/guarded-web-page-fetcher';
import { JsonLdPageRecipeExtractor } from '@/infrastructure/web/json-ld-page-recipe-extractor';
import {
	appUrl,
	env,
	expiringImageEnvironmentPrefixes,
	imageEnvironment,
	readableImageEnvironments,
	siteUrl,
} from '@/lib/env';
import { settings } from '@/lib/settings';

const emails = new ResendEmailSender({
	apiKey: env.RESEND_API_KEY,
	domain: env.RESEND_EMAIL_DOMAIN,
});

const imageFolders = new ImageFolders(
	imageEnvironment,
	readableImageEnvironments,
	expiringImageEnvironmentPrefixes
);

const images = new BlobImageStore({ storeId: env.BLOB_STORE_ID, folders: imageFolders });

// The hosts a deployment answers on: the one its links name, and its own Vercel hosts.
const deploymentHosts = [
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
		allowedHosts: deploymentHosts,
		productionHost: env.VERCEL_ENV === 'production' ? siteUrl.hostname : undefined,
		accounts: new AccountService(
			new DrizzleMemberRepository(db),
			new DrizzleInviteRepository(db),
			emails
		),
		runInBackground: waitUntil,
		checkBotId,
	});
	return auth;
}

// Reading the session is request work. With partial prefetching, headers resolve while the page's
// shell still prerenders, so the read waits for the request itself.
async function requestHeaders(): Promise<Headers> {
	await connection();
	return headers();
}

const sessionActors = new BetterAuthActorProvider(getAuth, requestHeaders);

// Every service resolves the actor, so a page that calls several reads the session once. React's
// cache keeps the read for the rest of the render's request, and outside a render, as in a Server
// Action or a Route Handler, each call reads the session again.
const actors: ActorProvider = { currentActor: cache(() => sessionActors.currentActor()) };

export function getRecipeService(): RecipeService {
	return new RecipeService(
		new DrizzleRecipeRepository(db),
		new DrizzleRecipeImportRepository(db),
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
	return new RecipeImageService(
		new DrizzleRecipeRepository(db),
		new DrizzleRecipeImportRepository(db),
		images,
		actors,
		imageFolders,
		new DrizzleImageMoveLock(db),
		after
	);
}

export function getRecipeImportService(): RecipeImportService {
	return new RecipeImportService(
		new DrizzleRecipeRepository(db),
		new DrizzleRecipeImportRepository(db),
		new GuardedWebPageFetcher({ siteUrl }),
		new JsonLdPageRecipeExtractor(),
		new AiPageRecipeExtractor(settings.ai.pageModelId),
		new AiScanRecipeExtractor(settings.ai.scanModelId),
		images,
		actors,
		imageFolders
	);
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
	return new MemberService(new DrizzleMemberRepository(db), actors, env.ADMIN_EMAIL);
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
		allowedHosts: deploymentHosts,
		authorizeUpload: (pathname) => getRecipeImageService().authorizeUpload(pathname),
	});
	return uploads.handle(request);
}
