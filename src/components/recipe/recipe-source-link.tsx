// A page the recipe came from, named by its host. Search engines don't follow the link, and the page
// isn't told which recipe sent the reader.
function RecipeSourceLink({ url }: { url: string }) {
	return (
		<a
			href={url}
			rel="nofollow noopener noreferrer"
			className="text-primary underline underline-offset-4"
		>
			{new URL(url).hostname}
		</a>
	);
}

function RecipeImportedFrom({ sourceUrl }: { sourceUrl: string }) {
	return (
		<p className="text-sm text-muted-foreground">
			Imported from <RecipeSourceLink url={sourceUrl} />
		</p>
	);
}

export { RecipeImportedFrom, RecipeSourceLink };
