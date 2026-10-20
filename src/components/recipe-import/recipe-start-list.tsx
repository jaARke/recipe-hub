import {
	CameraIcon,
	ChevronRightIcon,
	LinkIcon,
	PencilLineIcon,
	type LucideIcon,
} from 'lucide-react';
import Link from 'next/link';
import * as React from 'react';
import { recipeEntryPaths } from '@/components/recipe-import/recipe-entry-paths';
import type { Provenance } from '@/domain/recipe/provenance';

type EntryMode = Provenance['entryMode'];

// Each way to start a recipe, in the order the start page offers them.
const recipeStarts = {
	manual: {
		icon: PencilLineIcon,
		title: 'Type it in',
		description: 'Fill in the recipe yourself.',
	},
	url: {
		icon: LinkIcon,
		title: 'From a link',
		description: 'Copy a recipe from a website by pasting its address.',
	},
	photo: {
		icon: CameraIcon,
		title: 'From photos',
		description: 'Take or choose photos of a recipe card or a cookbook page, and we’ll read it.',
	},
} as const satisfies Record<EntryMode, { icon: LucideIcon; title: string; description: string }>;

const entryModes = Object.keys(recipeStarts) as EntryMode[];

// The ways to start a recipe, each row a link to its page, named by its title and described by its
// line, with the chevron of a link that leads on.
function RecipeStartList() {
	const baseId = React.useId();

	return (
		<ul role="list" className="divide-y rounded-xl border">
			{entryModes.map((mode) => {
				const { icon: Icon, title, description } = recipeStarts[mode];
				const ids = {
					title: `${baseId}-${mode}-title`,
					description: `${baseId}-${mode}-description`,
				};
				return (
					<li key={mode} className="first:rounded-t-xl last:rounded-b-xl">
						<Link
							href={recipeEntryPaths[mode]}
							aria-labelledby={ids.title}
							aria-describedby={ids.description}
							className="group flex items-center gap-4 rounded-[inherit] p-4 hover:bg-state-layer"
						>
							<span className="flex size-11 shrink-0 items-center justify-center rounded-full bg-secondary">
								<Icon aria-hidden="true" className="size-5" />
							</span>
							<span className="flex min-w-0 flex-1 flex-col gap-0.5">
								<span
									id={ids.title}
									className="font-medium underline-offset-4 group-hover:underline"
								>
									{title}
								</span>
								<span id={ids.description} className="text-sm text-muted-foreground">
									{description}
								</span>
							</span>
							<ChevronRightIcon
								aria-hidden="true"
								className="size-5 shrink-0 text-muted-foreground"
							/>
						</Link>
					</li>
				);
			})}
		</ul>
	);
}

export { RecipeStartList };
