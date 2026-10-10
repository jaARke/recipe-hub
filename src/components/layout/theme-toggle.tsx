'use client';

import { MoonIcon, SunIcon } from 'lucide-react';
import { useTheme } from 'next-themes';
import { Button } from '@/components/ui/button';
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

type ThemeOption = { value: 'light' | 'dark' | 'system'; label: string };

const themeOptions: readonly ThemeOption[] = [
	{ value: 'light', label: 'Light' },
	{ value: 'dark', label: 'Dark' },
	{ value: 'system', label: 'System' },
];

function ThemeToggle() {
	const { theme, setTheme } = useTheme();

	return (
		<DropdownMenu>
			<DropdownMenuTrigger
				render={<Button variant="ghost" size="icon" aria-label="Change theme" />}
			>
				{/* The server cannot know the theme, so the icon follows the html class instead of state. */}
				<SunIcon className="dark:hidden" aria-hidden="true" />
				<MoonIcon className="hidden dark:block" aria-hidden="true" />
			</DropdownMenuTrigger>
			<DropdownMenuContent align="end">
				<DropdownMenuRadioGroup value={theme} onValueChange={setTheme}>
					<DropdownMenuLabel>Theme</DropdownMenuLabel>
					{themeOptions.map((option) => (
						<DropdownMenuRadioItem key={option.value} value={option.value} closeOnClick>
							{option.label}
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

export { ThemeToggle };
