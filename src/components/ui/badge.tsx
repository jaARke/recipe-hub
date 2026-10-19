import { mergeProps } from '@base-ui/react/merge-props';
import { useRender } from '@base-ui/react/use-render';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const badgeVariants = cva(
	// Link badges show only their own focus treatment and stand 24 px tall, the WCAG 2.5.8 minimum.
	'group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all outline-none focus-visible:border-ring [a]:h-6 focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!',
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground [a]:hover:bg-primary/80',
				// A link badge hovers as the secondary button does; at 80 percent the surface barely changes.
				secondary: 'bg-secondary text-secondary-foreground [a]:hover:bg-secondary-hover',
				destructive:
					'bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20',
				outline: 'border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground',
				// The ghost button's state layer.
				ghost: 'hover:bg-state-layer hover:text-muted-foreground',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			// User text, such as a tag, wraps within a narrow screen, curved at the corners as one line is.
			wrap: {
				true: 'h-auto min-h-5 rounded-[10px] py-px whitespace-normal wrap-anywhere [a]:h-auto [a]:min-h-6 [a]:rounded-[12px]',
			},
		},
		defaultVariants: {
			variant: 'default',
		},
	}
);

function Badge({
	className,
	variant = 'default',
	wrap,
	render,
	...props
}: useRender.ComponentProps<'span'> & VariantProps<typeof badgeVariants>) {
	return useRender({
		defaultTagName: 'span',
		props: mergeProps<'span'>(
			{
				className: cn(badgeVariants({ variant, wrap }), className),
			},
			props
		),
		render,
		state: {
			slot: 'badge',
			variant,
		},
	});
}

export { Badge, badgeVariants };
