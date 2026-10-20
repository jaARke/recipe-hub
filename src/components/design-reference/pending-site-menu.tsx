'use client';

import type { HeaderMember } from '@/components/layout/header-member';
import { SiteMenu } from '@/components/layout/site-menu';

// Reads that never finish, made in the browser so the server's response still ends.
const unresolvedMember = new Promise<HeaderMember | null>(() => {});
const unresolvedDraftCount = new Promise<number>(() => {});

// The phone menu as it opens before the session resolves: its navigation, and a placeholder for the
// account items.
function PendingSiteMenu() {
	return <SiteMenu member={unresolvedMember} draftCount={unresolvedDraftCount} />;
}

export { PendingSiteMenu };
