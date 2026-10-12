// Synthetic sample content for the design reference. Never real user data.

type SampleOption = {
	value: string;
	label: string;
};

export const sampleCourses: readonly SampleOption[] = [
	{ value: 'breakfast', label: 'Breakfast' },
	{ value: 'main', label: 'Main' },
	{ value: 'side', label: 'Side' },
	{ value: 'soup', label: 'Soup' },
	{ value: 'dessert', label: 'Dessert' },
	{ value: 'baking', label: 'Baking' },
];

// An invite link as the admin page shows it once; the reserved domain keeps it from leading anywhere.
export const sampleInviteLink =
	'https://recipes.example/invite#c2FtcGxlLWludml0ZS1mb3ItdGhlLWRlc2lnbi1yZWY';
