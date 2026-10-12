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
};

function RecipePagination({ page, pageCount, pageHref }: RecipePaginationProps) {
	return (
		<div className="flex flex-col items-center gap-3">
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
		</div>
	);
}

export { RecipePagination };
