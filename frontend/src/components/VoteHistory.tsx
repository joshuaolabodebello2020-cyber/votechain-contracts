import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Proposal, ProposalState, VoteRecord } from '../types';
import { useWalletStore } from '../store';
import { generateVoteHistoryCsv, downloadCsv } from '../utils/csv';
import { useDebounce } from '../hooks/useDebounce';

// ── Types ──────────────────────────────────────────────────────────────────

interface Props {
  proposals: Proposal[];
}

type StateFilter = 'All' | ProposalState;
type SortDir = 'newest' | 'oldest';

interface VoteRow {
  proposalId: string;
  proposalTitle: string;
  proposalState: ProposalState;
  voteType: VoteRecord['type'];
  weight: number;
  votedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function statusClass(state: ProposalState) {
  return `status-chip status-${state.toLowerCase()}`;
}

const VOTE_BADGE: Record<VoteRecord['type'], string> = {
  For: 'vote-for',
  Against: 'vote-against',
  Abstain: 'vote-abstain',
};

const STATE_FILTERS: Array<'All' | ProposalState> = [
  'All', 'Active', 'Passed', 'Rejected', 'Executed', 'Cancelled',
];

// ── Component ──────────────────────────────────────────────────────────────

export default function VoteHistory({ proposals }: Props) {
  const { t } = useTranslation();
  const connectedAddress = useWalletStore((s) => s.address);

  const [address, setAddress] = useState('');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [stateFilter, setStateFilter] = useState<StateFilter>('All');
  const [sortDir, setSortDir] = useState<SortDir>('newest');

  const debouncedAddress = useDebounce(address.trim(), 300);

  // Auto-fill address from connected wallet
  function handleUseConnectedWallet() {
    if (connectedAddress) setAddress(connectedAddress);
  }

  const rows = useMemo<VoteRow[]>(() => {
    const normalized = debouncedAddress.toLowerCase();
    if (!normalized) return [];

    const matched: VoteRow[] = [];

    proposals.forEach((proposal) => {
      if (stateFilter !== 'All' && proposal.state !== stateFilter) return;

      proposal.votes.forEach((vote) => {
        if (!vote.address.toLowerCase().includes(normalized)) return;
        if (fromDate && vote.votedAt < fromDate) return;
        if (toDate && vote.votedAt > toDate) return;

        matched.push({
          proposalId: proposal.id,
          proposalTitle: proposal.title,
          proposalState: proposal.state,
          voteType: vote.type,
          weight: vote.weight,
          votedAt: vote.votedAt,
        });
      });
    });

    // Sort by votedAt date
    matched.sort((a, b) =>
      sortDir === 'newest'
        ? b.votedAt.localeCompare(a.votedAt)
        : a.votedAt.localeCompare(b.votedAt)
    );

    return matched;
  }, [proposals, debouncedAddress, fromDate, toDate, stateFilter, sortDir]);

  function handleExport() {
    const csv = generateVoteHistoryCsv(rows);
    const safeName = debouncedAddress.replace(/\W/g, '_') || 'unknown';
    downloadCsv(csv, `vote-history-${safeName}.csv`);
  }

  function toggleSort() {
    setSortDir((d) => (d === 'newest' ? 'oldest' : 'newest'));
  }

  const showEmpty = debouncedAddress.length > 0 && rows.length === 0;
  const showPrompt = debouncedAddress.length === 0;

  return (
    <section aria-labelledby="vote-history-heading" className="card">

      {/* ── Header ── */}
      <div className="header">
        <div>
          <h2 id="vote-history-heading">{t('voteHistory.heading')}</h2>
          <p>{t('voteHistory.subheading')}</p>
        </div>
        <button
          type="button"
          onClick={handleExport}
          disabled={rows.length === 0}
          aria-disabled={rows.length === 0}
          aria-label={t('voteHistory.exportCsvAriaLabel')}
        >
          {t('voteHistory.exportCsv')}
        </button>
      </div>

      {/* ── Filters ── */}
      <form className="grid" onSubmit={(e) => e.preventDefault()} noValidate>

        {/* Address input */}
        <div>
          <label htmlFor="vh-address" style={{ display: 'block', marginBottom: '0.3rem', fontWeight: 600 }}>
            {t('voteHistory.addressLabel')}
          </label>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <input
              id="vh-address"
              type="text"
              value={address}
              placeholder={t('voteHistory.addressPlaceholder')}
              onChange={(e) => setAddress(e.target.value)}
              aria-describedby="vh-address-help"
              style={{ flex: 1 }}
            />
            {connectedAddress && (
              <button
                type="button"
                onClick={handleUseConnectedWallet}
                style={{ whiteSpace: 'nowrap' }}
              >
                {t('voteHistory.useConnectedWallet')}
              </button>
            )}
          </div>
          <p id="vh-address-help" className="visually-hidden">
            {t('voteHistory.addressHelp')}
          </p>
        </div>

        {/* Date range */}
        <label htmlFor="vh-from">
          {t('voteHistory.fromLabel')}
          <input
            id="vh-from"
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
          />
        </label>

        <label htmlFor="vh-to">
          {t('voteHistory.toLabel')}
          <input
            id="vh-to"
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
          />
        </label>

        {/* State filter */}
        <label htmlFor="vh-state">
          {t('voteHistory.stateLabel')}
          <select
            id="vh-state"
            value={stateFilter}
            onChange={(e) => setStateFilter(e.target.value as StateFilter)}
          >
            {STATE_FILTERS.map((s) => (
              <option key={s} value={s}>
                {s === 'All' ? t('proposalList.filterAll') : t(`proposalList.filter${s}`)}
              </option>
            ))}
          </select>
        </label>

      </form>

      {/* ── Table ── */}
      <div className="table-wrapper" aria-live="polite" aria-atomic="true">
        <table>
          <caption className="visually-hidden">
            {t('voteHistory.tableCaption')}
          </caption>
          <thead>
            <tr>
              <th scope="col">{t('voteHistory.colProposal')}</th>
              <th scope="col">{t('voteHistory.colVote')}</th>
              <th scope="col">{t('voteHistory.colWeight')}</th>
              <th scope="col">{t('voteHistory.colState')}</th>
              {/* Sortable date column — aria-sort reflects current direction */}
              <th
                scope="col"
                aria-sort={sortDir === 'newest' ? 'descending' : 'ascending'}
                style={{ cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
              >
                <button
                  type="button"
                  onClick={toggleSort}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'inherit',
                    font: 'inherit',
                    fontWeight: 700,
                    padding: 0,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                  }}
                >
                  {t('voteHistory.colVotedAt')}
                  <span aria-hidden="true">{sortDir === 'newest' ? '↓' : '↑'}</span>
                </button>
              </th>
            </tr>
          </thead>
          <tbody>
            {showPrompt && (
              <tr>
                <td colSpan={5}>{t('voteHistory.noAddress')}</td>
              </tr>
            )}
            {showEmpty && (
              <tr>
                <td colSpan={5}>{t('voteHistory.noVotes')}</td>
              </tr>
            )}
            {rows.map((row, i) => (
              <tr key={`${row.proposalId}-${i}`}>
                <td>{row.proposalTitle}</td>
                <td>
                  <span
                    className={`status-chip ${VOTE_BADGE[row.voteType]}`}
                    aria-label={t('voteHistory.voteAriaLabel', { type: row.voteType })}
                  >
                    {t(`voteHistory.vote${row.voteType}`)}
                  </span>
                </td>
                <td>{row.weight.toLocaleString()}</td>
                <td>
                  <span className={statusClass(row.proposalState)}>
                    {row.proposalState}
                  </span>
                </td>
                <td>{row.votedAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
