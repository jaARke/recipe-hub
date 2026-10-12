import * as React from 'react';

type PageSectionProps = {
	id: string;
	title: string;
	children: React.ReactNode;
};

// A titled part of a page, named by its heading so assistive technology lists it as a region.
function PageSection({ id, title, children }: PageSectionProps) {
	const headingId = `${id}-heading`;

	return (
		<section id={id} aria-labelledby={headingId} className="flex flex-col gap-4">
			<h2 id={headingId} className="font-heading text-2xl font-medium">
				{title}
			</h2>
			{children}
		</section>
	);
}

export { PageSection };
