import 'server-only';
import { redirect } from 'next/navigation';
import { SignInRequiredError } from '@/application/authorization';
import type { DraftSummaryDto } from '@/application/drafts/saved-draft-dtos';
import { signInHref } from '@/components/auth/auth-paths';
import { getSavedDraftService } from '@/composition/services';

// The member's drafts, newest first. The authoritative check: the service refuses a visitor who isn't
// signed in, and the proxy only looks for a cookie, which can be present but expired, so the visitor
// is sent to sign in and back to the page's href, its query included.
export async function loadDrafts(pageHref: string): Promise<DraftSummaryDto[]> {
	try {
		return await getSavedDraftService().listDrafts();
	} catch (error) {
		if (error instanceof SignInRequiredError) {
			redirect(signInHref(pageHref));
		}
		throw error;
	}
}
