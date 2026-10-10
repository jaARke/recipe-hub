import { cn } from 'cn';
import type { Metadata } from 'next';
import { Fraunces, Hanken_Grotesk, JetBrains_Mono } from 'next/font/google';
import { SiteHeader } from '@/components/layout/site-header';
import { ThemeProvider } from '@/components/layout/theme-provider';
import { Toaster } from '@/components/ui/toast';
import { TooltipProvider } from '@/components/ui/tooltip';
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
	title: { default: 'Recipe Hub', template: '%s | Recipe Hub' },
	description: 'Browse, search, and cook from a shared recipe collection.',
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
				<a
					href="#main"
					className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md"
				>
					Skip to main content
				</a>
				<ThemeProvider>
					<TooltipProvider>
						<Toaster>
							<SiteHeader />
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
