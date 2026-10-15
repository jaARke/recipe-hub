import { cn } from 'cn';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import { Suspense } from 'react';
import { readHeaderMember } from '@/app/_lib/read-header-member';
import { mergeDeviceFavorites } from '@/app/(browse)/favorites/actions';
import { SessionRenewal } from '@/components/auth/session-renewal';
import { DeviceFavoritesMerge } from '@/components/favorites/device-favorites-merge';
import type { HeaderMember } from '@/components/layout/header-member';
import { SiteFooter } from '@/components/layout/site-footer';
import { SiteHeader } from '@/components/layout/site-header';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getMemberService } from '@/composition/services';
import { siteUrl } from '@/lib/env';
import { siteDescription, siteName } from '@/lib/site';
import { tokenColors } from '@/lib/token-colors';
import './globals.css';

const fraunces = Fraunces({
	variable: '--font-fraunces',
	subsets: ['latin'],
	axes: ['SOFT', 'opsz'],
});

const hankenGrotesk = Hanken_Grotesk({
	variable: '--font-hanken-grotesk',
	subsets: ['latin'],
});

const jetbrainsMono = JetBrains_Mono({
	variable: '--font-jetbrains-mono',
	subsets: ['latin'],
});

export const metadata: Metadata = {
	metadataBase: siteUrl,
	title: { default: siteName, template: `%s | ${siteName}` },
	description: siteDescription,
	// The opengraph-image file convention fills in the images, which pages without their own inherit.
	openGraph: { type: 'website', siteName },
	twitter: { card: 'summary_large_image' },
	// Kept out of search results until launch; links are still followed so crawlers see each noindex.
	robots: { index: false, follow: true },
};

// The browser's toolbar takes the header's color in the system's theme; a theme picked with the
// toggle does not reach it.
export const viewport: Viewport = {
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: tokenColors.light.background },
		{ media: '(prefers-color-scheme: dark)', color: tokenColors.dark.background },
	],
};

// Renews a signed-in member's session once the read resolves, behind its own boundary.
async function MemberSessionRenewal({ member }: { member: Promise<HeaderMember | null> }) {
	return (await member) === null ? null : <SessionRenewal />;
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
	// Read once and not awaited here: each part that shows it streams in behind its own boundary,
	// so the session never holds up the page.
	const member = readHeaderMember(() => getMemberService().getCurrentMember());

	return (
		<html
			lang="en"
			// next-themes sets the theme class on <html> before hydration.
			suppressHydrationWarning
			className={cn(
				fraunces.variable,
				hankenGrotesk.variable,
				jetbrainsMono.variable,
				'h-full antialiased'
			)}
		>
			<body className="flex min-h-full flex-col">
				<a
					href="#main"
					className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md"
				>
					Skip to main content
				</a>
				<ThemeProvider>
					<TooltipProvider>
						<Toaster>
							<SiteHeader member={member} />
							<Suspense>
								<MemberSessionRenewal member={member} />
							</Suspense>
							<Suspense>
								<DeviceFavoritesMerge member={member} mergeAction={mergeDeviceFavorites} />
							</Suspense>
							<main id="main" className="flex-1">
								{children}
							</main>
							<SiteFooter />
						</Toaster>
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
