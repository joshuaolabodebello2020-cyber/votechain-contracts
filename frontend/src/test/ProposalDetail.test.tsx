import { render, screen } from '@testing-library/react';
import ProposalDetail from '../pages/ProposalDetail/ProposalDetail';
import { ProposalStatus } from '../types/proposal';

const baseProposal = {
  id: '1',
  proposer: 'GABCDEF1234567890',
  title: 'Test Proposal',
  description: 'A test proposal description.',
  votesYes: BigInt(0),
  votesNo: BigInt(0),
  votesAbstain: BigInt(0),
  quorum: BigInt(100),
  startTime: 1_700_000_000,
  endTime: 1_700_000_100,
  translations: {},
};

describe('ProposalDetail', () => {
  it('renders cancel button for active proposals when admin', () => {
    render(
      <ProposalDetail
        proposal={{ ...baseProposal, status: ProposalStatus.Active }}
        isAdmin={true}
        onCancel={() => {}}
      />
    );

    expect(screen.getByRole('button', { name: /Cancel Proposal/i })).toBeInTheDocument();
  });

  it('does not render cancel button for passed proposals even when admin', () => {
    render(
      <ProposalDetail
        proposal={{ ...baseProposal, status: ProposalStatus.Passed }}
        isAdmin={true}
        onCancel={() => {}}
      />
    );

    expect(screen.queryByRole('button', { name: /Cancel Proposal/i })).not.toBeInTheDocument();
  });
});
