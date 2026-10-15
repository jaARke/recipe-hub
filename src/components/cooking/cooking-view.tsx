'use client';

import { cn } from 'cn';
import { XIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { Mascot } from '@/components/brand/mascot';
import { countCheckedLines } from '@/components/cooking/cooking-checks';
import { IngredientsDialog, StepsDialog } from '@/components/cooking/cooking-dialogs';
import { CookingNotes, IngredientChecklist } from '@/components/cooking/cooking-ingredients';
import { CookingPrintout } from '@/components/cooking/cooking-printout';
import {
	cookingGatherHeading,
	cookingNextLabel,
	cookingResumedText,
	cookingScreens,
	cookingStepHeading,
	gatherTitle,
	startsCookingGroup,
	type CookingRecipe,
	type CookingScreen,
	type CookingStepScreen,
} from '@/components/cooking/cooking-screens';
import { RecipeScaleStepper } from '@/components/cooking/recipe-scale-stepper';
import { useCookingChecks, type CookingChecks } from '@/components/cooking/use-cooking-checks';
import {
	useCookingScreenIndex,
	useRecipeScale,
	type RecipeScale,
} from '@/components/cooking/use-cooking-url';
import { useScreenWakeLock } from '@/components/cooking/use-screen-wake-lock';
import { useHydrated } from '@/components/forms/use-hydrated';
import { MainContent } from '@/components/layout/main-content';
import { StepsNote } from '@/components/recipe/recipe-ingredients-and-steps';
import { recipePath } from '@/components/recipe/recipe-paths';
import { Button, buttonVariants } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { givesAmount } from '@/domain/recipe/ingredient-scaling';

type HeadingRef = React.RefObject<HTMLHeadingElement | null>;

// On phones a step longer than this takes a smaller numeral, leaving its text more of the screen.
const longStepLength = 220;

// A step's text, and Gather's, read from across the counter.
const stepTextClassName =
	'max-w-[36ch] text-[1.625rem] leading-[1.4] text-pretty sm:text-3xl sm:leading-[1.35]';

// A swipe moves when it travels this far across, and more across than down by this ratio.
const swipeDistance = 60;
const swipeSlope = 1.5;

const arrowMoves: Partial<Record<string, 1 | -1>> = { ArrowLeft: -1, ArrowRight: 1 };

// Where an arrow key belongs to what has focus, or to an open dialog, rather than to the view.
const keyOwnerSelector =
	'input, textarea, select, button, a, [contenteditable], [role="checkbox"], [role="dialog"]';

// Each screen's heading takes focus after a move, so a screen reader reads the new screen from its
// start; it shows no ring, since the move is what the cook asked for.
function ScreenHeading({ heading, children }: { heading: HeadingRef; children: React.ReactNode }) {
	return (
		<h1
			ref={heading}
			tabIndex={-1}
			className="font-heading text-3xl font-semibold wrap-anywhere outline-none sm:text-4xl"
		>
			{children}
		</h1>
	);
}

// A step's number large in the heading face over a highlighter's swash, then how many steps there
// are; Gather shows 0, the step before the recipe's first.
function StepNumeral({
	number,
	stepCount,
	small,
}: {
	number: number;
	stepCount: number;
	small: boolean;
}) {
	return (
		<span className="flex items-end gap-3">
			<span
				// Each size carries the tight leading, which cn would otherwise drop for the size after it.
				className={cn(
					'relative isolate font-heading font-semibold sm:text-[8.5rem]/[0.78]',
					small ? 'text-[4.5rem]/[0.78]' : 'text-[6.5rem]/[0.78]'
				)}
			>
				<span
					aria-hidden="true"
					className="absolute -inset-x-2 bottom-[0.06em] -z-10 h-[0.36em] -rotate-2 rounded-[3px] bg-highlight"
				/>
				{number}
			</span>
			<span className="pb-0.5 text-xl text-muted-foreground">of {stepCount}</span>
		</span>
	);
}

// Step 0, laid out as a step is: the numeral, then what to do, then the checklist to do it with.
function GatherScreen({
	recipe,
	stepCount,
	scale,
	checks,
	heading,
}: {
	recipe: CookingRecipe;
	stepCount: number;
	scale: RecipeScale;
	checks: CookingChecks;
	heading: HeadingRef;
}) {
	const gathered = countCheckedLines(recipe.ingredientSections, checks.checked);
	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-3">
				<h1
					ref={heading}
					tabIndex={-1}
					aria-label={cookingGatherHeading(stepCount)}
					className="flex flex-col gap-7 outline-none"
				>
					<StepNumeral number={0} stepCount={stepCount} small={false} />
					<span className={stepTextClassName}>{gatherTitle}</span>
				</h1>
				<p className="text-lg text-muted-foreground">
					{gathered.checked} of {gathered.total} gathered
				</p>
			</div>
			<div className="rounded-xl border bg-card p-4">
				<RecipeScaleStepper scale={scale} />
			</div>
			<IngredientChecklist
				sections={recipe.ingredientSections}
				factor={scale.factor}
				checks={checks}
				size="large"
				headingTag="h2"
			/>
			{recipe.notes !== undefined && (
				<CookingNotes notes={recipe.notes} size="large" headingTag="h2" />
			)}
		</div>
	);
}

