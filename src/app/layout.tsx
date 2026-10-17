import { cn } from 'cn';
import type { Metadata, Viewport } from 'next';
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import { SkipToMainContent } from '@/components/layout/main-content';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
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
};

// The browser's toolbar takes the header's color in the system's theme; a theme picked with the
// toggle does not reach it.
export const viewport: Viewport = {
	themeColor: [
		{ media: '(prefers-color-scheme: light)', color: tokenColors.light.background },
		{ media: '(prefers-color-scheme: dark)', color: tokenColors.dark.background },
	],
};

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
				<SkipToMainContent />
				<ThemeProvider>
					<TooltipProvider>
						<Toaster>{children}</Toaster>
					</TooltipProvider>
				</ThemeProvider>
			</body>
		</html>
	);
}
