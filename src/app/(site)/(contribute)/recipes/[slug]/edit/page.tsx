import { LockIcon } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, permanentRedirect, redirect } from 'next/navigation';
import { Suspense } from 'react';
import { getCachedRecipe } from '@/app/_lib/recipe-cache';
import { loadFormMember } from '@/app/(site)/(contribute)/_lib/load-form-member';
import { deleteRecipe, updateRecipe } from '@/app/(site)/(contribute)/recipes/[slug]/edit/actions';
import { ForbiddenError, SignInRequiredError } from '@/application/authorization';
import type { EditableRecipeDto } from '@/application/recipes/recipe-dtos';
import { signInHref } from '@/components/auth/auth-paths';
import { PageContainer } from '@/components/layout/page-container';
import {
	EditingPageHeading,
	editingPageTitles,
} from '@/components/recipe-form/editing-page-heading';
import { RecipeForm, RecipeFormSkeleton } from '@/components/recipe-form/recipe-form';
import { recipeFormValues } from '@/components/recipe-form/recipe-form-values';
import { EditedRecipeMenu } from '@/components/recipe-form/subject-menus';
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

// The public lookup gates only the title, so a missing recipe's 404 carries the not-found page's title
// without authorizing; the page itself authorizes in loadEditableRecipe.
export async function generateMetadata({
	params,
}: PageProps<'/recipes/[slug]/edit'>): Promise<Metadata> {
	const { slug } = await params;
	if ((await getCachedRecipe(slug)) === null) {
		notFound();
	}
	return { title: editingPageTitles.edit };
}

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
				<EmptyTitle>You can’t edit this recipe</EmptyTitle>
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
		return (
			<>
				<EditingPageHeading title={editingPageTitles.edit} />
				<EditNotAllowedEmptyState slug={slug} />
			</>
		);
	}

	// Slugs follow titles, so an old one still finds the recipe. Inside Suspense the redirect happens
	// in the browser, where a permanent one leaves at once and a temporary one waits a second.
	if (recipe.slug !== slug) {
		permanentRedirect(recipeEditPath(recipe.slug));
	}

	// Loading the recipe read the session, so this is the request's time, not a prerender's. Taken
	// before the ids are listed, so changes kept for a recipe added meanwhile are never pruned.
	const now = new Date();
	// Every recipe's id, so the form's load drops unsaved changes kept for one deleted since.
	const [member, recipeIds] = await Promise.all([
		loadFormMember(recipeEditPath(slug)),
		getRecipeService().listRecipeIds(),
	]);
	return (
		<>
			<EditingPageHeading
				title={editingPageTitles.edit}
				menu={
					<EditedRecipeMenu
						recipe={{ id: recipe.id, slug: recipe.slug, title: recipe.title }}
						memberId={member.id}
						action={deleteRecipe}
					/>
				}
			/>
			<RecipeForm
				// A recipe changed elsewhere starts the form again; Next keeps recent pages, and their state, alive.
				key={recipe.updatedAt.toISOString()}
				initial={recipeFormValues(recipe)}
				action={updateRecipe}
				uploadFolders={getRecipeImageService().uploadFolders()}
				editing={{ id: recipe.id, version: recipe.updatedAt.toISOString() }}
				autosave={{ memberId: member.id, existing: { knownAt: now, recipeIds } }}
				submitLabel="Save changes"
			/>
		</>
	);
}

export default function EditRecipePage({ params }: PageProps<'/recipes/[slug]/edit'>) {
	return (
		<PageContainer width="readingOrWide" className="flex flex-col gap-8 py-12 sm:py-16">
			<Suspense
				fallback={
					<>
						<EditingPageHeading title={editingPageTitles.edit} />
						<RecipeFormSkeleton besideOriginal />
					</>
				}
			>
				<RecipeEditor params={params} />
			</Suspense>
		</PageContainer>
	);
}
