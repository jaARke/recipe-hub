import { PrivacyNote } from '@/components/layout/privacy-note';

// A signed-out reader's favorites live in a cookie until sign-in moves them to the account, so
// their list says where it is kept.
function DeviceFavoritesNote() {
	return (
		<PrivacyNote>Your favorites are kept in a cookie on this device until you sign in.</PrivacyNote>
	);
}

export { DeviceFavoritesNote };
