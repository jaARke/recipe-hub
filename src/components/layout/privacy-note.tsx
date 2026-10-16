import * as React from 'react';
import { privacyPath } from '@/components/auth/auth-paths';
import { TextLink } from '@/components/layout/text-link';

type PrivacyNoteProps = {
	// What the page keeps, said before the link.
	children?: React.ReactNode;
};

// A quiet line linking to the privacy page, below what a page asks for or keeps.
function PrivacyNote({ children }: PrivacyNoteProps) {
	return (
		<p className="text-sm text-muted-foreground">
			{children !== undefined && <>{children} </>}
			Read <TextLink href={privacyPath}>what we store and why</TextLink>.
		</p>
	);
}

export { PrivacyNote };
