import { Badge } from '@/components/ui/badge';

// A count beside a label, such as a tab's, read after a comma ("Drafts, 2"). Zero shows nothing.
// Narrowed as shadcn's count badges are, so three labelled tabs fit a 320 px screen.
function CountBadge({ count }: { count: number }) {
	if (count === 0) {
		return null;
	}

	return (
		<Badge variant="outline" className="min-w-5 px-1 tabular-nums">
			<span className="sr-only">, </span>
			{count}
		</Badge>
	);
}

export { CountBadge };
