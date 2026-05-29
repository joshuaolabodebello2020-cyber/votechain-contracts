export type ProposalState = 'Active' | 'Passed' | 'Rejected' | 'Executed' | 'Cancelled';

export interface VoteRecord {
  address: string;
  type: 'For' | 'Against' | 'Abstain';
  weight: number;
  votedAt: string;
}

export interface Proposal {
  id: string;
  title: string;
  description: string;
  state: ProposalState;
  createdAt: string;
  endAt: string;
  votesCount: number;
  totalWeight: number;
  votes: VoteRecord[];
}
