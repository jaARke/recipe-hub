import type { Metadata } from 'next';
import { PageContainer } from '@/components/layout/page-container';
import { PageSection } from '@/components/layout/page-section';
import { sessionLifetimeDays, signInCodeLifetimeMinutes } from '@/domain/member/member';
import { removedImageLifetimeDays } from '@/domain/recipe/image-retention';
import { importDraftLifetimeDays } from '@/domain/recipe/recipe-import';
import { siteName } from '@/lib/site';

export const metadata: Metadata = {
	title: 'Privacy',
};

const listClassName = 'flex list-disc flex-col gap-2 pl-5';

export default function PrivacyPage() {
	return (
		<PageContainer width="reading" className="flex flex-col gap-8 py-12 sm:py-16">
			<div className="flex flex-col gap-3">
				<h1 className="font-heading text-4xl font-medium">Privacy</h1>
				<p className="text-lg text-muted-foreground">
					What {siteName} stores about the people who use it, and why. Recipes and dish photos are
					public. Everything else on this page stays private unless it says otherwise.
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
						A sign-in code is stored encrypted until it&apos;s used, or for{' '}
						{signInCodeLifetimeMinutes} minutes at most.
					</li>
					<li>
						If you add a passkey, the site stores only its public key, which can&apos;t sign you in
						on its own. The passkey itself stays on your device or in your password manager.
					</li>
					<li>
						Each sign-in starts a session, which records the IP address and browser it began from. A
						session ends when you sign out, or after {sessionLifetimeDays} days without a visit.
					</li>
					<li>
						To slow down guessing, the site briefly counts sign-in attempts from each IP address.
					</li>
				</ul>
			</PageSection>
			<PageSection id="privacy-imports" title="Importing recipes">
				<ul className={listClassName}>
					<li>
						To read a recipe you import, the site may send its photos or the text of its web page to
						an AI model through Vercel&apos;s AI Gateway. Neither the Gateway nor the model&apos;s
						provider keeps them after answering.
					</li>
					<li>
						Each request an import makes is labeled with your account id in the AI Gateway&apos;s
						usage reports, never your name or email address. The model&apos;s provider gets a coded
						form of that id, so it can trace misuse to an account without knowing who you are.
					</li>
					<li>
						An import&apos;s draft is kept until you save it as a recipe, or for{' '}
						{importDraftLifetimeDays} days at most.
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
						The request form uses Vercel BotID, which runs a check in your browser to tell people
						from automated programs.
					</li>
					<li>
						Your choice of light or dark theme is saved in your browser and never sent to the site.
					</li>
				</ul>
			</PageSection>
			<PageSection id="privacy-services" title="Services the site uses">
				<ul className={listClassName}>
					<li>Email is sent through Resend.</li>
					<li>
						The site is hosted by Vercel. Its database is hosted by Neon, and photos are stored in
						Vercel Blob.
					</li>
					<li>
						A photo or scan that&apos;s removed, or that belongs to a deleted recipe, is kept for{' '}
						{removedImageLifetimeDays} days before it&apos;s deleted for good.
					</li>
					<li>Imports are read by AI models through Vercel&apos;s AI Gateway.</li>
					<li>
						Changes are tried on test versions of the site before they go live. Test versions use a
						copy of the database, so they may hold copies of this data too. They aren&apos;t public.
					</li>
				</ul>
			</PageSection>
			<PageSection id="privacy-questions" title="Questions">
				<p>
					To ask about your data or have it removed, ask the member who invited you. If you&apos;ve
					only requested access, ask the person you know here.
				</p>
			</PageSection>
		</PageContainer>
	);
}
