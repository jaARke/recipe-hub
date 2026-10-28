'use client';

import { cn } from 'cn';
import * as React from 'react';
import { RecipeImageStrip } from '@/components/recipe/recipe-image-strip';
import {
	imagePositionLabel,
	imageViewerLabels,
} from '@/components/recipe/recipe-image-viewer-labels';
import { RecipeImageViewerTitleBar } from '@/components/recipe/recipe-image-viewer-title-bar';
import { FullSizeImageLink, type ShownImage } from '@/components/recipe/shown-recipe-image';
import {
	handleZoomKey,
	isZoomed,
	RecipeImageZoomControls,
	ZoomableRecipeImage,
	type ImageZoom,
	type ZoomFrameSize,
} from '@/components/recipe/zoomable-recipe-image';
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
	type CarouselApi,
} from '@/components/ui/carousel';
import type { RecipeImageRole } from '@/domain/recipe/recipe-image';

// A slide's frame: the screen's width, and its height less the title bar, the caption and strip,
// and the padding around the image.
const viewerFrameSize: ZoomFrameSize = { width: '100vw', height: '100dvh - 12rem' };

// The most of the screen's height a description takes before it scrolls: enough to show an ordinary
// one whole in a phone's narrow caption beside the zoom buttons, and little enough that the longest
// leaves the image most of the screen.
const captionHeightClassName = 'max-h-[25dvh]';

// The arrows move between images while the image shown is whole, and pan it while it's zoomed.
const imageMoveKeys: Partial<Record<string, 'previous' | 'next'>> = {
	ArrowLeft: 'previous',
	ArrowRight: 'next',
};

export type RecipeImageViewerBodyProps = {
	role: RecipeImageRole;
	images: readonly ShownImage[];
	title: string;
	startIndex: number;
	// Takes the button the viewer opens on: the one that moves on, or Close with one image.
	initialFocusRef: React.Ref<HTMLButtonElement>;
};

// The title bar with where you are, the zoom, Full size, and Close; the image; and the caption over a
// strip of every image. A chunk of its own, which RecipeImageViewer loads as a reader reaches for it:
// imported anywhere else, it brings the zoom and the carousel into that page's first JavaScript.
function RecipeImageViewerBody({
	role,
	images,
	title,
	startIndex,
	initialFocusRef,
}: RecipeImageViewerBodyProps) {
	const labels = imageViewerLabels(role);
	const several = images.length > 1;
	const [api, setApi] = React.useState<CarouselApi>();
	const [current, setCurrent] = React.useState(startIndex);
	// The zoom of the image shown, and the same as a drag reads it between renders.
	const [zoom, setZoom] = React.useState<ImageZoom | null>(null);
	const zoomRef = React.useRef<ImageZoom | null>(null);
	const shownZoomRef = React.useRef<ImageZoom | null>(null);

	const attachZoom = React.useCallback((attached: ImageZoom | null) => {
		zoomRef.current = attached;
		setZoom(attached);
	}, []);

	// A swipe moves between images only while the image shown is whole; zoomed, a drag pans it.
	const canSwipe = React.useCallback(() => !isZoomed(zoomRef.current), []);
	const options = React.useMemo(
		() => ({ startIndex, watchDrag: canSwipe }),
		[startIndex, canSwipe]
	);

	React.useEffect(() => {
		if (api === undefined) {
			return;
		}
		const onSelect = () => setCurrent(api.selectedScrollSnap());
		api.on('select', onSelect);
		return () => {
			api.off('select', onSelect);
		};
	}, [api]);

	// The image moved away from turns inert and drops the focus it held, which the new image takes.
	React.useEffect(() => {
		const previous = shownZoomRef.current;
		shownZoomRef.current = zoom;
		const frame = zoom?.instance.wrapperComponent;
		if (previous === null || frame === null || frame === undefined) {
			return;
		}
		const focused = document.activeElement;
		if (focused === null || focused === document.body || focused.closest('[inert]') !== null) {
			frame.focus({ preventScroll: true });
		}
	}, [zoom]);

	// Ahead of the carousel's own keys, from anywhere in the viewer: the zoom's keys first, and while
	// the image is whole, Left and Right move between images.
	const onKeyDownCapture = (event: React.KeyboardEvent) => {
		if (handleZoomKey(zoomRef.current, event)) {
			event.preventDefault();
			event.stopPropagation();
			return;
		}
		const move = imageMoveKeys[event.key];
		if (move === undefined || event.altKey || event.ctrlKey || event.metaKey) {
			return;
		}
		event.preventDefault();
		event.stopPropagation();
		if (move === 'previous') {
			api?.scrollPrev();
		} else {
			api?.scrollNext();
		}
	};

	const shownImage = images[current];
	// The viewer opens on the button that moves on rather than a disabled one: Next, or Previous from
	// the last image.
	const opensOnNext = startIndex < images.length - 1;
	// The row under the image has something to show from sm, where the zoom sits in the title bar.
	const hasFooterFromSm = several || images.some((image) => image.alt !== undefined);

	return (
		<div className="flex min-h-0 flex-1 flex-col" onKeyDownCapture={onKeyDownCapture}>
			<RecipeImageViewerTitleBar
				role={role}
				title={title}
				index={current}
				count={images.length}
				closeRef={several ? undefined : initialFocusRef}
			>
				<RecipeImageZoomControls zoom={zoom} className="hidden sm:flex" />
				{shownImage !== undefined && (
					// 44 px for a finger, like the buttons beside it.
					<FullSizeImageLink image={shownImage} className="mx-1 pointer-coarse:h-11" />
				)}
			</RecipeImageViewerTitleBar>
			<Carousel
				opts={options}
				setApi={setApi}
				aria-label={labels.region}
				className="min-h-0 flex-1 *:data-[slot=carousel-content]:h-full"
			>
				<CarouselContent className="h-full">
					{images.map((image, index) => {
						const isCurrent = index === current;
						const position = imagePositionLabel(role, index, images.length);
						return (
							// Only the current image can be reached; the others are off to the sides.
							<CarouselItem
								key={image.pathname}
								aria-label={position}
								inert={!isCurrent}
								className="h-full"
							>
								{/* Clear of Previous and Next: beside the image from sm, under it on phones. */}
								<div className={cn('size-full p-3 sm:px-16 sm:py-6', several && 'max-sm:pb-16')}>
									<ZoomableRecipeImage
										image={image}
										alt={image.alt ?? ''}
										label={position}
										frame={viewerFrameSize}
										active={isCurrent}
										zoomRef={isCurrent ? attachZoom : undefined}
										className="rounded-md"
										imageClassName="rounded-sm"
									/>
								</div>
							</CarouselItem>
						);
					})}
				</CarouselContent>
				{several && (
					<>
						{/* Focusable at either end, so focus stays put; 44 px for a finger. */}
						<CarouselPrevious
							ref={opensOnNext ? undefined : initialFocusRef}
							aria-label={labels.previous}
							focusableWhenDisabled
							className="left-3 size-9 bg-background/85 max-sm:top-auto max-sm:bottom-3 pointer-coarse:size-11"
						/>
						<CarouselNext
							ref={opensOnNext ? initialFocusRef : undefined}
							aria-label={labels.next}
							focusableWhenDisabled
							className="right-3 size-9 bg-background/85 max-sm:top-auto max-sm:bottom-3 pointer-coarse:size-11"
						/>
					</>
				)}
			</Carousel>
			<div
				className={cn(
					'flex flex-col gap-2 border-t px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]',
					!hasFooterFromSm && 'sm:hidden'
				)}
			>
				<div className="flex items-start justify-between gap-3">
					<RecipeImageCaption role={role} images={images} index={current} />
					<RecipeImageZoomControls zoom={zoom} className="-my-1 flex shrink-0 sm:hidden" />
				</div>
				{several && (
					<RecipeImageStrip
						role={role}
						images={images}
						current={current}
						onSelect={(index) => api?.scrollTo(index)}
						// Centered only while the row fits: centering a row that overflows would put its first
						// thumbnails past the left edge, out of the scroll's reach.
						className="-mx-1 sm:justify-center-safe"
					/>
				)}
			</div>
		</div>
	);
}

