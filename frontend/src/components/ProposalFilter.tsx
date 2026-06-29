import { useState } from "react";

export interface FilterState {
search: string;
status: string;
author: string;
category: string;
}

interface Props {
onFilterChange: (filters: FilterState) => void;
}

export default function ProposalFilter({ onFilterChange }: Props) {
const [filters, setFilters] = useState<FilterState>({
search: "", status: "", author: "", category: ""
});

const update = (key: keyof FilterState, value: string) => {
const next = { ...filters, [key]: value };
setFilters(next);
onFilterChange(next);
};

return (
<div role="group" aria-label="Filter proposals" className="flex flex-wrap gap-3 mb-4">
<input type="search" placeholder="Search title or description..."
value={filters.search} onChange={e => update("search", e.target.value)}
className="border rounded px-3 py-2 text-sm flex-1" />
<select value={filters.status} onChange={e => update("status", e.target.value)}
className="border rounded px-3 py-2 text-sm">
<option value="">All Statuses</option>
<option value="active">Active</option>
<option value="passed">Passed</option>
<option value="failed">Failed</option>
</select>
<input type="text" placeholder="Filter by author..."
value={filters.author} onChange={e => update("author", e.target.value)}
className="border rounded px-3 py-2 text-sm" />
<input type="text" placeholder="Filter by category..."
value={filters.category} onChange={e => update("category", e.target.value)}
className="border rounded px-3 py-2 text-sm" />
</div>
);
}
