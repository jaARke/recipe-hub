import { SearchIcon } from 'lucide-react';
import { sampleCourses } from '@/components/design-reference/fixtures';
import { Specimen } from '@/components/design-reference/reference-section';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Field,
	FieldContent,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSeparator,
	FieldSet,
	FieldTitle,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
	InputGroup,
	InputGroupAddon,
	InputGroupInput,
	InputGroupText,
} from '@/components/ui/input-group';
import { Label } from '@/components/ui/label';
import {
	NumberField,
	NumberFieldDecrement,
	NumberFieldGroup,
	NumberFieldIncrement,
	NumberFieldInput,
} from '@/components/ui/number-field';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectLabel,
	SelectSeparator,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { chapterLabels, chapters, noChapterMessage, type Chapter } from '@/domain/recipe/chapter';
import { dietLabels, diets } from '@/domain/recipe/diet';
import { noStepsMessage } from '@/domain/recipe/instruction';

function CourseSelectItems() {
	return sampleCourses.map((item) => (
		<SelectItem key={item.value} value={item.value}>
			{item.label}
		</SelectItem>
	));
}

function InputSpecimen() {
	return (
		<Specimen>
			<FieldGroup className="grid gap-6 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor="input-default">Default</FieldLabel>
					<Input id="input-default" placeholder="Buttermilk biscuits" />
				</Field>
				<Field>
					<FieldLabel htmlFor="input-filled">Filled, with helper text</FieldLabel>
					<Input
						id="input-filled"
						defaultValue="Aunt June"
						aria-describedby="input-filled-description"
					/>
					<FieldDescription id="input-filled-description">
						Who the recipe comes from.
					</FieldDescription>
				</Field>
				<Field data-disabled="true">
					<FieldLabel htmlFor="input-disabled">Disabled</FieldLabel>
					<Input id="input-disabled" defaultValue="Grandpa Lou" disabled />
				</Field>
				<Field data-invalid="true">
					<FieldLabel htmlFor="input-invalid">Invalid</FieldLabel>
					<Input id="input-invalid" aria-invalid="true" aria-describedby="input-invalid-error" />
					<FieldError id="input-invalid-error">
						Add a title so the recipe shows up in search.
					</FieldError>
				</Field>
			</FieldGroup>
		</Specimen>
	);
}

function InputGroupSpecimen() {
	return (
		<Specimen>
			<FieldGroup className="grid gap-6 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor="input-group-icon">Leading icon</FieldLabel>
					<InputGroup>
						<InputGroupInput id="input-group-icon" type="search" placeholder="Search recipes" />
						<InputGroupAddon>
							<SearchIcon aria-hidden="true" />
						</InputGroupAddon>
					</InputGroup>
				</Field>
				<Field>
					<FieldLabel htmlFor="input-group-text">Trailing text</FieldLabel>
					<InputGroup>
						<InputGroupInput id="input-group-text" inputMode="numeric" defaultValue="35" />
						<InputGroupAddon align="inline-end">
							<InputGroupText>minutes</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
				</Field>
				<Field data-disabled="true">
					<FieldLabel htmlFor="input-group-disabled">Disabled</FieldLabel>
					<InputGroup data-disabled="true">
						<InputGroupInput id="input-group-disabled" defaultValue="Buttermilk" disabled />
						<InputGroupAddon>
							<SearchIcon aria-hidden="true" />
						</InputGroupAddon>
					</InputGroup>
				</Field>
				<Field data-invalid="true">
					<FieldLabel htmlFor="input-group-invalid">Invalid</FieldLabel>
					<InputGroup>
						<InputGroupInput
							id="input-group-invalid"
							inputMode="numeric"
							defaultValue="0"
							aria-invalid="true"
							aria-describedby="input-group-invalid-error"
						/>
						<InputGroupAddon align="inline-end">
							<InputGroupText>minutes</InputGroupText>
						</InputGroupAddon>
					</InputGroup>
					<FieldError id="input-group-invalid-error">Enter at least 1 minute.</FieldError>
				</Field>
			</FieldGroup>
		</Specimen>
	);
}

// A recipe's servings stepper steps by one, a count it makes by half the count, and batches by half.
const numberFieldSamples = [
	{ id: 'number-field-servings', label: 'Servings', value: 6, step: 1, min: 1, max: 48 },
	{ id: 'number-field-makes', label: 'Cookies', value: 24, step: 12, min: 12, max: 192 },
	{ id: 'number-field-batches', label: 'Batches', value: 1, step: 0.5, min: 0.5, max: 8 },
] as const;

