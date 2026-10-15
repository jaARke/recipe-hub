import 'server-only';
import { unstable_rethrow } from 'next/navigation';
import { connection } from 'next/server';

// A part of a page for its one reader, such as the header's member or a recipe's edit link, reads
// the session. A failed read is logged and the part falls back, so the page around it, which anyone
// can read, still shows rather than the error page. Next's own control-flow errors still pass through.
export async function readForReader<Value, Fallback>(
	read: () => Promise<Value>,
	// The part's own log line, a constant message as every log line is, and what it shows instead.
	failure: { log: (error: unknown) => void; fallback: Fallback }
): Promise<Value | Fallback> {
	// The session read is request work. Waiting for the request outside the catch leaves a render Next
	// ends first, such as a prerender or the dev server's validation render, to Next.
	await connection();
	try {
		return await read();
	} catch (error) {
		unstable_rethrow(error);
		failure.log(error);
		return failure.fallback;
	}
}
