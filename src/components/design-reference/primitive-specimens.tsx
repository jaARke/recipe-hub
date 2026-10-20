import {
	BadgeSpecimen,
	ButtonSpecimen,
	PaginationSpecimen,
	ToggleSpecimen,
} from '@/components/design-reference/action-specimens';
import { AlertDialogSpecimen } from '@/components/design-reference/alert-dialog-specimen';
import {
	AlertSpecimen,
	AttachmentSpecimen,
	AvatarSpecimen,
	CardSpecimen,
	EmptySpecimen,
	ProgressSpecimen,
	SeparatorSpecimen,
	SkeletonSpecimen,
	SpinnerSpecimen,
} from '@/components/design-reference/display-specimens';
import {
	CheckboxSpecimen,
	FieldSpecimen,
	InputGroupSpecimen,
	InputSpecimen,
	LabelSpecimen,
	NumberFieldSpecimen,
	RadioGroupSpecimen,
	SelectSpecimen,
	SwitchSpecimen,
	TextareaSpecimen,
} from '@/components/design-reference/form-specimens';
import {
	CarouselSpecimen,
	CollapsibleSpecimen,
	DialogSpecimen,
	DropdownMenuSpecimen,
	TabsSpecimen,
	TooltipSpecimen,
} from '@/components/design-reference/overlay-specimens';
import {
	ReferenceSubsection,
	ReferenceSubsectionNav,
} from '@/components/design-reference/reference-section';
import { ToastSpecimen } from '@/components/design-reference/toast-specimen';

// One entry per file in src/components/ui.
const primitives = [
	{ id: 'button', title: 'Button', Content: ButtonSpecimen },
	{ id: 'toggle', title: 'Toggle', Content: ToggleSpecimen },
	{ id: 'badge', title: 'Badge', Content: BadgeSpecimen },
	{ id: 'avatar', title: 'Avatar', Content: AvatarSpecimen },
	{ id: 'pagination', title: 'Pagination', Content: PaginationSpecimen },
	{ id: 'card', title: 'Card', Content: CardSpecimen },
	{ id: 'input', title: 'Input', Content: InputSpecimen },
	{ id: 'input-group', title: 'Input group', Content: InputGroupSpecimen },
	{ id: 'number-field', title: 'Number field', Content: NumberFieldSpecimen },
	{ id: 'textarea', title: 'Textarea', Content: TextareaSpecimen },
	{ id: 'label', title: 'Label', Content: LabelSpecimen },
	{ id: 'field', title: 'Field', Content: FieldSpecimen },
	{ id: 'select', title: 'Select', Content: SelectSpecimen },
	{ id: 'checkbox', title: 'Checkbox', Content: CheckboxSpecimen },
	{ id: 'radio-group', title: 'Radio group', Content: RadioGroupSpecimen },
	{ id: 'switch', title: 'Switch', Content: SwitchSpecimen },
	{ id: 'attachment', title: 'Attachment', Content: AttachmentSpecimen },
	{ id: 'tabs', title: 'Tabs', Content: TabsSpecimen },
	{ id: 'collapsible', title: 'Collapsible', Content: CollapsibleSpecimen },
	{ id: 'carousel', title: 'Carousel', Content: CarouselSpecimen },
	{ id: 'dialog', title: 'Dialog', Content: DialogSpecimen },
	{ id: 'alert-dialog', title: 'Alert dialog', Content: AlertDialogSpecimen },
	{ id: 'dropdown-menu', title: 'Dropdown menu', Content: DropdownMenuSpecimen },
	{ id: 'tooltip', title: 'Tooltip', Content: TooltipSpecimen },
	{ id: 'alert', title: 'Alert', Content: AlertSpecimen },
	{ id: 'toast', title: 'Toast', Content: ToastSpecimen },
	{ id: 'skeleton', title: 'Skeleton', Content: SkeletonSpecimen },
	{ id: 'spinner', title: 'Spinner', Content: SpinnerSpecimen },
	{ id: 'progress', title: 'Progress', Content: ProgressSpecimen },
	{ id: 'empty', title: 'Empty', Content: EmptySpecimen },
	{ id: 'separator', title: 'Separator', Content: SeparatorSpecimen },
] as const;

function PrimitiveSpecimens() {
	return (
		<div className="flex flex-col gap-16">
			<ReferenceSubsectionNav label="Primitives" subsections={primitives} />
			{primitives.map(({ id, title, Content }) => (
				<ReferenceSubsection key={id} id={id} title={title}>
					<Content />
				</ReferenceSubsection>
			))}
		</div>
	);
}

export { PrimitiveSpecimens };
