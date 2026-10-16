// The recipe page's text hierarchy, shared with the typography specimen.
export const recipeTextStyles = {
	// Long words wrap rather than push a control beside the title off a narrow screen.
	title: 'min-w-0 font-heading text-4xl font-semibold wrap-anywhere md:text-5xl',
	section: 'font-heading text-2xl font-semibold',
	subsection: 'text-lg font-semibold',
	body: 'text-lg',
	supporting: 'text-lg text-muted-foreground',
	// The header's ruled cells: a label over its value. Times and the yield, read at a glance, are a
	// step larger than who added the recipe and when.
	cellLabel: 'text-sm text-muted-foreground',
	factValue: 'text-lg font-medium',
	cellValue: 'text-base font-medium',
} as const;

// Keyed by the title's level; level 4 nests the recipe under the design reference's own headings.
export const recipeHeadingTags = {
	1: { title: 'h1', section: 'h2', subsection: 'h3' },
	4: { title: 'h4', section: 'h5', subsection: 'h6' },
} as const;

export type RecipeHeadingLevel = keyof typeof recipeHeadingTags;

export type RecipeSubsectionTag = (typeof recipeHeadingTags)[RecipeHeadingLevel]['subsection'];
