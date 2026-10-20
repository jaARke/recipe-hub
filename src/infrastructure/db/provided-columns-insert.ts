import 'server-only';
import { getTableColumns, sql, type InferModelFromColumns } from 'drizzle-orm';
import type { PgColumn, PgDatabase, PgQueryResultHKT, PgTable } from 'drizzle-orm/pg-core';

// A column of the table, so a selection naming another table's column fails to compile.
type ColumnOf<TTable extends PgTable> = TTable['_']['columns'][keyof TTable['_']['columns']];

// Inserts one row naming only the columns it sets, where Drizzle's insert names every column the
// schema declares, so writes still succeed once a column they leave out is dropped while this code
// serves. Every column the row leaves out takes the database's default. Returns the selected columns
// of the inserted row, decoded as a select decodes them.
export async function insertProvidedColumns<
	TTable extends PgTable,
	TSelection extends Record<string, ColumnOf<TTable>>,
>(
	db: PgDatabase<PgQueryResultHKT>,
	table: TTable,
	row: TTable['$inferInsert'],
	returning: TSelection
): Promise<InferModelFromColumns<TSelection>> {
	const values: Record<string, unknown> = row;
	const provided = Object.entries(getTableColumns(table)).filter(
		([key]) => values[key] !== undefined
	);
	const names = provided.map(([, column]) => sql.identifier(column.name));
	const params = provided.map(([key, column]) => sql.param(values[key], column));
	const returned = Object.values(returning).map((column) => sql.identifier(column.name));

	// Widened, since Drizzle's select types do not resolve over a generic selection.
	const selection: Record<string, PgColumn> = returning;
	const inserted = db
		.$with('inserted', selection)
		.as(
			sql`insert into ${table} (${sql.join(names, sql`, `)}) values (${sql.join(params, sql`, `)}) returning ${sql.join(returned, sql`, `)}`
		);
	const [result] = await db.with(inserted).select().from(inserted);
	return result as InferModelFromColumns<TSelection>;
}
