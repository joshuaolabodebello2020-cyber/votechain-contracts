import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Proposal, VoteRecord } from '../types';
import { useWalletStore } from '../store';
import { useOptimisticVote, type VoteChoice } from '../hooks/useOptimisticVote';
import { useTransactionStatus } from '../hooks/useTransactionStatus';
import { TransactionToast } from '../components/TransactionToast';

// ── Stub tx broadcaster ────────────────────────────────────────────────────
// Replace this with your real Soroban contract call when the backend is wired.
async function broadcastVoteTx(_proposalId: string, _choice: VoteChoice): Promise<string> {
  await new Promise((r) => setTimeout(r, 800)); // simulate network latency
  // Return a fake hash for now — swap with real Freighter + Soroban SDK call.
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

// ── Placeholder data ───────────────────────────────────────────────────────
// Replace with real API / store data when the backend is wired up.
const MOCK_PROPOSALS: Proposal[] = [
  {
    id: '1',
    title: 'Increase validator reward by 5%',
    description: 'Proposal to increase the base validator reward from 10% to 15% APY.',
    state: 'Active',
    createdAt: '2026-05-01',
    endAt: '2026-06-15',
    votesCount: 42,
    totalWeight: 1_200_000,
    votes: [],
  },
  {
    id: '2',
    title: 'Add new governance parameter: max_proposals_per_epoch',
    description: 'Introduce a cap on the number of active proposals per epoch.',
    state: 'Active',
    createdAt: '2026-05-10',
    endAt: '2026-06-20',
    votesCount: 17,
    totalWeight: 540_000,
    votes: [],
  },
];

// ── Vote choice button ─────────────────────────────────────────────────────

const CHOICE_STYLE: Record<VoteChoice, React.CSSProperties> = {
  For:     { background: '#14532d', color: '#bbf7d0', borderColor: '#166534' },
  Against: { background: '#7f1d1d', color: '#fecaca', borderColor: '#991b1b' },
  Abstain: { background: '#334155', color: '#e2e8f0', borderColor: '#475569' },
};

interface VoteButtonProps {
  choice: VoteChoice;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
  label: string;
}

function VoteButton({ choice, selected, disabled, onClick, label }: VoteButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={selected}
      style={{
        ...CHOICE_STYLE[choice],
        opacity: disabled ? 0.5 : 1,
        fontWeight: selected ? 700 : 400,
        outline: selected ? '3px solid #7dd3fc' : undefined,
        minWidth: '6rem',
      }}
    >
      {label}
    </button>
  );
}

// ── Proposal voting card ───────────────────────────────────────────────────

interface ProposalVoteCardProps {
  proposal: Proposal;
  walletWeight: number;
  onVote: (proposalId: string, choice: VoteChoice) => Promise<void>;
  isPending: boolean;
}

function ProposalVoteCard({ proposal, walletWeight, onVote, isPending }: ProposalVoteCardProps) {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<VoteChoice | null>(null);

  async function handleSubmit() {
    if (!selected) return;
    await onVote(proposal.id, selected);
  }

  return (
    <div className="card" style={{ marginBottom: '1rem' }}>
      <div style={{ marginBottom: '0.75rem' }}>
        <strong>{proposal.title}</strong>
        <p style={{ color: '#94a3b8', fontSize: '0.9rem', margin: '0.25rem 0 0' }}>
          {proposal.description}
        </p>
      </div>

      {/* Live vote counts — updated optimistically */}
      <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.875rem', color: '#94a3b8', marginBottom: '1rem' }}>
        <span>
          {t('votingPanel.votesCount')}: <strong style={{ color: '#f8fafc' }}>{proposal.votesCount.toLocaleString()}</strong>
        </span>
        <span>
          {t('votingPanel.totalWeight')}: <strong style={{ color: '#f8fafc' }}>{proposal.totalWeight.toLocaleString()}</strong>
        </span>
        {isPending && (
          <span style={{ color: '#7dd3fc', display: 'inline-flex', alignItems: 'center', gap: '0.4rem' }}>
            <span className="spinner" aria-hidden="true" />
            <span>{t('votingPanel.optimisticBadge')}</span>
          </span>
        )}
      </div>

      {/* Vote choice buttons */}
      <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.75rem' }}>
        {(['For', 'Against', 'Abstain'] as VoteChoice[]).map((choice) => (
          <VoteButton
            key={choice}
            choice={choice}
            selected={selected === choice}
            disabled={isPending}
            onClick={() => setSelected(choice)}
            label={t(`votingPanel.vote${choice}`)}
          />
        ))}
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!selected || isPending}
        aria-disabled={!selected || isPending}
        aria-label={t('votingPanel.submitAriaLabel', { type: selected ?? '', id: proposal.id })}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
      >
        {isPending ? (
          <>
            <span className="spinner" aria-hidden="true" />
            {t('votingPanel.confirming')}
          </>
        ) : (
          t('votingPanel.castVote')
        )}
      </button>
    </div>
  );
}

// ── Page ───────────────────────────────────────────────────────────────────

export default function VotingPanel() {
  const { t } = useTranslation();
  const { address, connected } = useWalletStore();
  const { status, error, applyPatch, vote, reset } = useOptimisticVote();
  const { tx, reset: resetTx } = useTransactionStatus();

  // Wallet weight — replace with real on-chain balance lookup.
  const WALLET_WEIGHT = 10_000;

  // Track which proposal is currently being voted on so we only show the
  // loading state on that card, not all of them.
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);

  async function handleVote(proposalId: string, choice: VoteChoice) {
    setActiveProposalId(proposalId);
    await vote(
      proposalId,
      choice,
      WALLET_WEIGHT,
      () => broadcastVoteTx(proposalId, choice)
    );
  }

  if (!connected) {
    return (
      <section aria-labelledby="voting-panel-heading" style={{ padding: '1.5rem' }}>
        <h2 id="voting-panel-heading">{t('votingPanel.heading')}</h2>
        <p>{t('votingPanel.connectWalletPrompt')}</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="voting-panel-heading" style={{ padding: '1.5rem' }}>
      <h2 id="voting-panel-heading">{t('votingPanel.heading')}</h2>

      {/* Error banner — shown when tx fails and optimistic update is reverted */}
      {status === 'failed' && error && (
        <div
          role="alert"
          style={{
            background: '#7f1d1d',
            color: '#fecaca',
            padding: '0.75rem 1rem',
            borderRadius: '0.5rem',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '1rem',
          }}
        >
          <span>{t('votingPanel.voteFailed')}</span>
          <button
            type="button"
            onClick={() => { reset(); setActiveProposalId(null); }}
            style={{ background: 'transparent', border: '1px solid #fecaca', color: '#fecaca', padding: '0.25rem 0.75rem' }}
          >
            {t('errorBoundary.retry')}
          </button>
        </div>
      )}

      {/* Proposal cards */}
      {MOCK_PROPOSALS.map((raw) => {
        // Apply the optimistic patch only to the proposal being voted on.
        const proposal = applyPatch(raw);
        const isPending = status === 'pending' && activeProposalId === raw.id;

        return (
          <ProposalVoteCard
            key={proposal.id}
            proposal={proposal}
            walletWeight={WALLET_WEIGHT}
            onVote={handleVote}
            isPending={isPending}
          />
        );
      })}

      {/* Transaction toast — loading indicator + confirmation/failure feedback */}
      <TransactionToast
        tx={tx}
        onDismiss={() => { resetTx(); setActiveProposalId(null); }}
      />
    </section>
  );
}
