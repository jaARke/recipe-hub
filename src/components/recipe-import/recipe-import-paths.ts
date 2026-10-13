// Where a member reviews an import's draft and saves it as a recipe.
export function recipeImportPath(id: string): string {
	return `/contribute/imports/${id}`;
}
