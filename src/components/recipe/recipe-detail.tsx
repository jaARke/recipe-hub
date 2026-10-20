import { cn } from 'cn';
import type { ReactNode } from 'react';
import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { TextLink } from '@/components/layout/text-link';
import { RecipeActions, RecipeActionsSkeleton } from '@/components/recipe/recipe-actions';
import { RecipeFilmstrip } from '@/components/recipe/recipe-filmstrip';
import { RecipeIngredientsAndSteps } from '@/components/recipe/recipe-ingredients-and-steps';
import { RecipeParagraphs } from '@/components/recipe/recipe-paragraphs';
import { RecipeSourceLink } from '@/components/recipe/recipe-source-link';
import { RecipeBadges } from '@/components/recipe/recipe-summary';
import {
	recipeHeadingTags,
	recipeTextStyles,
	type RecipeHeadingLevel,
} from '@/components/recipe/recipe-text-styles';
import { recipeSearchHref, recipesView } from '@/components/search/search-params';
import { Skeleton } from '@/components/ui/skeleton';
import { chapterLabels } from '@/domain/recipe/chapter';
import { dietLabels } from '@/domain/recipe/diet';
import { formatDuration, totalMinutes } from '@/domain/recipe/duration';
import { holidayLabels } from '@/domain/recipe/holiday';
import type { RecipeImage } from '@/domain/recipe/recipe-image';
import { formatYieldCount, yieldVerbs, type RecipeYield } from '@/domain/recipe/recipe-yield';
import { formatDate } from '@/lib/dates';

// A labelled cell in the header's ruled block.
type RecipeCell = {
	label: string;
	value: ReactNode;
	// Sets the cell's span, where it takes more than one column.
	className?: string;
};

// A ruled row of cells, two across on phones and four from sm, so the rows' columns line up.
const cellRowClassName = 'grid grid-cols-2 gap-x-4 gap-y-3 py-3 sm:grid-cols-4';

// Who added the recipe, and its chapter, take two columns from sm, leaving two for the dates or for
// the holidays and diets.
const wideCellClassName = 'sm:col-span-2';

// The description and the notes read as body text.
const recipeParagraphsClassName = cn(recipeTextStyles.body, 'gap-4');

// The yield's verb labels what it counts: "Serves" 8, "Makes" 10 biscuits.
function yieldCell(recipeYield: RecipeYield): RecipeCell {
	return { label: yieldVerbs[recipeYield.kind], value: formatYieldCount(recipeYield) };
}

function recipeFactCells({
	times,
	yield: recipeYield,
}: Pick<PublicRecipeDto, 'times' | 'yield'>): RecipeCell[] {
	const cells: RecipeCell[] = [];
	if (times.prepMinutes !== undefined) {
		cells.push({ label: 'Prep', value: formatDuration(times.prepMinutes) });
	}
	if (times.cookMinutes !== undefined) {
		cells.push({ label: 'Cook', value: formatDuration(times.cookMinutes) });
	}
	const total = totalMinutes(times);
	if (total !== undefined) {
		cells.push({ label: 'Total', value: formatDuration(total) });
	}
	if (recipeYield !== undefined) {
		cells.push(yieldCell(recipeYield));
	}
	return cells;
}

function RecipeDate({ date }: { date: Date }) {
	return <time dateTime={date.toISOString()}>{formatDate(date)}</time>;
}

// Who added the recipe and when, and when it was edited if on a later day, as the site's time zone
// counts them, so a fix made the day a recipe went up shows no edit.
function recipeProvenanceCells({
	contributor,
	createdAt,
	updatedAt,
}: Pick<PublicRecipeDto, 'contributor' | 'createdAt' | 'updatedAt'>): RecipeCell[] {
	const cells: RecipeCell[] = [
		{
			label: 'Added by',
			value: contributor.displayName,
			className: wideCellClassName,
		},
		{ label: 'Added', value: <RecipeDate date={createdAt} /> },
	];
	if (formatDate(updatedAt) !== formatDate(createdAt)) {
		cells.push({ label: 'Edited', value: <RecipeDate date={updatedAt} /> });
	}
	return cells;
}

// Where the recipe sits in the cookbook: its chapter, then any holidays and diets, each a link to
// the Recipes page filtered by it.
function recipeClassificationCells({
	chapter,
	holidays,
	diets,
}: Pick<PublicRecipeDto, 'chapter' | 'holidays' | 'diets'>): RecipeCell[] {
	const cells: RecipeCell[] = [
		{
			label: 'Chapter',
			value: (
				<TextLink href={recipeSearchHref(recipesView(chapter))}>{chapterLabels[chapter]}</TextLink>
			),
			className: wideCellClassName,
		},
	];
	if (holidays.length > 0) {
		const badges = holidays.map((holiday) => ({
			label: holidayLabels[holiday],
			href: recipeSearchHref({ ...recipesView(), holidays: [holiday] }),
		}));
		cells.push({ label: 'Holidays', value: <RecipeBadges badges={badges} /> });
	}
	if (diets.length > 0) {
		const badges = diets.map((diet) => ({
			label: dietLabels[diet],
			href: recipeSearchHref({ ...recipesView(), diets: [diet] }),
		}));
		cells.push({ label: 'Diet', value: <RecipeBadges badges={badges} /> });
	}
	return cells;
}

function RecipeCellRow({
	cells,
	valueClassName,
}: {
	cells: readonly RecipeCell[];
	valueClassName: string;
}) {
	return (
		<dl className={cellRowClassName}>
			{cells.map(({ label, value, className }) => (
				<div key={label} className={cn('flex min-w-0 flex-col gap-0.5', className)}>
					<dt className={recipeTextStyles.cellLabel}>{label}</dt>
					<dd className={cn(valueClassName, 'wrap-break-word')}>{value}</dd>
				</div>
			))}
		</dl>
	);
}

