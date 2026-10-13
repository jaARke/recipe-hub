'use client';

import * as React from 'react';
import { useFocusOnReplace } from '@/components/forms/use-focus-on-replace';

type RecipeListHeadingProps = {
	id: string;
	children: React.ReactNode;
};

// The list's h1. It takes the focus that fell with a page the list replaced, as when deleting a
// recipe leaves its edit page; a page load leaves focus alone.
function RecipeListHeading({ id, children }: RecipeListHeadingProps) {
	const ref = React.useRef<HTMLHeadingElement>(null);
	useFocusOnReplace(ref);

	return (
		<h1 ref={ref} id={id} tabIndex={-1} className="font-heading text-4xl font-medium">
			{children}
		</h1>
	);
}

export { RecipeListHeading };
