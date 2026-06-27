import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Navbar from '../components/Navbar';

// i18n — return the key so we can assert on known strings
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// FreighterWallet and LanguageSwitcher bring in heavy deps; stub them out
vi.mock('../components/FreighterWallet', () => ({
  FreighterWallet: () => <div data-testid="freighter-wallet" />,
}));

vi.mock('../components/LanguageSwitcher', () => ({
  default: () => <div data-testid="language-switcher" />,
}));

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  document.documentElement.classList.remove('dark');
});

describe('Navbar', () => {
  it('renders the brand name', () => {
    render(<Navbar />);
    expect(screen.getByText('nav.brand')).toBeInTheDocument();
  });

  it('renders the theme toggle button', () => {
    render(<Navbar />);
    expect(screen.getByRole('button', { name: /switch to dark mode/i })).toBeInTheDocument();
  });

  it('renders the FreighterWallet component', () => {
    render(<Navbar />);
    expect(screen.getByTestId('freighter-wallet')).toBeInTheDocument();
  });

  it('renders the LanguageSwitcher component', () => {
    render(<Navbar />);
    expect(screen.getByTestId('language-switcher')).toBeInTheDocument();
  });

  it('toggles dark mode class on documentElement when theme button is clicked', async () => {
    render(<Navbar />);
    const toggleBtn = screen.getByRole('button', { name: /switch to dark mode/i });

    await userEvent.click(toggleBtn);
    expect(document.documentElement.classList.contains('dark')).toBe(true);

    await userEvent.click(screen.getByRole('button', { name: /switch to light mode/i }));
    expect(document.documentElement.classList.contains('dark')).toBe(false);
  });

  it('persists theme preference in localStorage', async () => {
    render(<Navbar />);
    const toggleBtn = screen.getByRole('button', { name: /switch to dark mode/i });

    await userEvent.click(toggleBtn);
    expect(localStorage.getItem('theme')).toBe('dark');

    await userEvent.click(screen.getByRole('button', { name: /switch to light mode/i }));
    expect(localStorage.getItem('theme')).toBe('light');
  });

  it('renders with accessible nav landmark', () => {
    render(<Navbar />);
    expect(screen.getByRole('navigation', { name: 'nav.mainNavLabel' })).toBeInTheDocument();
  });
});
