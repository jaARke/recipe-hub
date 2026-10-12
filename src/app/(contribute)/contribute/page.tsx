import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { Suspense } from 'react';
import { createRecipe } from '@/app/(contribute)/contribute/actions';
import { signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import { RecipeForm, RecipeFormSkeleton } from '@/components/recipe-form/recipe-form';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { contributePath } from '@/components/recipe/recipe-paths';
import { getMemberService, getRecipeImageService } from '@/composition/services';

export const metadata: Metadata = {
	title: 'Add a recipe',
};

// The proxy sends a visitor without a session cookie to sign in first; this is the check that
// counts, since the cookie can be present but expired.
async function ContributeForMember() {
	const member = await getMemberService().getCurrentMember();
	if (member === null) {
		redirect(signInHref(contributePath));
	}

	return (
		<RecipeForm
			initial={recipeFormValues()}
			action={createRecipe}
			uploadFolders={getRecipeImageService().uploadFolders()}
			submitLabel="Save recipe"
		/>
	);
}

export default function ContributePage() {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-medium">Add a recipe</h1>
			<Suspense fallback={<RecipeFormSkeleton />}>
				<ContributeForMember />
			</Suspense>
		</PageContainer>
	);
}
