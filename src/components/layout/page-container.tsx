import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import * as React from 'react';

// A comfortable line length for ingredients and steps, on a page held to it.
const readingWidthClassName = 'max-w-2xl';

// The same line length for a part of a wider page: reading width less the container's side padding.
const readingPartWidthClassName = 'max-w-156';

const pageContainerVariants = cva('mx-auto w-full px-4 sm:px-6', {
	variants: {
		width: {
			reading: readingWidthClassName,
			// Reading width, widened from lg while it holds content wideContentProps marks, such as the
			// recipe form beside the original recipe.
			readingOrWide: `${readingWidthClassName} lg:has-data-wide-content:max-w-6xl`,
			wide: 'max-w-6xl',
		},
	},
});

// Marks content that widens the readingOrWide container around it, from lg.
function wideContentProps(isWide: boolean) {
	return { 'data-wide-content': isWide ? '' : undefined };
}

function PageContainer({
	className,
	width,
	...props
}: React.ComponentProps<'div'> & Required<VariantProps<typeof pageContainerVariants>>) {
	return <div className={cn(pageContainerVariants({ width, className }))} {...props} />;
}

export { PageContainer, readingPartWidthClassName, wideContentProps };
