import { PageChangeFocus } from '@/components/recipe/page-change-focus';
import { pageItems } from '@/components/recipe/page-items';
import {
	Pagination,
	PaginationContent,
	PaginationEllipsis,
	PaginationItem,
	PaginationLink,
	PaginationNext,
	PaginationPrevious,
} from '@/components/ui/pagination';

type RecipePaginationProps = {
	page: number;
	pageCount: number;
	// Each page's link, carrying whatever else the URL holds, such as the order.
	pageHref: (page: number) => string;
	// The heading above the results, focusable with tabIndex -1, which takes focus on a page change.
	resultsHeadingId: string;
};

function RecipePagination({ page, pageCount, pageHref, resultsHeadingId }: RecipePaginationProps) {
	return (
		<PageChangeFocus page={page} resultsHeadingId={resultsHeadingId}>
			<Pagination>
				{/* Wraps on the narrowest phones rather than scrolling sideways. */}
				<PaginationContent className="flex-wrap justify-center">
					{page > 1 && (
						<PaginationItem>
							<PaginationPrevious href={pageHref(page - 1)} />
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
									href={pageHref(item.page)}
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
							<PaginationNext href={pageHref(page + 1)} />
						</PaginationItem>
					)}
				</PaginationContent>
			</Pagination>
			<p className="text-sm text-muted-foreground">
				Page {page} of {pageCount}
			</p>
		</PageChangeFocus>
	);
}

export { RecipePagination };