// The step's number large in the heading face over a highlighter's swash; with its section, it is
// the screen's heading, read as "For the gravy, step 9 of 10".
function StepScreen({
	step,
	stepCount,
	scale,
	heading,
}: {
	step: CookingStepScreen;
	stepCount: number;
	scale: RecipeScale;
	heading: HeadingRef;
}) {
	return (
		<div className="flex flex-col gap-7">
			<h1
				ref={heading}
				tabIndex={-1}
				aria-label={cookingStepHeading(step, stepCount)}
				className="flex flex-col gap-3 outline-none"
			>
				{step.sectionHeading !== undefined && (
					<span className="text-lg font-semibold text-muted-foreground">{step.sectionHeading}</span>
				)}
				<StepNumeral
					number={step.number}
					stepCount={stepCount}
					small={step.text.length > longStepLength}
				/>
			</h1>
			<p className={cn(stepTextClassName, 'whitespace-pre-line')}>{step.text}</p>
			{/* Only where the step's text gives an amount, which the recipe's scale leaves as written. */}
			{scale.factor !== 1 && givesAmount(step.text) && (
				<StepsNote recipeYield={scale.recipeYield} className="text-base text-muted-foreground" />
			)}
		</div>
	);
}

function FinishScreen({ title, heading }: { title: string; heading: HeadingRef }) {
	return (
		<div className="flex flex-col items-start gap-6">
			<Mascot size="xl" />
			<ScreenHeading heading={heading}>Enjoy your {title}</ScreenHeading>
			<p className="text-lg text-muted-foreground">That was the last step.</p>
		</div>
	);
}

// The checklist and notes beside a step from lg, in view as the step scrolls. It follows the step in
// the page's order, so the step's heading leads the main content.
function IngredientsColumn({
	recipe,
	scale,
	checks,
}: {
	recipe: CookingRecipe;
	scale: RecipeScale;
	checks: CookingChecks;
}) {
	const headingId = React.useId();
	return (
		<aside aria-labelledby={headingId} className="max-lg:hidden lg:col-start-1 lg:row-start-1">
			<div className="sticky top-0 flex flex-col gap-4">
				<h2 id={headingId} className="font-heading text-xl font-semibold">
					Ingredients
				</h2>
				{/* The servings stay at hand from lg, where the Ingredients dialog that holds them hides. */}
				<RecipeScaleStepper scale={scale} />
				<IngredientChecklist
					sections={recipe.ingredientSections}
					factor={scale.factor}
					checks={checks}
					size="regular"
					headingTag="h3"
				/>
				{recipe.notes !== undefined && (
					<CookingNotes notes={recipe.notes} size="regular" headingTag="h2" />
				)}
			</div>
		</aside>
	);
}

// A segment per screen but the finish, filled up to the one shown, with a gap before each group so
// the rail draws the recipe's shape. Screen readers have each screen's heading instead.
function ProgressRail({ screens, index }: { screens: readonly CookingScreen[]; index: number }) {
	return (
		<div aria-hidden="true" className="flex gap-1 overflow-hidden px-4 sm:px-6">
			{screens.slice(0, -1).map((_, position) => (
				<span
					key={position}
					className={cn(
						'h-2 min-w-0 flex-1 rounded-full border',
						startsCookingGroup(screens, position) && 'ml-2',
						position < index && 'border-foreground/70 bg-foreground/70',
						position === index && 'border-foreground bg-highlight',
						position > index && 'border-border bg-muted'
					)}
				/>
			))}
		</div>
	);
}

