'use client';

import * as React from 'react';
import { CountBadge } from '@/components/layout/count-badge';
import type { NavItem } from '@/components/layout/nav-items';

type NavItemCountProps = {
	item: NavItem;
	// The signed-in member's draft count, and none for a signed-out visitor.
	draftCount: Promise<number>;
};

// Names what the badge counts, which Add recipe's label doesn't, so it reads "Add recipe, 2 drafts".
function DraftCountBadge({ draftCount }: Pick<NavItemCountProps, 'draftCount'>) {
	const count = React.use(draftCount);
	if (count === 0) {
		return null;
	}

	return (
		<>
			<CountBadge count={count} />
			<span className="sr-only">{count === 1 ? ' draft' : ' drafts'}</span>
		</>
	);
}

// What a section's link shows after its label, in the header's row and the phone menu alike. The count
// waits for its own read behind its own boundary, so the link never waits for it.
function NavItemCount({ item, draftCount }: NavItemCountProps) {
	return item.showsDraftCount ? (
		<React.Suspense>
			<DraftCountBadge draftCount={draftCount} />
		</React.Suspense>
	) : null;
}

export { NavItemCount };
