import type { Metadata } from 'next';
import { Suspense } from 'react';
import { nextParamName, requestAccessPath, safeNextPath } from '@/components/auth/auth-paths';
import { SignInForm, SignInFormSkeleton } from '@/components/auth/sign-in-form';
import { PageContainer } from '@/components/layout/page-container';
import { TextLink } from '@/components/layout/text-link';
import { signInCodeLifetimeMinutes } from '@/domain/member/member';

export const metadata: Metadata = {
	title: 'Sign in',
};

// The page to return to arrives in the URL, so it's checked before the form can navigate to it.
async function SignInWithReturn({ searchParams }: Pick<PageProps<'/sign-in'>, 'searchParams'>) {
	const next = safeNextPath((await searchParams)[nextParamName]);
	return <SignInForm next={next} codeLifetimeMinutes={signInCodeLifetimeMinutes} />;
}

export default function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-medium">Sign in</h1>
			<Suspense fallback={<SignInFormSkeleton />}>
				<SignInWithReturn searchParams={searchParams} />
			</Suspense>
			<p className="text-muted-foreground">
				Don&apos;t have an account? <TextLink href={requestAccessPath}>Request access</TextLink>.
			</p>
		</PageContainer>
	);
}