// Ruled like an index card: a row for the times and yield, one for who added the recipe and when,
// and one for where it sits in the cookbook. A row with nothing to show is left out; who added the
// recipe and its chapter always show.
function RecipeRuledBlock({ recipe }: { recipe: PublicRecipeDto }) {
	const facts = recipeFactCells(recipe);
	return (
		<div className="flex flex-col divide-y border-y">
			{facts.length > 0 && (
				<RecipeCellRow cells={facts} valueClassName={recipeTextStyles.factValue} />
			)}
			<RecipeCellRow
				cells={recipeProvenanceCells(recipe)}
				valueClassName={recipeTextStyles.cellValue}
			/>
			<RecipeCellRow
				cells={recipeClassificationCells(recipe)}
				valueClassName={recipeTextStyles.cellValue}
			/>
		</div>
	);
}

// Where the recipe came from: "From Uncle Ray", with the page an import read after a named source,
// "From Grandma’s cookbook (example.com)". A source written as a web address is the page itself, so
// it links once, as an import with no source does.
function RecipeCredit({ source, sourceUrl }: Pick<PublicRecipeDto, 'source' | 'sourceUrl'>) {
	const name = source === sourceUrl ? undefined : source;
	const link = sourceUrl === undefined ? undefined : <RecipeSourceLink url={sourceUrl} />;
	if (name === undefined && link === undefined) {
		return null;
	}

	return (
		<p className={recipeTextStyles.supporting}>
			From {name ?? link}
			{name !== undefined && link !== undefined && <> ({link})</>}
		</p>
	);
}

// "1 page", "2 pages".
function pageCount(count: number): string {
	return count === 1 ? '1 page' : `${count} pages`;
}

// The pages of the recipe as first written, before its ingredients, in a filmstrip as the dish photos
// are; the viewer links each page at full size.
function RecipeScans({
	scans,
	headingLevel,
}: {
	scans: readonly RecipeImage[];
	headingLevel: RecipeHeadingLevel;
}) {
	if (scans.length === 0) {
		return null;
	}

	const { section: Section } = recipeHeadingTags[headingLevel];
	const title = 'Original recipe';
	return (
		<div className="flex flex-col gap-4 print:hidden">
			<div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
				<Section className={recipeTextStyles.section}>{title}</Section>
				<p className="text-muted-foreground">{pageCount(scans.length)}</p>
			</div>
			<RecipeFilmstrip role="scan" title={title} images={scans} />
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
	// The favorite toggle among the recipe's actions, as RecipeActions takes it.
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
			<header className="flex flex-col gap-5">
				<div className="flex flex-col gap-3">
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
					<RecipeCredit source={recipe.source} sourceUrl={recipe.sourceUrl} />
				</div>
				<RecipeRuledBlock recipe={recipe} />
				<RecipeActions slug={recipe.slug} title={recipe.title} favoriteToggle={favoriteToggle} />
			</header>
			<RecipeFilmstrip role="dish" title={recipe.title} images={recipe.images} preload />
			{recipe.description !== undefined && (
				<RecipeParagraphs text={recipe.description} className={recipeParagraphsClassName} />
			)}
			<RecipeScans scans={recipe.scans} headingLevel={headingLevel} />
			<RecipeIngredientsAndSteps
				ingredientSections={recipe.ingredientSections}
				instructionSections={recipe.instructionSections}
				headingLevel={headingLevel}
			/>
			{recipe.notes !== undefined && (
				<div className="flex flex-col gap-6">
					<Section className={recipeTextStyles.section}>Notes</Section>
					<RecipeParagraphs text={recipe.notes} className={recipeParagraphsClassName} />
				</div>
			)}
		</article>
	);
}

// A ruled row's cells while the recipe loads, each a label's line over a value's.
function RecipeCellRowSkeleton({
	cellCount,
	firstCellClassName,
	valueClassName,
}: {
	cellCount: number;
	firstCellClassName?: string;
	// The value's line height.
	valueClassName: string;
}) {
	return (
		<div className={cellRowClassName}>
			{Array.from({ length: cellCount }, (_, index) => (
				<div key={index} className={cn('flex flex-col gap-0.5', index === 0 && firstCellClassName)}>
					<Skeleton className="h-5 w-14" />
					<Skeleton className={cn('w-24', valueClassName)} />
				</div>
			))}
		</div>
	);
}

// The header as most recipes fill it, with every row of the ruled block, so the recipe moves nothing
// when it streams in.
function RecipeDetailSkeleton() {
	return (
		<div role="status" aria-live="polite">
			<span className="sr-only">Loading recipe</span>
			<div aria-hidden="true" className="flex flex-col gap-10">
				<div className="flex flex-col gap-5">
					<div className="flex flex-col gap-3">
						<Skeleton className="h-10 w-3/4 md:h-13" />
						<Skeleton className="h-7 w-1/3" />
					</div>
					<div className="flex flex-col divide-y border-y">
						<RecipeCellRowSkeleton cellCount={4} valueClassName="h-7" />
						<RecipeCellRowSkeleton
							cellCount={3}
							firstCellClassName={wideCellClassName}
							valueClassName="h-6"
						/>
						<RecipeCellRowSkeleton
							cellCount={2}
							firstCellClassName={wideCellClassName}
							valueClassName="h-6"
						/>
					</div>
					<RecipeActionsSkeleton />
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

export { RecipeDetail, RecipeDetailSkeleton };
