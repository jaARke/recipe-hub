'use client';

import { cn } from 'cn';
import * as React from 'react';
import { focusFellToPage } from '@/components/forms/focus-fell-to-page';
import { CountBadge } from '@/components/layout/count-badge';

type PageSectionProps = {
	id: string;
	title: string;
	// h4 nests the section under the design reference's own headings.
	headingTag?: 'h2' | 'h4';
	description?: string;
	// Shown beside the title.
	count?: number;
	// The section's item count. An item that leaves while focused, such as a declined request, drops
	// focus to the page, so the heading takes it and keyboard users go on from here.
	itemCount?: number;
	className?: string;
	children: React.ReactNode;
};

// A titled part of a page that stacks its sections in one scroll, named by its heading so assistive
// technology lists it as a region. A rule sets it off from whatever precedes it in its container;
// first in one, such as a tab panel, it needs none.
function PageSection({
	id,
	title,
	headingTag: Heading = 'h2',
	description,
	count,
	itemCount,
	className,
	children,
}: PageSectionProps) {
	const headingId = `${id}-heading`;
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
		<section
			id={id}
			aria-labelledby={headingId}
			className={cn('flex flex-col gap-4 not-first:border-t not-first:pt-8', className)}
		>
			<div className="flex flex-col gap-2">
				<Heading
					ref={headingRef}
					id={headingId}
					tabIndex={itemCount === undefined ? undefined : -1}
					className="flex flex-wrap items-center gap-2 font-heading text-2xl font-semibold"
				>
					{title}
					{count !== undefined && <CountBadge count={count} />}
				</Heading>
				{description !== undefined && <p className="text-muted-foreground">{description}</p>}
			</div>
			{children}
		</section>
	);
}

export { PageSection };
