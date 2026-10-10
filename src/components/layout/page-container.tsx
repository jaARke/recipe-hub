import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import * as React from 'react';

const pageContainerVariants = cva('mx-auto w-full px-4 sm:px-6', {
	variants: {
		width: {
			// A comfortable line length for ingredients and steps.
			reading: 'max-w-2xl',
			wide: 'max-w-6xl',
		},
	},
});

function PageContainer({
	className,
	width,
	...props
}: React.ComponentProps<'div'> & Required<VariantProps<typeof pageContainerVariants>>) {
	return <div className={cn(pageContainerVariants({ width, className }))} {...props} />;
}

export { PageContainer };
