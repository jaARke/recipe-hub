'use client';

import { cn } from 'cn';
import { ingredientCheckKey } from '@/components/cooking/cooking-checks';
import type { CookingRecipe } from '@/components/cooking/cooking-screens';
import type { CookingChecks } from '@/components/cooking/use-cooking-checks';
import type { RecipeScale } from '@/components/cooking/use-cooking-url';
import { ScaledIngredientLineText } from '@/components/recipe/recipe-ingredients-and-steps';
import { RecipeParagraphs } from '@/components/recipe/recipe-paragraphs';
import { Checkbox } from '@/components/ui/checkbox';
import { scaleIngredientLine } from '@/domain/recipe/ingredient-scaling';
import { formatScaledYield } from '@/domain/recipe/recipe-yield';

type CookingHeadingTag = 'h2' | 'h3';

// Large on Gather, read from across the counter, and regular beside a step and in the Ingredients
// dialog. Every row is the checkbox's label and at least 44 px tall, for a finger; its box is as tall
// as the text's first line, so it sits beside it.
const checklistSizes = {
	large: {
		list: 'gap-6',
		heading: 'text-lg',
		row: 'min-h-14 gap-4 py-3 text-xl',
		boxLine: 'h-7',
		box: 'size-6',
	},
	regular: {
		list: 'gap-4',
		heading: 'text-base',
		row: 'min-h-11 gap-3 py-2 text-base',
		boxLine: 'h-6',
		box: 'size-5',
	},
} as const;

const notesSizes = {
	large: 'text-lg',
	regular: 'text-base',
} as const satisfies Record<keyof typeof checklistSizes, string>;

// The recipe's ingredients at the cook's scale to check off, by section; a check follows its line
// wherever the list shows, through a rescale too.
function IngredientChecklist({
	sections,
	factor,
	checks: { checked, setChecked },
	size,
	headingTag: Heading,
}: {
	sections: CookingRecipe['ingredientSections'];
	factor: number;
	checks: CookingChecks;
	size: keyof typeof checklistSizes;
	headingTag: CookingHeadingTag;
}) {
	const sizes = checklistSizes[size];
	return (
		<div className={cn('flex flex-col', sizes.list)}>
			{sections.map((section, sectionIndex) => (
				<div key={sectionIndex} className="flex flex-col">
					{section.heading !== undefined && (
						<Heading className={cn('pb-1 font-semibold', sizes.heading)}>{section.heading}</Heading>
					)}
					<ul role="list" className="flex flex-col">
						{section.lines.map((line, lineIndex) => {
							const row = ingredientCheckKey(sectionIndex, lineIndex);
							const isChecked = checked.has(row);
							return (
								<li key={lineIndex}>
									<label className={cn('flex cursor-pointer items-start border-b', sizes.row)}>
										<span className={cn('flex shrink-0 items-center', sizes.boxLine)}>
											<Checkbox
												checked={isChecked}
												onCheckedChange={(next) => setChecked(row, next)}
												className={sizes.box}
											/>
										</span>
										<span
											className={cn(
												'min-w-0 transition-colors',
												isChecked && 'text-muted-foreground line-through decoration-1'
											)}
										>
											<ScaledIngredientLineText scaled={scaleIngredientLine(line, factor)} />
										</span>
									</label>
								</li>
							);
						})}
					</ul>
				</div>
			))}
		</div>
	);
}

// The recipe's notes, headed "Notes" wherever the ingredients show; on Gather they sit in a panel.
function CookingNotes({
	notes,
	size,
	headingTag: Heading,
}: {
	notes: string;
	size: keyof typeof notesSizes;
	headingTag: CookingHeadingTag;
}) {
	return (
		<section
			className={cn('flex flex-col', size === 'large' ? 'gap-3 rounded-xl bg-muted p-5' : 'gap-2')}
		>
			<Heading className="font-heading text-xl font-semibold">Notes</Heading>
			<RecipeParagraphs text={notes} className={cn('gap-3', notesSizes[size])} />
		</section>
	);
}

// The servings the checklist is scaled to, as text: Gather sets them, so they hold through the cook.
function CookingScaleText({ scale }: { scale: RecipeScale }) {
	return (
		<p className="text-muted-foreground">{formatScaledYield(scale.recipeYield, scale.factor)}</p>
	);
}

export { CookingNotes, CookingScaleText, IngredientChecklist };
