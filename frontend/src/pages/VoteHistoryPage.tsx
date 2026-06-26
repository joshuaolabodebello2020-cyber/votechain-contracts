import VoteHistory from '../components/VoteHistory';
import type { Proposal } from '../types';

// Placeholder — replace with real API/store data when the backend is wired up.
const PROPOSALS: Proposal[] = [];

export default function VoteHistoryPage() {
  return <VoteHistory proposals={PROPOSALS} />;
}
