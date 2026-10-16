import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { AccountSpecimens } from '@/components/design-reference/account-specimens';
import { BrandSpecimens } from '@/components/design-reference/brand-specimens';
import { ColorSpecimens } from '@/components/design-reference/color-specimens';
import { CompositionSpecimens } from '@/components/design-reference/composition-specimens';
import { PrimitiveSpecimens } from '@/components/design-reference/primitive-specimens';
import { ReferenceSection } from '@/components/design-reference/reference-section';
import { ShapeSpecimens } from '@/components/design-reference/shape-specimens';
import { TypographySpecimens } from '@/components/design-reference/typography-specimens';
import { PageContainer } from '@/components/layout/page-container';
import { buttonVariants } from '@/components/ui/button';
import { env } from '@/lib/env';
import { siteName } from '@/lib/site';

const isDesignReferenceEnabled = env.NODE_ENV === 'development' || env.VERCEL_ENV === 'preview';

export function generateMetadata(): Metadata {
	// Gated here as well, so production's 404 carries the not-found page's title.
	if (!isDesignReferenceEnabled) {
		notFound();
	}

	return { title: 'Design reference', robots: { index: false, follow: false } };
}

const sections = [
	{
		id: 'brand',
		title: 'Brand',
		description:
			'The lockup, the wordmark, and the mascot at each size it is drawn. The theme toggle shows them on the dark theme.',
		Content: BrandSpecimens,
	},
	{
		id: 'color',
		title: 'Color',
		description:
			'Semantic tokens for every surface and its text. Values are read from the page and follow the theme toggle.',
		Content: ColorSpecimens,
	},
	{
		id: 'typography',
		title: 'Typography',
		description: 'Three families and one type scale with paired line heights.',
		Content: TypographySpecimens,
	},
	{
		id: 'shape',
		title: 'Shape and depth',
		description: 'Radius, shadow, and the focus treatment every control shares.',
		Content: ShapeSpecimens,
	},
	{
		id: 'primitives',
		title: 'Primitives',
		description:
			'Every component in src/components/ui with its variants, sizes, and states. Overlays are fully operable.',
		Content: PrimitiveSpecimens,
	},
	{
		id: 'compositions',
		title: 'Compositions',
		description: 'Primitives assembled the way recipe screens will use them, with sample content.',
		Content: CompositionSpecimens,
	},
	{
		id: 'accounts',
		title: 'Accounts and admin',
		description:
			'The header’s account controls, the account pages, and the admin page, with sample members and stand-ins for their actions.',
		Content: AccountSpecimens,
	},
] as const;

export default function DesignReferencePage() {
	// Production prerenders this check into a static 404.
	if (!isDesignReferenceEnabled) {
		notFound();
	}

	return (
		<PageContainer width="wide" className="flex flex-col gap-12 py-12 sm:py-16">
			<header className="flex flex-col gap-6">
				<div className="flex flex-col gap-3">
					<h1 className="font-heading text-4xl font-semibold">Design reference</h1>
					<p className="max-w-2xl text-lg text-muted-foreground">
						The tokens, primitives, and compositions behind {siteName}, for tuning the design
						language. It exists only in development and on preview deployments.
					</p>
				</div>
				<nav aria-label="Design reference sections">
					<ul className="flex flex-wrap gap-2">
						{sections.map((section) => (
							<li key={section.id}>
								<a
									href={`#${section.id}`}
									className={buttonVariants({ variant: 'outline', size: 'sm' })}
								>
									{section.title}
								</a>
							</li>
						))}
					</ul>
				</nav>
			</header>
			{sections.map(({ id, title, description, Content }) => (
				<ReferenceSection key={id} id={id} title={title} description={description}>
					<Content />
				</ReferenceSection>
			))}
		</PageContainer>
	);
}
