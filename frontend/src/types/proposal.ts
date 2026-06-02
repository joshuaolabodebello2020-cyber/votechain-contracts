export enum ProposalStatus {
  Active = 'Active',
  Passed = 'Passed',
  Rejected = 'Rejected',
  Executed = 'Executed',
  Cancelled = 'Cancelled',
}

export enum VoteType {
  Yes = 'Yes',
  No = 'No',
  Abstain = 'Abstain',
}

export interface Translation {
  title: string;
  description: string;
}

export interface Proposal {
  id: string;
  proposer: string;
  title: string;
  description: string;
  votesYes: bigint;
  votesNo: bigint;
  votesAbstain: bigint;
  quorum: bigint;
  startTime: number; // unix timestamp
  endTime: number; // unix timestamp
  status: ProposalStatus;
  translations?: Record<string, Translation>;
}
