'use client';

import { ThemeProvider as NextThemesProvider } from 'next-themes';
import * as React from 'react';

function ThemeProvider({ children }: { children: React.ReactNode }) {
	return (
		<NextThemesProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			disableTransitionOnChange
		>
			{children}
		</NextThemesProvider>
	);
}

export { ThemeProvider };
