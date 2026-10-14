'use client';

import { cn } from 'cn';
import { ChevronLeftIcon, ChevronRightIcon, ExternalLinkIcon, ZoomInIcon } from 'lucide-react';
import * as React from 'react';
import {
	imagePositionLabel,
	imageViewerLabels,
} from '@/components/recipe/recipe-image-viewer-labels';
import {
	ShownImageLink,
	ShownRecipeImage,
	type ShownImage,
} from '@/components/recipe/shown-recipe-image';
import { Button, buttonVariants } from '@/components/ui/button';

const labels = imageViewerLabels('scan');

type OriginalRecipePaneProps = {
	// The form's scans, in its order.
	images: readonly ShownImage[];
	// Names the pane, as the form names its scans.
	title: string;
	className?: string;
};

// The original recipe beside the form, a page at a time, in view as the form scrolls: it clears the
// sticky header (h-14 and its border) by 1.5rem and ends 2rem above the screen's bottom. Zoom doubles
// the page, which then scrolls, and Full size opens the page by itself in a new tab. No carousel: a
// zoomed page takes the arrow keys to scroll, which a carousel would take to change pages.
function OriginalRecipePane({ images, title, className }: OriginalRecipePaneProps) {
	// The page shown stays with its scan as scans move, and the first shows once it's removed.
	const [shownPathname, setShownPathname] = React.useState<string>();
	const [zoomed, setZoomed] = React.useState(false);
	const index = Math.max(
		images.findIndex((image) => image.pathname === shownPathname),
		0
	);
	const image = images[index];
	if (image === undefined) {
		return null;
	}

	// Named as the viewer names it, or for the whole original when it has one page.
	const pageName = images.length === 1 ? title : imagePositionLabel('scan', index, images.length);
	const showPage = (pageIndex: number) => setShownPathname(images[pageIndex]?.pathname);

	return (
		<aside
			aria-label={title}
			className={cn('sticky top-20 flex h-[calc(100dvh-7rem)] flex-col gap-3', className)}
		>
			<div className="flex flex-wrap items-center justify-between gap-2">
				{images.length > 1 && (
					<div className="flex items-center gap-2">
						{/* Focusable at either end, so focus stays put. */}
						<Button
							variant="outline"
							size="icon-sm"
							className="rounded-full"
							aria-label={labels.previous}
							disabled={index === 0}
							focusableWhenDisabled
							onClick={() => showPage(index - 1)}
						>
							<ChevronLeftIcon aria-hidden="true" />
						</Button>
						<Button
							variant="outline"
							size="icon-sm"
							className="rounded-full"
							aria-label={labels.next}
							disabled={index === images.length - 1}
							focusableWhenDisabled
							onClick={() => showPage(index + 1)}
						>
							<ChevronRightIcon aria-hidden="true" />
						</Button>
						<p
							role="status"
							aria-live="polite"
							className="font-mono text-xs tracking-wide text-muted-foreground uppercase"
						>
							{pageName}
						</p>
					</div>
				)}
				<div className="ml-auto flex items-center gap-2">
					{/* Shows it's on as an open menu's trigger does. */}
					<Button
						variant="outline"
						size="sm"
						className="aria-pressed:bg-muted aria-pressed:text-foreground"
						aria-pressed={zoomed}
						onClick={() => setZoomed((wasZoomed) => !wasZoomed)}
					>
						<ZoomInIcon data-icon="inline-start" aria-hidden="true" />
						Zoom
					</Button>
					<ShownImageLink
						image={image}
						className={buttonVariants({ variant: 'outline', size: 'sm' })}
					>
						Full size
						<ExternalLinkIcon data-icon="inline-end" aria-hidden="true" />
						<span className="sr-only">, opens in a new tab</span>
					</ShownImageLink>
				</div>
			</div>
			{/* Keyed by its page, so a new page starts at its top left. Zoomed, it scrolls, and takes focus
			for the keyboard to scroll it. */}
			<div
				key={image.pathname}
				role={zoomed ? 'group' : undefined}
				aria-label={zoomed ? pageName : undefined}
				tabIndex={zoomed ? 0 : undefined}
				className={cn(
					'min-h-0 flex-1 rounded-md bg-muted',
					zoomed ? 'overflow-auto' : 'overflow-hidden'
				)}
			>
				<ShownRecipeImage
					role="scan"
					image={image}
					alt={pageName}
					fit="contain"
					className={zoomed ? 'w-[200%]' : 'size-full *:object-top'}
				/>
			</div>
		</aside>
	);
}

export { OriginalRecipePane };
