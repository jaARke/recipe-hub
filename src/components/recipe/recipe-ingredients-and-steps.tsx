import { cn } from 'cn';
import type * as React from 'react';
import { IngredientLineText } from '@/components/recipe/ingredient-line-text';
import {
	numberInstructionSteps,
	type NumberedInstructionSection,
} from '@/components/recipe/recipe-step-numbers';
import {
	recipeHeadingTags,
	recipeTextStyles,
	type RecipeHeadingLevel,
	type RecipeSubsectionTag,
} from '@/components/recipe/recipe-text-styles';
import { Badge } from '@/components/ui/badge';
import type { IngredientLine, IngredientSection } from '@/domain/recipe/ingredient';
import { scaleIngredientLine } from '@/domain/recipe/ingredient-scaling';
import type { InstructionSection } from '@/domain/recipe/instruction';
import { formatStepsNoteCount, type RecipeYield } from '@/domain/recipe/recipe-yield';

// A scale other than the recipe's own, as the cooking view prints the recipe at.
export type RecipeListsScale = {
	recipeYield: RecipeYield | undefined;
	factor: number;
};

// The ingredients' bullets and the steps' numbers share one muted marker column, and each item's text
// starts the same gap past it, so an ingredient's text lines up with a step's.
const listMarkerClassName = 'marker:font-mono marker:text-sm marker:text-muted-foreground';
const listItemClassName = 'pl-2';

// A marker's characters are monospaced at text-sm, 0.875rem, and JetBrains Mono's are 0.6em wide.
const listMarkerCharacterWidth = '0.525rem';

// Indents every list of ingredients and steps as far as the recipe's last step number needs, with its
// ". ", so "10." sits inside the column as "9." does.
function listIndentStyle(lastNumber: number): React.CSSProperties {
	const characters = String(lastNumber).length + 2;
	return { paddingLeft: `calc(${characters} * ${listMarkerCharacterWidth})` };
}

// An amount the scale left unscaled, underlined in dots, which print and stay apart from a checked
// row's strike-through, and named so to a screen reader.
function unscaledAmount(text: React.ReactNode): React.ReactNode {
	return (
		<>
			<span className="underline decoration-foreground decoration-dotted decoration-2 underline-offset-[0.22em] [text-decoration-skip-ink:none]">
				{text}
			</span>
			<span className="sr-only">{' (not scaled)'}</span>
		</>
	);
}

// An ingredient at a scale. A line the scale left whole though it gives an amount says so, and the
// amounts it left unscaled in a line it scaled are underlined, with a note beneath that a screen reader
// skips, having heard each named; at the recipe's own scale, or with nothing to scale, a line has no
// mark.
function ScaledIngredientLineText({ line, factor }: { line: IngredientLine; factor: number }) {
	const { line: scaled, unscaled } = scaleIngredientLine(line, factor);
	const amounts = unscaled === undefined || unscaled === 'whole' ? [] : unscaled.amounts;
	return (
		<>
			<IngredientLineText
				line={scaled}
				written={line}
				marks={{ spans: amounts, render: unscaledAmount }}
			/>
			{unscaled === 'whole' && (
				<Badge variant="secondary" className="ml-2 align-middle">
					Not scaled
				</Badge>
			)}
			{amounts.length > 0 && (
				<span aria-hidden="true" className="block text-base text-muted-foreground">
					{amounts.length === 1 ? 'Underlined amount not scaled' : 'Underlined amounts not scaled'}
				</span>
			)}
		</>
	);
}

function SectionHeading({ heading, tag: Heading }: { heading?: string; tag: RecipeSubsectionTag }) {
	return heading === undefined ? null : (
		<Heading className={recipeTextStyles.subsection}>{heading}</Heading>
	);
}

