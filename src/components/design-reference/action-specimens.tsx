import { ArrowRightIcon, ClockIcon, PlusIcon } from 'lucide-react';
import { Specimen, SpecimenLabel } from '@/components/design-reference/reference-section';
import { FavoriteHeartIcon } from '@/components/design-reference/stand-in-favorite-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '@/components/ui/pagination';
import { Spinner } from '@/components/ui/spinner';
import { Toggle } from '@/components/ui/toggle';

const buttonVariantNames = [
	'default',
	'outline',
	'secondary',
	'ghost',
	'destructive',
	'link',
] as const;
const buttonTextSizes = ['xs', 'sm', 'default', 'lg'] as const;
const buttonIconSizes = ['icon-xs', 'icon-sm', 'icon', 'icon-lg'] as const;
const toggleVariantNames = ['default', 'outline'] as const;
const toggleSizes = ['sm', 'default', 'lg'] as const;
const badgeVariantNames = [
	'default',
	'secondary',
	'destructive',
	'outline',
	'ghost',
	'link',
] as const;

function ButtonSpecimen() {
	return (
		<div className="flex flex-col gap-6">
			<Specimen label="Variants by size: xs, sm, default, lg, then disabled">
				<ul className="flex flex-col gap-6">
					{buttonVariantNames.map((variant) => (
						<li key={variant} className="flex flex-col gap-2">
							<SpecimenLabel>variant=&quot;{variant}&quot;</SpecimenLabel>
							<div className="flex flex-wrap items-center gap-3">
								{buttonTextSizes.map((size) => (
									<Button key={size} variant={variant} size={size}>
										Add recipe
									</Button>
								))}
								<Button variant={variant} disabled>
									Disabled
								</Button>
							</div>
						</li>
					))}
				</ul>
			</Specimen>
			<div className="grid gap-6 md:grid-cols-2">
				<Specimen label="Icon sizes: icon-xs, icon-sm, icon, icon-lg">
					<div className="flex flex-wrap items-center gap-3">
						{buttonIconSizes.map((size) => (
							<Button key={size} variant="outline" size={size} aria-label="Add recipe">
								<PlusIcon aria-hidden="true" />
							</Button>
						))}
					</div>
				</Specimen>
				<Specimen label="With icons and a pending state">
					<div className="flex flex-wrap items-center gap-3">
						<Button>
							<PlusIcon data-icon="inline-start" aria-hidden="true" />
							Add recipe
						</Button>
						<Button variant="outline">
							Next step
							<ArrowRightIcon data-icon="inline-end" aria-hidden="true" />
						</Button>
						<Button disabled>
							<Spinner data-icon="inline-start" />
							Saving
						</Button>
					</div>
				</Specimen>
			</div>
		</div>
	);
}

function ToggleSpecimen() {
	return (
		<div className="flex flex-col gap-6">
			<Specimen label="Variants by size: sm, default, lg, then disabled. Press one to fill its heart">
				<ul className="flex flex-col gap-6">
					{toggleVariantNames.map((variant) => (
						<li key={variant} className="flex flex-col gap-2">
							<SpecimenLabel>variant=&quot;{variant}&quot;</SpecimenLabel>
							<div className="flex flex-wrap items-center gap-3">
								{toggleSizes.map((size) => (
									<Toggle key={size} variant={variant} size={size} aria-label="Favorite">
										<FavoriteHeartIcon />
									</Toggle>
								))}
								<Toggle variant={variant} disabled aria-label="Favorite">
									<FavoriteHeartIcon />
								</Toggle>
							</div>
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label="Pressed, with an icon and with text">
				<div className="flex flex-wrap items-center gap-3">
					<Toggle variant="outline" defaultPressed aria-label="Favorite">
						<FavoriteHeartIcon />
					</Toggle>
					<Toggle variant="outline" defaultPressed>
						<FavoriteHeartIcon data-icon="inline-start" />
						Favorite
					</Toggle>
				</div>
			</Specimen>
		</div>
	);
}

function BadgeSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label="Variants">
				<ul className="flex flex-wrap items-center gap-3">
					{badgeVariantNames.map((variant) => (
						<li key={variant}>
							<Badge variant={variant}>{variant}</Badge>
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label="With an icon, and as a link">
				<div className="flex flex-wrap items-center gap-3">
					<Badge variant="outline">
						<ClockIcon data-icon="inline-start" aria-hidden="true" />
						35 min
					</Badge>
					<Badge variant="secondary" render={<a href="#badge" />}>
						Baking
					</Badge>
					<Badge render={<a href="#badge" />}>Favorite</Badge>
				</div>
			</Specimen>
		</div>
	);
}

// Every link stays on this page; the recipe list builds its own from the page count.
function SamplePageLinks({
	pages,
	currentPage,
}: {
	pages: readonly number[];
	currentPage: number;
}) {
	return pages.map((page) => (
		<PaginationItem key={page}>
			<PaginationLink
				href="#pagination"
				isActive={page === currentPage}
				aria-label={`Page ${page}`}
			>
				{page}
			</PaginationLink>
		</PaginationItem>
	));
}

// Each wraps on the narrowest phones, as RecipePagination does, and has its own name, since this page
// shows several.
function PaginationSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label="A middle page, with gaps on both sides">
				<Pagination aria-label="Pagination, a middle page">
					<PaginationContent className="flex-wrap justify-center">
						<PaginationItem>
							<PaginationPrevious href="#pagination" />
						</PaginationItem>
						<SamplePageLinks pages={[1]} currentPage={5} />
						<PaginationItem>
							<PaginationEllipsis />
						</PaginationItem>
						<SamplePageLinks pages={[4, 5, 6]} currentPage={5} />
						<PaginationItem>
							<PaginationEllipsis />
						</PaginationItem>
						<SamplePageLinks pages={[10]} currentPage={5} />
						<PaginationItem>
							<PaginationNext href="#pagination" />
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			</Specimen>
			<Specimen label="The first page, which has no previous link">
				<Pagination aria-label="Pagination, the first page">
					<PaginationContent className="flex-wrap justify-center">
						<SamplePageLinks pages={[1, 2, 3]} currentPage={1} />
						<PaginationItem>
							<PaginationNext href="#pagination" />
						</PaginationItem>
					</PaginationContent>
				</Pagination>
			</Specimen>
		</div>
	);
}

export { BadgeSpecimen, ButtonSpecimen, PaginationSpecimen, ToggleSpecimen };
