'use client';

import { cn } from 'cn';
import * as React from 'react';
import {
	imagePositionLabel,
	imageViewerLabels,
	viewImageLabel,
} from '@/components/recipe/recipe-image-viewer-labels';
import {
	FullSizeImageLink,
	ShownRecipeImage,
	type ShownImage,
} from '@/components/recipe/shown-recipe-image';
import { Button } from '@/components/ui/button';
import {
	Carousel,
	CarouselContent,
	CarouselItem,
	CarouselNext,
	CarouselPrevious,
	type CarouselApi,
} from '@/components/ui/carousel';
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from '@/components/ui/dialog';
import type { RecipeImageRole } from '@/domain/recipe/recipe-image';

type RecipeImageViewerContextValue = {
	role: RecipeImageRole;
	images: readonly ShownImage[];
};

type RecipeImageViewerProps = RecipeImageViewerContextValue & {
	// Names the dialog.
	title: string;
	// The triggers, laid out by the caller.
	children: React.ReactNode;
};

// Each role's slide width: the dialog's, at most 42rem less 1.5rem of padding on each side and within
// a 1rem margin, or narrower on a short screen, as viewerSlideClasses says.
const viewerSlideSizes = {
	dish: 'min(624px, 100vw - 80px, (100dvh - 12rem) * 4 / 3)',
	scan: 'min(624px, 100vw - 80px, (100dvh - 13rem) * 3 / 4)',
} as const satisfies Record<RecipeImageRole, string>;

// Each role's slide shape, narrowed on a short screen so the slide is at most the screen's height less
// the dialog's margin and padding, its title, and a one-line caption beside Previous and Next: 12rem,
// and 13rem for a scan, whose caption holds Full size under it.
const viewerSlideClasses = {
	dish: 'aspect-4/3 max-w-[calc((100dvh-12rem)*4/3)]',
	scan: 'aspect-3/4 max-w-[calc((100dvh-13rem)*3/4)]',
} as const satisfies Record<RecipeImageRole, string>;

// A scan is a page to read, so its caption links to the page at full size, past the optimizer.
const viewerLinksFullSize = {
	dish: false,
	scan: true,
} as const satisfies Record<RecipeImageRole, boolean>;

const RecipeImageViewerContext = React.createContext<RecipeImageViewerContextValue | null>(null);

function useRecipeImageViewer(): RecipeImageViewerContextValue {
	const context = React.useContext(RecipeImageViewerContext);
	if (context === null) {
		throw new Error('useRecipeImageViewer must be used within a <RecipeImageViewer />');
	}
	return context;
}

// Every image whole, one at a time; a trigger's payload is the index the viewer opens at.
function RecipeImageViewer({ role, images, title, children }: RecipeImageViewerProps) {
	const context = React.useMemo(() => ({ role, images }), [role, images]);
	const popupRef = React.useRef<HTMLDivElement>(null);
	// The carousel button the viewer opens on; with one image there is none, and the first control
	// takes focus: a scan's Full size, or Close.
	const initialFocusRef = React.useRef<HTMLButtonElement>(null);

	return (
		<RecipeImageViewerContext.Provider value={context}>
			<Dialog>
				{({ payload }) => (
					<>
						{children}
						{/* The slide shrinks to fit the dialog's height, the screen's less a margin, so only a
						caption longer than a line makes it scroll. */}
						<DialogContent ref={popupRef} initialFocus={initialFocusRef} className="sm:max-w-2xl">
							{/* Clears the close button in the corner. */}
							<DialogHeader className="pr-8">
								<DialogTitle>{title}</DialogTitle>
							</DialogHeader>
							<RecipeImageCarousel
								role={role}
								images={images}
								startIndex={typeof payload === 'number' ? payload : 0}
								popupRef={popupRef}
								initialFocusRef={initialFocusRef}
							/>
						</DialogContent>
					</>
				)}
			</Dialog>
		</RecipeImageViewerContext.Provider>
	);
}

// Opens the viewer at one image. The caller sizes and rounds it around the image it holds.
function RecipeImageViewerTrigger({
	index,
	className,
	children,
}: {
	index: number;
	className: string;
	children: React.ReactNode;
}) {
	const { role, images } = useRecipeImageViewer();

	return (
		<DialogTrigger
			payload={index}
			aria-label={viewImageLabel(role, index, images.length, images[index]?.alt)}
			className={cn('block overflow-hidden transition-shadow hover:shadow-md', className)}
		>
			{children}
		</DialogTrigger>
	);
}

// Opens the viewer at its first image, named by its own text, such as "View original".
function RecipeImageViewerButton({
	className,
	children,
}: {
	className?: string;
	children: React.ReactNode;
}) {
	return (
		<DialogTrigger payload={0} render={<Button variant="outline" className={className} />}>
			{children}
		</DialogTrigger>
	);
}

type InitialFocusProps = {
	startIndex: number;
	initialFocusRef: React.RefObject<HTMLButtonElement | null>;
};

