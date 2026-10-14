import { cn } from 'cn';
import { Specimen, SpecimenLabel } from '@/components/design-reference/reference-section';
import { TokenValue } from '@/components/design-reference/token-value';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

const radiusSteps = [
	'rounded-sm',
	'rounded-md',
	'rounded-lg',
	'rounded-xl',
	'rounded-2xl',
	'rounded-3xl',
	'rounded-4xl',
] as const;

const shadowSteps = ['shadow-xs', 'shadow-sm', 'shadow-md', 'shadow-lg'] as const;

function ShapeSpecimens() {
	return (
		<div className="flex flex-col gap-10">
			<Specimen label="Radius: every step derives from --radius">
				<div className="flex flex-col gap-6">
					<p className="text-sm text-muted-foreground">
						Base radius <code className="font-mono text-xs text-foreground">--radius</code> is{' '}
						<code className="font-mono text-xs text-foreground">
							<TokenValue name="--radius" />
						</code>
						. Buttons and inputs use md, cards and dialogs xl, badges 4xl.
					</p>
					<ul className="grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-7">
						{radiusSteps.map((step) => (
							<li key={step} className="flex flex-col gap-2">
								<div className={cn('h-16 border bg-muted', step)} />
								<SpecimenLabel>{step}</SpecimenLabel>
							</li>
						))}
					</ul>
				</div>
			</Specimen>
			<Specimen label="Shadow: four steps, tinted with the foreground hue">
				<ul className="grid grid-cols-2 gap-6 lg:grid-cols-4">
					{shadowSteps.map((step) => (
						<li key={step} className="flex flex-col gap-3">
							<Card className={cn('h-20', step)} />
							<SpecimenLabel>{step}</SpecimenLabel>
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label="Focus: one treatment for every control">
				<div className="flex flex-col gap-6">
					<div className="flex flex-col gap-2">
						<SpecimenLabel>Static preview</SpecimenLabel>
						<div className="flex h-9 w-full max-w-xs items-center rounded-md border border-ring px-2.5 text-sm ring-3 ring-ring/50">
							Focused control
						</div>
					</div>
					<div className="flex flex-col gap-2">
						<SpecimenLabel>Press Tab to move focus through these controls</SpecimenLabel>
						<div className="flex flex-wrap items-center gap-4">
							<Button variant="outline">Edit recipe</Button>
							<Input aria-label="Focus sample" placeholder="Focus sample" className="max-w-xs" />
							<Checkbox aria-label="Focus sample checkbox" />
						</div>
					</div>
				</div>
			</Specimen>
		</div>
	);
}

export { ShapeSpecimens };
