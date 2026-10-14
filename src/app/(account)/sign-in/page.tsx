import type { Metadata } from 'next';
import { Suspense } from 'react';
import { nextParamName, requestAccessPath, safeNextPath } from '@/components/auth/auth-paths';
import { SignInForm, SignInFormSkeleton } from '@/components/auth/sign-in-form';
import { PageContainer } from '@/components/layout/page-container';
import { TextLink } from '@/components/layout/text-link';
import { contributePath } from '@/components/recipe/recipe-paths';
import { settings } from '@/lib/settings';

export const metadata: Metadata = {
	title: 'Sign in',
};

type SignInSearchParams = Pick<PageProps<'/sign-in'>, 'searchParams'>;

// The page to return to arrives in the URL, so it's checked before the form can navigate to it.
async function readReturnPath({ searchParams }: SignInSearchParams): Promise<string> {
	return safeNextPath((await searchParams)[nextParamName]);
}

async function SignInWithReturn({ searchParams }: SignInSearchParams) {
	const next = await readReturnPath({ searchParams });
	return (
		<SignInForm next={next} codeLifetimeMinutes={settings.accounts.signInCodeLifetimeMinutes} />
	);
}

// The header's Add recipe sends a signed-out visitor here, so the page says why.
async function SignInReason({ searchParams }: SignInSearchParams) {
	const next = await readReturnPath({ searchParams });
	return next === contributePath ? (
		<p className="text-lg text-muted-foreground">Sign in to add a recipe.</p>
	) : null;
}

export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<div className="flex flex-col gap-3">
				<h1 className="font-heading text-4xl font-semibold">Sign in</h1>
				<Suspense>
					<SignInReason searchParams={searchParams} />
				</Suspense>
			</div>
			<Suspense fallback={<SignInFormSkeleton />}>
				<SignInWithReturn searchParams={searchParams} />
			</Suspense>
			<p className="text-muted-foreground">
				Don’t have an account? <TextLink href={requestAccessPath}>Request access</TextLink>.
			</p>
		</PageContainer>
	);
}