// A horizontal swipe across the screen, by touch or pen, as an extra to Back and Next.
function useSwipe(onSwipe: (direction: 1 | -1) => void) {
	const start = React.useRef<{ x: number; y: number } | null>(null);
	return {
		onPointerDown: (event: React.PointerEvent) => {
			start.current = event.pointerType === 'mouse' ? null : { x: event.clientX, y: event.clientY };
		},
		onPointerCancel: () => {
			start.current = null;
		},
		onPointerUp: (event: React.PointerEvent) => {
			const from = start.current;
			start.current = null;
			if (from === null) {
				return;
			}
			const across = event.clientX - from.x;
			const down = event.clientY - from.y;
			if (Math.abs(across) >= swipeDistance && Math.abs(across) > Math.abs(down) * swipeSlope) {
				onSwipe(across < 0 ? 1 : -1);
			}
		},
	};
}

function CookingSession({ recipe }: { recipe: CookingRecipe }) {
	const screens = React.useMemo(
		() => cookingScreens(recipe.instructionSections),
		[recipe.instructionSections]
	);
	const [index, setIndex] = useCookingScreenIndex(screens.length);
	const scale = useRecipeScale(recipe.yield);
	const checks = useCookingChecks(recipe);
	// Said when the view opens past Gather, as on a reload mid-cook, until the cook moves.
	const [resumedText, setResumedText] = React.useState(() => cookingResumedText(screens[index]));
	const [ingredientsOpen, setIngredientsOpen] = React.useState(false);
	const [stepsOpen, setStepsOpen] = React.useState(false);
	const scroller = React.useRef<HTMLDivElement>(null);
	const heading = React.useRef<HTMLHeadingElement>(null);
	useScreenWakeLock(true);

	const screen = screens[index] ?? screens[0]!;
	const stepCount = screens.length - 2;
	const showsColumn = screen.kind === 'step';
	const dialogOpen = ingredientsOpen || stepsOpen;
	const recipeHref = recipePath(recipe.slug);
	const nextLabel = cookingNextLabel(screens, index);

	// Shows the screen from its top, its heading focused unless a dialog closing hands focus to it.
	const moveTo = React.useCallback(
		(next: number, { focus = true }: { focus?: boolean } = {}) => {
			if (next < 0 || next >= screens.length) {
				return;
			}
			flushSync(() => {
				setResumedText(undefined);
				setIndex(next);
			});
			scroller.current?.scrollTo({ top: 0 });
			if (focus) {
				heading.current?.focus({ preventScroll: true });
			}
		},
		[screens.length, setIndex]
	);

	function startOver(options?: { focus?: boolean }) {
		checks.clear();
		moveTo(0, options);
	}

	const swipe = useSwipe((direction) => moveTo(index + direction));

	React.useEffect(() => {
		function onKeyDown(event: KeyboardEvent) {
			const direction = arrowMoves[event.key];
			if (
				direction === undefined ||
				dialogOpen ||
				event.defaultPrevented ||
				event.repeat ||
				event.altKey ||
				event.ctrlKey ||
				event.metaKey ||
				event.shiftKey ||
				(event.target instanceof Element && event.target.closest(keyOwnerSelector) !== null)
			) {
				return;
			}
			event.preventDefault();
			moveTo(index + direction);
		}
		window.addEventListener('keydown', onKeyDown);
		return () => window.removeEventListener('keydown', onKeyDown);
	}, [dialogOpen, index, moveTo]);

	return (
		<>
			<div className="fixed inset-0 flex flex-col bg-background print:hidden">
				<header className="flex flex-col gap-3 py-3">
					<div className="flex items-center gap-1 px-2 sm:px-4">
						<Link
							href={recipeHref}
							aria-label="Close cooking view"
							className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), 'size-11')}
						>
							<XIcon className="size-5" aria-hidden="true" />
						</Link>
						<p className="min-w-0 flex-1 truncate pl-1 font-heading text-lg font-semibold">
							{recipe.title}
						</p>
						{/* Wherever the ingredients aren't already on screen: Gather is their checklist, and from lg
						a step shows them in a column. */}
						{screen.kind !== 'gather' && (
							<IngredientsDialog
								open={ingredientsOpen}
								onOpenChange={setIngredientsOpen}
								recipe={recipe}
								scale={scale}
								checks={checks}
								triggerClassName={showsColumn ? 'lg:hidden' : undefined}
							/>
						)}
						<StepsDialog
							open={stepsOpen}
							onOpenChange={setStepsOpen}
							screens={screens}
							index={index}
							heading={heading}
							onPick={(position) => moveTo(position, { focus: false })}
							onStartOver={() => startOver({ focus: false })}
						/>
					</div>
					<ProgressRail screens={screens} index={index} />
					{resumedText !== undefined && (
						<div className="mx-4 flex flex-wrap items-center justify-between gap-x-4 gap-y-2 rounded-lg bg-accent px-4 py-2 sm:mx-6">
							<p>{resumedText}</p>
							<Button variant="outline" className="h-11 px-4" onClick={() => startOver()}>
								Start over
							</Button>
						</div>
					)}
				</header>
				{/* Vertical scrolling and zoom stay the browser's, so a sideways swipe reaches the view. */}
				<div
					ref={scroller}
					{...swipe}
					className="min-h-0 flex-1 touch-pan-y touch-pinch-zoom overflow-y-auto"
				>
					<MainContent>
						<div
							className={cn(
								'mx-auto w-full max-w-2xl px-5 pt-6 pb-10 sm:px-8 sm:pt-10',
								showsColumn && 'lg:grid lg:max-w-6xl lg:grid-cols-[20rem_1fr] lg:gap-16'
							)}
						>
							<div className={cn(showsColumn && 'lg:col-start-2 lg:row-start-1')}>
								{screen.kind === 'gather' && (
									<GatherScreen
										recipe={recipe}
										stepCount={stepCount}
										scale={scale}
										checks={checks}
										heading={heading}
									/>
								)}
								{screen.kind === 'step' && (
									<StepScreen step={screen} stepCount={stepCount} scale={scale} heading={heading} />
								)}
								{screen.kind === 'finish' && (
									<FinishScreen title={recipe.title} heading={heading} />
								)}
							</div>
							{showsColumn && <IngredientsColumn recipe={recipe} scale={scale} checks={checks} />}
						</div>
					</MainContent>
				</div>
				<div className="border-t bg-background px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6">
					<div className="mx-auto flex w-full max-w-2xl gap-3">
						{index > 0 && nextLabel !== undefined && (
							<Button
								variant="outline"
								className="h-14 flex-1 text-base"
								onClick={() => moveTo(index - 1)}
							>
								Back
							</Button>
						)}
						{nextLabel === undefined ? (
							<Link href={recipeHref} className={cn(buttonVariants(), 'h-14 flex-1 text-base')}>
								Back to the recipe
							</Link>
						) : (
							<Button className="h-14 flex-[2] text-base" onClick={() => moveTo(index + 1)}>
								{nextLabel}
							</Button>
						)}
					</div>
				</div>
			</div>
			<CookingPrintout recipe={recipe} scale={scale} />
		</>
	);
}

