import { ArrowRightIcon, ClockIcon, PlusIcon } from 'lucide-react';
import { Specimen, SpecimenLabel } from '@/components/design-reference/reference-section';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

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

export { BadgeSpecimen, ButtonSpecimen };
