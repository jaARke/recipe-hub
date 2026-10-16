'use client';

import { cn } from 'cn';
import * as React from 'react';
import { RecipeImageStrip } from '@/components/recipe/recipe-image-strip';
import { imagePositionLabel } from '@/components/recipe/recipe-image-viewer-labels';
import { FullSizeImageLink, type ShownImage } from '@/components/recipe/shown-recipe-image';
import {
	handleZoomKey,
	RecipeImageZoomControls,
	ZoomableRecipeImage,
	type ImageZoom,
	type ZoomFrameSize,
} from '@/components/recipe/zoomable-recipe-image';
import { Skeleton } from '@/components/ui/skeleton';

// In view as the form scrolls: the pane clears the sticky header (h-14 and its border) by 1.5rem and
// ends 2rem above the form's action bar held at the screen's bottom, whose height ActionBar keeps on
// the form. Until it does, as while the form loads, the pane leaves the bar's height on one row.
const paneClassName =
	'sticky top-20 flex h-[calc(100dvh-7rem-var(--action-bar-height,3.75rem))] flex-col gap-3';

// The page's frame: about half the screen, beside the fields, and the pane's height less its
// controls and the strip of pages.
const paneFrameSize: ZoomFrameSize = { width: '50vw', height: '100dvh - 14rem' };

// While the page is whole, Left and Right turn it.
const pageTurnKeys: Partial<Record<string, -1 | 1>> = { ArrowLeft: -1, ArrowRight: 1 };

type OriginalRecipePaneProps = {
	// The form's scans, in its order.
	images: readonly ShownImage[];
	// Names the pane, as the form names its scans.
	title: string;
	className?: string;
};

// The original recipe beside the form, a page at a time, in view as the form scrolls: the page whole
// and zoomable as the viewer's are, with the zoom's buttons and Full size above it and a strip of
// the pages below. The zoom's keys work anywhere in the pane.
function OriginalRecipePane({ images, title, className }: OriginalRecipePaneProps) {
	// The page shown stays with its scan as scans move, and the first shows once it's removed.
	const [shownPathname, setShownPathname] = React.useState<string>();
	const [zoom, setZoom] = React.useState<ImageZoom | null>(null);
	const index = Math.max(
		images.findIndex((image) => image.pathname === shownPathname),
		0
	);
	const image = images[index];
	if (image === undefined) {
		return null;
	}

	const several = images.length > 1;
	// Named as the viewer names it, or for the whole original when it has one page.
	const pageName = several ? imagePositionLabel('scan', index, images.length) : title;
	const showPage = (pageIndex: number) => setShownPathname(images[pageIndex]?.pathname);

	const onKeyDown = (event: React.KeyboardEvent) => {
		if (handleZoomKey(zoom, event)) {
			event.preventDefault();
			return;
		}
		const turn = pageTurnKeys[event.key];
		if (turn === undefined || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		event.preventDefault();
		showPage(Math.min(Math.max(index + turn, 0), images.length - 1));
	};

	return (
		<aside aria-label={title} className={cn(paneClassName, className)} onKeyDown={onKeyDown}>
			<div className="flex flex-wrap items-center justify-between gap-2">
				{several && (
					<p
						role="status"
						aria-live="polite"
						className="font-mono text-xs tracking-wide text-muted-foreground uppercase"
					>
						{pageName}
					</p>
				)}
				<div className="ml-auto flex items-center gap-1">
					<RecipeImageZoomControls zoom={zoom} className="flex" />
					<FullSizeImageLink image={image} className="ml-1" />
				</div>
			</div>
			<div className="min-h-0 flex-1">
				<ZoomableRecipeImage
					image={image}
					alt={pageName}
					label={pageName}
					frame={paneFrameSize}
					zoomRef={setZoom}
					className="rounded-md border bg-muted/40"
				/>
			</div>
			{several && (
				<RecipeImageStrip
					role="scan"
					images={images}
					current={index}
					onSelect={showPage}
					className="-mx-1"
				/>
			)}
		</aside>
	);
}

// Holds the pane's place while the form loads: its controls over the page.
function OriginalRecipePaneSkeleton({ className }: { className?: string }) {
	return (
		<div className={cn(paneClassName, className)}>
			<Skeleton className="h-9 w-64 self-end" />
			<Skeleton className="min-h-0 flex-1" />
		</div>
	);
}

export { OriginalRecipePane, OriginalRecipePaneSkeleton };
