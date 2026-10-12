import { KeyRoundIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { formatDate } from '@/lib/dates';

// What the account page shows of a passkey: the server keeps only its public key.
type PasskeySummary = {
	id: string;
	name?: string | null;
	createdAt?: Date | null;
};

type PasskeyListProps = {
	passkeys: readonly PasskeySummary[];
	// The passkey being removed, whose button waits.
	removingId?: string;
	onRemove: (id: string) => void;
};

function PasskeyList({ passkeys, removingId, onRemove }: PasskeyListProps) {
	if (passkeys.length === 0) {
		return <p className="text-muted-foreground">You haven&apos;t added a passkey yet.</p>;
	}

	return (
		<ul className="flex flex-col divide-y border-y">
			{passkeys.map((passkey) => {
				const name = passkey.name || 'Passkey';
				const added = passkey.createdAt ? formatDate(passkey.createdAt) : undefined;

				return (
					<li key={passkey.id} className="flex items-center justify-between gap-4 py-3">
						<div className="flex items-center gap-3">
							<KeyRoundIcon className="size-5 text-muted-foreground" aria-hidden="true" />
							<div>
								<p className="font-medium">{name}</p>
								{added !== undefined && (
									<p className="text-sm text-muted-foreground">Added {added}</p>
								)}
							</div>
						</div>
						<Button
							type="button"
							variant="ghost"
							disabled={removingId === passkey.id}
							focusableWhenDisabled
							onClick={() => onRemove(passkey.id)}
						>
							Remove
							<span className="sr-only">
								{added === undefined ? ` ${name}` : ` ${name}, added ${added}`}
							</span>
						</Button>
					</li>
				);
			})}
		</ul>
	);
}

function PasskeyListSkeleton() {
	return (
		<div role="status" className="flex flex-col divide-y border-y">
			<span className="sr-only">Loading passkeys</span>
			<div className="flex items-center justify-between gap-4 py-3">
				<div className="flex flex-col gap-1">
					<Skeleton className="h-5 w-24" />
					<Skeleton className="h-4 w-36" />
				</div>
				<Skeleton className="h-9 w-20" />
			</div>
		</div>
	);
}

export { PasskeyList, PasskeyListSkeleton };
