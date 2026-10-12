import {
	BadgeSpecimen,
	ButtonSpecimen,
	PaginationSpecimen,
} from '@/components/design-reference/action-specimens';
import {
	AttachmentSpecimen,
	CardSpecimen,
	EmptySpecimen,
	SeparatorSpecimen,
	SkeletonSpecimen,
	SpinnerSpecimen,
} from '@/components/design-reference/display-specimens';
import {
	CheckboxSpecimen,
	FieldSpecimen,
	InputSpecimen,
	LabelSpecimen,
	SelectSpecimen,
	TextareaSpecimen,
} from '@/components/design-reference/form-specimens';
import {
	DialogSpecimen,
	DropdownMenuSpecimen,
	TabsSpecimen,
	TooltipSpecimen,
} from '@/components/design-reference/overlay-specimens';
import { ReferenceSubsection } from '@/components/design-reference/reference-section';
import { ToastSpecimen } from '@/components/design-reference/toast-specimen';
import { buttonVariants } from '@/components/ui/button';

// One entry per file in src/components/ui.
const primitives = [
	{ id: 'button', title: 'Button', Content: ButtonSpecimen },
	{ id: 'badge', title: 'Badge', Content: BadgeSpecimen },
	{ id: 'pagination', title: 'Pagination', Content: PaginationSpecimen },
	{ id: 'card', title: 'Card', Content: CardSpecimen },
	{ id: 'input', title: 'Input', Content: InputSpecimen },
	{ id: 'textarea', title: 'Textarea', Content: TextareaSpecimen },
	{ id: 'label', title: 'Label', Content: LabelSpecimen },
	{ id: 'field', title: 'Field', Content: FieldSpecimen },
	{ id: 'select', title: 'Select', Content: SelectSpecimen },
	{ id: 'checkbox', title: 'Checkbox', Content: CheckboxSpecimen },
	{ id: 'attachment', title: 'Attachment', Content: AttachmentSpecimen },
	{ id: 'tabs', title: 'Tabs', Content: TabsSpecimen },
	{ id: 'dialog', title: 'Dialog', Content: DialogSpecimen },
	{ id: 'dropdown-menu', title: 'Dropdown menu', Content: DropdownMenuSpecimen },
	{ id: 'tooltip', title: 'Tooltip', Content: TooltipSpecimen },
	{ id: 'toast', title: 'Toast', Content: ToastSpecimen },
	{ id: 'skeleton', title: 'Skeleton', Content: SkeletonSpecimen },
	{ id: 'spinner', title: 'Spinner', Content: SpinnerSpecimen },
	{ id: 'empty', title: 'Empty', Content: EmptySpecimen },
	{ id: 'separator', title: 'Separator', Content: SeparatorSpecimen },
] as const;

function PrimitiveSpecimens() {
	return (
		<div className="flex flex-col gap-16">
			<nav aria-label="Primitives">
				<ul className="flex flex-wrap gap-1">
					{primitives.map((primitive) => (
						<li key={primitive.id}>
							<a
								href={`#${primitive.id}`}
								className={buttonVariants({ variant: 'ghost', size: 'xs' })}
							>
								{primitive.title}
							</a>
						</li>
					))}
				</ul>
			</nav>
			{primitives.map(({ id, title, Content }) => (
				<ReferenceSubsection key={id} id={id} title={title}>
					<Content />
				</ReferenceSubsection>
			))}
		</div>
	);
}

export { PrimitiveSpecimens };
