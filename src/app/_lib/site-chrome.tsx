import 'server-only';
import { Suspense, type ReactNode } from 'react';
import { readForReader } from '@/app/_lib/read-for-reader';
import { readHeaderMember } from '@/app/_lib/read-header-member';
import { mergeDeviceFavorites } from '@/app/(site)/(browse)/favorites/actions';
import { SessionRenewal } from '@/components/auth/session-renewal';
import { DeviceFavoritesMerge } from '@/components/favorites/device-favorites-merge';
import type { HeaderMember } from '@/components/layout/header-member';
import { MainContent } from '@/components/layout/main-content';
import { SiteHeader } from '@/components/layout/site-header';
import { getFavoriteService, getMemberService, getSavedDraftService } from '@/composition/services';
import { getLogger } from '@/lib/logger';

const logger = getLogger('auth');

// Renews a signed-in member's session once the read resolves, behind its own boundary.
async function MemberSessionRenewal({ member }: { member: Promise<HeaderMember | null> }) {
	return (await member) === null ? null : <SessionRenewal />;
}

// Merges only where the member's device still keeps favorites, so any other page load posts nothing.
// Where the read fails, the device keeps them for the next page load.
async function MemberFavoritesMerge() {
	const toMerge = await readForReader(() => getFavoriteService().hasDeviceFavoritesToMerge(), {
		log: (error) => logger.error('Favorites merge session read failed', { err: error }),
		fallback: false,
	});
	return toMerge ? <DeviceFavoritesMerge mergeAction={mergeDeviceFavorites} /> : null;
}

// The header above a page's main content, and the work every site page does for a signed-in
// member. The root not-found page renders outside the (site) layout, so both render this.
export function SiteChrome({ children }: { children: ReactNode }) {
	// Each read once and not awaited here: each part that shows one streams in behind its own
	// boundary, so the session never holds up the page.
	const member = readHeaderMember(() => getMemberService().getCurrentMember());
	// Where the read fails, Add recipe shows no count rather than a wrong one.
	const draftCount = readForReader(() => getSavedDraftService().countDrafts(), {
		log: (error) => logger.error('Draft count session read failed', { err: error }),
		fallback: 0,
	});

	return (
		<>
			<SiteHeader member={member} draftCount={draftCount} />
			<Suspense>
				<MemberSessionRenewal member={member} />
			</Suspense>
			<Suspense>
				<MemberFavoritesMerge />
			</Suspense>
			<MainContent>{children}</MainContent>
		</>
	);
}
