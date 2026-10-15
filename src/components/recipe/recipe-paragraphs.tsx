import { cn } from 'cn';

// One or more blank lines, as stored text keeps its line breaks.
const paragraphBreak = /\n{2,}/;

// Paragraphs parted by blank lines, each keeping its own line breaks and kept whole in print, since
// notes can run for pages. The caller sets the text's size and the space between paragraphs.
function RecipeParagraphs({ text, className }: { text: string; className: string }) {
	return (
		<div className={cn('flex flex-col', className)}>
			{text.split(paragraphBreak).map((paragraph, index) => (
				<p key={index} className="whitespace-pre-line print:break-inside-avoid">
					{paragraph}
				</p>
			))}
		</div>
	);
}

export { RecipeParagraphs };
