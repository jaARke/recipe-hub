import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import * as React from 'react';

const textareaVariants = cva(
	'flex field-sizing-content min-h-16 w-full resize-y rounded-md border border-input bg-transparent px-2.5 py-2 text-base shadow-xs transition-[color,box-shadow] outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 supports-[field-sizing:content]:resize-none md:text-sm dark:bg-input/30 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40',
	{
		variants: {
			size: {
				default: '',
				// One line tall until the text grows, for the items of a list.
				compact: 'min-h-0',
			},
		},
		defaultVariants: {
			size: 'default',
		},
	}
);

function Textarea({
	className,
	size = 'default',
	...props
}: React.ComponentProps<'textarea'> & VariantProps<typeof textareaVariants>) {
	return (
		<textarea
			data-slot="textarea"
			data-size={size}
			className={cn(textareaVariants({ size, className }))}
			{...props}
		/>
	);
}

export { Textarea };
