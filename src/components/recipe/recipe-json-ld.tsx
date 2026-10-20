import type { HowToSection, HowToStep, Recipe, RestrictedDiet, WithContext } from 'schema-dts';
import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { recipeImageSrc, recipePath } from '@/components/recipe/recipe-paths';
import { chapterRecipeCategories } from '@/domain/recipe/chapter';
import { dietLabels, dietSchemaOrgNames, type Diet } from '@/domain/recipe/diet';
import { toIsoDuration, totalMinutes } from '@/domain/recipe/duration';
import { holidayLabels } from '@/domain/recipe/holiday';
import type { InstructionSection } from '@/domain/recipe/instruction';
import { formatYield, type RecipeYield } from '@/domain/recipe/recipe-yield';

type RecipeJsonLdProps = {
	recipe: PublicRecipeDto;
	siteUrl: URL;
};

function absoluteUrl(path: string, siteUrl: URL): string {
	return new URL(path, siteUrl).href;
}

function toHowToSteps(section: InstructionSection): HowToStep[] {
	return section.steps.map((step) => ({ '@type': 'HowToStep', text: step.text }));
}

// Google asks for servings as just a number. A range of servings is not one, so it keeps the page's
// wording, as a "makes" yield does.
function toRecipeYield(recipeYield: RecipeYield): string {
	return recipeYield.kind === 'servings' && recipeYield.amount.max === undefined
		? String(recipeYield.amount.min)
		: formatYield(recipeYield);
}

// Google asks for plain steps, adding sections only where the recipe names them.
function toRecipeInstructions(
	sections: readonly InstructionSection[]
): (HowToStep | HowToSection)[] {
	return sections.flatMap<HowToStep | HowToSection>((section) =>
		section.heading === undefined
			? toHowToSteps(section)
			: [{ '@type': 'HowToSection', name: section.heading, itemListElement: toHowToSteps(section) }]
	);
}

// Each diet schema.org has a RestrictedDiet member for, by its full URL, as schema.org writes it.
function toSuitableForDiet(diets: readonly Diet[]): RestrictedDiet[] {
	return diets.flatMap((diet) => {
		const name = dietSchemaOrgNames[diet];
		return name === undefined ? [] : [`https://schema.org/${name}` as const];
	});
}

// Google lists a holiday among the keywords, which also carry each diet schema.org has no member for.
function toKeywords({ holidays, diets }: Pick<PublicRecipeDto, 'holidays' | 'diets'>): string[] {
	return [
		...holidays.map((holiday) => holidayLabels[holiday]),
		...diets
			.filter((diet) => dietSchemaOrgNames[diet] === undefined)
			.map((diet) => dietLabels[diet]),
	];
}

function toRecipeJsonLd(recipe: PublicRecipeDto, siteUrl: URL): WithContext<Recipe> {
	const { prepMinutes, cookMinutes } = recipe.times;
	// Google reads prep and cook times only as a pair.
	const hasPrepAndCook = prepMinutes !== undefined && cookMinutes !== undefined;
	const total = totalMinutes(recipe.times);
	const images = recipe.images.map((image) => absoluteUrl(recipeImageSrc(image.pathname), siteUrl));
	const suitableForDiet = toSuitableForDiet(recipe.diets);
	const keywords = toKeywords(recipe);

	return {
		'@context': 'https://schema.org',
		'@type': 'Recipe',
		url: absoluteUrl(recipePath(recipe.slug), siteUrl),
		name: recipe.title,
		description: recipe.description,
		// The member who added the recipe; the source can be a cookbook rather than a person.
		author: { '@type': 'Person', name: recipe.contributor.displayName },
		image: images.length > 0 ? images : undefined,
		datePublished: recipe.createdAt.toISOString(),
		dateModified: recipe.updatedAt.toISOString(),
		prepTime: hasPrepAndCook ? toIsoDuration(prepMinutes) : undefined,
		cookTime: hasPrepAndCook ? toIsoDuration(cookMinutes) : undefined,
		totalTime: total === undefined ? undefined : toIsoDuration(total),
		recipeYield: recipe.yield === undefined ? undefined : toRecipeYield(recipe.yield),
		recipeIngredient: recipe.ingredientSections.flatMap((section) =>
			section.lines.map((line) => line.text)
		),
		recipeInstructions: toRecipeInstructions(recipe.instructionSections),
		recipeCategory: chapterRecipeCategories[recipe.chapter],
		suitableForDiet: suitableForDiet.length > 0 ? suitableForDiet : undefined,
		keywords: keywords.length > 0 ? keywords.join(', ') : undefined,
	};
}

function RecipeJsonLd({ recipe, siteUrl }: RecipeJsonLdProps) {
	return (
		<script
			type="application/ld+json"
			// Escaping < keeps recipe text from closing the script element.
			dangerouslySetInnerHTML={{
				__html: JSON.stringify(toRecipeJsonLd(recipe, siteUrl)).replace(/</g, '\\u003c'),
			}}
		/>
	);
}

export { RecipeJsonLd, toRecipeJsonLd };
