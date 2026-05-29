import type { Proposal, VoteRecord } from '../types';

export function generateCsv(votes: VoteRecord[]) {
  const header = ['Address', 'Vote Type', 'Weight', 'Voted At'];
  const rows = votes.map(({ address, type, weight, votedAt }) => [address, type, weight.toString(), votedAt]);
  return [header, ...rows].map((row) => row.join(',')).join('\n');
}

export function generateProposalCsv(proposals: Proposal[]) {
  const header = ['ID', 'Title', 'State', 'Votes Count', 'Total Weight', 'Created At', 'End Date'];
  const rows = proposals.map(({ id, title, state, votesCount, totalWeight, createdAt, endAt }) => [
    id,
    `"${title.replace(/"/g, '""')}"`,
    state,
    votesCount.toString(),
    totalWeight.toString(),
    createdAt,
    endAt,
  ]);
  return [header, ...rows].map((row) => row.join(',')).join('\n');
}

export function downloadCsv(csv: string, filename: string) {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
