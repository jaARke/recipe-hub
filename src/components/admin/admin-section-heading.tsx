'use client';

import * as React from 'react';
import { focusFellToPage } from '@/components/forms/focus-fell-to-page';

type AdminSectionHeadingProps = {
	as: 'h2' | 'h4';
	id: string;
	// The section's item count. An item that leaves while focused, such as a declined request,
	// drops focus to the page, so the heading takes it and keyboard users go on from here.
	itemCount?: number;
	children: React.ReactNode;
};

function AdminSectionHeading({ as: Heading, id, itemCount, children }: AdminSectionHeadingProps) {
	const headingRef = React.useRef<HTMLHeadingElement>(null);
	const previousItemCount = React.useRef(itemCount);

	React.useEffect(() => {
		const itemLeft =
			itemCount !== undefined &&
			previousItemCount.current !== undefined &&
			itemCount < previousItemCount.current;
		previousItemCount.current = itemCount;
		if (itemLeft && focusFellToPage()) {
			headingRef.current?.focus();
		}
	}, [itemCount]);

	return (
		<Heading
			ref={headingRef}
			id={id}
			tabIndex={itemCount === undefined ? undefined : -1}
			className="flex flex-wrap items-center gap-2 font-heading text-2xl font-medium"
		>
			{children}
		</Heading>
	);
}

export { AdminSectionHeading };
