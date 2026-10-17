'use client';

import * as React from 'react';
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from '@/components/ui/select';

// A null value is the select's "any" choice.
type ChoiceItem = {
	value: string | null;
	label: string;
	count?: number;
};

// Named only while a choice is made, so the "any" choice submits nothing and a search keeps one URL.
function ChoiceSelect({
	id,
	name,
	items,
	defaultValue,
	descriptionId,
}: {
	id: string;
	name: string;
	items: readonly ChoiceItem[];
	defaultValue: string | null;
	descriptionId?: string;
}) {
	const [value, setValue] = React.useState(defaultValue);

	return (
		<Select
			name={value === null ? undefined : name}
			items={items}
			defaultValue={defaultValue}
			onValueChange={(chosen) => setValue(chosen)}
		>
			<SelectTrigger id={id} className="w-full" aria-describedby={descriptionId}>
				<SelectValue />
			</SelectTrigger>
			<SelectContent>
				{items.map((item) => (
					<SelectItem key={item.value ?? ''} value={item.value}>
						{item.label}
						{item.count !== undefined && (
							<>
								{' '}
								<span className="text-muted-foreground">{item.count}</span>
							</>
						)}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

export { ChoiceSelect };
