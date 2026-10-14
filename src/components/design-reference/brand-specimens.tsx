import { cn } from 'cn';
import { Lockup } from '@/components/brand/lockup';
import { Mascot, mascotSizes, type MascotSize } from '@/components/brand/mascot';
import { Wordmark } from '@/components/brand/wordmark';
import { Specimen, SpecimenLabel } from '@/components/design-reference/reference-section';

// Where each size appears; the mascot shows at most once in a screen's content.
const mascotSizeUses: Record<MascotSize, string> = {
	sm: 'the header lockup',
	md: 'the sign-in, invite, and request-access headings',
	lg: 'empty states',
	xl: 'the not-found page',
};

const wordmarkHeights = ['h-5', 'h-8', 'h-12'] as const;

function BrandSpecimens() {
	return (
		<div className="flex flex-col gap-10">
			<Specimen label="Lockup: the header's link home, named by the wordmark">
				<Lockup />
			</Specimen>
			<Specimen label="Wordmark: Shantell Sans outlined, filled with the text color">
				<ul className="flex flex-col gap-6">
					{wordmarkHeights.map((height) => (
						<li key={height} className="flex flex-col items-start gap-2">
							{/* The largest outgrows a phone's column, so it scales down to fit. */}
							<Wordmark className={cn('w-auto max-w-full', height)} />
							<SpecimenLabel>{height}</SpecimenLabel>
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label="Mascot: the die-cut keeps its ink outline on both themes">
				<ul className="flex flex-wrap items-end gap-8">
					{(Object.keys(mascotSizeUses) as MascotSize[]).map((size) => (
						<li key={size} className="flex flex-col gap-2">
							<Mascot size={size} />
							<SpecimenLabel>
								{size}, {mascotSizes[size]} px: {mascotSizeUses[size]}
							</SpecimenLabel>
						</li>
					))}
				</ul>
			</Specimen>
		</div>
	);
}

export { BrandSpecimens };
