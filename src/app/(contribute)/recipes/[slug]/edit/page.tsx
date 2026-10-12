import { LockIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { deleteRecipe, updateRecipe } from '@/app/(contribute)/recipes/[slug]/edit/actions';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import type { EditableRecipeDto } from '@/application/recipes/recipe-dtos';
import { signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import { PageSection } from '@/components/layout/page-section';
import { DeleteRecipeDialog } from '@/components/recipe-form/delete-recipe-dialog';
import { RecipeForm, RecipeFormSkeleton } from '@/components/recipe-form/recipe-form';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { recipeEditPath, recipePath } from '@/components/recipe/recipe-paths';
import { buttonVariants } from '@/components/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';
import { getRecipeImageService, getRecipeService } from '@/composition/services';

export const metadata: Metadata = {
	title: 'Edit recipe',
};

// The authoritative check: the service authorizes the actor, and the proxy only looks for a cookie.
// Null for a member who may not edit the recipe; an unknown slug is a 404.
async function loadEditableRecipe(slug: string): Promise<EditableRecipeDto | null> {
	let recipe: EditableRecipeDto | null;
	try {
		recipe = await getRecipeService().getRecipeForEditing(slug);
	} catch (error) {
		if (error instanceof SignInRequiredError) {
			redirect(signInHref(recipeEditPath(slug)));
		}
		if (error instanceof ForbiddenError) {
			return null;
		}
		throw error;
	}

	if (recipe === null) {
		notFound();
	}
	return recipe;
}

// For a signed-in member who neither added the recipe nor is an admin.
function EditNotAllowedEmptyState({ slug }: { slug: string }) {
	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<LockIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle>You can&apos;t edit this recipe</EmptyTitle>
				<EmptyDescription>
					Only the person who added this recipe, or an admin, can edit it.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Link href={recipePath(slug)} className={buttonVariants()}>
					Back to the recipe
				</Link>
			</EmptyContent>
		</Empty>
	);
}

async function RecipeEditor({ params }: Pick<PageProps<'/recipes/[slug]/edit'>, 'params'>) {
	const { slug } = await params;
	const recipe = await loadEditableRecipe(slug);
	if (recipe === null) {
		return <EditNotAllowedEmptyState slug={slug} />;
	}

	// Slugs follow titles, so an old one still finds the recipe. Inside Suspense the redirect happens
	// in the browser, where a permanent one leaves at once and a temporary one waits a second.
	if (recipe.slug !== slug) {
		permanentRedirect(recipeEditPath(recipe.slug));
	}

	return (
		<div className="flex flex-col gap-12">
			<RecipeForm
				// A recipe changed elsewhere starts the form again; Next keeps recent pages, and their state, alive.
				key={recipe.updatedAt.toISOString()}
				initial={recipeFormValues(recipe)}
				action={updateRecipe}
				uploadFolders={getRecipeImageService().uploadFolders()}
				editing={{ id: recipe.id, version: recipe.updatedAt.toISOString() }}
				submitLabel="Save changes"
			/>
			<PageSection id="delete-recipe" title="Delete recipe">
				<p className="text-muted-foreground">
					Deleting the recipe also deletes its photos, and it can&apos;t be undone.
				</p>
				<div>
					<DeleteRecipeDialog recipeId={recipe.id} title={recipe.title} action={deleteRecipe} />
				</div>
			</PageSection>
		</div>
	);
}

export default function EditRecipePage({ params }: PageProps<'/recipes/[slug]/edit'>) {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<h1 className="font-heading text-4xl font-medium">Edit recipe</h1>
			<Suspense fallback={<RecipeFormSkeleton />}>
				<RecipeEditor params={params} />
			</Suspense>
		</PageContainer>
	);
}
