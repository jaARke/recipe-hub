import { cn } from 'cn';
import { Loader2Icon } from 'lucide-react';

// The explicit aria-live, which the role implies, keeps the spinner announced while a Base UI popup
// hides everything else from screen readers.
function Spinner({ className, ...props }: React.ComponentProps<'svg'>) {
	return (
		<Loader2Icon
			data-slot="spinner"
			// A status only when labelled with what loads, since one in a pending button joins its name.
			{...(props['aria-label'] === undefined
				? { 'aria-hidden': true }
				: { role: 'status', 'aria-live': 'polite' })}
			className={cn('size-4 animate-spin', className)}
			{...props}
		/>
	);
}

export { Spinner };
