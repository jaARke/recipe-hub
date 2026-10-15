'use client';

import type { RefObject } from 'react';
import { sampleCourses } from '@/components/design-reference/fixtures';
import { Specimen } from '@/components/design-reference/reference-section';
import {
	Combobox,
	ComboboxChip,
	ComboboxChips,
	ComboboxChipsInput,
	ComboboxContent,
	ComboboxEmpty,
	ComboboxInput,
	ComboboxItem,
	ComboboxList,
	ComboboxValue,
	useComboboxAnchor,
} from '@/components/ui/combobox';
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field';

type SampleCourse = (typeof sampleCourses)[number];

const chosenCourses = sampleCourses.filter(
	({ value }) => value === 'dessert' || value === 'baking'
);

// Anchored to the chips when there are any, so the list opens below the whole field.
function CourseList({ anchor }: { anchor?: RefObject<HTMLDivElement | null> }) {
	return (
		<ComboboxContent anchor={anchor}>
			<ComboboxEmpty>No courses match.</ComboboxEmpty>
			<ComboboxList>
				{(course: SampleCourse) => (
					<ComboboxItem key={course.value} value={course}>
						{course.label}
					</ComboboxItem>
				)}
			</ComboboxList>
		</ComboboxContent>
	);
}

// Chosen values as chips inside the field, each removed with its button or the keyboard.
function CourseChips({
	id,
	invalid = false,
	describedBy,
}: {
	id: string;
	invalid?: boolean;
	describedBy?: string;
}) {
	const anchor = useComboboxAnchor();
	return (
		<Combobox multiple items={sampleCourses} defaultValue={chosenCourses}>
			<ComboboxChips ref={anchor}>
				<ComboboxValue>
					{(courses: SampleCourse[]) => (
						<>
							{courses.map((course) => (
								<ComboboxChip key={course.value} removeLabel={`Remove ${course.label}`}>
									{course.label}
								</ComboboxChip>
							))}
							<ComboboxChipsInput
								id={id}
								aria-invalid={invalid ? 'true' : undefined}
								aria-describedby={describedBy}
							/>
						</>
					)}
				</ComboboxValue>
			</ComboboxChips>
			<CourseList anchor={anchor} />
		</Combobox>
	);
}

function ComboboxSpecimen() {
	return (
		<Specimen label="The recipe form’s tags field builds on the chips, suggesting the labels in use">
			<FieldGroup className="grid gap-6 sm:grid-cols-2">
				<Field>
					<FieldLabel htmlFor="combobox-single">One value, typed or chosen</FieldLabel>
					<Combobox items={sampleCourses}>
						<ComboboxInput
							id="combobox-single"
							placeholder="Choose a course"
							triggerLabel="Show courses"
							showClear
							clearLabel="Clear course"
						/>
						<CourseList />
					</Combobox>
				</Field>
				<Field>
					<FieldLabel htmlFor="combobox-chips">Several values, as chips</FieldLabel>
					<CourseChips id="combobox-chips" />
				</Field>
				<Field data-disabled="true">
					<FieldLabel htmlFor="combobox-disabled">Disabled</FieldLabel>
					<Combobox items={sampleCourses} defaultValue={chosenCourses[0]} disabled>
						<ComboboxInput
							id="combobox-disabled"
							triggerLabel="Show courses"
							showClear
							clearLabel="Clear course"
							disabled
						/>
						<CourseList />
					</Combobox>
				</Field>
				<Field data-invalid="true">
					<FieldLabel htmlFor="combobox-invalid">Invalid</FieldLabel>
					<CourseChips id="combobox-invalid" invalid describedBy="combobox-invalid-error" />
					<FieldError id="combobox-invalid-error">Choose at most one course.</FieldError>
				</Field>
			</FieldGroup>
		</Specimen>
	);
}

export { ComboboxSpecimen };
