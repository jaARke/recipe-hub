import { cn } from 'cn';
import type { ReactNode } from 'react';
import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { IngredientLineText } from '@/components/recipe/ingredient-line-text';
import {
	RecipeImageViewer,
	RecipeImageViewerTrigger,
} from '@/components/recipe/recipe-image-viewer';
import { RecipePhoto } from '@/components/recipe/recipe-photo';
import { RecipeTags } from '@/components/recipe/recipe-summary';
import { recipeSearchHref } from '@/components/search/search-params';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, totalMinutes } from '@/domain/recipe/duration';
import type { IngredientSection } from '@/domain/recipe/ingredient';
import type { InstructionSection } from '@/domain/recipe/instruction';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { formatYield } from '@/domain/recipe/recipe-yield';
import { formatDate } from '@/lib/dates';

// The recipe page's text hierarchy, shared with the typography specimen.
const recipeTextStyles = {
	// Long words wrap rather than push a control beside the title off a narrow screen.
	title: 'min-w-0 font-heading text-4xl font-medium wrap-anywhere md:text-5xl',
	section: 'font-heading text-2xl font-medium',
	subsection: 'text-lg font-semibold',
	body: 'text-lg',
	supporting: 'text-lg text-muted-foreground',
	meta: 'font-mono text-xs tracking-wide uppercase',
} as const;

// Keyed by the title's level; level 4 nests the recipe under the design reference's own headings.
const recipeHeadingTags = {
	1: { title: 'h1', section: 'h2', subsection: 'h3' },
	4: { title: 'h4', section: 'h5', subsection: 'h6' },
} as const;

type RecipeHeadingLevel = keyof typeof recipeHeadingTags;

type SubsectionTag = (typeof recipeHeadingTags)[RecipeHeadingLevel]['subsection'];

type RecipeMetaItem = {
	label: string;
	value: string;
};

// A reading-width container's column is 624px.
const coverPhotoSizes = '(min-width: 672px) 624px, 100vw';

// The other photos' thumbnails are w-24.
const thumbnailPhotoSizes = '96px';

// Every recipe with the tag, newest first as search lists them without a query.
function tagSearchHref(tag: string): string {
	return recipeSearchHref({ tags: [tag], sort: 'newest', page: 1 });
}

function recipeMetaItems({
	times,
	yield: recipeYield,
}: Pick<PublicRecipeDto, 'times' | 'yield'>): RecipeMetaItem[] {
	const items: RecipeMetaItem[] = [];
	if (times.prepMinutes !== undefined) {
		items.push({ label: 'Prep', value: formatDuration(times.prepMinutes) });
	}
	if (times.cookMinutes !== undefined) {
		items.push({ label: 'Cook', value: formatDuration(times.cookMinutes) });
	}
	const total = totalMinutes(times);
	if (total !== undefined) {
		items.push({ label: 'Total', value: formatDuration(total) });
	}
	if (recipeYield !== undefined) {
		items.push({ label: 'Yield', value: formatYield(recipeYield) });
	}
	return items;
}

function RecipeMetaRow({ recipe }: { recipe: Pick<PublicRecipeDto, 'times' | 'yield'> }) {
	const items = recipeMetaItems(recipe);
	if (items.length === 0) {
		return null;
	}

	return (
		<dl className={cn(recipeTextStyles.meta, 'flex flex-wrap gap-x-6 gap-y-2')}>
			{items.map((item) => (
				<div key={item.label} className="flex gap-2">
					<dt className="text-muted-foreground">{item.label}</dt>
					<dd>{item.value}</dd>
				</div>
			))}
		</dl>
	);
}

function RecipeDate({ label, date }: { label: string; date: Date }) {
	return (
		<p>
			{label} <time dateTime={date.toISOString()}>{formatDate(date)}</time>
		</p>
	);
}

// The page a recipe was imported from, named by its host. Search engines don't follow the link, and
// the page isn't told which recipe sent the reader.
function RecipeImportedFrom({ sourceUrl }: { sourceUrl: string }) {
	return (
		<p className="text-sm text-muted-foreground">
			Imported from{' '}
			<a
				href={sourceUrl}
				rel="nofollow noopener noreferrer"
				className="text-primary underline underline-offset-4"
			>
				{new URL(sourceUrl).hostname}
			</a>
		</p>
	);
}

function RecipeByline({ recipe }: { recipe: PublicRecipeDto }) {
	return (
		<div className="flex flex-col gap-1">
			{recipe.source !== undefined && (
				<p className={recipeTextStyles.supporting}>From {recipe.source}</p>
			)}
			{recipe.sourceUrl !== undefined && <RecipeImportedFrom sourceUrl={recipe.sourceUrl} />}
			<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
				<RecipeDate
					label={`Added by ${recipe.contributor.displayName} on`}
					date={recipe.createdAt}
				/>
				{recipe.updatedAt.getTime() > recipe.createdAt.getTime() && (
					<RecipeDate label="Edited" date={recipe.updatedAt} />
				)}
			</div>
		</div>
	);
}

function IngredientSectionList({
	section,
	headingTag: Heading,
}: {
	section: IngredientSection;
	headingTag: SubsectionTag;
}) {
	return (
		<div className="flex flex-col gap-3 print:break-inside-avoid">
			{section.heading !== undefined && (
				<Heading className={recipeTextStyles.subsection}>{section.heading}</Heading>
			)}
			<ul className={cn(recipeTextStyles.body, 'flex flex-col gap-2')}>
				{section.lines.map((line, index) => (
					<li key={index}>
						<IngredientLineText line={line} />
					</li>
				))}
			</ul>
		</div>
	);
}

