import * as React from 'react';

const mainContentId = 'main';

// First in the body, so a keyboard user's first Tab can pass the header. Shown only while focused.
function SkipToMainContent() {
	return (
		<a
			href={`#${mainContentId}`}
			className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:rounded-md focus:border focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-medium focus:text-foreground focus:shadow-md"
		>
			Skip to main content
		</a>
	);
}

// Every page's main landmark, the skip link's target. It fills the body's height, so the footer
// sits at the bottom of a short page.
function MainContent({ children }: { children: React.ReactNode }) {
	return (
		<main id={mainContentId} className="flex-1">
			{children}
		</main>
	);
}

export { MainContent, SkipToMainContent };
