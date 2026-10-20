// How the Recipes page counts recipes, in its count line, its chapters and its filter sheet. Client
// components use it too, so it imports nothing.

const countFormat = new Intl.NumberFormat('en-US');

// A bare count, such as the sidebar's beside each chapter.
export function formatCount(count: number): string {
	return countFormat.format(count);
}

// "1 recipe" or "1,024 recipes".
export function recipeCount(count: number): string {
	return count === 1 ? '1 recipe' : `${formatCount(count)} recipes`;
}
