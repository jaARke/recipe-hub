'use client';

import { cn } from 'cn';
import { SearchIcon } from 'lucide-react';
import Form from 'next/form';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { flushSync } from 'react-dom';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import { whenRecipeResultsShown } from '@/components/search/recipe-results-loading';
import { Button } from '@/components/ui/button';
import { Field, FieldLabel } from '@/components/ui/field';
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group';
import { Spinner } from '@/components/ui/spinner';
import { hrefWithParams } from '@/lib/url-query';

type HeaderSearchProps = {
	// Begins the ids of the field, its label, the icon that opens it, and Cancel, so each header search
	// on a page, as on the design reference, keeps its own.
	idPrefix: string;
	// The words' parameter, which search-params.ts names on the server.
	queryName: string;
	// The Recipes page's heading, focusable with tabIndex -1, which takes the search's focus once its
	// results show.
	resultsHeadingId: string;
};

// Searches every recipe from scratch, whatever page it is typed on. From lg a field that fills the
// header's row; below lg an icon that turns the row into the field, with Cancel. Once submitted the
// field keeps its words, read-only with a spinner, until the results show, then empties, and closes
// below lg, since the Recipes page's own field holds the words. The focus the search held moves to
// the page's heading, as a page link's would, so the results come next in reading order.
function HeaderSearch({ idPrefix, queryName, resultsHeadingId }: HeaderSearchProps) {
	const inputId = `${idPrefix}-query`;
	const labelId = `${idPrefix}-label`;
	const openButtonId = `${idPrefix}-open`;
	const cancelButtonId = `${idPrefix}-cancel`;
	const router = useRouter();
	const [open, setOpen] = React.useState(false);
	// From the submission until the results show.
	const [searching, setSearching] = React.useState(false);
	// The navigation's own transition, since next/form reports no pending navigation. It ends as the
	// page's skeletons show, and the results' loading states say when they give way.
	const [navigating, startNavigation] = React.useTransition();
	// Whether the open field or Cancel, which leaves with it, held focus as its search ended on a page
	// with no Recipes heading, such as the not-found page, so the icon takes it.
	const focusOpenButton = React.useRef(false);

	// Focused within the tap, so iOS raises the keyboard.
	function openField() {
		flushSync(() => setOpen(true));
		document.getElementById(inputId)?.focus();
	}

	// Brings the row back and keeps the words.
	function closeField() {
		flushSync(() => setOpen(false));
		document.getElementById(openButtonId)?.focus();
	}

	// Navigates as the form would submit, with its one field and none of the page's.
	function search(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (searching) {
			return;
		}
		const params = new URLSearchParams();
		for (const [name, value] of new FormData(event.currentTarget)) {
			if (typeof value === 'string') {
				params.append(name, value);
			}
		}
		setSearching(true);
		startNavigation(() => router.push(hrefWithParams(recipeListPath, params)));
	}

	// Once the navigation commits, the search ends as its results show.
	React.useEffect(() => {
		if (!searching || navigating) {
			return;
		}
		return whenRecipeResultsShown(() => {
			const input = document.getElementById(inputId);
			if (input instanceof HTMLInputElement) {
				input.value = '';
				const focused = document.activeElement;
				const heldFocus = focused === input || focused?.id === cancelButtonId;
				const heading = document.getElementById(resultsHeadingId);
				if (heldFocus && heading !== null) {
					heading.focus();
				} else {
					focusOpenButton.current = open && heldFocus;
				}
			}
			setSearching(false);
			setOpen(false);
		});
	}, [searching, navigating, inputId, cancelButtonId, resultsHeadingId, open]);

	React.useLayoutEffect(() => {
		if (open || !focusOpenButton.current) {
			return;
		}
		focusOpenButton.current = false;
		document.getElementById(openButtonId)?.focus();
	}, [open, openButtonId]);

	return (
		// The header hides the rest of its row below lg while this is open.
		<div
			data-search-open={open ? '' : undefined}
			className="flex flex-1 items-center justify-end gap-2 lg:mx-4"
		>
			<search aria-labelledby={labelId} className={cn('flex-1', !open && 'max-lg:hidden')}>
				<Form action={recipeListPath} aria-busy={searching} onSubmit={search}>
					<Field>
						<FieldLabel id={labelId} htmlFor={inputId} className="sr-only">
							Search recipes
						</FieldLabel>
						<InputGroup>
							<InputGroupInput
								id={inputId}
								type="search"
								name={queryName}
								enterKeyHint="search"
								placeholder="Search recipes"
								readOnly={searching}
							/>
							<InputGroupAddon>
								{searching ? <Spinner /> : <SearchIcon aria-hidden="true" />}
							</InputGroupAddon>
						</InputGroup>
					</Field>
				</Form>
			</search>
			{/* Keyed apart, so a swap replaces the button rather than renaming the focused one. */}
			{open ? (
				<Button
					key="cancel"
					id={cancelButtonId}
					variant="ghost"
					className="lg:hidden"
					onClick={closeField}
				>
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

export { HeaderSearch };
