'use client';

import { cn } from 'cn';
import { useMemo, type ReactNode } from 'react';
import { CookingModeControls } from '@/components/cooking/cooking-mode-controls';
import { useCookingMode, type CookingMode } from '@/components/cooking/cooking-mode-provider';
import {
	ingredientRowKey,
	stepRowKey,
	type CookingRowKey,
} from '@/components/cooking/cooking-progress';
import { IngredientLineText } from '@/components/recipe/ingredient-line-text';
import { RecipeScaleControls } from '@/components/recipe/recipe-scale-controls';
import { useRecipeScale } from '@/components/recipe/recipe-scale-provider';
import {
	recipeHeadingTags,
	recipeTextStyles,
	type RecipeHeadingLevel,
	type RecipeSubsectionTag,
} from '@/components/recipe/recipe-text-styles';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import type { IngredientSection } from '@/domain/recipe/ingredient';
import { scaleIngredientLine, type ScaledIngredientLine } from '@/domain/recipe/ingredient-scaling';
import type { InstructionSection } from '@/domain/recipe/instruction';
import { formatStepsNote } from '@/domain/recipe/recipe-yield';

// A section of ingredients at the recipe's scale.
type ScaledIngredientSection = Omit<IngredientSection, 'lines'> & {
	lines: readonly ScaledIngredientLine[];
};

const stepMarkerClassName = 'marker:font-mono marker:text-sm marker:text-muted-foreground';

function scaleSections(
	sections: readonly IngredientSection[],
	factor: number
): ScaledIngredientSection[] {
	return sections.map((section) => ({
		...section,
		lines: section.lines.map((line) => scaleIngredientLine(line, factor)),
	}));
}

// An ingredient at the recipe's scale. A line the scale left whole though it gives an amount says
// so, and one it scaled only in part shows the line as written beneath; at the recipe's own scale,
// or with nothing to scale, a line has no mark.
function ScaledIngredientLineText({
	scaled: { line, unscaled },
}: {
	scaled: ScaledIngredientLine;
}) {
	return (
		<>
			<IngredientLineText line={line} />
			{unscaled === 'whole' && (
				<Badge variant="secondary" className="ml-2 align-middle">
					Not scaled
				</Badge>
			)}
			{unscaled === 'part' && (
				<span className="block text-base text-muted-foreground">As written: {line.text}</span>
			)}
		</>
	);
}

// A row to check off: the whole row is the label, at least 44 px tall for a finger. A checked row
// fades, and the current step is marked with a tint.
function CookingRow({
	row,
	cookingMode: { progress, setChecked },
	current = false,
	children,
}: {
	row: CookingRowKey;
	cookingMode: CookingMode;
	current?: boolean;
	children: ReactNode;
}) {
	const checked = progress.checked.has(row);
	return (
		<label
			className={cn(
				'-mx-2 flex min-h-11 items-start gap-3 rounded-lg px-2 py-2',
				current && 'bg-muted',
				checked && 'text-muted-foreground'
			)}
		>
			{/* As tall as the text's first line, so the box sits beside it. */}
			<span className="flex h-7 shrink-0 items-center">
				<Checkbox
					checked={checked}
					onCheckedChange={(next) => setChecked(row, next)}
					className="size-5"
				/>
			</span>
			<span className="min-w-0">{children}</span>
		</label>
	);
}

function SectionHeading({ heading, tag: Heading }: { heading?: string; tag: RecipeSubsectionTag }) {
	return heading === undefined ? null : (
		<Heading className={recipeTextStyles.subsection}>{heading}</Heading>
	);
}

function IngredientSectionList({
	section,
	headingTag,
}: {
	section: ScaledIngredientSection;
	headingTag: RecipeSubsectionTag;
}) {
	return (
		<div className="flex flex-col gap-3 print:break-inside-avoid">
			<SectionHeading heading={section.heading} tag={headingTag} />
			<ul className={cn(recipeTextStyles.body, 'flex flex-col gap-2')}>
				{section.lines.map((scaled, index) => (
					<li key={index}>
						<ScaledIngredientLineText scaled={scaled} />
					</li>
				))}
			</ul>
		</div>
	);
}

function CookingIngredientSectionList({
	section,
	sectionIndex,
	headingTag,
	cookingMode,
}: {
	section: ScaledIngredientSection;
	sectionIndex: number;
	headingTag: RecipeSubsectionTag;
	cookingMode: CookingMode;
}) {
	return (
		<div className="flex flex-col gap-3">
			<SectionHeading heading={section.heading} tag={headingTag} />
			<ul className={cn(recipeTextStyles.cookingBody, 'flex flex-col')}>
				{section.lines.map((scaled, index) => (
					<li key={index}>
						<CookingRow row={ingredientRowKey(sectionIndex, index)} cookingMode={cookingMode}>
							<ScaledIngredientLineText scaled={scaled} />
						</CookingRow>
					</li>
				))}
			</ul>
		</div>
	);
}

