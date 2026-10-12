import 'server-only';
import { z } from 'zod';
import { requireMember } from '@/application/authorization';
import { paginationSchema } from '@/application/pagination';
import type { ActorProvider } from '@/application/ports/actor-provider';
import {
	recipeSorts,
	type RecipePage,
	type RecipeRepository,
} from '@/application/ports/recipe-repository';
import { InvalidRecipePageError, RecipeNotFoundError } from '@/application/recipes/errors';
import {
	toPublicRecipeDto,
	toRecipeRef,
	toRecipeSummaryDto,
	type PublicRecipeDto,
	type RecipeRef,
	type RecipeSummaryPage,
} from '@/application/recipes/recipe-dtos';
import { assertCanModifyRecipe } from '@/application/recipes/recipe-policy';
import { InvalidRecipeError } from '@/domain/recipe/errors';
import { provenanceSchema, type Provenance } from '@/domain/recipe/provenance';
import {
	parseRecipeContent,
	recipeIdSchema,
	type Recipe,
	type RecipeContent,
	type RecipeContentInput,
	type RecipeId,
} from '@/domain/recipe/recipe';
import { recipeProblemsFromZodError } from '@/domain/recipe/recipe-problem';
import { slugify, slugSchema } from '@/domain/recipe/slug';
import { tagKey } from '@/domain/recipe/tag';
import { getLogger } from '@/lib/logger';

const recipePageSchema = paginationSchema.extend({ sort: z.enum(recipeSorts) });

const logger = getLogger('recipes');

export type CreateRecipeInput = {
	content: RecipeContentInput;
	provenance: Provenance;
};

// Problems are reported under provenance, beside the content's own paths.
function parseProvenance(input: unknown): Provenance {
	const result = provenanceSchema.safeParse(input);
	if (!result.success) {
		throw new InvalidRecipeError(
			recipeProblemsFromZodError(result.error).map((problem) => ({
				...problem,
				path: problem.path === '' ? 'provenance' : `provenance.${problem.path}`,
			}))
		);
	}

	return result.data;
}

export class RecipeService {
	private readonly recipes: RecipeRepository;
	private readonly actors: ActorProvider;

	constructor(recipes: RecipeRepository, actors: ActorProvider) {
		this.recipes = recipes;
		this.actors = actors;
	}

	// Public reads never ask for the actor, so pages can cache them.
	async getRecipe(slug: string): Promise<PublicRecipeDto | null> {
		if (!slugSchema.safeParse(slug).success) {
			return null;
		}

		const recipe = await this.recipes.findBySlug(slug);
		return recipe === null ? null : toPublicRecipeDto(recipe);
	}

	async listRecipes(page: RecipePage): Promise<RecipeSummaryPage> {
		const result = recipePageSchema.safeParse(page);
		if (!result.success) {
			throw new InvalidRecipePageError();
		}

		const [recipes, total] = await Promise.all([
			this.recipes.list(result.data),
			this.recipes.count(),
		]);
		return { recipes: recipes.map(toRecipeSummaryDto), total };
	}

	// Writes resolve the actor first, so an anonymous caller learns nothing about which recipes exist.
	async createRecipe(input: CreateRecipeInput): Promise<RecipeRef> {
		const actor = requireMember(await this.actors.currentActor());
		const content = parseRecipeContent(input.content);
		const provenance = parseProvenance(input.provenance);

		const recipe = await this.recipes.create({
			content: await this.withCanonicalTags(content),
			provenance,
			contributorId: actor.memberId,
			slugBase: slugify(content.title),
		});

		logger.info('Recipe created', {
			recipeId: recipe.id,
			memberId: actor.memberId,
			entryMode: recipe.provenance.entryMode,
		});
		return toRecipeRef(recipe);
	}

	async updateRecipe(id: string, input: RecipeContentInput): Promise<RecipeRef> {
		const actor = requireMember(await this.actors.currentActor());
		const recipe = await this.findRecipe(id);
		assertCanModifyRecipe(actor, recipe);
		const content = parseRecipeContent(input);

		const updated = await this.recipes.update(
			recipe.id,
			await this.withCanonicalTags(content, recipe.id)
		);
		if (updated === null) {
			throw new RecipeNotFoundError();
		}

		logger.info('Recipe updated', { recipeId: updated.id, memberId: actor.memberId });
		return toRecipeRef(updated);
	}

	async deleteRecipe(id: string): Promise<RecipeRef> {
		const actor = requireMember(await this.actors.currentActor());
		const recipe = await this.findRecipe(id);
		assertCanModifyRecipe(actor, recipe);

		const deleted = await this.recipes.delete(recipe.id);
		if (!deleted) {
			throw new RecipeNotFoundError();
		}

		logger.info('Recipe deleted', { recipeId: recipe.id, memberId: actor.memberId });
		return toRecipeRef(recipe);
	}

	// Ids arrive from URLs and forms, so a malformed id names no recipe.
	private async findRecipe(id: string): Promise<Recipe> {
		const parsed = recipeIdSchema.safeParse(id);
		const recipe = parsed.success ? await this.recipes.findById(parsed.data) : null;
		if (recipe === null) {
			throw new RecipeNotFoundError();
		}

		return recipe;
	}

	// A tag takes the label other recipes already use, so an update can respell a tag only it uses.
	private async withCanonicalTags(
		content: RecipeContent,
		excludeRecipeId?: RecipeId
	): Promise<RecipeContent> {
		const labels = await this.recipes.findTagLabels(content.tags.map(tagKey), excludeRecipeId);
		const labelsByKey = new Map(labels.map((label) => [tagKey(label), label]));

		return {
			...content,
			tags: content.tags.map((tag) => labelsByKey.get(tagKey(tag)) ?? tag),
		};
	}
}
