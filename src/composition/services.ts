import 'server-only';
import { waitUntil } from '@vercel/functions';
import { headers } from 'next/headers';
import { AccessRequestService } from '@/application/access/access-request-service';
import { AccountService } from '@/application/access/account-service';
import { InviteService } from '@/application/access/invite-service';
import { MemberService } from '@/application/members/member-service';
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
import { appUrl, env, siteUrl } from '@/lib/env';

const emails = new ResendEmailSender({
	apiKey: env.RESEND_API_KEY,
	domain: env.RESEND_EMAIL_DOMAIN,
});

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

const actors = new BetterAuthActorProvider(getAuth, headers);

export function getRecipeService(): RecipeService {
	return new RecipeService(new DrizzleRecipeRepository(db), actors);
}

export function getRecipeSearchService(): RecipeSearchService {
	return new RecipeSearchService(new DrizzleRecipeSearch(db));
}

export function getRecipeImageService(): RecipeImageService {
	return new RecipeImageService(new BlobImageStore({ storeId: env.BLOB_STORE_ID }));
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