function InstructionSectionList({
	section,
	headingTag: Heading,
}: {
	section: InstructionSection;
	headingTag: SubsectionTag;
}) {
	return (
		<div className="flex flex-col gap-3">
			{section.heading !== undefined && (
				<Heading className={recipeTextStyles.subsection}>{section.heading}</Heading>
			)}
			<ol
				className={cn(
					recipeTextStyles.body,
					'list-decimal space-y-4 pl-6 marker:font-mono marker:text-sm marker:text-muted-foreground'
				)}
			>
				{section.steps.map((step, index) => (
					<li key={index} className="pl-2 print:break-inside-avoid">
						{step.text}
					</li>
				))}
			</ol>
		</div>
	);
}

// The cover, then a row of the other photos; each opens the viewer at itself. Left off the printout,
// which is for cooking from.
function RecipePhotos({ title, images }: { title: string; images: readonly RecipeImage[] }) {
	const [cover, ...others] = images;
	if (cover === undefined) {
		return null;
	}

	return (
		<RecipeImageViewer role="dish" title={title} images={images}>
			<div className="flex flex-col gap-3 print:hidden">
				{/* Each button is named for its photo, so the photo inside it is decorative. */}
				<RecipeImageViewerTrigger index={0} className="w-full rounded-xl">
					<RecipePhoto
						pathname={cover.pathname}
						alt=""
						sizes={coverPhotoSizes}
						preload
						className="aspect-3/2"
					/>
				</RecipeImageViewerTrigger>
				{others.length > 0 && (
					<ul className="flex flex-wrap gap-3">
						{others.map((image, index) => (
							<li key={image.pathname}>
								<RecipeImageViewerTrigger index={index + 1} className="rounded-md">
									<RecipePhoto
										pathname={image.pathname}
										alt=""
										sizes={thumbnailPhotoSizes}
										className="aspect-4/3 w-24"
									/>
								</RecipeImageViewerTrigger>
							</li>
						))}
					</ul>
				)}
			</div>
		</RecipeImageViewer>
	);
}

function RecipeDetail({
	recipe,
	headingLevel,
	titleAction,
}: {
	recipe: PublicRecipeDto;
	headingLevel: RecipeHeadingLevel;
	// A control beside the title, such as the edit link. Its box is reserved whenever it is passed, so
	// a link that streams in later moves nothing.
	titleAction?: ReactNode;
}) {
	const { title: Title, section: Section, subsection } = recipeHeadingTags[headingLevel];
	const titleId = `${recipe.slug}-title`;
	const title = (
		<Title id={titleId} className={recipeTextStyles.title}>
			{recipe.title}
		</Title>
	);

	return (
		<article aria-labelledby={titleId} className="flex flex-col gap-10">
			<header className="flex flex-col gap-4">
				{titleAction === undefined ? (
					title
				) : (
					<div className="flex items-start justify-between gap-4">
						{title}
						{/* As tall as the title's first line, so an icon button centers on it. */}
						<div className="flex h-10 w-9 shrink-0 items-center md:h-13 print:hidden">
							{titleAction}
						</div>
					</div>
				)}
				<RecipeByline recipe={recipe} />
				<RecipeMetaRow recipe={recipe} />
				{recipe.tags.length > 0 && <RecipeTags tags={recipe.tags} tagHref={tagSearchHref} />}
			</header>
			<RecipePhotos title={recipe.title} images={recipe.images} />
			{recipe.description !== undefined && (
				<p className={recipeTextStyles.body}>{recipe.description}</p>
			)}
			<div className="flex flex-col gap-6">
				<Section className={recipeTextStyles.section}>Ingredients</Section>
				{recipe.ingredientSections.map((section, index) => (
					<IngredientSectionList key={index} section={section} headingTag={subsection} />
				))}
			</div>
			<div className="flex flex-col gap-6">
				<Section className={recipeTextStyles.section}>Steps</Section>
				{recipe.instructionSections.map((section, index) => (
					<InstructionSectionList key={index} section={section} headingTag={subsection} />
				))}
			</div>
			{recipe.notes !== undefined && (
				<aside className="flex flex-col gap-2 rounded-xl bg-muted p-6 print:break-inside-avoid">
					<p className={cn(recipeTextStyles.meta, 'text-muted-foreground')}>Notes</p>
					<p className={recipeTextStyles.body}>{recipe.notes}</p>
				</aside>
			)}
		</article>
	);
}

function RecipeDetailSkeleton() {
	return (
		<div role="status" aria-live="polite">
			<span className="sr-only">Loading recipe</span>
			<div aria-hidden="true" className="flex flex-col gap-10">
				<div className="flex flex-col gap-4">
					<Skeleton className="h-10 w-3/4 md:h-13" />
					<div className="flex flex-col gap-1">
						<Skeleton className="h-7 w-1/3" />
						<Skeleton className="h-5 w-1/2" />
					</div>
					<Skeleton className="h-4 w-2/3" />
					<div className="flex gap-1.5">
						<Skeleton className="h-5 w-16 rounded-4xl" />
						<Skeleton className="h-5 w-20 rounded-4xl" />
					</div>
				</div>
				<Skeleton className="aspect-3/2 rounded-xl" />
				<div className="flex flex-col gap-6">
					<Skeleton className="h-8 w-40" />
					<div className="flex flex-col gap-2">
						<Skeleton className="h-7 w-2/3" />
						<Skeleton className="h-7 w-1/2" />
						<Skeleton className="h-7 w-3/5" />
						<Skeleton className="h-7 w-1/2" />
					</div>
				</div>
			</div>
		</div>
	);
}

export { RecipeDetail, RecipeDetailSkeleton, RecipeImportedFrom, RecipeMetaRow, recipeTextStyles };
