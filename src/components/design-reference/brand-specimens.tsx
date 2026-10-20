import { cn } from 'cn';
import { Lockup } from '@/components/brand/lockup';
import { Mascot, mascotSizes, type MascotPose, type MascotSize } from '@/components/brand/mascot';
import { Wordmark } from '@/components/brand/wordmark';
import { Specimen, SpecimenLabel } from '@/components/design-reference/reference-section';

// Where each size appears; the mascot shows at most once in a screen's content.
const mascotSizeUses: Record<MascotSize, string> = {
	sm: 'the header lockup',
	lg: 'empty states',
	xl: 'the not-found and error pages, and the cooking view’s finish',
};

// Where each pose appears.
const mascotPoseUses: Record<MascotPose, string> = {
	grin: 'the lockups, the icons, the share cards, and the cooking view’s finish',
	worried: 'the not-found and error pages',
	sleeping: 'no recipes yet, in the cookbook or a chapter; no matches; and no favorites yet',
};

const wordmarkHeights = ['h-5', 'h-8', 'h-12'] as const;

function BrandSpecimens() {
	return (
		<div className="flex flex-col gap-10">
			<Specimen label="Lockup: the header’s link home, named by the wordmark">
				<Lockup />
			</Specimen>
			<Specimen label="Wordmark: Shantell Sans outlined, filled with the text color">
				<ul role="list" className="flex flex-col gap-6">
					{wordmarkHeights.map((height) => (
						<li key={height} className="flex flex-col items-start gap-2">
							{/* The largest outgrows a phone's column, so it scales down to fit. */}
							<Wordmark className={cn('w-auto max-w-full', height)} />
							<SpecimenLabel>{height}</SpecimenLabel>
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label="Mascot poses: each its own die-cut, shown at lg">
				<ul role="list" className="flex flex-wrap items-start gap-8">
					{(Object.keys(mascotPoseUses) as MascotPose[]).map((pose) => (
						<li key={pose} className="flex max-w-40 flex-col gap-2">
							<Mascot pose={pose} size="lg" />
							<SpecimenLabel>
								{pose}: {mascotPoseUses[pose]}
							</SpecimenLabel>
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label="Mascot sizes: the die-cut keeps its ink outline on both themes">
				<ul role="list" className="flex flex-wrap items-end gap-8">
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