function NumberFieldSpecimen() {
	return (
		<Specimen label="Servings by one, cookies by 12, batches by half, and disabled, as before hydration">
			<FieldGroup className="grid gap-6 sm:grid-cols-2">
				{numberFieldSamples.map(({ id, label, value, step, min, max }) => (
					<Field key={id}>
						<FieldLabel htmlFor={id}>{label}</FieldLabel>
						<NumberField id={id} defaultValue={value} step={step} min={min} max={max}>
							<NumberFieldGroup>
								<NumberFieldDecrement />
								<NumberFieldInput />
								<NumberFieldIncrement />
							</NumberFieldGroup>
						</NumberField>
					</Field>
				))}
				<Field data-disabled="true">
					<FieldLabel htmlFor="number-field-disabled">Disabled</FieldLabel>
					<NumberField id="number-field-disabled" defaultValue={6} disabled>
						<NumberFieldGroup>
							<NumberFieldDecrement />
							<NumberFieldInput />
							<NumberFieldIncrement />
						</NumberFieldGroup>
					</NumberField>
				</Field>
			</FieldGroup>
		</Specimen>
	);
}

function TextareaSpecimen() {
	return (
		<Specimen>
			<FieldGroup className="grid gap-6 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor="textarea-default">Default</FieldLabel>
					<Textarea id="textarea-default" placeholder="The story behind the recipe" />
				</Field>
				<Field>
					<FieldLabel htmlFor="textarea-filled">Filled</FieldLabel>
					<Textarea
						id="textarea-filled"
						defaultValue="June cut her biscuits with a juice glass and never twisted it."
					/>
				</Field>
				<Field data-disabled="true">
					<FieldLabel htmlFor="textarea-disabled">Disabled</FieldLabel>
					<Textarea id="textarea-disabled" defaultValue="Locked while the import runs." disabled />
				</Field>
				<Field data-invalid="true">
					<FieldLabel htmlFor="textarea-invalid">Invalid</FieldLabel>
					<Textarea
						id="textarea-invalid"
						aria-invalid="true"
						aria-describedby="textarea-invalid-error"
					/>
					<FieldError id="textarea-invalid-error">{noStepsMessage}</FieldError>
				</Field>
			</FieldGroup>
		</Specimen>
	);
}

function LabelSpecimen() {
	return (
		<Specimen label='Beside an input and a checkbox, then disabled: a Field with data-disabled="true" dims its FieldLabel'>
			<div className="flex flex-col gap-6">
				<div className="flex max-w-xs flex-col gap-2">
					<Label htmlFor="label-input">Source</Label>
					<Input id="label-input" placeholder="Grandma Rose" />
				</div>
				<div className="flex items-center gap-3">
					<Checkbox id="label-checkbox" defaultChecked />
					<Label htmlFor="label-checkbox">Favorite</Label>
				</div>
				<Field orientation="horizontal" data-disabled="true">
					<Checkbox id="label-checkbox-disabled" disabled />
					<FieldLabel htmlFor="label-checkbox-disabled">Disabled</FieldLabel>
				</Field>
			</div>
		</Specimen>
	);
}

function FieldSpecimen() {
	return (
		<div className="grid gap-6 md:grid-cols-2">
			<Specimen label="Field set with legend, description, and horizontal fields">
				<FieldSet>
					<FieldLegend>Diet</FieldLegend>
					<FieldDescription>Choose every diet that applies.</FieldDescription>
					<FieldGroup data-slot="checkbox-group">
						{diets.map((diet) => (
							<Field key={diet} orientation="horizontal">
								<Checkbox id={`field-diet-${diet}`} defaultChecked={diet === 'vegetarian'} />
								<FieldLabel htmlFor={`field-diet-${diet}`}>{dietLabels[diet]}</FieldLabel>
							</Field>
						))}
					</FieldGroup>
				</FieldSet>
			</Specimen>
			<Specimen label="Choice card and separator">
				<FieldGroup>
					<FieldLabel htmlFor="field-share">
						<Field orientation="horizontal">
							<Checkbox id="field-share" defaultChecked />
							<FieldContent>
								<FieldTitle>Share with everyone</FieldTitle>
								<FieldDescription>Anyone who is signed in can read it.</FieldDescription>
							</FieldContent>
						</Field>
					</FieldLabel>
					<FieldSeparator>or</FieldSeparator>
					<FieldLabel htmlFor="field-private">
						<Field orientation="horizontal">
							<Checkbox id="field-private" />
							<FieldContent>
								<FieldTitle>Keep as a private draft</FieldTitle>
								<FieldDescription>Only you can see it until you share it.</FieldDescription>
							</FieldContent>
						</Field>
					</FieldLabel>
				</FieldGroup>
			</Specimen>
			<Specimen
				label="Responsive orientation: label beside the control in wide containers"
				figureClassName="md:col-span-2"
			>
				<FieldGroup>
					<Field orientation="responsive">
						<FieldContent>
							<FieldLabel htmlFor="field-yield">Yield</FieldLabel>
							<FieldDescription id="field-yield-description">
								Servings or an amount, such as 10 biscuits.
							</FieldDescription>
						</FieldContent>
						<Input
							id="field-yield"
							placeholder="Serves 6"
							aria-describedby="field-yield-description"
						/>
					</Field>
				</FieldGroup>
			</Specimen>
		</div>
	);
}

