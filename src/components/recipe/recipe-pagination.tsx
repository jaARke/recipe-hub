import { pageItems } from '@/components/recipe/page-items';
import { recipeListPath } from '@/components/recipe/recipe-paths';
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '@/components/ui/pagination';

function RecipePagination({ page, pageCount }: { page: number; pageCount: number }) {
	return (
		<div className="flex flex-col items-center gap-3">
			<Pagination>
				{/* Wraps on the narrowest phones rather than scrolling sideways. */}
				<PaginationContent className="flex-wrap justify-center">
					{page > 1 && (
						<PaginationItem>
							<PaginationPrevious href={recipeListPath(page - 1)} />
						</PaginationItem>
					)}
					{pageItems(page, pageCount).map((item) =>
						item.kind === 'gap' ? (
							<PaginationItem key={`gap-${item.afterPage}`}>
								<PaginationEllipsis />
							</PaginationItem>
						) : (
							<PaginationItem key={item.page}>
								<PaginationLink
									href={recipeListPath(item.page)}
									isActive={item.page === page}
									aria-label={`Page ${item.page}`}
								>
									{item.page}
								</PaginationLink>
							</PaginationItem>
						)
					)}
					{page < pageCount && (
						<PaginationItem>
							<PaginationNext href={recipeListPath(page + 1)} />
						</PaginationItem>
					)}
				</PaginationContent>
			</Pagination>
			<p className="text-sm text-muted-foreground">
				Page {page} of {pageCount}
			</p>
		</div>
	);
}

export { RecipePagination };
