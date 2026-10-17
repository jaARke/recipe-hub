'use client';

import { cn } from 'cn';
import { ChevronLeftIcon, ChevronRightIcon } from 'lucide-react';
import * as React from 'react';
import { imageFit, imageRatioStyle, imageShape } from '@/components/recipe/recipe-image-shape';
import {
	RecipeImageViewer,
	RecipeImageViewerTrigger,
} from '@/components/recipe/recipe-image-viewer';
import { RecipePhoto } from '@/components/recipe/recipe-photo';
import { Button } from '@/components/ui/button';
import type { RecipeImage, RecipeImageRole } from '@/domain/recipe/recipe-image';
import { prefersReducedMotion } from '@/lib/reduced-motion';

// Each role's row height in pixels, on phones and from sm: a dish photo leads the page, and a page is
// there to be recognized, then read in the viewer.
const filmstripHeights = {
	dish: { phone: 240, wide: 320 },
	scan: { phone: 208, wide: 288 },
} as const satisfies Record<RecipeImageRole, { phone: number; wide: number }>;

// Sets the row's heights, which filmstripHeightClassName picks between at sm.
type FilmstripHeightStyle = React.CSSProperties &
	Record<'--filmstrip-phone-height' | '--filmstrip-wide-height', string>;

const filmstripHeightClassName =
	'[--filmstrip-height:var(--filmstrip-phone-height)] sm:[--filmstrip-height:var(--filmstrip-wide-height)]';

// Tailwind's sm breakpoint, where the row takes its taller height.
const smallScreenMinWidth = 640;

// The most of the column one image in a row takes, so the next always peeks in at the edge; a wider
// image is narrowed to it, and so is shorter than the row.
const maxColumnShare = 0.82;

// A lone image is at most this tall, or 70% of the screen, and narrowed to its shape.
const loneImageMaxHeight = 576;

// A reading-width container's column is 624px from 672px wide, and the screen less its padding below.
const readingColumn = { width: 624, fromScreenWidth: 672 };

// How far the row's arrows scroll it, of its width; its snap points settle it on an image.
const scrollShare = 0.8;

// The width an image in a row shows at: as wide as the row's height makes it, at most its share of
// the column.
function rowItemSizes(role: RecipeImageRole, image: RecipeImage): string {
	const { width, height } = imageShape(image.size);
	const { phone, wide } = filmstripHeights[role];
	const widthAt = (rowHeight: number) => Math.ceil((rowHeight * width) / height);
	return `(min-width: ${smallScreenMinWidth}px) min(${widthAt(wide)}px, ${Math.ceil(readingColumn.width * maxColumnShare)}px), min(${widthAt(phone)}px, ${maxColumnShare * 100}vw)`;
}

// The width a lone image shows at: the column's, or less where its height would pass the most.
function loneImageSizes(image: RecipeImage): string {
	const { width, height } = imageShape(image.size);
	const shapedWidth = Math.ceil((loneImageMaxHeight * width) / height);
	return `(min-width: ${readingColumn.fromScreenWidth}px) min(${readingColumn.width}px, ${shapedWidth}px), min(100vw, ${shapedWidth}px)`;
}

type RecipeFilmstripProps = {
	role: RecipeImageRole;
	// Names the viewer.
	title: string;
	images: readonly RecipeImage[];
	// For the first image the page shows, which loads with the page.
	preload?: boolean;
};

// The dish's photos or the original's pages, each whole in its own shape: one image across the
// column, or a row at one height that scrolls sideways. Each opens the viewer at itself. Left off the
// printout, which is for cooking from.
function RecipeFilmstrip({ role, title, images, preload = false }: RecipeFilmstripProps) {
	const [first] = images;
	if (first === undefined) {
		return null;
	}

	return (
		<RecipeImageViewer role={role} title={title} images={images}>
			<div className="print:hidden">
				{images.length === 1 ? (
					<LoneImage image={first} preload={preload} />
				) : (
					<FilmstripRow role={role} images={images} preload={preload} />
				)}
			</div>
		</RecipeImageViewer>
	);
}

// Across the column in its own shape, narrowed to it where it would stand taller than the screen
// allows.
function LoneImage({ image, preload }: { image: RecipeImage; preload: boolean }) {
	return (
		<div
			style={{
				...imageRatioStyle(image.size),
				width: `min(100%, min(${loneImageMaxHeight}px, 70svh) * var(--image-ratio))`,
			}}
			className="aspect-(--image-ratio)"
		>
			{/* Each button is named for its image, so the image inside it is decorative. */}
			<RecipeImageViewerTrigger
				index={0}
				className="size-full rounded-xl shadow-xs ring-1 ring-foreground/10"
			>
				<RecipePhoto
					pathname={image.pathname}
					alt=""
					sizes={loneImageSizes(image)}
					preload={preload}
					fit={imageFit(image.size)}
					className="size-full"
				/>
			</RecipeImageViewerTrigger>
		</div>
	);
}

