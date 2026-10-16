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
import type { IngredientSection } from '@/domain/recipe/ingredient';
import { scaleIngredientLine, type ScaledIngredientLine } from '@/domain/recipe/ingredient-scaling';
import type { InstructionSection } from '@/domain/recipe/instruction';
import { formatStepsNoteCount, type RecipeYield } from '@/domain/recipe/recipe-yield';

// A scale other than the recipe's own, as the cooking view prints the recipe at.
export type RecipeListsScale = {
	recipeYield: RecipeYield | undefined;
	factor: number;
};

const stepMarkerClassName = 'marker:font-mono marker:text-sm marker:text-muted-foreground';

// A marker's characters are monospaced at text-sm, 0.875rem, and JetBrains Mono's are 0.6em wide.
const stepMarkerCharacterWidth = '0.525rem';

// Indents every list of steps as far as the recipe's last number needs, with its ". ", so "10." sits
// inside the column as "9." does.
function stepListIndentStyle(lastNumber: number): React.CSSProperties {
	const characters = String(lastNumber).length + 2;
	return { paddingLeft: `calc(${characters} * ${stepMarkerCharacterWidth})` };
}

// An ingredient at a scale. A line the scale left whole though it gives an amount says so, and one it
// scaled only in part shows the line as written beneath; at the recipe's own scale, or with nothing
// to scale, a line has no mark.
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

function SectionHeading({ heading, tag: Heading }: { heading?: string; tag: RecipeSubsectionTag }) {
	return heading === undefined ? null : (
		<Heading className={recipeTextStyles.subsection}>{heading}</Heading>
	);
}

function IngredientSectionList({
	section,
	factor,
	headingTag,
}: {
	section: IngredientSection;
	factor: number;
	headingTag: RecipeSubsectionTag;
}) {
	return (
		<div className="flex flex-col gap-3 print:break-inside-avoid">
			<SectionHeading heading={section.heading} tag={headingTag} />
			<ul className={cn(recipeTextStyles.body, 'flex flex-col gap-2')}>
				{section.lines.map((line, index) => (
					<li key={index}>
						<ScaledIngredientLineText scaled={scaleIngredientLine(line, factor)} />
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
				start={section.steps[0]?.number}
				style={indentStyle}
				className={cn(recipeTextStyles.body, 'list-decimal space-y-4', stepMarkerClassName)}
			>
				{section.steps.map((step) => (
					<li key={step.number} className="pl-2 print:break-inside-avoid">
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
	const indentStyle = stepListIndentStyle(numberedSections.at(-1)?.steps.at(-1)?.number ?? 0);

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
