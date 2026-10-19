import { Button as ButtonPrimitive } from '@base-ui/react/button';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';

const buttonVariantClasses = cva(
	// Dims a pending button too: focusableWhenDisabled sets aria-disabled instead of disabled.
	"group/button inline-flex shrink-0 items-center justify-center rounded-md border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 active:not-aria-[haspopup]:translate-y-px disabled:pointer-events-none disabled:opacity-50 aria-disabled:pointer-events-none aria-disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
	{
		variants: {
			variant: {
				default: 'bg-primary text-primary-foreground hover:bg-primary/80',
				// The brand's inked edge in both themes, instead of the border and input colors. Dark hover and
				// open surfaces step further than the light theme's, since a small step doesn't show there.
				outline:
					'border-edge bg-background shadow-xs hover:bg-muted hover:text-foreground aria-expanded:bg-muted aria-expanded:text-foreground dark:bg-input/30 dark:hover:bg-input/60 dark:aria-expanded:bg-input/60',
				secondary:
					'bg-secondary text-secondary-foreground hover:bg-secondary-hover aria-expanded:bg-secondary aria-expanded:text-secondary-foreground',
				// Hovered or open, the state layer, which shows on a field or a card as on the page.
				ghost:
					'hover:bg-state-layer hover:text-foreground aria-expanded:bg-state-layer aria-expanded:text-foreground',
				// A full-strength focus border: at 40 percent it falls under 3:1 against the tint. Its dark hover
				// tints further and brightens the text, which keeps 4.5:1 on a dialog.
				destructive:
					'bg-destructive/10 text-destructive hover:bg-destructive/20 focus-visible:border-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:hover:bg-destructive/35 dark:hover:text-[color-mix(in_oklab,var(--destructive),var(--foreground)_40%)] dark:focus-visible:ring-destructive/40',
				link: 'text-primary underline-offset-4 hover:underline',
			},
			size: {
				default:
					'h-9 gap-1.5 px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
				xs: "h-6 gap-1 rounded-[min(var(--radius-md),8px)] px-2 text-xs in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 [&_svg:not([class*='size-'])]:size-3",
				sm: 'h-8 gap-1 rounded-[min(var(--radius-md),10px)] px-2.5 in-data-[slot=button-group]:rounded-md has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5',
				lg: 'h-10 gap-1.5 px-2.5 has-data-[icon=inline-end]:pr-2 has-data-[icon=inline-start]:pl-2',
				icon: 'size-9',
				'icon-xs':
					"size-6 rounded-[min(var(--radius-md),8px)] in-data-[slot=button-group]:rounded-md [&_svg:not([class*='size-'])]:size-3",
				'icon-sm':
					'size-8 rounded-[min(var(--radius-md),10px)] in-data-[slot=button-group]:rounded-md',
				'icon-lg': 'size-10',
			},
			// User text, such as an active filter, wraps within a narrow screen rather than running off it.
			wrap: {
				true: 'h-auto whitespace-normal wrap-anywhere',
			},
		},
		// A wrapping button is its size's height on one line and grows by its padding from there.
		compoundVariants: [
			{ wrap: true, size: 'xs', className: 'min-h-6 py-0.5' },
			{ wrap: true, size: 'sm', className: 'min-h-8 py-1' },
			{ wrap: true, size: 'default', className: 'min-h-9 py-1.5' },
			{ wrap: true, size: 'lg', className: 'min-h-10 py-2' },
		],
		defaultVariants: {
			variant: 'default',
			size: 'default',
		},
	}
);

// Merged as Button merges them, so a link drawn as a button keeps its variant's border color
// rather than the base's transparent one.
function buttonVariants(options?: Parameters<typeof buttonVariantClasses>[0]): string {
	return cn(buttonVariantClasses(options));
}

function Button({
	className,
	variant = 'default',
	size = 'default',
	wrap,
	...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariantClasses>) {
	return (
		<ButtonPrimitive
			data-slot="button"
			className={buttonVariants({ variant, size, wrap, className })}
			{...props}
		/>
	);
}

export { Button, buttonVariants };
