// pg 8 already verifies the certificate and host for sslmode=require, but warns that pg 9 will stop.
// Naming verify-full keeps that verification across the upgrade and silences the warning.
export function pinFullSslVerification(connectionString: string): string {
	const url = new URL(connectionString);
	if (url.searchParams.get('sslmode') === 'require') {
		url.searchParams.set('sslmode', 'verify-full');
	}
	return url.toString();
}
