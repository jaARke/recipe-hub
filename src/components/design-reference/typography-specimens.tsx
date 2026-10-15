import { cn } from 'cn';
import { Specimen, SpecimenLabel } from '@/components/design-reference/reference-section';
import { sampleRecipeDetail } from '@/components/design-reference/sample-recipe-dtos';
import { TokenValue } from '@/components/design-reference/token-value';
import { RecipeMetaRow } from '@/components/recipe/recipe-detail';
import { recipeTextStyles } from '@/components/recipe/recipe-text-styles';

type FontFamily = {
	utility: string;
	family: string;
	usage: string;
	sampleClassName: string;
	sample: string;
};

type TypeStep = {
	name: string;
	sampleClassName: string;
	tracked: boolean;
};

type HierarchyRole = {
	role: string;
	className: string;
	sample: string;
};

const fontFamilies: readonly FontFamily[] = [
	{
		utility: 'font-heading',
		family: 'Fraunces, soft, weight 600',
		usage: 'Headings and recipe titles.',
		sampleClassName: 'font-heading text-3xl font-semibold',
		sample: 'Weeknight chicken soup',
	},
	{
		utility: 'font-sans',
		family: 'Hanken Grotesk',
		usage: 'Body text, controls, and navigation.',
		sampleClassName: 'font-sans text-lg',
		sample: 'Simmer the broth gently so it stays clear, then add the noodles at the end.',
	},
	{
		utility: 'font-mono',
		family: 'JetBrains Mono',
		usage: 'Times, yields, and other metadata.',
		sampleClassName: 'font-mono text-xs tracking-wide uppercase',
		sample: 'Prep 15 min · Cook 35 min · Serves 6',
	},
];

// Steps from 2xl up are set as the headings that use them are: Fraunces at weight 600.
const typeScale: readonly TypeStep[] = [
	{ name: 'text-xs', sampleClassName: 'text-xs', tracked: false },
	{ name: 'text-sm', sampleClassName: 'text-sm', tracked: false },
	{ name: 'text-base', sampleClassName: 'text-base', tracked: false },
	{ name: 'text-lg', sampleClassName: 'text-lg', tracked: false },
	{ name: 'text-xl', sampleClassName: 'text-xl', tracked: false },
	{ name: 'text-2xl', sampleClassName: 'font-heading text-2xl font-semibold', tracked: true },
	{ name: 'text-3xl', sampleClassName: 'font-heading text-3xl font-semibold', tracked: true },
	{ name: 'text-4xl', sampleClassName: 'font-heading text-4xl font-semibold', tracked: true },
	{ name: 'text-5xl', sampleClassName: 'font-heading text-5xl font-semibold', tracked: true },
];

const hierarchy: readonly HierarchyRole[] = [
	{ role: 'Recipe title', className: recipeTextStyles.title, sample: 'Weeknight chicken soup' },
	{ role: 'Section', className: recipeTextStyles.section, sample: 'Ingredients' },
	{ role: 'Subsection', className: recipeTextStyles.subsection, sample: 'For the broth' },
	{
		role: 'Ingredients and steps',
		className: recipeTextStyles.body,
		sample: '2 quarts chicken stock',
	},
	{
		role: 'Ingredients and steps in cooking mode',
		className: recipeTextStyles.cookingBody,
		sample: '2 quarts chicken stock',
	},
	{
		role: 'Supporting text',
		className: recipeTextStyles.supporting,
		sample: 'From Grandpa Lou',
	},
];

function TypographySpecimens() {
	return (
		<div className="flex flex-col gap-10">
			<Specimen label="Families" frame="bare">
				<ul className="grid gap-4 md:grid-cols-3">
					{fontFamilies.map((font) => (
						<li key={font.utility} className="flex flex-col gap-4 rounded-xl border bg-card p-6">
							<div className="flex flex-col gap-1">
								<span className="font-mono text-xs">{font.utility}</span>
								<SpecimenLabel>{font.family}</SpecimenLabel>
							</div>
							<p className={font.sampleClassName}>{font.sample}</p>
							<p className="mt-auto text-sm text-muted-foreground">{font.usage}</p>
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label="Type scale: size / line height / tracking">
				<ul className="flex flex-col divide-y">
					{typeScale.map((step) => (
						<li
							key={step.name}
							className="flex flex-col gap-2 py-4 first:pt-0 last:pb-0 md:flex-row md:items-baseline md:gap-8"
						>
							<div className="flex shrink-0 flex-col gap-0.5 md:w-56">
								<span className="font-mono text-xs">{step.name}</span>
								<SpecimenLabel className="min-h-4">
									<TokenValue name={`--${step.name}`} /> /{' '}
									<TokenValue name={`--${step.name}--line-height`} />
									{step.tracked && (
										<>
											{' '}
											/ <TokenValue name={`--${step.name}--letter-spacing`} />
										</>
									)}
								</SpecimenLabel>
							</div>
							<p className={cn('min-w-0', step.sampleClassName)}>Buttermilk biscuits</p>
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label="Recipe page hierarchy">
				<ul className="flex flex-col gap-6">
					{hierarchy.map((level) => (
						<li key={level.role} className="flex flex-col gap-1">
							<SpecimenLabel>
								{level.role}: {level.className}
							</SpecimenLabel>
							<p className={level.className}>{level.sample}</p>
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label="Body text at reading width: text-lg, max-w-2xl">
				<p className="max-w-2xl text-lg">{sampleRecipeDetail.notes}</p>
			</Specimen>
			<Specimen label={`Metadata: ${recipeTextStyles.meta}`}>
				<RecipeMetaRow recipe={sampleRecipeDetail} />
			</Specimen>
		</div>
	);
}

export { TypographySpecimens };
