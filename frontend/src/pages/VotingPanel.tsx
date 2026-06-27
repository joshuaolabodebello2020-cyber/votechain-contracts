import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { Proposal, VoteRecord } from '../types';
import { useWalletStore, useProposalStore } from '../store';
import { useOptimisticVote, type VoteChoice } from '../hooks/useOptimisticVote';
import { TransactionToast } from '../components/TransactionToast';

// ── Stub tx broadcaster ────────────────────────────────────────────────────
// Replace this with your real Soroban contract call when the backend is wired.
async function broadcastVoteTx(_proposalId: string, _choice: VoteChoice): Promise<string> {
  await new Promise((r) => setTimeout(r, 800)); // simulate network latency
  // Return a fake hash for now — swap with real Freighter + Soroban SDK call.
  return Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
}

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

interface ProposalVoteCardProps {
  proposal: Proposal;
  walletWeight: number;
  onVote: (proposalId: string, choice: VoteChoice) => Promise<void>;
  isPending: boolean;
  optimisticVote?: { choice: VoteChoice; status: 'pending' | 'confirmed' | 'failed' };
}

function ProposalVoteCard({ proposal, walletWeight, onVote, isPending, optimisticVote }: ProposalVoteCardProps) {
  const { t } = useTranslation();
  // Use optimisticVote as the selected choice if it exists
  const [selected, setSelected] = useState<VoteChoice | null>(optimisticVote?.choice || null);

  // Update selected if optimisticVote changes
  React.useEffect(() => {
    if (optimisticVote?.choice) {
      setSelected(optimisticVote.choice);
    }
  }, [optimisticVote?.choice]);

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
        {optimisticVote && (
          <p style={{ 
            color: optimisticVote.status === 'confirmed' ? '#4ade80' : 
                   optimisticVote.status === 'failed' ? '#fca5a5' : '#7dd3fc',
            fontSize: '0.8rem',
            marginTop: '0.25rem'
          }}>
            {optimisticVote.status === 'confirmed' ? '✓ Vote confirmed' :
             optimisticVote.status === 'failed' ? '✗ Vote failed' :
             'Vote pending...'}
          </p>
        )}
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
        {(['For', 'Against', 'Abstain'] as VoteChoice[]).map((choice) => {
          const buttonProps = {
            choice,
            selected: selected === choice,
            disabled: isPending || (optimisticVote?.status === 'confirmed'),
            onClick: () => setSelected(choice),
            label: t(`votingPanel.vote${choice}`),
          };
          return (
            <VoteButton
              key={choice}
              {...buttonProps}
            />
          );
        })}
      </div>

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={!selected || isPending || (optimisticVote?.status === 'confirmed')}
        aria-disabled={!selected || isPending || (optimisticVote?.status === 'confirmed')}
        aria-label={t('votingPanel.submitAriaLabel', { type: selected ?? '', id: proposal.id })}
        style={{ display: 'inline-flex', alignItems: 'center', gap: '0.5rem' }}
      >
        {isPending ? (
          <>
            <span className="spinner" aria-hidden="true" />
            {t('votingPanel.confirming')}
          </>
        ) : optimisticVote?.status === 'confirmed' ? (
          '✓ Vote Cast'
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
  const { getAllProposals, optimisticVotes } = useProposalStore();
  const { getProposal, getStatus, isConfirming, castVote, tx, resetTx, resetProposal } = useOptimisticVote();

  // Wallet weight — replace with real on-chain balance lookup.
  const WALLET_WEIGHT = 10_000;

  // Track which proposal is currently being voted on so we only show the
  // loading state on that card, not all of them.
  const [activeProposalId, setActiveProposalId] = useState<string | null>(null);

  async function handleVote(proposalId: string, choice: VoteChoice) {
    setActiveProposalId(proposalId);
    await castVote(
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

  // Get proposals from the store (will be updated optimistically)
  const proposals = getAllProposals().filter((p: Proposal) => p.state === 'Active');

  return (
    <section aria-labelledby="voting-panel-heading" style={{ padding: '1.5rem' }}>
      <h2 id="voting-panel-heading">{t('votingPanel.heading')}</h2>

      {/* Error banner — shown when tx fails and optimistic update is reverted */}
      {tx.status === 'failed' && activeProposalId && (
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
            onClick={() => { resetProposal(activeProposalId); resetTx(); setActiveProposalId(null); }}
            style={{ background: 'transparent', border: '1px solid #fecaca', color: '#fecaca', padding: '0.25rem 0.75rem' }}
          >
            {t('errorBoundary.retry')}
          </button>
        </div>
      )}

      {/* Proposal cards */}
      {proposals.map((raw: Proposal) => {
        const proposal = getProposal(raw.id) || raw;
        const isPending = isConfirming(raw.id);
        const optimisticVote = optimisticVotes[raw.id];
        const cardProps = {
          proposal,
          walletWeight: WALLET_WEIGHT,
          onVote: handleVote,
          isPending,
          optimisticVote,
        };

        return (
          <ProposalVoteCard
            key={proposal.id}
            {...cardProps}
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
