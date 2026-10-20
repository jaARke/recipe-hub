import type * as React from 'react';

// The pages that hold the recipe form under a heading of their own, which only editing a recipe does:
// a draft's page is headed by its recipe's title.
export type EditingPage = 'edit';

// Each page's heading, which is its title too.
export const editingPageTitles = {
	edit: 'Edit recipe',
} as const satisfies Record<EditingPage, string>;

type EditingPageHeadingProps = {
	// The page's heading, such as one of editingPageTitles or a draft's title.
	title: string;
	// h4 nests the heading under the design reference's own headings.
	headingTag?: 'h1' | 'h4';
	// The page's menu of what can be done to the recipe or draft it edits, if it has one.
	menu?: React.ReactNode;
};

// The heading of a page that holds the recipe form, with the page's menu at its right, as the recipe
// page's title holds its edit link. A title typed without spaces wraps anywhere rather than widen the
// page.
function EditingPageHeading({ title, headingTag: Heading = 'h1', menu }: EditingPageHeadingProps) {
	const heading = (
		<Heading className="min-w-0 font-heading text-4xl font-semibold wrap-anywhere">{title}</Heading>
	);
	if (menu === undefined) {
		return heading;
	}
	return (
		<div className="flex items-start justify-between gap-4">
			{heading}
			{/* As tall as the heading's first line, so the icon button centers on it. */}
			<div className="flex h-10 shrink-0 items-center">{menu}</div>
		</div>
	);
}

export { EditingPageHeading };
