import { cn } from 'cn';
import { Specimen, SpecimenLabel } from '@/components/design-reference/reference-section';
import { ColorTokenValue } from '@/components/design-reference/token-value';

type TokenRef = {
	utility: string;
	variable: `--${string}`;
};

type ColorSwatch = {
	name: string;
	sampleClassName: string;
	tokens: readonly TokenRef[];
	note?: string;
};

type LineToken = {
	token: TokenRef;
	usage: string;
	sampleClassName: string;
};

const colorSwatches: readonly ColorSwatch[] = [
	{
		name: 'background',
		sampleClassName: 'bg-background text-foreground',
		tokens: [
			{ utility: 'bg-background', variable: '--background' },
			{ utility: 'text-foreground', variable: '--foreground' },
		],
	},
	{
		name: 'card',
		sampleClassName: 'bg-card text-card-foreground',
		tokens: [
			{ utility: 'bg-card', variable: '--card' },
			{ utility: 'text-card-foreground', variable: '--card-foreground' },
		],
	},
	{
		name: 'popover',
		sampleClassName: 'bg-popover text-popover-foreground',
		tokens: [
			{ utility: 'bg-popover', variable: '--popover' },
			{ utility: 'text-popover-foreground', variable: '--popover-foreground' },
		],
	},
	{
		name: 'primary',
		sampleClassName: 'bg-primary text-primary-foreground',
		tokens: [
			{ utility: 'bg-primary', variable: '--primary' },
			{ utility: 'text-primary-foreground', variable: '--primary-foreground' },
		],
	},
	{
		name: 'secondary',
		sampleClassName: 'bg-secondary text-secondary-foreground',
		tokens: [
			{ utility: 'bg-secondary', variable: '--secondary' },
			{ utility: 'text-secondary-foreground', variable: '--secondary-foreground' },
		],
	},
	{
		name: 'muted',
		sampleClassName: 'bg-muted text-muted-foreground',
		tokens: [
			{ utility: 'bg-muted', variable: '--muted' },
			{ utility: 'text-muted-foreground', variable: '--muted-foreground' },
		],
	},
	{
		name: 'accent',
		sampleClassName: 'bg-accent text-accent-foreground',
		tokens: [
			{ utility: 'bg-accent', variable: '--accent' },
			{ utility: 'text-accent-foreground', variable: '--accent-foreground' },
		],
	},
	{
		name: 'highlight',
		sampleClassName: 'bg-highlight text-highlight-foreground',
		tokens: [
			{ utility: 'bg-highlight', variable: '--highlight' },
			{ utility: 'text-highlight-foreground', variable: '--highlight-foreground' },
		],
		note: 'Search matches. The mark element sets it, with bolder text so a match never relies on color.',
	},
	{
		name: 'destructive',
		sampleClassName: 'bg-destructive/10 text-destructive',
		tokens: [{ utility: 'text-destructive', variable: '--destructive' }],
		note: 'No foreground pair. Primitives set it as text on a 10 percent tint.',
	},
	{
		name: 'favorite',
		sampleClassName: 'bg-muted text-favorite',
		tokens: [{ utility: 'text-favorite', variable: '--favorite' }],
		note: 'No foreground pair. A pressed favorite toggle fills its heart with it, on the pressed surface.',
	},
];

const lineTokens: readonly LineToken[] = [
	{
		token: { utility: 'border-border', variable: '--border' },
		usage: 'Dividers and surface edges.',
		sampleClassName: 'border border-border',
	},
	{
		token: { utility: 'border-input', variable: '--input' },
		usage: 'Form control outlines.',
		sampleClassName: 'border border-input',
	},
	{
		token: { utility: 'border-edge', variable: '--edge' },
		usage: 'Inked edges on cards and outline buttons.',
		sampleClassName: 'border border-edge',
	},
	{
		token: { utility: 'ring-ring', variable: '--ring' },
		usage: 'Focus, as a solid border plus a 3px ring at 50 percent.',
		sampleClassName: 'border border-ring ring-3 ring-ring/50',
	},
];

function TokenRow({ token }: { token: TokenRef }) {
	return (
		<div className="flex flex-col gap-0.5">
			<dt className="font-mono text-xs">{token.utility}</dt>
			<dd className="min-h-4">
				<SpecimenLabel>
					<ColorTokenValue name={token.variable} />
				</SpecimenLabel>
			</dd>
		</div>
	);
}

function ColorSpecimens() {
	return (
		<div className="flex flex-col gap-10">
			<Specimen label="Surfaces with their paired text" frame="bare">
				<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{colorSwatches.map((swatch) => (
						<li key={swatch.name} className="flex flex-col overflow-hidden rounded-xl border">
							<div className={cn('flex h-24 items-end gap-3 p-4', swatch.sampleClassName)}>
								<span className="font-heading text-3xl font-semibold">Aa</span>
								<span className="text-sm">Buttermilk biscuits</span>
							</div>
							<div className="flex flex-1 flex-col gap-3 border-t bg-card p-4">
								<dl className="flex flex-col gap-3">
									{swatch.tokens.map((token) => (
										<TokenRow key={token.utility} token={token} />
									))}
								</dl>
								{swatch.note && <p className="text-xs text-muted-foreground">{swatch.note}</p>}
							</div>
						</li>
					))}
				</ul>
			</Specimen>
			<Specimen label="Lines and outlines" frame="bare">
				<ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
					{lineTokens.map((line) => (
						<li
							key={line.token.utility}
							className="flex flex-col overflow-hidden rounded-xl border"
						>
							<div className="bg-background p-6">
								<div className={cn('h-9 rounded-md', line.sampleClassName)} />
							</div>
							<div className="flex flex-1 flex-col gap-3 border-t bg-card p-4">
								<dl>
									<TokenRow token={line.token} />
								</dl>
								<p className="text-xs text-muted-foreground">{line.usage}</p>
							</div>
						</li>
					))}
				</ul>
			</Specimen>
		</div>
	);
}

export { ColorSpecimens };