function SelectSpecimen() {
	return (
		<Specimen>
			<FieldGroup className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
				<Field>
					<FieldLabel htmlFor="select-default">Placeholder</FieldLabel>
					<Select items={sampleCourses}>
						<SelectTrigger id="select-default">
							<SelectValue placeholder="Choose a course" />
						</SelectTrigger>
						<SelectContent>
							<CourseSelectItems />
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor="select-small">Small, with a value</FieldLabel>
					<Select items={sampleCourses} defaultValue="main">
						<SelectTrigger id="select-small" size="sm">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<CourseSelectItems />
						</SelectContent>
					</Select>
				</Field>
				<Field>
					<FieldLabel htmlFor="select-grouped">Groups</FieldLabel>
					<Select items={sampleCourses} defaultValue="baking">
						<SelectTrigger id="select-grouped">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<SelectGroup>
								<SelectLabel>Meals</SelectLabel>
								<SelectItem value="breakfast">Breakfast</SelectItem>
								<SelectItem value="main">Main</SelectItem>
								<SelectItem value="side">Side</SelectItem>
								<SelectItem value="soup">Soup</SelectItem>
							</SelectGroup>
							<SelectSeparator />
							<SelectGroup>
								<SelectLabel>Sweets</SelectLabel>
								<SelectItem value="dessert">Dessert</SelectItem>
								<SelectItem value="baking">Baking</SelectItem>
							</SelectGroup>
						</SelectContent>
					</Select>
				</Field>
				<Field data-disabled="true">
					<FieldLabel htmlFor="select-disabled">Disabled</FieldLabel>
					<Select items={sampleCourses} defaultValue="soup" disabled>
						<SelectTrigger id="select-disabled">
							<SelectValue />
						</SelectTrigger>
						<SelectContent>
							<CourseSelectItems />
						</SelectContent>
					</Select>
				</Field>
				<Field data-invalid="true">
					<FieldLabel htmlFor="select-invalid">Invalid</FieldLabel>
					<Select items={sampleCourses}>
						<SelectTrigger
							id="select-invalid"
							aria-invalid="true"
							aria-describedby="select-invalid-error"
						>
							<SelectValue placeholder="Choose a course" />
						</SelectTrigger>
						<SelectContent>
							<CourseSelectItems />
						</SelectContent>
					</Select>
					<FieldError id="select-invalid-error">Choose a course.</FieldError>
				</Field>
			</FieldGroup>
		</Specimen>
	);
}

function CheckboxSpecimen() {
	return (
		<Specimen>
			<FieldGroup className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				<Field orientation="horizontal">
					<Checkbox id="checkbox-unchecked" />
					<FieldLabel htmlFor="checkbox-unchecked">Unchecked</FieldLabel>
				</Field>
				<Field orientation="horizontal">
					<Checkbox id="checkbox-checked" defaultChecked />
					<FieldLabel htmlFor="checkbox-checked">Checked</FieldLabel>
				</Field>
				<Field orientation="horizontal" data-disabled="true">
					<Checkbox id="checkbox-disabled" disabled />
					<FieldLabel htmlFor="checkbox-disabled">Disabled</FieldLabel>
				</Field>
				<Field orientation="horizontal" data-disabled="true">
					<Checkbox id="checkbox-disabled-checked" defaultChecked disabled />
					<FieldLabel htmlFor="checkbox-disabled-checked">Disabled and checked</FieldLabel>
				</Field>
				<Field orientation="horizontal" data-invalid="true">
					<Checkbox
						id="checkbox-invalid"
						aria-invalid="true"
						aria-describedby="checkbox-invalid-error"
					/>
					<FieldContent>
						<FieldLabel htmlFor="checkbox-invalid">Invalid</FieldLabel>
						<FieldError id="checkbox-invalid-error">Confirm before sharing.</FieldError>
					</FieldContent>
				</Field>
			</FieldGroup>
		</Specimen>
	);
}

