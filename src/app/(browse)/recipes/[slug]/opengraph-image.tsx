import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { connection } from 'next/server';
import {
	openGraphFontFamilies,
	openGraphImageContentType,
	openGraphImageSize,
	renderOpenGraphImage,
} from '@/app/_lib/open-graph-image';
import { getCachedRecipe, recipeCacheTags } from '@/app/_lib/recipe-cache';
import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { getRecipeImageService } from '@/composition/services';
import { coverImage } from '@/domain/recipe/recipe-image';
import { siteName } from '@/lib/site';
import { tokenColors } from '@/lib/token-colors';

type ImageProps = {
	params: Promise<{ slug: string }>;
};

type ShareCardProps = {
	title: string;
	source?: string;
	// A data URL, or null to set the title alone.
	photo: string | null;
};

type TitleSizes = {
	short: number;
	medium: number;
	long: number;
};

// Vercel's CDN may keep a card a year: its URL carries the recipe's revision, so an edit names a new
// card, and a write's tag purge drops it when the recipe is deleted.
const cardCdnMaxAgeSeconds = 365 * 24 * 60 * 60;

// Vercel's CDN strips s-maxage. Browsers check back, since the URL's hash covers this file but not the
// shared card styles.
const cardCacheControl = `public, max-age=0, must-revalidate, s-maxage=${cardCdnMaxAgeSeconds}`;

// Satori draws only these: WebP renders blank and AVIF throws.
const drawableContentTypes = ['image/jpeg', 'image/png'];

const shortTitleLength = 24;
const mediumTitleLength = 48;

const photoLayout = {
	padding: '64px 56px 72px 72px',
	titleSizes: { short: 72, medium: 60, long: 50 },
	titleLines: 4,
};

const textLayout = {
	padding: '72px 96px 80px 96px',
	titleSizes: { short: 96, medium: 80, long: 60 },
	titleLines: 3,
};

// The id carries the revision, so an edit changes the image URL that link previews cache.
function revisionId(recipe: PublicRecipeDto): string {
	return String(recipe.updatedAt.getTime());
}

function imageAlt(recipe: PublicRecipeDto): string {
	return recipe.source === undefined ? recipe.title : `${recipe.title}, from ${recipe.source}`;
}

// The slug asked for and the current one, as getCachedRecipe tags them, so a card cached under an
// old slug is purged too.
function cardCacheTags(slug: string, recipe: PublicRecipeDto): string {
	return [...new Set([slug, recipe.slug])].map(recipeCacheTags.recipe).join(',');
}

// The line clamp catches titles that are still too long at the smallest size.
function titleFontSize(title: string, sizes: TitleSizes): number {
	if (title.length <= shortTitleLength) {
		return sizes.short;
	}

	if (title.length <= mediumTitleLength) {
		return sizes.medium;
	}

	return sizes.long;
}

// Pathnames are never reused, so a photo's data URL never goes stale.
async function getDrawablePhoto(pathname: string): Promise<string | null> {
	'use cache';
	cacheLife('max');

	const image = await getRecipeImageService().getPublicImage(pathname);
	if (image === null) {
		return null;
	}

	if (!drawableContentTypes.includes(image.contentType)) {
		await image.body.cancel();
		return null;
	}

	const bytes = Buffer.from(await new Response(image.body).arrayBuffer());
	return `data:${image.contentType};base64,${bytes.toString('base64')}`;
}

function ShareCard({ title, source, photo }: ShareCardProps) {
	const layout = photo === null ? textLayout : photoLayout;

	return (
		<div
			style={{
				display: 'flex',
				width: '100%',
				height: '100%',
				backgroundColor: tokenColors.light.background,
				color: tokenColors.light.foreground,
			}}
		>
			<div style={{ width: 24, height: '100%', backgroundColor: tokenColors.light.primary }} />
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					flex: 1,
					padding: layout.padding,
				}}
			>
				<div
					style={{
						fontFamily: openGraphFontFamilies.heading,
						fontSize: 32,
						color: tokenColors.light.primary,
					}}
				>
					{siteName}
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
					<div
						style={{
							// Satori clamps lines only on block elements.
							display: 'block',
							lineClamp: layout.titleLines,
							fontFamily: openGraphFontFamilies.heading,
							fontSize: titleFontSize(title, layout.titleSizes),
							lineHeight: 1.08,
							letterSpacing: '-0.02em',
						}}
					>
						{title}
					</div>
					{source !== undefined && (
						<div
							style={{
								display: 'block',
								lineClamp: 2,
								fontFamily: openGraphFontFamilies.body,
								fontSize: 32,
								color: tokenColors.light.mutedForeground,
							}}
						>
							{`From ${source}`}
						</div>
					)}
				</div>
			</div>
			{photo !== null && (
				<img
					src={photo}
					alt=""
					width={540}
					height={openGraphImageSize.height}
					style={{ objectFit: 'cover' }}
				/>
			)}
		</div>
	);
}

export async function generateImageMetadata({ params }: { params: { slug?: string } }) {
	// The build asks without a slug, before any recipe is known.
	if (params.slug === undefined) {
		return [];
	}

	const recipe = await getCachedRecipe(params.slug);
	if (recipe === null) {
		return [];
	}

	return [
		{
			id: revisionId(recipe),
			alt: imageAlt(recipe),
			size: openGraphImageSize,
			contentType: openGraphImageContentType,
		},
	];
}

// Next answers 404 itself for an id that generateImageMetadata did not list.
export default async function Image({ params }: ImageProps) {
	// The JPEG encoding is not cached, so the card renders per request and the CDN keeps it.
	await connection();
	const { slug } = await params;
	const recipe = await getCachedRecipe(slug);
	if (recipe === null) {
		notFound();
	}

	const cover = coverImage(recipe.images);
	const photo = cover === undefined ? null : await getDrawablePhoto(cover.pathname);
	const card = await renderOpenGraphImage(
		<ShareCard title={recipe.title} source={recipe.source} photo={photo} />
	);

	return new Response(card, {
		headers: {
			'Content-Type': openGraphImageContentType,
			'Cache-Control': cardCacheControl,
			'Vercel-Cache-Tag': cardCacheTags(slug, recipe),
		},
	});
}