function InstructionSectionList({
	section,
	headingTag,
}: {
	section: InstructionSection;
	headingTag: RecipeSubsectionTag;
}) {
	return (
		<div className="flex flex-col gap-3">
			<SectionHeading heading={section.heading} tag={headingTag} />
			<ol className={cn(recipeTextStyles.body, 'list-decimal space-y-4 pl-6', stepMarkerClassName)}>
				{section.steps.map((step, index) => (
					<li key={index} className="pl-2 print:break-inside-avoid">
						{step.text}
					</li>
				))}
			</ol>
		</div>
	);
}

function CookingInstructionSectionList({
	section,
	sectionIndex,
	headingTag,
	currentStep,
	cookingMode,
}: {
	section: InstructionSection;
	sectionIndex: number;
	headingTag: RecipeSubsectionTag;
	currentStep: CookingRowKey | undefined;
	cookingMode: CookingMode;
}) {
	return (
		<div className="flex flex-col gap-3">
			<SectionHeading heading={section.heading} tag={headingTag} />
			<ol
				className={cn(
					recipeTextStyles.cookingBody,
					'list-decimal space-y-2 pl-6',
					stepMarkerClassName
				)}
			>
				{section.steps.map((step, index) => {
					const row = stepRowKey(sectionIndex, index);
					const current = row === currentStep;
					return (
						<li key={index} aria-current={current ? 'step' : undefined} className="pl-2">
							<CookingRow row={row} cookingMode={cookingMode} current={current}>
								{step.text}
							</CookingRow>
						</li>
					);
				})}
			</ol>
		</div>
	);
}

// The step to do next: the first one not yet checked.
function firstUncheckedStep(
	sections: readonly InstructionSection[],
	checked: ReadonlySet<CookingRowKey>
): CookingRowKey | undefined {
	for (const [sectionIndex, section] of sections.entries()) {
		for (const index of section.steps.keys()) {
			const row = stepRowKey(sectionIndex, index);
			if (!checked.has(row)) {
				return row;
			}
		}
	}
	return undefined;
}

// A list in cooking mode on screen, and the plain list beneath it for the printout, which is the
// recipe as it reads without cooking mode.
function ScreenAndPrint({ screen, print }: { screen: ReactNode; print: ReactNode }) {
	return (
		<>
			<div className="contents print:hidden">{screen}</div>
			<div className="hidden print:contents">{print}</div>
		</>
	);
}

// The recipe's ingredients and steps, each list under its heading and each section under its own.
// On a recipe page, inside a CookingModeProvider, a switch at the Ingredients heading turns on
// cooking mode, whose rows are keyed by section and index, so a rescale keeps them; inside a
// RecipeScaleProvider, the stepper below it scales the ingredients, and a note says the steps keep
// the recipe's own amounts. Elsewhere the lists render plain, at the recipe's own scale.
function RecipeIngredientsAndSteps({
	ingredientSections,
	instructionSections,
	headingLevel,
}: {
	ingredientSections: readonly IngredientSection[];
	instructionSections: readonly InstructionSection[];
	headingLevel: RecipeHeadingLevel;
}) {
	const { section: Section, subsection } = recipeHeadingTags[headingLevel];
	const cookingMode = useCookingMode();
	const cooking = cookingMode?.progress.on === true ? cookingMode : null;
	const scale = useRecipeScale();
	const factor = scale?.factor ?? 1;
	const scaledSections = useMemo(
		() => scaleSections(ingredientSections, factor),
		[ingredientSections, factor]
	);

	const ingredients = scaledSections.map((section, index) => (
		<IngredientSectionList key={index} section={section} headingTag={subsection} />
	));
	const steps = instructionSections.map((section, index) => (
		<InstructionSectionList key={index} section={section} headingTag={subsection} />
	));
	const currentStep =
		cooking === null
			? undefined
			: firstUncheckedStep(instructionSections, cooking.progress.checked);

	return (
		<>
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-3">
					<Section className={recipeTextStyles.section}>Ingredients</Section>
					{cookingMode !== null && <CookingModeControls cookingMode={cookingMode} />}
					{scale !== null && <RecipeScaleControls scale={scale} cooking={cooking !== null} />}
				</div>
				{cooking === null ? (
					ingredients
				) : (
					<ScreenAndPrint
						screen={scaledSections.map((section, index) => (
							<CookingIngredientSectionList
								key={index}
								section={section}
								sectionIndex={index}
								headingTag={subsection}
								cookingMode={cooking}
							/>
						))}
						print={ingredients}
					/>
				)}
			</div>
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-3">
					<Section className={recipeTextStyles.section}>Steps</Section>
					{scale !== null && factor !== 1 && (
						<p className={recipeTextStyles.supporting}>{formatStepsNote(scale.recipeYield)}</p>
					)}
				</div>
				{cooking === null ? (
					steps
				) : (
					<ScreenAndPrint
						screen={instructionSections.map((section, index) => (
							<CookingInstructionSectionList
								key={index}
								section={section}
								sectionIndex={index}
								headingTag={subsection}
								currentStep={currentStep}
								cookingMode={cooking}
							/>
						))}
						print={steps}
					/>
				)}
			</div>
		</>
	);
}

export { RecipeIngredientsAndSteps };
