'use client';

import type { HeaderMember } from '@/components/layout/header-member';
import { SiteMenu } from '@/components/layout/site-menu';

// A session read that never finishes, made in the browser so the server's response still ends.
const unresolvedMember = new Promise<HeaderMember | null>(() => {});

// The phone menu as it opens before the session resolves: its navigation, and a placeholder for the
// account items.
function PendingSiteMenu() {
	return <SiteMenu member={unresolvedMember} />;
}

export { PendingSiteMenu };
