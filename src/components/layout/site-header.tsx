import Link from 'next/link';
import { MainNav } from '@/components/layout/main-nav';
import { PageContainer } from '@/components/layout/page-container';
import { ThemeToggle } from '@/components/layout/theme-toggle';

function SiteHeader() {
	return (
		<header className="sticky top-0 z-40 border-b bg-background">
			<PageContainer width="wide" className="flex h-14 items-center gap-4">
				<Link href="/" className="rounded-md font-heading text-xl font-medium">
					Recipe Hub
				</Link>
				<MainNav />
				<div className="ml-auto">
					<ThemeToggle />
				</div>
			</PageContainer>
		</header>
	);
}

export { SiteHeader };
