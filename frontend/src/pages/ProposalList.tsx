import ProposalListComponent from '../components/ProposalList';
import type { Proposal } from '../types';

// Placeholder data — replace with real API call
const PROPOSALS: Proposal[] = [];

export default function ProposalList() {
  return <ProposalListComponent proposals={PROPOSALS} />;
}
