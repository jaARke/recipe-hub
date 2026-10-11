import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { cacheLife } from 'next/cache';
import { notFound } from 'next/navigation';
import { ImageResponse } from 'next/og';
import { getCachedRecipe } from '@/app/_lib/recipe-cache';
import type { PublicRecipeDto } from '@/application/recipes/recipe-dtos';
import { siteName } from '@/components/layout/site-name';
import { getRecipeImageService } from '@/composition/services';
import { coverImage } from '@/domain/recipe/recipe-image';

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

const size = { width: 1200, height: 630 };
const contentType = 'image/png';

// Mirror the light theme tokens in globals.css as sRGB, since Satori reads no CSS variables or oklch.
const colors = {
	background: '#fcfcfb',
	foreground: '#191816',
	mutedForeground: '#61605e',
	primary: '#1b626e',
};

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

const fontsDirectory = join(process.cwd(), 'assets/fonts');
const [frauncesMedium, hankenGroteskRegular] = await Promise.all([
	readFile(join(fontsDirectory, 'fraunces-soft-medium.ttf')),
	readFile(join(fontsDirectory, 'hanken-grotesk-regular.ttf')),
]);

// The id carries the revision, so an edit changes the image URL that link previews cache.
function revisionId(recipe: PublicRecipeDto): string {
	return String(recipe.updatedAt.getTime());
}

function imageAlt(recipe: PublicRecipeDto): string {
	return recipe.source === undefined ? recipe.title : `${recipe.title}, from ${recipe.source}`;
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
				backgroundColor: colors.background,
				color: colors.foreground,
			}}
		>
			<div style={{ width: 24, height: '100%', backgroundColor: colors.primary }} />
			<div
				style={{
					display: 'flex',
					flexDirection: 'column',
					justifyContent: 'space-between',
					flex: 1,
					padding: layout.padding,
				}}
			>
				<div style={{ fontFamily: 'Fraunces', fontSize: 32, color: colors.primary }}>
					{siteName}
				</div>
				<div style={{ display: 'flex', flexDirection: 'column', gap: 28 }}>
					<div
						style={{
							// Satori clamps lines only on block elements.
							display: 'block',
							lineClamp: layout.titleLines,
							fontFamily: 'Fraunces',
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
								fontFamily: 'Hanken Grotesk',
								fontSize: 32,
								color: colors.mutedForeground,
							}}
						>
							{`From ${source}`}
						</div>
					)}
				</div>
			</div>
			{photo !== null && (
				<img src={photo} alt="" width={540} height={size.height} style={{ objectFit: 'cover' }} />
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

	return [{ id: revisionId(recipe), alt: imageAlt(recipe), size, contentType }];
}

// Next answers 404 itself for an id that generateImageMetadata did not list.
export default async function Image({ params }: ImageProps) {
	const { slug } = await params;
	const recipe = await getCachedRecipe(slug);
	if (recipe === null) {
		notFound();
	}

	const cover = coverImage(recipe.images);
	const photo = cover === undefined ? null : await getDrawablePhoto(cover.pathname);

	return new ImageResponse(
		<ShareCard title={recipe.title} source={recipe.source} photo={photo} />,
		{
			...size,
			fonts: [
				{ name: 'Fraunces', data: frauncesMedium, weight: 500, style: 'normal' },
				{ name: 'Hanken Grotesk', data: hankenGroteskRegular, weight: 400, style: 'normal' },
			],
		}
	);
}
