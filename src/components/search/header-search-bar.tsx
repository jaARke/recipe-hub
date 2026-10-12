import { cn } from 'cn';
import { SearchIcon } from 'lucide-react';
import Form from 'next/form';
import Link from 'next/link';
import { recipeSearchPath } from '@/components/recipe/recipe-paths';
import { recipeSearchParamNames } from '@/components/search/search-params';
import { buttonVariants } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';

// Phones have no room for a field, so they get a link to the search page.
function HeaderSearchLink({ className }: { className?: string }) {
	return (
		<Link
			href={recipeSearchPath}
			aria-label="Search recipes"
			className={cn(buttonVariants({ variant: 'ghost', size: 'icon' }), className)}
		>
			<SearchIcon aria-hidden="true" />
		</Link>
	);
}

// Starts a fresh search: only the query, with no filters or order.
function HeaderSearchForm({ id, className }: { id: string; className?: string }) {
	return (
		<search className={className}>
			<Form action={recipeSearchPath}>
				<Field className="w-56 lg:w-72">
					<FieldLabel htmlFor={id} className="sr-only">
						Search recipes
					</FieldLabel>
					<InputGroup>
						<InputGroupInput
							id={id}
							type="search"
							name={recipeSearchParamNames.text}
							enterKeyHint="search"
							placeholder="Search recipes"
						/>
						<InputGroupAddon>
							<SearchIcon aria-hidden="true" />
						</InputGroupAddon>
					</InputGroup>
				</Field>
			</Form>
		</search>
	);
}

function HeaderSearchBar() {
	return (
		<>
			<HeaderSearchLink className="sm:hidden" />
			<HeaderSearchForm id="header-search-query" className="hidden sm:block" />
		</>
	);
}

export { HeaderSearchBar, HeaderSearchForm, HeaderSearchLink };
