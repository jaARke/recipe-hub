import { ChefHatIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { buttonVariants } from '@/components/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';
import { Skeleton } from '@/components/ui/skeleton';
import { getMemberService } from '@/composition/services';

export const metadata: Metadata = {
	title: 'Add a recipe',
};

const contributePath = '/contribute';

// A placeholder until recipe authoring arrives. The proxy sends a visitor without a session cookie
// to sign in first; this is the check that counts, since the cookie can be present but expired.
async function ContributeForMember() {
	const member = await getMemberService().getCurrentMember();
	if (member === null) {
		redirect(signInHref(contributePath));
	}

	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<ChefHatIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>Coming soon</EmptyTitle>
				<EmptyDescription>
					Adding recipes isn&apos;t ready yet. Until then, you can browse and search the recipes
					already here.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				{/* Base UI's Button must not render links, so the link takes the button's look directly. */}
				<Link href={recipeListPath} className={buttonVariants()}>
					Browse recipes
				</Link>
			</EmptyContent>
		</Empty>
	);
}

function ContributeSkeleton() {
	return (
		<div role="status">
			<span className="sr-only">Loading</span>
			<Skeleton className="h-72 w-full rounded-lg" />
		</div>
	);
}

export default function ContributePage() {
	return (
		<PageContainer width="wide" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-medium">Add a recipe</h1>
			<Suspense fallback={<ContributeSkeleton />}>
				<ContributeForMember />
			</Suspense>
		</PageContainer>
	);
}
