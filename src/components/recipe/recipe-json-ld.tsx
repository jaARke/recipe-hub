import type { HowToSection, HowToStep, Recipe, WithContext } from 'schema-dts';
import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { recipeImageSrc, recipePath } from '@/components/recipe/recipe-paths';
import { toIsoDuration, totalMinutes } from '@/domain/recipe/duration';
import type { InstructionSection } from '@/domain/recipe/instruction';
import { formatYield } from '@/domain/recipe/recipe-yield';

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

function toRecipeJsonLd(recipe: PublicRecipeDto, siteUrl: URL): WithContext<Recipe> {
	const { prepMinutes, cookMinutes } = recipe.times;
	// Google reads prep and cook times only as a pair.
	const hasPrepAndCook = prepMinutes !== undefined && cookMinutes !== undefined;
	const total = totalMinutes(recipe.times);
	const images = recipe.images.map((image) => absoluteUrl(recipeImageSrc(image.pathname), siteUrl));

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
		recipeYield: recipe.yield === undefined ? undefined : formatYield(recipe.yield),
		recipeIngredient: recipe.ingredientSections.flatMap((section) =>
			section.lines.map((line) => line.text)
		),
		recipeInstructions: toRecipeInstructions(recipe.instructionSections),
		keywords: recipe.tags.length > 0 ? recipe.tags.join(', ') : undefined,
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
