import { recipeCookPath, recipePath } from '@/components/recipe/recipe-paths';
import { sampleButtermilkBiscuits } from '@/domain/recipe/samples/sample-recipes';
import { slugify } from '@/domain/recipe/slug';

// The seed's sample the suites read and never change, which `pnpm db:seed` adds to develop: it makes
// 10 biscuits in 7 steps, from 8 ingredients in two sections.
const slug = slugify(sampleButtermilkBiscuits.title);

export const sampleRecipe = {
	slug,
	title: sampleButtermilkBiscuits.title,
	path: recipePath(slug),
	cookPath: recipeCookPath(slug),
	photoAlt: sampleButtermilkBiscuits.images[0]?.alt ?? '',
};
