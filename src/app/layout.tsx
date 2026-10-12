import { cn } from 'cn';
import type { Metadata } from 'next';
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import { Suspense } from 'react';
import { SessionRenewal } from '@/components/auth/session-renewal';
import { HeaderAccount, HeaderAccountPlaceholder } from '@/components/layout/header-account';
import { SiteHeader } from '@/components/layout/site-header';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
import { getMemberService } from '@/composition/services';
import { siteUrl } from '@/lib/env';
import { siteName } from '@/lib/site';
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
	description: 'Browse, search, and cook from a shared recipe collection.',
	// Kept out of search results until launch; links are still followed so crawlers see each noindex.
	robots: { index: false, follow: true },
};

// Reads the session, so it streams in behind its own boundary instead of holding up the page.
async function SiteHeaderAccount() {
	const member = await getMemberService().getCurrentMember();
	return (
		<>
			<HeaderAccount
				member={member === null ? null : { displayName: member.displayName, role: member.role }}
			/>
			{member !== null && <SessionRenewal />}
		</>
	);
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
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
							<SiteHeader
								account={
									<Suspense fallback={<HeaderAccountPlaceholder />}>
										<SiteHeaderAccount />
									</Suspense>
								}
							/>
							<main id="main" className="flex-1">
								{children}
							</main>
						</Toaster>
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
