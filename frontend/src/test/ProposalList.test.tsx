import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProposalList from '../components/ProposalList';
import type { Proposal } from '../types';

// Mock zustand store — ProposalList reads `connected` to show the create button
vi.mock('../store', () => ({
  useWalletStore: (selector: (s: { connected: boolean }) => unknown) =>
    selector({ connected: false }),
}));

// Mock CSV utils to avoid file-system side-effects in tests
vi.mock('../utils/csv', () => ({
  generateProposalCsv: vi.fn(() => ''),
  downloadCsv: vi.fn(),
}));

const PROPOSALS: Proposal[] = [
  {
    id: 'P-001',
    title: 'Increase quorum threshold',
    description: 'Raise the quorum from 10% to 15%.',
    state: 'Active',
    createdAt: '2026-06-01',
    endAt: '2026-07-01',
    votesCount: 42,
    totalWeight: 840000,
    votes: [],
  },
  {
    id: 'P-002',
    title: 'Allocate treasury funds',
    description: 'Send 500k tokens to the grants committee.',
    state: 'Passed',
    createdAt: '2026-05-01',
    endAt: '2026-06-01',
    votesCount: 120,
    totalWeight: 2400000,
    votes: [],
  },
  {
    id: 'P-003',
    title: 'Elect new council member',
    description: 'Nominate Alice for the governance council.',
    state: 'Rejected',
    createdAt: '2026-04-01',
    endAt: '2026-05-01',
    votesCount: 30,
    totalWeight: 300000,
    votes: [],
  },
];

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProposalList', () => {
  it('renders all proposals when no filter is applied', () => {
    render(<ProposalList proposals={PROPOSALS} />);
    expect(screen.getByText('Increase quorum threshold')).toBeInTheDocument();
    expect(screen.getByText('Allocate treasury funds')).toBeInTheDocument();
    expect(screen.getByText('Elect new council member')).toBeInTheDocument();
  });

  it('shows empty state when proposal list is empty', () => {
    render(<ProposalList proposals={[]} />);
    expect(screen.getByText(/no proposals have been created yet/i)).toBeInTheDocument();
  });

  it('filters proposals by search text', async () => {
    render(<ProposalList proposals={PROPOSALS} />);
    const searchInput = screen.getByRole('searchbox', { name: /search proposals/i });
    await userEvent.type(searchInput, 'quorum');

    expect(screen.getByText('Increase quorum threshold')).toBeInTheDocument();
    expect(screen.queryByText('Allocate treasury funds')).not.toBeInTheDocument();
    expect(screen.queryByText('Elect new council member')).not.toBeInTheDocument();
  });

  it('shows no-match message when search yields no results', async () => {
    render(<ProposalList proposals={PROPOSALS} />);
    const searchInput = screen.getByRole('searchbox', { name: /search proposals/i });
    await userEvent.type(searchInput, 'zzznomatch');

    expect(screen.getByText(/no proposals match "zzznomatch"/i)).toBeInTheDocument();
  });

  it('filters proposals by state tab', async () => {
    render(<ProposalList proposals={PROPOSALS} />);
    const passedTab = screen.getByRole('tab', { name: 'Passed' });
    await userEvent.click(passedTab);

    expect(screen.getByText('Allocate treasury funds')).toBeInTheDocument();
    expect(screen.queryByText('Increase quorum threshold')).not.toBeInTheDocument();
    expect(screen.queryByText('Elect new council member')).not.toBeInTheDocument();
  });

  it('sets aria-selected on the active tab', async () => {
    render(<ProposalList proposals={PROPOSALS} />);
    const allTab = screen.getByRole('tab', { name: 'All' });
    const activeTab = screen.getByRole('tab', { name: 'Active' });

    expect(allTab).toHaveAttribute('aria-selected', 'true');
    expect(activeTab).toHaveAttribute('aria-selected', 'false');

    await userEvent.click(activeTab);

    expect(allTab).toHaveAttribute('aria-selected', 'false');
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
  });

  it('sorts proposals by newest first by default', () => {
    render(<ProposalList proposals={PROPOSALS} />);
    const table = screen.getAllByRole('table')[0];
    const rows = within(table).getAllByRole('row');
    // header row + 3 data rows; first data row should be the newest (P-001 2026-06-01)
    expect(rows[1]).toHaveTextContent('P-001');
  });

  it('sorts proposals by oldest when "Oldest" is selected', async () => {
    render(<ProposalList proposals={PROPOSALS} />);
    const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
    await userEvent.selectOptions(sortSelect, 'oldest');

    const table = screen.getAllByRole('table')[0];
    const rows = within(table).getAllByRole('row');
    // Oldest is P-003 (2026-04-01)
    expect(rows[1]).toHaveTextContent('P-003');
  });

  it('disables export button when filtered list is empty', async () => {
    render(<ProposalList proposals={PROPOSALS} />);
    const searchInput = screen.getByRole('searchbox', { name: /search proposals/i });
    await userEvent.type(searchInput, 'zzznomatch');

    const exportBtn = screen.getByRole('button', { name: /export filtered proposals/i });
    expect(exportBtn).toBeDisabled();
  });

  it('renders proposal state badges in the card view', () => {
    render(<ProposalList proposals={PROPOSALS} />);
    expect(screen.getAllByText('Active').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Passed').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Rejected').length).toBeGreaterThan(0);
  });

  it('navigates tabs with arrow keys', async () => {
    render(<ProposalList proposals={PROPOSALS} />);
    const allTab = screen.getByRole('tab', { name: 'All' });
    allTab.focus();
    await userEvent.keyboard('{ArrowRight}');

    const activeTab = screen.getByRole('tab', { name: 'Active' });
    expect(activeTab).toHaveAttribute('aria-selected', 'true');
  });
});
