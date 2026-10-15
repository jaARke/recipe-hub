import { adminPath } from '@/components/auth/auth-paths';

// The admin page's tabs, in their order on the page. Requests comes first, so the access-request
// email's link to the page lands on it.
export const adminTabs = ['requests', 'invites', 'members'] as const;

export type AdminTab = (typeof adminTabs)[number];

export const defaultAdminTab: AdminTab = 'requests';

// The admin page's URL parameter naming the open tab.
export const adminTabParamName = 'tab';

function isAdminTab(value: string): value is AdminTab {
	return (adminTabs as readonly string[]).includes(value);
}

// Exactly one known tab opens it; a missing, repeated, or unknown value opens the default tab.
export function parseAdminTab(searchParams: Pick<URLSearchParams, 'getAll'>): AdminTab {
	const values = searchParams.getAll(adminTabParamName);
	const value = values.length === 1 ? values[0] : undefined;
	return value !== undefined && isAdminTab(value) ? value : defaultAdminTab;
}

// The default tab is left out, so each tab has one URL.
export function adminTabHref(tab: AdminTab): string {
	return tab === defaultAdminTab
		? adminPath
		: `${adminPath}?${new URLSearchParams({ [adminTabParamName]: tab })}`;
}