// The current image's description, announced with its place as it changes. Every description takes
// the same cell, hidden but the current one's, so the caption keeps the height of the longest and the
// image above keeps its size from image to image. Without descriptions it takes no room. A
// description taller than its cell scrolls inside it.
function RecipeImageCaption({
	role,
	images,
	index,
}: {
	role: RecipeImageRole;
	images: readonly ShownImage[];
	index: number;
}) {
	const described = images.some((image) => image.alt !== undefined);
	const scrollerRef = React.useRef<HTMLDivElement>(null);
	const [scrolls, setScrolls] = React.useState(false);

	// Each description starts at its top. Measured as the description changes, and again as the cell
	// or the text changes size.
	React.useEffect(() => {
		const scroller = scrollerRef.current;
		if (scroller === null) {
			return;
		}
		scroller.scrollTop = 0;
		const measure = () => setScrolls(scroller.scrollHeight > scroller.clientHeight);
		measure();
		const observer = new ResizeObserver(measure);
		observer.observe(scroller);
		if (scroller.firstElementChild !== null) {
			observer.observe(scroller.firstElementChild);
		}
		return () => observer.disconnect();
	}, [index]);

	return (
		<div
			className={cn('grid min-w-0 flex-1 *:col-start-1 *:row-start-1', described && 'min-h-6 py-1')}
		>
			{images.map((image) => (
				<p key={image.pathname} className={cn('invisible overflow-hidden', captionHeightClassName)}>
					{image.alt}
				</p>
			))}
			{/* Only a description that scrolls takes focus, so the keyboard can scroll it too. */}
			<div
				ref={scrollerRef}
				role={scrolls ? 'group' : undefined}
				aria-label={scrolls ? imageViewerLabels(role).description : undefined}
				tabIndex={scrolls ? 0 : undefined}
				className={cn(
					'overflow-y-auto rounded-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50',
					captionHeightClassName
				)}
			>
				<p role="status" aria-live="polite">
					{/* The place shows in the title bar; the announcement carries it too. */}
					{images.length > 1 && (
						<span className="sr-only">{imagePositionLabel(role, index, images.length)}. </span>
					)}
					{images[index]?.alt}
				</p>
			</div>
		</div>
	);
}

export { RecipeImageViewerBody };