type RecipeImageCarouselProps = RecipeImageViewerContextValue &
	InitialFocusProps & {
		// The viewer's popup, which takes the arrow keys the carousel does not.
		popupRef: React.RefObject<HTMLDivElement | null>;
	};

function RecipeImageCarousel({
	role,
	images,
	startIndex,
	popupRef,
	initialFocusRef,
}: RecipeImageCarouselProps) {
	const labels = imageViewerLabels(role);
	const [api, setApi] = React.useState<CarouselApi>();
	const [current, setCurrent] = React.useState(startIndex);

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

	// The carousel takes arrow keys only while it holds focus, so the rest of the viewer, such as Close,
	// takes them here. The popup stops arrow keys from bubbling past it, and those the carousel handled
	// arrive default-prevented.
	React.useEffect(() => {
		const popup = popupRef.current;
		if (api === undefined || popup === null) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.defaultPrevented) {
				return;
			}
			if (event.key === 'ArrowLeft') {
				event.preventDefault();
				api.scrollPrev();
			} else if (event.key === 'ArrowRight') {
				event.preventDefault();
				api.scrollNext();
			}
		};
		popup.addEventListener('keydown', onKeyDown);
		return () => {
			popup.removeEventListener('keydown', onKeyDown);
		};
	}, [api, popupRef]);

	return (
		<Carousel
			opts={{ startIndex }}
			setApi={setApi}
			aria-label={labels.region}
			className="flex flex-col gap-4"
		>
			<CarouselContent>
				{images.map((image, index) => (
					// Only the current image is read, as its caption says; the others are off to the sides.
					<CarouselItem
						key={image.pathname}
						aria-label={imagePositionLabel(role, index, images.length)}
						aria-hidden={index !== current}
					>
						<ShownRecipeImage
							image={image}
							alt={image.alt ?? ''}
							sizes={viewerSlideSizes[role]}
							fit="contain"
							className={cn('mx-auto rounded-md', viewerSlideClasses[role])}
						/>
					</CarouselItem>
				))}
			</CarouselContent>
			<RecipeImageCaption
				role={role}
				images={images}
				index={current}
				startIndex={startIndex}
				initialFocusRef={initialFocusRef}
			/>
		</Carousel>
	);
}

function RecipeImageCaptionLines({ alt, position }: { alt?: string; position: string }) {
	return (
		<>
			{alt !== undefined && <p>{alt}</p>}
			<p className="font-mono text-xs tracking-wide text-muted-foreground uppercase">{position}</p>
		</>
	);
}

// The current image's description and place, announced as it changes, beside Previous and Next; a
// scan's Full size sits under the description.
function RecipeImageCaption({
	role,
	images,
	index,
	startIndex,
	initialFocusRef,
}: RecipeImageViewerContextValue & InitialFocusProps & { index: number }) {
	const shownImage = images[index];
	const alt = shownImage?.alt;
	// 44 px for a finger, like Previous and Next.
	const fullSizeLink =
		shownImage !== undefined && viewerLinksFullSize[role] ? (
			<FullSizeImageLink image={shownImage} className="pointer-coarse:h-11" />
		) : null;
	if (images.length === 1) {
		return alt === undefined && fullSizeLink === null ? null : (
			<div className="flex flex-col items-start gap-2">
				{alt !== undefined && <p>{alt}</p>}
				{fullSizeLink}
			</div>
		);
	}

	const labels = imageViewerLabels(role);
	// The viewer opens on the button that moves on rather than a disabled one: Next, or Previous from
	// the last image.
	const opensOnNext = startIndex < images.length - 1;
	return (
		<div className="flex items-start justify-between gap-4">
			<div className="flex min-w-0 flex-col items-start gap-2">
				{/* Every image's caption takes the same cell, hidden but the current one's, so the viewer
				keeps the height of the longest and Previous and Next stay put from image to image. */}
				<div className="grid min-w-0 *:col-start-1 *:row-start-1">
					{images.map((image, imageIndex) => (
						<div key={image.pathname} className="invisible flex flex-col gap-1">
							<RecipeImageCaptionLines
								alt={image.alt}
								position={imagePositionLabel(role, imageIndex, images.length)}
							/>
						</div>
					))}
					<div role="status" aria-live="polite" className="flex flex-col gap-1">
						<RecipeImageCaptionLines
							alt={alt}
							position={imagePositionLabel(role, index, images.length)}
						/>
					</div>
				</div>
				{fullSizeLink}
			</div>
			<div className="flex shrink-0 gap-2">
				{/* Below the image rather than beside it, 44 px for a finger, and focusable at either end so
				focus stays put. */}
				<CarouselPrevious
					ref={opensOnNext ? undefined : initialFocusRef}
					className="static pointer-coarse:size-11"
					aria-label={labels.previous}
					focusableWhenDisabled
				/>
				<CarouselNext
					ref={opensOnNext ? initialFocusRef : undefined}
					className="static pointer-coarse:size-11"
					aria-label={labels.next}
					focusableWhenDisabled
				/>
			</div>
		</div>
	);
}

export { RecipeImageViewer, RecipeImageViewerButton, RecipeImageViewerTrigger };
