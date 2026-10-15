import {
	afterEach,
	beforeEach,
	describe,
	expect,
	it,
	vi,
	type Mock,
	type MockInstance,
} from 'vitest';
import { copyLink, shareLink } from '@/components/sharing/link-sharing';
import { toast } from '@/components/ui/toast';

const link = {
	title: 'Buttermilk biscuits',
	url: 'https://preview.example.com/recipes/buttermilk-biscuits',
};

const copyByHand = 'Copy it from the address bar.';

let writeText: Mock<(text: string) => Promise<void>>;
let addToast: MockInstance<typeof toast.add>;

beforeEach(() => {
	writeText = vi.fn(async () => {});
	addToast = vi.spyOn(toast, 'add');
});

afterEach(() => {
	vi.unstubAllGlobals();
	vi.restoreAllMocks();
});

describe('copyLink', () => {
	it('copies the link and says so', async () => {
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		await copyLink(link.url, copyByHand);

		expect(writeText).toHaveBeenCalledExactlyOnceWith(link.url);
		expect(addToast).toHaveBeenCalledExactlyOnceWith({ title: 'Link copied' });
	});

	it('says how to copy the link by hand when the browser refuses', async () => {
		writeText.mockRejectedValue(new DOMException('Write permission denied.', 'NotAllowedError'));
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		await copyLink(link.url, copyByHand);

		expect(addToast).toHaveBeenCalledExactlyOnceWith({
			type: 'error',
			title: 'Couldn’t copy the link',
			description: copyByHand,
		});
	});
});

describe('shareLink', () => {
	it('opens the share sheet with the title and link, copying nothing', async () => {
		const share = vi.fn(async () => {});
		vi.stubGlobal('navigator', { share, clipboard: { writeText } });

		await shareLink(link, copyByHand);

		expect(share).toHaveBeenCalledExactlyOnceWith(link);
		expect(writeText).not.toHaveBeenCalled();
		expect(addToast).not.toHaveBeenCalled();
	});

	it('copies the link, and says so, in a browser without the Web Share API', async () => {
		vi.stubGlobal('navigator', { clipboard: { writeText } });

		await shareLink(link, copyByHand);

		expect(writeText).toHaveBeenCalledExactlyOnceWith(link.url);
		expect(addToast).toHaveBeenCalledExactlyOnceWith({ title: 'Link copied' });
	});

	it('does nothing more when the reader cancels the share', async () => {
		const share = vi.fn(async () => {
			throw new DOMException('Share canceled.', 'AbortError');
		});
		vi.stubGlobal('navigator', { share, clipboard: { writeText } });

		await expect(shareLink(link, copyByHand)).resolves.toBeUndefined();

		expect(writeText).not.toHaveBeenCalled();
		expect(addToast).not.toHaveBeenCalled();
	});

	it('copies the link instead when the browser refuses to share it', async () => {
		const share = vi.fn(async () => {
			throw new DOMException('Sharing is not allowed here.', 'NotAllowedError');
		});
		vi.stubGlobal('navigator', { share, clipboard: { writeText } });

		await shareLink(link, copyByHand);

		expect(writeText).toHaveBeenCalledExactlyOnceWith(link.url);
		expect(addToast).toHaveBeenCalledExactlyOnceWith({ title: 'Link copied' });
	});
});
