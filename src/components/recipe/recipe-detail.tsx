import { cn } from 'cn';
import type { ReactNode } from 'react';
import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { RecipeActions } from '@/components/recipe/recipe-actions';
import {
	RecipeImageViewer,
	RecipeImageViewerTrigger,
} from '@/components/recipe/recipe-image-viewer';
import { RecipeIngredientsAndSteps } from '@/components/recipe/recipe-ingredients-and-steps';
import { RecipePhoto } from '@/components/recipe/recipe-photo';
import { RecipeScaledYield } from '@/components/recipe/recipe-scaled-yield';
import { RecipeTags } from '@/components/recipe/recipe-summary';
import {
	recipeHeadingTags,
	recipeTextStyles,
	type RecipeHeadingLevel,
} from '@/components/recipe/recipe-text-styles';
import { recipeSearchHref } from '@/components/search/search-params';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration, totalMinutes } from '@/domain/recipe/duration';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { formatDate } from '@/lib/dates';

type RecipeMetaItem = {
	label: string;
	value: ReactNode;
};

// Scans sit two to a row, each half the column less half the gap. The column is 624px from 672px, and
// below it 100vw less the container's padding on each side: 1.5rem from sm, 1rem on phones.
const scanThumbnailSizes =
	'(min-width: 672px) 304px, (min-width: 640px) calc(50vw - 32px), calc(50vw - 24px)';

// A reading-width container's column is 624px.
const coverPhotoSizes = '(min-width: 672px) 624px, 100vw';

// The other photos' thumbnails are w-24.
const thumbnailPhotoSizes = '96px';

// One or more blank lines, as stored text keeps its line breaks.
const paragraphBreak = /\n{2,}/;

// Every recipe with the tag, newest first as search lists them without a query.
function tagSearchHref(tag: string): string {
	return recipeSearchHref({ tags: [tag], sort: 'newest', page: 1 });
}

// The recipe's scans, which the byline's link jumps to.
function recipeScansId(slug: string): string {
	return `${slug}-original`;
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
		items.push({ label: 'Yield', value: <RecipeScaledYield recipeYield={recipeYield} /> });
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

// A page the recipe came from, named by its host. Search engines don't follow the link, and the page
// isn't told which recipe sent the reader.
function RecipeSourceLink({ url }: { url: string }) {
	return (
		<a
			href={url}
			rel="nofollow noopener noreferrer"
			className="text-primary underline underline-offset-4"
		>
			{new URL(url).hostname}
		</a>
	);
}

function RecipeImportedFrom({ sourceUrl }: { sourceUrl: string }) {
	return (
		<p className="text-sm text-muted-foreground">
			Imported from <RecipeSourceLink url={sourceUrl} />
		</p>
	);
}

// Left off the printout, as the scans it jumps to are.
function RecipeScansLink({ slug }: { slug: string }) {
	return (
		<p className="text-sm print:hidden">
			<a href={`#${recipeScansId(slug)}`} className="text-primary underline underline-offset-4">
				See the original
			</a>
		</p>
	);
}

function RecipeByline({ recipe }: { recipe: PublicRecipeDto }) {
	// A source written as a web address is the page itself, so it links once rather than twice.
	const sourceIsUrl = recipe.source !== undefined && recipe.source === recipe.sourceUrl;
	return (
		<div className="flex flex-col gap-1">
			{recipe.source !== undefined && (
				<p className={recipeTextStyles.supporting}>
					From {sourceIsUrl ? <RecipeSourceLink url={recipe.source} /> : recipe.source}
				</p>
			)}
			{recipe.sourceUrl !== undefined && !sourceIsUrl && (
				<RecipeImportedFrom sourceUrl={recipe.sourceUrl} />
			)}
			{recipe.scans.length > 0 && <RecipeScansLink slug={recipe.slug} />}
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

// Paragraphs parted by blank lines, each kept whole in print, since notes can run for pages.
function RecipeParagraphs({ text }: { text: string }) {
	return (
		<div className={cn(recipeTextStyles.body, 'flex flex-col gap-4')}>
			{text.split(paragraphBreak).map((paragraph, index) => (
				<p key={index} className="whitespace-pre-line print:break-inside-avoid">
					{paragraph}
				</p>
			))}
		</div>
	);
}

// A thumbnail that opens the viewer at its image, a dish photo or a scan alike: a 4:3 box the image
// fills, cropped to it whatever its shape, since the viewer shows it whole. The caller sets its width
// and rounding.
function RecipeThumbnail({
	index,
	image,
	sizes,
	className,
}: {
	index: number;
	image: RecipeImage;
	sizes: string;
	className: string;
}) {
	return (
		<RecipeImageViewerTrigger index={index} className={className}>
			{/* The button is named for its image, so the image inside it is decorative. */}
			<RecipePhoto pathname={image.pathname} alt="" sizes={sizes} className="aspect-4/3" />
		</RecipeImageViewerTrigger>
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
								<RecipeThumbnail
									index={index + 1}
									image={image}
									sizes={thumbnailPhotoSizes}
									className="w-24 rounded-md"
								/>
							</li>
						))}
					</ul>
				)}
			</div>
		</RecipeImageViewer>
	);
}