// Two of the nine chapters, enough to show every row's invalid edge.
const invalidChapterSamples = ['desserts', 'cookies-candy'] as const satisfies readonly Chapter[];

function RadioGroupSpecimen() {
	return (
		<div className="flex flex-col gap-6">
			<Specimen label="Field set with legend and description, in two columns from sm">
				<FieldSet>
					<FieldLegend variant="label">Chapter</FieldLegend>
					<FieldDescription>Where the recipe goes in the cookbook.</FieldDescription>
					<RadioGroup defaultValue="desserts" className="sm:grid-cols-2">
						{chapters.map((chapter) => (
							<Field key={chapter} orientation="horizontal">
								<RadioGroupItem id={`radio-chapter-${chapter}`} value={chapter} />
								<FieldLabel htmlFor={`radio-chapter-${chapter}`}>
									{chapterLabels[chapter]}
								</FieldLabel>
							</Field>
						))}
					</RadioGroup>
				</FieldSet>
			</Specimen>
			<Specimen label="Disabled, then invalid with nothing chosen">
				<FieldGroup className="grid gap-6 sm:grid-cols-2">
					<FieldSet>
						<FieldLegend variant="label">Disabled</FieldLegend>
						<RadioGroup defaultValue="chosen" disabled>
							<Field orientation="horizontal" data-disabled="true">
								<RadioGroupItem id="radio-disabled" value="unchosen" />
								<FieldLabel htmlFor="radio-disabled">Disabled</FieldLabel>
							</Field>
							<Field orientation="horizontal" data-disabled="true">
								<RadioGroupItem id="radio-disabled-chosen" value="chosen" />
								<FieldLabel htmlFor="radio-disabled-chosen">Disabled and chosen</FieldLabel>
							</Field>
						</RadioGroup>
					</FieldSet>
					<FieldSet aria-describedby="radio-invalid-error">
						<FieldLegend variant="label">Invalid</FieldLegend>
						<FieldError id="radio-invalid-error">{noChapterMessage}</FieldError>
						<RadioGroup>
							{invalidChapterSamples.map((chapter) => (
								<Field key={chapter} orientation="horizontal">
									<RadioGroupItem
										id={`radio-invalid-${chapter}`}
										value={chapter}
										aria-invalid="true"
									/>
									<FieldLabel htmlFor={`radio-invalid-${chapter}`}>
										{chapterLabels[chapter]}
									</FieldLabel>
								</Field>
							))}
						</RadioGroup>
					</FieldSet>
				</FieldGroup>
			</Specimen>
		</div>
	);
}

const switchSizes = ['default', 'sm'] as const;

function SwitchSpecimen() {
	return (
		<div className="flex flex-col gap-6">
			<Specimen label="Off, on, disabled, and disabled on, at each size: default, then sm">
				<div className="flex flex-col gap-6">
					{switchSizes.map((size) => (
						<FieldGroup key={size} className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
							<Field orientation="horizontal">
								<Switch id={`switch-${size}-off`} size={size} />
								<FieldLabel htmlFor={`switch-${size}-off`}>Off</FieldLabel>
							</Field>
							<Field orientation="horizontal">
								<Switch id={`switch-${size}-on`} size={size} defaultChecked />
								<FieldLabel htmlFor={`switch-${size}-on`}>On</FieldLabel>
							</Field>
							<Field orientation="horizontal" data-disabled="true">
								<Switch id={`switch-${size}-disabled`} size={size} disabled />
								<FieldLabel htmlFor={`switch-${size}-disabled`}>Disabled</FieldLabel>
							</Field>
							<Field orientation="horizontal" data-disabled="true">
								<Switch id={`switch-${size}-disabled-on`} size={size} defaultChecked disabled />
								<FieldLabel htmlFor={`switch-${size}-disabled-on`}>Disabled and on</FieldLabel>
							</Field>
						</FieldGroup>
					))}
				</div>
			</Specimen>
			<Specimen label="Inside its label: the label’s text is the target too">
				<Label className="text-base">
					<Switch />
					Show photos
				</Label>
			</Specimen>
		</div>
	);
}

export {
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
};
