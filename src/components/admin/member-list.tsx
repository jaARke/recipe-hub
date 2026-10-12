import type { MemberDto } from '@/application/members/member-dtos';
import { Badge } from '@/components/ui/badge';
import { formatDate } from '@/lib/dates';

// Oldest first.
function MemberList({ members }: { members: MemberDto[] }) {
	return (
		<ul className="divide-y">
			{members.map((member) => (
				<li key={member.id} className="flex flex-col gap-1 py-4">
					<p className="flex flex-wrap items-center gap-2 font-medium">
						{member.displayName}
						{member.role === 'admin' && <Badge variant="secondary">Admin</Badge>}
					</p>
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
						<p className="wrap-anywhere">{member.email}</p>
						<p>
							Joined{' '}
							<time dateTime={member.createdAt.toISOString()}>{formatDate(member.createdAt)}</time>
						</p>
					</div>
				</li>
			))}
		</ul>
	);
}

export { MemberList };
