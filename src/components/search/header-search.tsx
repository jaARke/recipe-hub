'use client';

import { cn } from 'cn';
import { SearchIcon } from 'lucide-react';
import Form from 'next/form';
import { usePathname, useSearchParams } from 'next/navigation';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { recipeSearchPath } from '@/components/recipe/recipe-paths';
import { SearchQueryInput } from '@/components/search/search-query-input';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon } from '@/components/ui/input-group';

// Passed down from the server, where search-params.ts names the query's parameter.
type HeaderSearchProps = {
	// The search page's hidden fields join the form by its id, so a new query keeps the filters and
	// the order.
	formId: string;
	queryName: string;
	// The search page's syntax hint, which describes the field there.
	hintId: string;
};

type HeaderSearchFormProps = HeaderSearchProps & {
	query: string;
	searchPage: boolean;
	autoFocus?: boolean;
};

// From lg, a field that fills the header's row. Below lg, an icon that turns the row into the field
// with Cancel, which the search page opens with. Enter searches.
function HeaderSearchForm({
	formId,
	queryName,
	hintId,
	query,
	searchPage,
	autoFocus = false,
}: HeaderSearchFormProps) {
	const inputId = `${formId}-query`;
	const openButtonId = `${formId}-open`;
	// The search page opens with the field, and leaving it brings the row back.
	const [open, setOpen] = React.useState(searchPage);
	const [openedFor, setOpenedFor] = React.useState(searchPage);
	if (searchPage !== openedFor) {
		setOpenedFor(searchPage);
		setOpen(searchPage);
	}

	// Focused within the tap, so iOS raises the keyboard.
	function openField() {
		flushSync(() => setOpen(true));
		document.getElementById(inputId)?.focus();
	}

	// Brings the row back and keeps the query.
	function closeField() {
		flushSync(() => setOpen(false));
		document.getElementById(openButtonId)?.focus();
	}

	return (
		// The header hides the rest of its row below lg while this is open.
		<div
			data-search-open={open ? '' : undefined}
			className="flex flex-1 items-center justify-end gap-2 lg:mx-4"
		>
			<search className={cn('flex-1', !open && 'max-lg:hidden')}>
				<Form id={formId} action={recipeSearchPath}>
					<Field>
						<FieldLabel htmlFor={inputId} className="sr-only">
							Search recipes
						</FieldLabel>
						<InputGroup>
							<SearchQueryInput
								id={inputId}
								type="search"
								name={queryName}
								query={query}
								enterKeyHint="search"
								placeholder="Search recipes"
								autoFocus={autoFocus}
								aria-describedby={searchPage ? hintId : undefined}
							/>
							<InputGroupAddon>
								<SearchIcon aria-hidden="true" />
							</InputGroupAddon>
						</InputGroup>
					</Field>
				</Form>
			</search>
			{/* Keyed apart, so a swap replaces the button rather than renaming the focused one. */}
			{open ? (
				<Button key="cancel" variant="ghost" className="lg:hidden" onClick={closeField}>
					Cancel
				</Button>
			) : (
				<Button
					key="open"
					id={openButtonId}
					variant="ghost"
					size="icon"
					aria-label="Search recipes"
					className="lg:hidden"
					onClick={openField}
				>
					<SearchIcon aria-hidden="true" />
				</Button>
			)}
		</div>
	);
}

// On the search page the field holds the query, and an empty search page focuses it. Under Cache
// Components reading the URL suspends while prerendering, so this renders inside Suspense.
function HeaderSearch(props: HeaderSearchProps) {
	const searchPage = usePathname() === recipeSearchPath;
	const searchParams = useSearchParams();

	return (
		<HeaderSearchForm
			{...props}
			query={searchPage ? (searchParams.get(props.queryName) ?? '') : ''}
			searchPage={searchPage}
			autoFocus={searchPage && searchParams.size === 0}
		/>
	);
}

export { HeaderSearch, HeaderSearchForm };
