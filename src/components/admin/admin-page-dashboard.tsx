'use client';

import { useSearchParams } from 'next/navigation';
import type * as React from 'react';
import { AdminDashboard } from '@/components/admin/admin-dashboard';
import { adminTabHref, parseAdminTab, type AdminTab } from '@/components/admin/admin-tabs';

type AdminPageDashboardProps = Omit<
	React.ComponentProps<typeof AdminDashboard>,
	'tab' | 'onTabChange'
>;

// The admin page's dashboard, whose open tab is the URL's alone. A change is written in place,
// without a navigation, and Next passes it back through useSearchParams; a link to another tab, or
// to plain /admin, opens that one.
function AdminPageDashboard(props: AdminPageDashboardProps) {
	const tab = parseAdminTab(useSearchParams());

	function writeTab(next: AdminTab) {
		window.history.replaceState(null, '', adminTabHref(next));
	}

	return <AdminDashboard {...props} tab={tab} onTabChange={writeTab} />;
}

export { AdminPageDashboard };
