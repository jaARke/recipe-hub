import { cn } from 'cn';
import { ChevronLeftIcon } from 'lucide-react';
import Link from 'next/link';
import type * as React from 'react';

// GOV.UK's back link, above a page's title, naming the page it leads back to. A printout shows none.
function BackLink({ className, children, ...props }: React.ComponentProps<typeof Link>) {
	return (
		<Link
			className={cn(
				'inline-flex items-center gap-1 self-start text-sm underline underline-offset-4 print:hidden',
				className
			)}
			{...props}
		>
			<ChevronLeftIcon aria-hidden="true" className="size-4" />
			{children}
		</Link>
	);
}

export { BackLink };