// The view's frame while the recipe or the browser's place in it loads.
function CookingViewSkeleton() {
	return (
		<div className="fixed inset-0 flex flex-col bg-background">
			<div aria-hidden="true" className="flex flex-col gap-3 py-3">
				<div className="flex h-11 items-center gap-3 px-4 sm:px-6">
					<Skeleton className="size-6" />
					<Skeleton className="h-6 w-48" />
				</div>
				<Skeleton className="mx-4 h-2 sm:mx-6" />
			</div>
			<div className="min-h-0 flex-1 overflow-hidden">
				<MainContent>
					<div
						role="status"
						aria-live="polite"
						className="mx-auto w-full max-w-2xl px-5 pt-6 sm:px-8 sm:pt-10"
					>
						<span className="sr-only">Loading recipe</span>
						<div aria-hidden="true" className="flex flex-col gap-6">
							<Skeleton className="h-10 w-3/4" />
							<Skeleton className="h-20 rounded-xl" />
							<div className="flex flex-col gap-3">
								<Skeleton className="h-11 w-2/3" />
								<Skeleton className="h-11 w-1/2" />
								<Skeleton className="h-11 w-3/5" />
								<Skeleton className="h-11 w-1/2" />
							</div>
						</div>
					</div>
				</MainContent>
			</div>
		</div>
	);
}

// The full-screen cooking view: Gather your ingredients, then a step a screen with Back and Next,
// then the finish. The screen and the scale are the URL's and the checks the tab's, which only the
// browser knows, so the server's render and hydration show the skeleton and the view renders once
// the page has hydrated; a page reloaded mid-cook never flashes the first screen. The screen stays
// awake while the view shows.
function CookingView({ recipe }: { recipe: CookingRecipe }) {
	return useHydrated() ? <CookingSession recipe={recipe} /> : <CookingViewSkeleton />;
}

export { CookingView, CookingViewSkeleton };
