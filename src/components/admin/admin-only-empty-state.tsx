'use client';

import { LockIcon } from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { useFocusOnReplace } from '@/components/forms/use-focus-on-replace';
import { backToAllRecipesLabel, recipeListPath } from '@/components/recipe/recipe-paths';
import { buttonVariants } from '@/components/ui/button';
import {
	Empty,
	EmptyContent,
	EmptyDescription,
	EmptyHeader,
	EmptyMedia,
	EmptyTitle,
} from '@/components/ui/empty';

// For a signed-in member who is not an admin. When it replaces the page's lists, as after admins
// remove their own role, its title takes the focus that fell with them.
function AdminOnlyEmptyState() {
	const titleRef = React.useRef<HTMLDivElement>(null);
	useFocusOnReplace(titleRef);

	return (
		<Empty className="border">
			<EmptyHeader>
				<EmptyMedia variant="icon">
					<LockIcon aria-hidden="true" />
				</EmptyMedia>
				<EmptyTitle ref={titleRef} tabIndex={-1}>
					This page is for admins
				</EmptyTitle>
				<EmptyDescription>
					Admins review access requests and invite people. Your account doesn’t have admin access.
				</EmptyDescription>
			</EmptyHeader>
			<EmptyContent>
				<Link href={recipeListPath} className={buttonVariants()}>
					{backToAllRecipesLabel}
				</Link>
			</EmptyContent>
		</Empty>
	);
}

export { AdminOnlyEmptyState };