// A bullet marks each line, so one that wraps reads as one ingredient rather than two.
function IngredientSectionList({
	section,
	factor,
	headingTag,
	indentStyle,
}: {
	section: IngredientSection;
	factor: number;
	headingTag: RecipeSubsectionTag;
	indentStyle: React.CSSProperties;
}) {
	return (
		<div className="flex flex-col gap-3 print:break-inside-avoid">
			<SectionHeading heading={section.heading} tag={headingTag} />
			<ul
				role="list"
				style={indentStyle}
				className={cn(recipeTextStyles.body, 'list-disc space-y-2', listMarkerClassName)}
			>
				{section.lines.map((line, index) => (
					<li key={index} className={listItemClassName}>
						<ScaledIngredientLineText line={line} factor={factor} />
					</li>
				))}
			</ul>
		</div>
	);
}

// The note a scaled recipe's steps carry, since they keep the recipe's own amounts, with what they are
// for in bold: "Amounts in the steps are for the original 6 servings."
function StepsNote({
	recipeYield,
	className,
}: {
	recipeYield: RecipeYield | undefined;
	className: string;
}) {
	return (
		<p className={className}>
			Amounts in the steps are for the original{' '}
			<strong className="font-semibold text-foreground">{formatStepsNoteCount(recipeYield)}</strong>
			.
		</p>
	);
}

// A list of its own under its heading that starts at its first step's number, so a screen reader
// counts the steps as the page shows them.
function InstructionSectionList({
	section,
	headingTag,
	indentStyle,
}: {
	section: NumberedInstructionSection;
	headingTag: RecipeSubsectionTag;
	indentStyle: React.CSSProperties;
}) {
	return (
		<div className="flex flex-col gap-3">
			<SectionHeading heading={section.heading} tag={headingTag} />
			<ol
				role="list"
				start={section.steps[0]?.number}
				style={indentStyle}
				className={cn(recipeTextStyles.body, 'list-decimal space-y-4', listMarkerClassName)}
			>
				{section.steps.map((step) => (
					<li key={step.number} className={cn(listItemClassName, 'print:break-inside-avoid')}>
						{step.text}
					</li>
				))}
			</ol>
		</div>
	);
}

// The recipe's ingredients and steps, each list under its heading and each section under its own,
// as the recipe is written, with the steps counted straight through the sections. Given a scale, as
// the cooking view's printout is, the ingredients show at it and a note says the steps keep the
// recipe's own amounts.
function RecipeIngredientsAndSteps({
	ingredientSections,
	instructionSections,
	headingLevel,
	scale,
}: {
	ingredientSections: readonly IngredientSection[];
	instructionSections: readonly InstructionSection[];
	headingLevel: RecipeHeadingLevel;
	scale?: RecipeListsScale;
}) {
	const { section: Section, subsection } = recipeHeadingTags[headingLevel];
	const factor = scale?.factor ?? 1;
	const numberedSections = numberInstructionSteps(instructionSections);
	const indentStyle = listIndentStyle(numberedSections.at(-1)?.steps.at(-1)?.number ?? 0);

	return (
		<>
			<div className="flex flex-col gap-6">
				<Section className={recipeTextStyles.section}>Ingredients</Section>
				{ingredientSections.map((section, index) => (
					<IngredientSectionList
						key={index}
						section={section}
						factor={factor}
						headingTag={subsection}
						indentStyle={indentStyle}
					/>
				))}
			</div>
			<div className="flex flex-col gap-6">
				<div className="flex flex-col gap-3">
					<Section className={recipeTextStyles.section}>Steps</Section>
					{scale !== undefined && factor !== 1 && (
						<StepsNote recipeYield={scale.recipeYield} className={recipeTextStyles.supporting} />
					)}
				</div>
				{numberedSections.map((section, index) => (
					<InstructionSectionList
						key={index}
						section={section}
						headingTag={subsection}
						indentStyle={indentStyle}
					/>
				))}
			</div>
		</>
	);
}

export { RecipeIngredientsAndSteps, ScaledIngredientLineText, StepsNote };
