'use client';

import * as React from 'react';

// The bar's height, which it keeps on its form for what shares the screen with it held at the bottom.
// OriginalRecipePane's height leaves room for it.
const heightVariable = '--action-bar-height';

type ActionBarProps = {
	// The form's buttons, the primary first, at the bar's left edge.
	children: React.ReactNode;
	// At the bar's right edge: what a button waits for, or what is left to do. Nothing shows there
	// while it renders nothing.
	status?: React.ReactNode;
};

// True while the bar is held at the screen's bottom: while the sentinel marking the end of its place
// is below the screen.
function useHeldAtBottom(sentinel: React.RefObject<HTMLElement | null>): boolean {
	const [held, setHeld] = React.useState(false);
	React.useEffect(() => {
		const element = sentinel.current;
		if (element === null) {
			return;
		}
		const observer = new IntersectionObserver((entries) => {
			const entry = entries.at(-1);
			if (entry !== undefined) {
				setHeld(!entry.isIntersecting && entry.boundingClientRect.top > 0);
			}
		});
		observer.observe(element);
		return () => observer.disconnect();
	}, [sentinel]);
	return held;
}

// Keeps the bar's height, as it wraps or its status changes, on the form that holds it.
function useHeightOnForm(bar: React.RefObject<HTMLElement | null>) {
	React.useEffect(() => {
		const element = bar.current;
		const form = element?.closest('form') ?? null;
		if (element === null || form === null) {
			return;
		}
		const observer = new ResizeObserver((entries) => {
			const height = entries.at(-1)?.borderBoxSize[0]?.blockSize;
			if (height !== undefined) {
				form.style.setProperty(heightVariable, `${height}px`);
			}
		});
		observer.observe(element);
		return () => {
			observer.disconnect();
			form.style.removeProperty(heightVariable);
		};
	}, [bar]);
}

// The recipe form's actions, its last part, after the fields and the original recipe beside them, so
// it spans the page's container. While the form runs past the screen's bottom the bar is held there,
// opaque with a rule across the whole screen, so Save stays at hand; at its place at the form's end it
// has no rule, and Save sits 16 px after the fields as a page form's actions do. Unlike FormActions,
// the buttons keep one row on phones with the status at the right, wrapping only where the row is
// full, since a stack held at the screen's bottom would cover the form. The page's bottom scroll
// padding keeps focus clear of it.
function ActionBar({ children, status }: ActionBarProps) {
	const bar = React.useRef<HTMLDivElement>(null);
	const sentinel = React.useRef<HTMLDivElement>(null);
	const held = useHeldAtBottom(sentinel);
	useHeightOnForm(bar);

	return (
		<>
			{/* Its margin and padding put Save 16 px after the fields. Held, the rule and background spread
			across the screen as the border image's outset, which paints outside the bar without widening
			the page or clipping a focus ring. */}
			<div
				ref={bar}
				data-action-bar=""
				data-held={held ? '' : undefined}
				className="sticky bottom-0 z-30 mt-1 flex flex-wrap items-center gap-x-3 gap-y-2 bg-background py-3 data-held:[border-image:linear-gradient(var(--color-border)_0_1px,var(--color-background)_0)_fill_0//0_100vmax]"
			>
				<div className="flex flex-wrap items-center gap-2">{children}</div>
				<div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2 empty:hidden">
					{status}
				</div>
			</div>
			{/* Right after the bar's place, so it shows once the bar is back there. */}
			<div ref={sentinel} aria-hidden="true" />
		</>
	);
}

export { ActionBar };