// The pages of the recipe as first written, after the notes; each opens the viewer at its page, which
// links to it at full size. Left off the printout like the dish photos.
function RecipeScans({
	recipe: { slug, scans },
	headingLevel,
}: {
	recipe: Pick<PublicRecipeDto, 'slug' | 'scans'>;
	headingLevel: RecipeHeadingLevel;
}) {
	if (scans.length === 0) {
		return null;
	}

	const { section: Section } = recipeHeadingTags[headingLevel];
	const title = 'Original recipe';
	return (
		<div id={recipeScansId(slug)} className="flex flex-col gap-6 print:hidden">
			<Section className={recipeTextStyles.section}>{title}</Section>
			<RecipeImageViewer role="scan" title={title} images={scans}>
				<ul className="grid grid-cols-2 gap-4">
					{scans.map((scan, index) => (
						<li key={scan.pathname}>
							<RecipeThumbnail
								index={index}
								image={scan}
								sizes={scanThumbnailSizes}
								className="w-full rounded-xl"
							/>
						</li>
					))}
				</ul>
			</RecipeImageViewer>
		</div>
	);
}

function RecipeDetail({
	recipe,
	headingLevel,
	titleAction,
	favoriteToggle,
}: {
	recipe: PublicRecipeDto;
	headingLevel: RecipeHeadingLevel;
	// A control beside the title, such as the edit link. Its box is reserved whenever it is passed, so
	// a link that streams in later moves nothing.
	titleAction?: ReactNode;
	// The first of the recipe's actions, as RecipeActions takes it.
	favoriteToggle?: ReactNode;
}) {
	const { title: Title, section: Section } = recipeHeadingTags[headingLevel];
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
				<RecipeActions slug={recipe.slug} title={recipe.title} favoriteToggle={favoriteToggle} />
			</header>
			<RecipePhotos title={recipe.title} images={recipe.images} />
			{recipe.description !== undefined && <RecipeParagraphs text={recipe.description} />}
			<RecipeIngredientsAndSteps
				ingredientSections={recipe.ingredientSections}
				instructionSections={recipe.instructionSections}
				headingLevel={headingLevel}
			/>
			{recipe.notes !== undefined && (
				<div className="flex flex-col gap-6">
					<Section className={recipeTextStyles.section}>Notes</Section>
					<RecipeParagraphs text={recipe.notes} />
				</div>
			)}
			<RecipeScans recipe={recipe} headingLevel={headingLevel} />
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

export { RecipeDetail, RecipeDetailSkeleton, RecipeImportedFrom, RecipeMetaRow };
