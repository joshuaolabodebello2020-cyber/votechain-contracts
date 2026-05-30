import React, { useState } from "react";

/**
 * @typedef {"Active"|"Passed"|"Rejected"|"Executed"|"Cancelled"} ProposalState
 */

/**
 * @typedef {Object} Proposal
 * @property {number|bigint} id
 * @property {string} title
 * @property {string} description
 * @property {ProposalState} state
 * @property {number|bigint} votes_yes
 * @property {number|bigint} votes_no
 * @property {number|bigint} votes_abstain
 * @property {number|bigint} quorum
 * @property {number|bigint} end_time
 */

/** Number of proposals shown per page. */
export const PAGE_SIZE = 10;

/**
 * Displays a paginated, filterable list of governance proposals.
 *
 * @param {Object} props
 * @param {Proposal[]} props.proposals - Full list of proposals to display.
 */
export function ProposalList({ proposals = [] }) {
  const [filter, setFilter] = useState("All");
  const [page, setPage] = useState(0);

  const states = ["All", "Active", "Passed", "Rejected", "Executed", "Cancelled"];

  const filtered =
    filter === "All" ? proposals : proposals.filter((p) => p.state === filter);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages - 1);
  const visible = filtered.slice(currentPage * PAGE_SIZE, (currentPage + 1) * PAGE_SIZE);

  function handleFilterChange(state) {
    setFilter(state);
    setPage(0);
  }

  return (
    <div data-testid="proposal-list">
      <div data-testid="filter-bar" role="group" aria-label="Filter proposals by state">
        {states.map((s) => (
          <button
            key={s}
            data-testid={`filter-${s}`}
            aria-pressed={filter === s}
            onClick={() => handleFilterChange(s)}
          >
            {s}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p data-testid="empty-message">No proposals found.</p>
      ) : (
        <ul data-testid="proposal-items">
          {visible.map((p) => (
            <li key={String(p.id)} data-testid={`proposal-${p.id}`}>
              <span data-testid={`proposal-${p.id}-title`}>{p.title}</span>
              <span data-testid={`proposal-${p.id}-state`}>{p.state}</span>
            </li>
          ))}
        </ul>
      )}

      <div data-testid="pagination" aria-label="Pagination">
        <button
          data-testid="prev-page"
          onClick={() => setPage((p) => Math.max(0, p - 1))}
          disabled={currentPage === 0}
          aria-label="Previous page"
        >
          Prev
        </button>
        <span data-testid="page-indicator">
          {currentPage + 1} / {totalPages}
        </span>
        <button
          data-testid="next-page"
          onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
          disabled={currentPage >= totalPages - 1}
          aria-label="Next page"
        >
          Next
        </button>
      </div>
    </div>
  );
}
