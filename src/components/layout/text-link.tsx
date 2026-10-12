import { cn } from 'cn';
import Link from 'next/link';
import * as React from 'react';

// A link inside running text.
function TextLink({ className, ...props }: React.ComponentProps<typeof Link>) {
	return <Link className={cn('text-primary underline underline-offset-4', className)} {...props} />;
}

export { TextLink };
