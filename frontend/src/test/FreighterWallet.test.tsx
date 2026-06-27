import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { FreighterWallet } from '../components/FreighterWallet';

const mockFreighter = {
  isConnected: vi.fn(),
  requestAccess: vi.fn(),
  getPublicKey: vi.fn(),
  getNetwork: vi.fn(),
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: not connected on mount
  mockFreighter.isConnected.mockResolvedValue(false);
  (window as any).freighter = mockFreighter;
});

describe('FreighterWallet', () => {
  it('connect button triggers Freighter connection', async () => {
    mockFreighter.requestAccess.mockResolvedValue(undefined);
    mockFreighter.getPublicKey.mockResolvedValue('GABCDE1234567890ABCDE1234567890ABCDE1234567890ABCDE1234567890');
    mockFreighter.getNetwork.mockResolvedValue('TESTNET');

    render(<FreighterWallet />);
    await userEvent.click(screen.getByRole('button', { name: /connect freighter wallet/i }));

    expect(mockFreighter.requestAccess).toHaveBeenCalledOnce();
    expect(mockFreighter.getPublicKey).toHaveBeenCalledOnce();
  });

  it('connected state shows truncated address', async () => {
    const address = 'GABCDE1234567890ABCDE1234567890ABCDE1234567890ABCDE1234567890';
    mockFreighter.requestAccess.mockResolvedValue(undefined);
    mockFreighter.getPublicKey.mockResolvedValue(address);
    mockFreighter.getNetwork.mockResolvedValue('TESTNET');

    render(<FreighterWallet />);
    await userEvent.click(screen.getByRole('button', { name: /connect freighter wallet/i }));

    await waitFor(() =>
      expect(screen.getByLabelText(/connected wallet address/i)).toHaveTextContent('GABCDE...7890')
    );
  });

  it('disconnect clears wallet state', async () => {
    const address = 'GABCDE1234567890ABCDE1234567890ABCDE1234567890ABCDE1234567890';
    mockFreighter.requestAccess.mockResolvedValue(undefined);
    mockFreighter.getPublicKey.mockResolvedValue(address);
    mockFreighter.getNetwork.mockResolvedValue('TESTNET');

    render(<FreighterWallet />);
    await userEvent.click(screen.getByRole('button', { name: /connect freighter wallet/i }));
    await waitFor(() => screen.getByRole('button', { name: /disconnect wallet/i }));

    await userEvent.click(screen.getByRole('button', { name: /disconnect wallet/i }));

    expect(screen.getByRole('button', { name: /connect freighter wallet/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/connected wallet address/i)).not.toBeInTheDocument();
  });

  it('Freighter not installed shows install prompt', async () => {
    delete (window as any).freighter;

    render(<FreighterWallet />);
    await userEvent.click(screen.getByRole('button', { name: /connect freighter wallet/i }));

    await waitFor(() =>
      expect(screen.getByRole('link', { name: /install freighter/i })).toBeInTheDocument()
    );
  });
});
