import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { PageSection } from '@/components/layout/page-section';
import { settings } from '@/lib/settings';
import { siteName } from '@/lib/site';

export const metadata: Metadata = {
	title: 'Privacy',
};

const listClassName = 'flex list-disc flex-col gap-2 pl-5';

// A count of days as a sentence says it: "a day" or "7 days".
function dayCount(days: number): string {
	return days === 1 ? 'a day' : `${days} days`;
}

export default function PrivacyPage() {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<div className="flex flex-col gap-3">
				<h1 className="font-heading text-4xl font-semibold">Privacy</h1>
				<p className="text-lg text-muted-foreground">
					What {siteName} stores about the people who use it, and why. Recipes and their photos,
					dish photos and scans of the original, are public. Everything else on this page stays
					private unless it says otherwise.
				</p>
			</div>
			<PageSection id="privacy-requests" title="Access requests">
				<ul className={listClassName}>
					<li>
						The request form asks for your name, how you know us, and, if you choose, an email
						address for your invite.
					</li>
					<li>
						Only admins see requests. Each admin gets an email with your name when one arrives.
					</li>
					<li>
						A declined request is deleted. An approved request is kept as a record of who was
						invited.
					</li>
				</ul>
			</PageSection>
			<PageSection id="privacy-accounts" title="Accounts">
				<ul className={listClassName}>
					<li>Your display name is public. It appears beside recipes you add.</li>
					<li>
						Your email address is private. Sign-in codes are sent to it, and admins can see it.
					</li>
					<li>
						A sign-in code is stored encrypted until it’s used, or deleted after{' '}
						{settings.accounts.signInCodeLifetimeMinutes} minutes.
					</li>
					<li>
						If you add a passkey, the site stores only its public key, which can’t sign you in on
						its own. The passkey itself stays on your device or in your password manager.
					</li>
					<li>
						Each sign-in starts a session, which records the IP address and browser it began from. A
						session ends when you sign out, or after {settings.accounts.sessionLifetimeDays} days
						without a visit.
					</li>
					<li>
						To slow down guessing, the site briefly counts sign-in attempts from each IP address.
					</li>
					<li>Recipes you favorite are kept in your account, and only you see them.</li>
				</ul>
			</PageSection>
			<PageSection id="privacy-recipes" title="Recipes and photos">
				<ul className={listClassName}>
					<li>
						A recipe, its dish photos, and its scans of the original are public once the recipe is
						saved, so anyone can see them, signed in or not.
					</li>
					<li>
						A photo or scan you upload isn’t listed anywhere until the recipe it’s for is saved.
						Until then it opens only for someone who has its address, and it’s removed{' '}
						{dayCount(settings.retention.unusedImageLifetimeDays)} after no recipe or import draft
						names it.
					</li>
					<li>
						A photo or scan that’s removed, or that belongs to a deleted recipe, is deleted for good
						after {settings.retention.removedImageLifetimeDays} days.
					</li>
				</ul>
			</PageSection>
			<PageSection id="privacy-imports" title="Importing recipes">
				<ul className={listClassName}>
					<li>
						To read a recipe you import, the site may send its photos or the text of its web page to
						an AI model through Vercel’s AI Gateway. Neither the Gateway nor the model’s provider
						keeps them after answering.
					</li>
					<li>
						Each request an import makes is labeled with your account id in the AI Gateway’s usage
						reports, never your name or email address. The model’s provider gets a coded form of
						that id, so it can trace misuse to an account without knowing who you are.
					</li>
					<li>
						An import’s draft is kept until you save it as a recipe, or deleted after{' '}
						{settings.imports.importDraftLifetimeDays} days.
					</li>
					<li>
						A record of each import is kept: who started it, when, which AI model read it, and what
						it cost.
					</li>
				</ul>
			</PageSection>
			<PageSection id="privacy-cookies" title="Cookies and browser storage">
				<ul className={listClassName}>
					<li>
						Signing in sets a cookie that keeps you signed in. Adding or using a passkey sets a
						short-lived cookie for that step.
					</li>
					<li>
						The request form and requests for a sign-in code use Vercel BotID, which runs a check in
						your browser to tell people from automated programs.
					</li>
					<li>
						Your choice of light or dark theme is saved in your browser and never sent to the site.
					</li>
					{/* The cookie's name and lifetime are the adapter's, in cookie-device-favorites.ts. */}
					<li>
						Favoriting a recipe while signed out sets a cookie named “favorites”, which holds only
						the ids of the recipes you favorite, up to {settings.favorites.maxPerDevice} on a
						device. The site’s server sets it, and it’s kept for 400 days from your last change.
						When you sign in, your favorites move to your account and the cookie is cleared.
					</li>
					<li>
						Changes you haven’t saved to a recipe you’re adding, editing, or reviewing are kept in
						your browser, so they come back if the page reloads. They’re cleared when you save the
						recipe, discard them, or sign out, and until then anyone using this browser can see
						them.
					</li>
					<li>
						Cooking mode keeps, in your browser, whether it’s on for a recipe and which of its
						ingredients and steps you’ve checked, so they’re still there if the page reloads. None
						of it is sent to the site, and signing out leaves it. It’s cleared{' '}
						{settings.cooking.progressLifetimeHours} hours after your last change or once the recipe
						is edited, and Start over clears your checks.
					</li>
					<li>
						Each browser tab remembers which list you opened a recipe from, such as a search or your
						favorites, so the recipe can link back to it. It stays in your browser, is never sent to
						the site, and is forgotten when the tab closes.
					</li>
				</ul>
			</PageSection>
			<PageSection id="privacy-services" title="Services the site uses">
				<ul className={listClassName}>
					<li>Email is sent through Resend.</li>
					<li>
						The site is hosted by Vercel. Its database is hosted by Neon, and photos and scans are
						stored in Vercel Blob.
					</li>
					<li>
						Changes are tried on test versions of the site on Vercel before they go live. Each uses
						its own copy of the database on Neon, so it may hold copies of this data too. Test
						versions aren’t public.
					</li>
				</ul>
			</PageSection>
			<PageSection id="privacy-questions" title="Questions">
				<p>
					To ask about your data or have it removed, ask the member who invited you. If you’ve only
					requested access, ask the person you know here.
				</p>
			</PageSection>
		</PageContainer>
	);
}
