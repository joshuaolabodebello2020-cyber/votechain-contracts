import type { VoteRecord } from '../types';

export function generateCsv(votes: VoteRecord[]) {
  const header = ['Address', 'Vote Type', 'Weight', 'Voted At'];
  const rows = votes.map(({ address, type, weight, votedAt }) => [address, type, weight.toString(), votedAt]);
  return [header, ...rows].map((row) => row.join(',')).join('\n');
}
