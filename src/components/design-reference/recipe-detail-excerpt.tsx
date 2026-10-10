import { cn } from 'cn';
import { sampleRecipe } from '@/components/design-reference/fixtures';
import { PageContainer } from '@/components/layout/page-container';
import { Badge } from '@/components/ui/badge';

// The recipe page's text hierarchy, shared by the typography specimen and the detail excerpt.
const recipeTextStyles = {
	title: 'font-heading text-4xl font-medium md:text-5xl',
	section: 'font-heading text-2xl font-medium',
	subsection: 'text-lg font-semibold',
	body: 'text-lg',
	supporting: 'text-lg text-muted-foreground',
	meta: 'font-mono text-xs tracking-wide uppercase',
} as const;

function RecipeMetaRow({ items }: { items: readonly { label: string; value: string }[] }) {
	return (
		<dl className={cn(recipeTextStyles.meta, 'flex flex-wrap gap-x-6 gap-y-2')}>
			{items.map((item) => (
				<div key={item.label} className="flex gap-2">
					<dt className="text-muted-foreground">{item.label}</dt>
					<dd>{item.value}</dd>
				</div>
			))}
		</dl>
	);
}

function RecipeDetailExcerpt() {
	return (
		<PageContainer width="reading">
			<article aria-labelledby="sample-recipe-title" className="flex flex-col gap-10">
				<header className="flex flex-col gap-4">
					<h4 id="sample-recipe-title" className={recipeTextStyles.title}>
						{sampleRecipe.title}
					</h4>
					<p className={recipeTextStyles.supporting}>From {sampleRecipe.source}</p>
					<RecipeMetaRow items={sampleRecipe.meta} />
					<ul className="flex flex-wrap gap-1.5">
						{sampleRecipe.tags.map((tag) => (
							<li key={tag}>
								<Badge variant="secondary">{tag}</Badge>
							</li>
						))}
					</ul>
				</header>
				<p className={recipeTextStyles.body}>{sampleRecipe.description}</p>
				<div className="flex flex-col gap-6">
					<h5 className={recipeTextStyles.section}>Ingredients</h5>
					{sampleRecipe.ingredientSections.map((section, index) => (
						<div key={section.heading ?? index} className="flex flex-col gap-3">
							{section.heading && (
								<h6 className={recipeTextStyles.subsection}>{section.heading}</h6>
							)}
							<ul className={cn(recipeTextStyles.body, 'flex flex-col gap-2')}>
								{section.ingredients.map((ingredient) => (
									<li key={ingredient.item}>
										<span className="font-semibold">{ingredient.quantity}</span> {ingredient.item}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>
				<div className="flex flex-col gap-6">
					<h5 className={recipeTextStyles.section}>Steps</h5>
					<ol
						className={cn(
							recipeTextStyles.body,
							'list-decimal space-y-4 pl-6 marker:font-mono marker:text-sm marker:text-muted-foreground'
						)}
					>
						{sampleRecipe.steps.map((step) => (
							<li key={step} className="pl-2">
								{step}
							</li>
						))}
					</ol>
				</div>
				<aside className="flex flex-col gap-2 rounded-xl bg-muted p-6">
					<p className={cn(recipeTextStyles.meta, 'text-muted-foreground')}>Notes</p>
					<p className={recipeTextStyles.body}>{sampleRecipe.note}</p>
				</aside>
			</article>
		</PageContainer>
	);
}

export { RecipeDetailExcerpt, RecipeMetaRow, recipeTextStyles };
