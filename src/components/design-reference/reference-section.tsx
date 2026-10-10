import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from 'cn';
import * as React from 'react';

const specimenVariants = cva('min-w-0', {
	variants: {
		frame: {
			framed: 'rounded-xl border bg-card p-6',
			// For specimens whose items carry their own frames, such as swatch tiles.
			bare: '',
		},
	},
	defaultVariants: {
		frame: 'framed',
	},
});

function ReferenceSection({
	id,
	title,
	description,
	children,
}: {
	id: string;
	title: string;
	description: string;
	children: React.ReactNode;
}) {
	return (
		<section
			id={id}
			aria-labelledby={`${id}-heading`}
			className="flex scroll-mt-20 flex-col gap-10 border-t pt-12"
		>
			<header className="flex flex-col gap-2">
				<h2 id={`${id}-heading`} className="font-heading text-3xl font-medium">
					{title}
				</h2>
				<p className="max-w-2xl text-muted-foreground">{description}</p>
			</header>
			{children}
		</section>
	);
}

function ReferenceSubsection({
	id,
	title,
	description,
	children,
}: {
	id: string;
	title: string;
	description?: string;
	children: React.ReactNode;
}) {
	return (
		<div id={id} className="flex scroll-mt-20 flex-col gap-4">
			<div className="flex flex-col gap-1">
				<h3 className="font-heading text-xl font-medium">{title}</h3>
				{description && <p className="text-sm text-muted-foreground">{description}</p>}
			</div>
			{children}
		</div>
	);
}

function Specimen({
	label,
	frame,
	className,
	figureClassName,
	children,
}: {
	label?: string;
	className?: string;
	// Grid placement belongs on the figure, which is the grid item.
	figureClassName?: string;
	children: React.ReactNode;
} & VariantProps<typeof specimenVariants>) {
	return (
		<figure className={cn('flex min-w-0 flex-col gap-2', figureClassName)}>
			{label && (
				<figcaption>
					<SpecimenLabel>{label}</SpecimenLabel>
				</figcaption>
			)}
			<div className={cn(specimenVariants({ frame, className }))}>{children}</div>
		</figure>
	);
}

function SpecimenLabel({ className, ...props }: React.ComponentProps<'span'>) {
	return <span className={cn('font-mono text-xs text-muted-foreground', className)} {...props} />;
}

export { ReferenceSection, ReferenceSubsection, Specimen, SpecimenLabel };
