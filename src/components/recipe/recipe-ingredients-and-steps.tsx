import { cn } from 'cn';
import { IngredientLineText } from '@/components/recipe/ingredient-line-text';
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
import { formatStepsNote, type RecipeYield } from '@/domain/recipe/recipe-yield';

// A scale other than the recipe's own, as the cooking view prints the recipe at.
export type RecipeListsScale = {
	recipeYield: RecipeYield | undefined;
	factor: number;
};

const stepMarkerClassName = 'marker:font-mono marker:text-sm marker:text-muted-foreground';

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

// The recipe's ingredients and steps, each list under its heading and each section under its own,
// as the recipe is written. Given a scale, as the cooking view's printout is, the ingredients show at
// it and a note says the steps keep the recipe's own amounts.
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
						<p className={recipeTextStyles.supporting}>{formatStepsNote(scale.recipeYield)}</p>
					)}
				</div>
				{instructionSections.map((section, index) => (
					<InstructionSectionList key={index} section={section} headingTag={subsection} />
				))}
			</div>
		</>
	);
}

export { RecipeIngredientsAndSteps, ScaledIngredientLineText };
