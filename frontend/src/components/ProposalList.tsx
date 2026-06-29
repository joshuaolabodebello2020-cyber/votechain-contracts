import { useMemo, useState, type KeyboardEvent } from 'react';
import type { Proposal, ProposalState } from '../types';
import { generateProposalCsv, downloadCsv } from '../utils/csv';
import { useDebounce } from '../hooks/useDebounce';
import { useWalletStore } from '../store';

const sortOptions = [
  { value: 'newest', label: 'Newest' },
  { value: 'oldest', label: 'Oldest' },
  { value: 'votes', label: 'Most votes' },
  { value: 'ending', label: 'Ending soon' }
] as const;

const STATE_FILTERS = ['All', 'Active', 'Passed', 'Rejected', 'Executed', 'Cancelled'] as const;

function labelForState(state: ProposalState) {
  return state;
}

function statusClass(state: ProposalState) {
  return `status-chip status-${state.toLowerCase()}`;
}

/** Wraps matched substrings in <mark> for highlighting */
function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>;
  const regex = new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);
  return (
    <>
      {parts.map((part, i) =>
        regex.test(part) ? <mark key={i}>{part}</mark> : part
      )}
    </>
  );
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
  const connected = useWalletStore((state) => state.connected);

  const debouncedSearch = useDebounce(searchText, 300);

  const filtered = useMemo(() => {
    const normalizedSearch = debouncedSearch.trim().toLowerCase();
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
  }, [proposals, debouncedSearch, stateFilter, sortKey]);

  /** Handle arrow-key navigation on the state filter tab list */
  function handleTabKeyDown(e: KeyboardEvent<HTMLButtonElement>, index: number) {
    const tabs = STATE_FILTERS;
    let next = index;
    if (e.key === 'ArrowRight') {
      next = (index + 1) % tabs.length;
    } else if (e.key === 'ArrowLeft') {
      next = (index - 1 + tabs.length) % tabs.length;
    } else if (e.key === 'Home') {
      next = 0;
    } else if (e.key === 'End') {
      next = tabs.length - 1;
    } else {
      return;
    }
    e.preventDefault();
    setStateFilter(tabs[next] as StateFilter);
    const tabList = (e.currentTarget.closest('[role="tablist"]') as HTMLElement | null);
    const buttons = tabList?.querySelectorAll<HTMLButtonElement>('[role="tab"]');
    buttons?.[next]?.focus();
  }

  const highlightTerm = debouncedSearch.trim();
  const hasQuery = Boolean(highlightTerm);
  const isActiveFilter = stateFilter !== 'All';

  const emptyTitle = proposals.length === 0
    ? 'No proposals have been created yet.'
    : hasQuery
      ? `No proposals match "${highlightTerm}".`
      : 'No proposals match your filter criteria.';

  const emptyDescription = proposals.length === 0
    ? 'Governance is ready when the first proposal lands. Connect your wallet to submit one.'
    : hasQuery
      ? 'Try a different keyword or clear the search to broaden your results.'
      : isActiveFilter
        ? 'Try a different state filter or clear the current filter to show more proposals.'
        : 'There are no proposals to show at this time.';

  return (
    <section aria-labelledby="proposal-list-heading" className="card">
      <div className="header">
        <div>
          <h2 id="proposal-list-heading">Proposal listing</h2>
          <p>Search proposals by title or description, filter by state, and sort results instantly.</p>
        </div>
        <button
          type="button"
          onClick={() => downloadCsv(generateProposalCsv(filtered), 'proposals.csv')}
          disabled={filtered.length === 0}
          aria-disabled={filtered.length === 0}
          aria-label="Export filtered proposals as CSV"
        >
          Export CSV
        </button>
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

      {/* State filter as accessible tab list (WCAG 2.1 SC 2.1.1) */}
      <div
        role="tablist"
        aria-label="Filter proposals by state"
        className="nav-buttons"
        style={{ marginTop: '1rem' }}
      >
        {STATE_FILTERS.map((state, index) => (
          <button
            key={state}
            role="tab"
            type="button"
            aria-selected={stateFilter === state}
            tabIndex={stateFilter === state ? 0 : -1}
            className={stateFilter === state ? 'active-tab' : ''}
            onClick={() => setStateFilter(state as StateFilter)}
            onKeyDown={(e) => handleTabKeyDown(e, index)}
          >
            {state}
          </button>
        ))}
      </div>

      <div className="proposal-list" aria-live="polite" aria-atomic="true">
        {filtered.length > 0 ? (
          filtered.map((proposal) => (
            <article className="proposal-card" key={proposal.id}>
              <div className="card-header">
                <div className="card-title-row">
                  <p className="proposal-id">{proposal.id}</p>
                  <h3 className="proposal-title">
                    <Highlight text={proposal.title} term={highlightTerm} />
                  </h3>
                </div>
                <span className={`state-badge status-${proposal.state.toLowerCase()}`} role="status" aria-label={`Status: ${proposal.state}`}>
                  {labelForState(proposal.state)}
                </span>
              </div>

              <p className="proposal-description">
                <Highlight text={proposal.description} term={highlightTerm} />
              </p>

              <div className="vote-summary">
                <div className="vote-counts">
                  <div className="vote-count-item">
                    <span className="vote-dot dot-yes" /> {proposal.votesCount} votes
                  </div>
                  <div className="vote-count-item">
                    <span className="vote-dot dot-abstain" /> {proposal.totalWeight} weight
                  </div>
                </div>
              </div>

              <div className="card-footer">
                <span>Created {proposal.createdAt}</span>
                <span>Ends {proposal.endAt}</span>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">
            <div className="empty-state-illustration" aria-hidden="true">📭</div>
            <div>
              <h3>{emptyTitle}</h3>
              <p>{emptyDescription}</p>
            </div>
            {connected ? (
              <button type="button" className="action-btn">Create proposal</button>
            ) : (
              <p className="empty-state-note">Connect your wallet to create the first proposal.</p>
            )}
          </div>
        )}
      </div>

      <div className="table-wrapper" aria-live="polite" aria-atomic="true">
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
                <td><Highlight text={proposal.title} term={highlightTerm} /></td>
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
                <td colSpan={7}>{emptyTitle}</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
