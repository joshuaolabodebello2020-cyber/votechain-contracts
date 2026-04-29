import { useMemo, useState } from 'react';
import type { Proposal, ProposalState } from '../types';

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'votes', label: 'Most votes' },
  { value: 'ending', label: 'Ending soon' }
] as const;

function labelForState(state: ProposalState) {
  return state;
}

function statusClass(state: ProposalState) {
  return `status-chip status-${state.toLowerCase()}`;
}

interface Props {
  proposals: Proposal[];
}

type StateFilter = 'All' | ProposalState;

type SortKey = (typeof sortOptions)[number]['value'];

export default function ProposalList({ proposals }: Props) {
  const [searchText, setSearchText] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('All');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  const filtered = useMemo(() => {
    const normalizedSearch = searchText.trim().toLowerCase();
    return proposals
      .filter((proposal) => {
        const matchesText = [proposal.title, proposal.description].some((value) =>
          value.toLowerCase().includes(normalizedSearch)
        );
        const matchesState = stateFilter === 'All' || proposal.state === stateFilter;
        return matchesText && matchesState;
      })
      .sort((a, b) => {
        if (sortKey === 'newest') {
          return b.createdAt.localeCompare(a.createdAt);
        }
        if (sortKey === 'oldest') {
          return a.createdAt.localeCompare(b.createdAt);
        }
        if (sortKey === 'votes') {
          return b.votesCount - a.votesCount;
        }
        return a.endAt.localeCompare(b.endAt);
      });
  }, [proposals, searchText, stateFilter, sortKey]);

  return (
    <section aria-labelledby="proposal-list-heading" className="card">
      <div className="header">
        <div>
          <h2 id="proposal-list-heading">Proposal listing</h2>
          <p>Search proposals by title or description, filter by state, and sort results instantly.</p>
        </div>
      </div>
      <div className="grid">
        <label>
          Search
          <input
            aria-label="Search proposals"
            type="search"
            value={searchText}
            placeholder="Search title or description"
            onChange={(event) => setSearchText(event.target.value)}
          />
        </label>
        <label>
          State
          <select
            value={stateFilter}
            onChange={(event) => setStateFilter(event.target.value as StateFilter)}
          >
            <option value="All">All</option>
            <option value="Active">Active</option>
            <option value="Passed">Passed</option>
            <option value="Rejected">Rejected</option>
            <option value="Executed">Executed</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </label>
        <label>
          Sort by
          <select value={sortKey} onChange={(event) => setSortKey(event.target.value as SortKey)}>
            {sortOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="table-wrapper" aria-live="polite">
        <table>
          <caption className="visually-hidden">Filtered and sorted proposal listing</caption>
          <thead>
            <tr>
              <th scope="col">ID</th>
              <th scope="col">Title</th>
              <th scope="col">State</th>
              <th scope="col">Created</th>
              <th scope="col">End date</th>
              <th scope="col">Votes</th>
              <th scope="col">Weight</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((proposal) => (
              <tr key={proposal.id}>
                <td>{proposal.id}</td>
                <td>{proposal.title}</td>
                <td>
                  <span className={statusClass(proposal.state)}>{labelForState(proposal.state)}</span>
                </td>
                <td>{proposal.createdAt}</td>
                <td>{proposal.endAt}</td>
                <td>{proposal.votesCount}</td>
                <td>{proposal.totalWeight}</td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7}>No proposals match your search and filter criteria.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