function FilmstripRow({
	role,
	images,
	preload,
}: {
	role: RecipeImageRole;
	images: readonly RecipeImage[];
	preload: boolean;
}) {
	const rowRef = React.useRef<HTMLUListElement>(null);
	const [atStart, setAtStart] = React.useState(true);
	const [atEnd, setAtEnd] = React.useState(true);

	// Previous and Next show only where the row scrolls that way. The observer measures once as it
	// starts, and again as the column changes width.
	React.useEffect(() => {
		const row = rowRef.current;
		if (row === null) {
			return;
		}
		const measure = () => {
			setAtStart(row.scrollLeft <= 1);
			setAtEnd(row.scrollLeft + row.clientWidth >= row.scrollWidth - 1);
		};
		const observer = new ResizeObserver(measure);
		observer.observe(row);
		row.addEventListener('scroll', measure, { passive: true });
		return () => {
			observer.disconnect();
			row.removeEventListener('scroll', measure);
		};
	}, []);

	const scrollRow = (direction: 1 | -1) => {
		const row = rowRef.current;
		row?.scrollBy({
			left: direction * row.clientWidth * scrollShare,
			behavior: prefersReducedMotion() ? 'auto' : 'smooth',
		});
	};

	const { phone, wide } = filmstripHeights[role];
	const heightStyle: FilmstripHeightStyle = {
		'--filmstrip-phone-height': `${phone}px`,
		'--filmstrip-wide-height': `${wide}px`,
	};
	return (
		<div style={heightStyle} className={cn('@container relative', filmstripHeightClassName)}>
			{/* On a phone the row runs to the screen's edges and starts at the column's. It is padded so
			an image's focus ring shows inside it. */}
			<ul
				role="list"
				ref={rowRef}
				className="-mx-4 -my-1 flex snap-x snap-mandatory scroll-px-4 [scrollbar-width:thin] items-center gap-3 overflow-x-auto px-4 py-1 sm:-mx-1 sm:scroll-px-1 sm:px-1"
			>
				{images.map((image, index) => (
					<li
						key={image.pathname}
						style={{
							...imageRatioStyle(image.size),
							width: `min(var(--filmstrip-height) * var(--image-ratio), ${maxColumnShare * 100}cqw)`,
						}}
						className="aspect-(--image-ratio) shrink-0 snap-start"
					>
						<RecipeImageViewerTrigger
							index={index}
							className="size-full rounded-xl shadow-xs ring-1 ring-foreground/10"
						>
							<RecipePhoto
								pathname={image.pathname}
								alt=""
								sizes={rowItemSizes(role, image)}
								preload={preload && index === 0}
								fit={imageFit(image.size)}
								className="size-full"
							/>
						</RecipeImageViewerTrigger>
					</li>
				))}
			</ul>
			{/* For a mouse, which can't swipe the row; a keyboard reaches each image, and a finger swipes.
			They take no focus and are hidden from screen readers, which reach each image too. */}
			{!atStart && <FilmstripScrollButton direction={-1} onScroll={scrollRow} className="left-2" />}
			{!atEnd && <FilmstripScrollButton direction={1} onScroll={scrollRow} className="right-2" />}
		</div>
	);
}

function FilmstripScrollButton({
	direction,
	onScroll,
	className,
}: {
	direction: 1 | -1;
	onScroll: (direction: 1 | -1) => void;
	className: string;
}) {
	const Icon = direction === 1 ? ChevronRightIcon : ChevronLeftIcon;
	return (
		<Button
			variant="outline"
			size="icon"
			tabIndex={-1}
			aria-hidden="true"
			// Keeps focus where it was, as a button the keyboard can't reach should.
			onMouseDown={(event) => event.preventDefault()}
			onClick={() => onScroll(direction)}
			// Centered by its margins rather than a translate, which a button's press would replace.
			className={cn(
				'absolute inset-y-0 my-auto rounded-full bg-background/85 pointer-coarse:hidden',
				className
			)}
		>
			<Icon aria-hidden="true" />
		</Button>
	);
}

export { RecipeFilmstrip };
