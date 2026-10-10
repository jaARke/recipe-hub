'use client';

import { sampleCourses, sampleRecipe } from '@/components/design-reference/fixtures';
import { SampleSectionedList } from '@/components/design-reference/sample-sectioned-list';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
	Field,
	FieldDescription,
	FieldError,
	FieldGroup,
	FieldLabel,
	FieldLegend,
	FieldSet,
} from '@/components/ui/field';
import { Input } from '@/components/ui/input';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/components/ui/toast';

const ingredientSeeds = sampleRecipe.ingredientSections.map((section) => ({
	heading: section.heading,
	items: section.ingredients.map((ingredient) => `${ingredient.quantity} ${ingredient.item}`),
}));

const stepSeeds = [{ items: sampleRecipe.steps }];

function SampleRecipeForm() {
	return (
		<form
			noValidate
			className="flex flex-col gap-8"
			onSubmit={(event) => {
				event.preventDefault();
				toast.add({
					type: 'info',
					title: 'Nothing was saved',
					description: 'This sample form shows the layout only.',
				});
			}}
		>
			<FieldGroup>
				<Field data-invalid="true">
					<FieldLabel htmlFor="sample-title">Title</FieldLabel>
					<Input
						id="sample-title"
						name="title"
						required
						aria-invalid="true"
						aria-describedby="sample-title-description sample-title-error"
					/>
					<FieldDescription id="sample-title-description">
						Use the name you know it by.
					</FieldDescription>
					<FieldError id="sample-title-error">
						Add a title so the recipe shows up in search.
					</FieldError>
				</Field>
				<Field>
					<FieldLabel htmlFor="sample-source">Source</FieldLabel>
					<Input
						id="sample-source"
						name="source"
						placeholder="Grandma Rose"
						aria-describedby="sample-source-description"
					/>
					<FieldDescription id="sample-source-description">
						Who or where the recipe comes from.
					</FieldDescription>
				</Field>
				<FieldSet>
					<FieldLegend>Times and yield</FieldLegend>
					<div className="grid gap-4 sm:grid-cols-3">
						<Field>
							<FieldLabel htmlFor="sample-prep">Prep, in minutes</FieldLabel>
							<Input
								id="sample-prep"
								name="prepMinutes"
								type="number"
								inputMode="numeric"
								min={0}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="sample-cook">Cook, in minutes</FieldLabel>
							<Input
								id="sample-cook"
								name="cookMinutes"
								type="number"
								inputMode="numeric"
								min={0}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="sample-yield">Yield</FieldLabel>
							<Input id="sample-yield" name="yield" placeholder="Serves 6" />
						</Field>
					</div>
				</FieldSet>
				<Field>
					<FieldLabel htmlFor="sample-course">Course</FieldLabel>
					<Select name="course" items={sampleCourses}>
						<SelectTrigger id="sample-course">
							<SelectValue placeholder="Choose a course" />
						</SelectTrigger>
						<SelectContent>
							{sampleCourses.map((item) => (
								<SelectItem key={item.value} value={item.value}>
									{item.label}
								</SelectItem>
							))}
						</SelectContent>
					</Select>
				</Field>
				<SampleSectionedList
					legend="Ingredients"
					description="One ingredient per field. Add a section for a separate part, such as a glaze."
					itemName="Ingredient"
					itemPlaceholder="2½ cups all-purpose flour"
					headingPlaceholder="For the glaze"
					initialSections={ingredientSeeds}
				/>
				<SampleSectionedList
					legend="Steps"
					description="One step per field. Add a section for a separate part, such as a glaze."
					itemName="Step"
					itemPlaceholder="Heat the oven to 450°F."
					headingPlaceholder="For the glaze"
					ordered
					initialSections={stepSeeds}
				/>
				<Field>
					<FieldLabel htmlFor="sample-notes">Notes</FieldLabel>
					<Textarea id="sample-notes" name="notes" placeholder="The story behind the recipe" />
				</Field>
				<Field orientation="horizontal">
					<Checkbox id="sample-favorite" name="favorite" />
					<FieldLabel htmlFor="sample-favorite">Mark as a favorite</FieldLabel>
				</Field>
			</FieldGroup>
			<div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
				<Button type="button" variant="outline">
					Cancel
				</Button>
				<Button type="submit">Save recipe</Button>
			</div>
		</form>
	);
}

export { SampleRecipeForm };
