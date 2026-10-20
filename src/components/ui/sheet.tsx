'use client';

import { Dialog as SheetPrimitive } from '@base-ui/react/dialog';
import { cn } from 'cn';
import { XIcon } from 'lucide-react';
import * as React from 'react';
import { Button } from '@/components/ui/button';
import {
	KeptPagePopupContext,
	KeptPagePopupMounted,
	useKeptPagePopup,
	useKeptPagePopupProps,
} from '@/components/ui/kept-page-popup';

function Sheet({ ...props }: SheetPrimitive.Root.Props) {
	// Closes as its page hides, without drawing on return (kept-page-popup.tsx).
	const keptPage = useKeptPagePopup(props);
	return (
		<KeptPagePopupContext value={keptPage.context}>
			<SheetPrimitive.Root data-slot="sheet" {...props} {...keptPage.rootProps} />
		</KeptPagePopupContext>
	);
}

function SheetTrigger({ ...props }: SheetPrimitive.Trigger.Props) {
	return <SheetPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: SheetPrimitive.Close.Props) {
	return <SheetPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetPortal({ ...props }: SheetPrimitive.Portal.Props) {
	return <SheetPrimitive.Portal data-slot="sheet-portal" {...props} />;
}

function SheetOverlay({ className, ...props }: SheetPrimitive.Backdrop.Props) {
	// Undrawn once its page's hiding closed the sheet (kept-page-popup.tsx).
	const keptPageProps = useKeptPagePopupProps();
	return (
		<SheetPrimitive.Backdrop
			data-slot="sheet-overlay"
			{...keptPageProps}
			className={cn(
				'fixed inset-0 z-50 bg-black/10 transition-opacity duration-150 data-ending-style:opacity-0 data-starting-style:opacity-0 supports-backdrop-filter:backdrop-blur-xs',
				className
			)}
			{...props}
		/>
	);
}

function SheetContent({
	className,
	children,
	side = 'right',
	showCloseButton = true,
	...props
}: SheetPrimitive.Popup.Props & {
	side?: 'top' | 'right' | 'bottom' | 'left';
	showCloseButton?: boolean;
}) {
	// Undrawn once its page's hiding closed the sheet (kept-page-popup.tsx).
	const keptPageProps = useKeptPagePopupProps();
	return (
		<SheetPortal>
			<KeptPagePopupMounted />
			<SheetOverlay />
			<SheetPrimitive.Popup
				data-slot="sheet-content"
				data-side={side}
				{...keptPageProps}
				className={cn(
					'fixed z-50 flex flex-col gap-4 bg-popover bg-clip-padding text-sm text-popover-foreground shadow-lg transition duration-200 ease-in-out data-ending-style:opacity-0 data-starting-style:opacity-0 data-[side=bottom]:inset-x-0 data-[side=bottom]:bottom-0 data-[side=bottom]:h-auto data-[side=bottom]:border-t data-[side=bottom]:data-ending-style:translate-y-[2.5rem] data-[side=bottom]:data-starting-style:translate-y-[2.5rem] data-[side=left]:inset-y-0 data-[side=left]:left-0 data-[side=left]:h-full data-[side=left]:w-3/4 data-[side=left]:border-r data-[side=left]:data-ending-style:translate-x-[-2.5rem] data-[side=left]:data-starting-style:translate-x-[-2.5rem] data-[side=right]:inset-y-0 data-[side=right]:right-0 data-[side=right]:h-full data-[side=right]:w-3/4 data-[side=right]:border-l data-[side=right]:data-ending-style:translate-x-[2.5rem] data-[side=right]:data-starting-style:translate-x-[2.5rem] data-[side=top]:inset-x-0 data-[side=top]:top-0 data-[side=top]:h-auto data-[side=top]:border-b data-[side=top]:data-ending-style:translate-y-[-2.5rem] data-[side=top]:data-starting-style:translate-y-[-2.5rem] data-[side=left]:sm:max-w-sm data-[side=right]:sm:max-w-sm',
					// A phone's sheet leaves a strip of the page in view, and rules its header and footer off from a
					// body given overflow-y-auto, which scrolls between them; with no such body, all of it scrolls.
					'group/sheet-content data-[side=bottom]:max-h-[92dvh] data-[side=bottom]:gap-0 data-[side=bottom]:overflow-y-auto data-[side=bottom]:rounded-t-2xl',
					className
				)}
				{...props}
			>
				{children}
				{showCloseButton && (
					<SheetPrimitive.Close
						data-slot="sheet-close"
						render={
							<Button
								variant="ghost"
								// 44 px under a finger, like the site's other touch targets, grown around the icon so it stays
								// level with the title.
								className="absolute top-4 right-4 pointer-coarse:top-2 pointer-coarse:right-2 pointer-coarse:size-11"
								size="icon-sm"
							/>
						}
					>
						<XIcon />
						<span className="sr-only">Close</span>
					</SheetPrimitive.Close>
				)}
			</SheetPrimitive.Popup>
		</SheetPortal>
	);
}

function SheetHeader({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="sheet-header"
			className={cn(
				// Ruled off from the body that scrolls below it in a bottom sheet.
				'flex flex-col gap-1.5 p-4 group-data-[side=bottom]/sheet-content:border-b',
				className
			)}
			{...props}
		/>
	);
}

function SheetFooter({ className, ...props }: React.ComponentProps<'div'>) {
	return (
		<div
			data-slot="sheet-footer"
			className={cn(
				// In a bottom sheet, ruled off from the body that scrolls above it, its actions in a row at the
				// right as a dialog's are, and clear of the screen's bottom edge as the cooking view's bar is.
				'mt-auto flex flex-col gap-2 p-4 group-data-[side=bottom]/sheet-content:flex-row group-data-[side=bottom]/sheet-content:justify-end group-data-[side=bottom]/sheet-content:border-t group-data-[side=bottom]/sheet-content:pt-3 group-data-[side=bottom]/sheet-content:pb-[max(0.75rem,env(safe-area-inset-bottom))]',
				className
			)}
			{...props}
		/>
	);
}

function SheetTitle({ className, ...props }: SheetPrimitive.Title.Props) {
	return (
		<SheetPrimitive.Title
			data-slot="sheet-title"
			// The brand sets headings in Fraunces at weight 600, and a bottom sheet, which covers most of a
			// phone's screen, heads it at text-xl.
			className={cn(
				'font-heading font-semibold text-foreground group-data-[side=bottom]/sheet-content:text-xl',
				className
			)}
			{...props}
		/>
	);
}

function SheetDescription({ className, ...props }: SheetPrimitive.Description.Props) {
	return (
		<SheetPrimitive.Description
			data-slot="sheet-description"
			className={cn('text-sm text-muted-foreground', className)}
			{...props}
		/>
	);
}

export {
	Sheet,
	SheetTrigger,
	SheetClose,
	SheetContent,
	SheetHeader,
	SheetFooter,
	SheetTitle,
	SheetDescription,
};
