import Link from 'next/link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDuration } from '@/domain/recipe/duration';

type RecipeCardProps = {
	title: string;
	source: string;
	totalMinutes: number;
	yieldText: string;
	tags: readonly string[];
	href: string;
};

function RecipeCard({ title, source, totalMinutes, yieldText, tags, href }: RecipeCardProps) {
	return (
		<Link href={href} className="block h-full rounded-xl transition-shadow hover:shadow-md">
			<Card className="h-full">
				<CardHeader>
					<CardTitle>{title}</CardTitle>
					<CardDescription>From {source}</CardDescription>
				</CardHeader>
				<CardContent className="mt-auto">
					<dl className="flex flex-wrap gap-x-4 gap-y-1 font-mono text-xs tracking-wide text-muted-foreground uppercase">
						<div>
							<dt className="sr-only">Total time</dt>
							<dd>{formatDuration(totalMinutes)}</dd>
						</div>
						<div>
							<dt className="sr-only">Yield</dt>
							<dd>{yieldText}</dd>
						</div>
					</dl>
					{tags.length > 0 && (
						<ul className="flex flex-wrap gap-1.5">
							{tags.map((tag) => (
								<li key={tag}>
									<Badge variant="secondary">{tag}</Badge>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>
		</Link>
	);
}

function RecipeCardSkeleton() {
	return (
		// Purely visual: the loading region that renders skeletons announces the loading state.
		<Card aria-hidden="true" className="h-full">
			<CardHeader>
				<Skeleton className="h-6 w-3/4" />
				<Skeleton className="h-5 w-1/3" />
			</CardHeader>
			<CardContent className="mt-auto">
				<Skeleton className="h-4 w-1/2" />
				<div className="flex gap-1.5">
					<Skeleton className="h-5 w-16 rounded-4xl" />
					<Skeleton className="h-5 w-20 rounded-4xl" />
				</div>
			</CardContent>
		</Card>
	);
}

export { RecipeCard, RecipeCardSkeleton };
