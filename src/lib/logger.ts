import 'server-only';
import { AppError } from '@/lib/errors';

type LogLevel = 'info' | 'warn' | 'error';

// Values go in fields, never in the message; `err` takes an error and is serialized with its cause.
export type LogFields = Record<string, unknown> & { err?: unknown };

export type Logger = Record<LogLevel, (message: string, fields?: LogFields) => void>;

// Drizzle's query errors end their message with the query's parameters, which can hold email
// addresses, so the parameters are cut.
const queryParametersSeparator = '\nparams: ';

function serializeError(error: unknown): unknown {
	if (!(error instanceof Error)) {
		return error;
	}

	// The stack starts with the message, so it loses the parameters too.
	const message = error.message.split(queryParametersSeparator)[0] ?? '';
	return {
		name: error.name,
		message,
		...(error instanceof AppError && { code: error.code }),
		stack: error.stack?.replace(error.message, message),
		...(error.cause !== undefined && { cause: serializeError(error.cause) }),
	};
}

function write(level: LogLevel, logger: string, message: string, fields: LogFields = {}) {
	const { err, ...rest } = fields;
	const record = {
		level,
		logger,
		message,
		...rest,
		...(err !== undefined && { err: serializeError(err) }),
	};

	// One JSON line per event. Vercel takes the level from the console method, not the JSON body.
	console[level](JSON.stringify(record));
}

export function getLogger(logger: string): Logger {
	return {
		info: (message, fields) => write('info', logger, message, fields),
		warn: (message, fields) => write('warn', logger, message, fields),
		error: (message, fields) => write('error', logger, message, fields),
	};
}
