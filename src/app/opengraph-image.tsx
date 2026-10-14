import { cacheLife } from 'next/cache';
import {
	openGraphFontFamilies,
	openGraphImageContentType,
	openGraphImageSize,
	renderOpenGraphImage,
} from '@/app/_lib/open-graph-image';
import { siteDescription, siteName } from '@/lib/site';
import { tokenColors } from '@/lib/token-colors';

export const alt = `${siteName}. ${siteDescription}`;
export const size = openGraphImageSize;
export const contentType = openGraphImageContentType;

function SiteCard() {
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
					justifyContent: 'center',
					gap: 40,
					flex: 1,
					padding: '72px 96px 80px 96px',
				}}
			>
				<div
					style={{
						fontFamily: openGraphFontFamilies.heading,
						fontSize: 128,
						lineHeight: 1,
						letterSpacing: '-0.02em',
						color: tokenColors.light.primary,
					}}
				>
					{siteName}
				</div>
				<div
					style={{
						maxWidth: 820,
						fontFamily: openGraphFontFamilies.body,
						fontSize: 44,
						lineHeight: 1.3,
						color: tokenColors.light.mutedForeground,
					}}
				>
					{siteDescription}
				</div>
			</div>
		</div>
	);
}

// Cached, so the build draws the card once and serves it as a static file.
async function renderSiteCard(): Promise<Uint8Array<ArrayBuffer>> {
	'use cache';
	cacheLife('max');
	return renderOpenGraphImage(<SiteCard />);
}

export default async function Image() {
	return new Response(await renderSiteCard(), { headers: { 'Content-Type': contentType } });
}
