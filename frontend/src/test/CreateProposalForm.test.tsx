import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import CreateProposalForm from '../components/CreateProposalForm';

beforeEach(() => {
  vi.clearAllMocks();
});

describe('CreateProposalForm', () => {
  it('renders the form with required fields', () => {
    render(<CreateProposalForm />);
    expect(screen.getByRole('heading', { name: /create proposal/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/title/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/quorum/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/voting duration/i)).toBeInTheDocument();
  });

  it('renders the template selector with a Custom option', () => {
    render(<CreateProposalForm />);
    const select = screen.getByRole('combobox', { name: /template/i });
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /custom/i })).toBeInTheDocument();
  });

  it('pre-fills title and description when a template is selected via dropdown', async () => {
    render(<CreateProposalForm />);
    const select = screen.getByRole('combobox', { name: /template/i });
    await userEvent.selectOptions(select, 'treasury-allocation');

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    const descTextarea = screen.getByLabelText(/description/i) as HTMLTextAreaElement;

    expect(titleInput.value).toContain('Allocate');
    expect(descTextarea.value).toContain('treasury');
  });

  it('pre-fills fields when a quick-select template button is clicked', async () => {
    render(<CreateProposalForm />);
    const paramBtn = screen.getByRole('button', { name: /parameter change/i });
    await userEvent.click(paramBtn);

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    expect(titleInput.value).toContain('PARAMETER_NAME');
  });

  it('marks the active template button as pressed', async () => {
    render(<CreateProposalForm />);
    const treasuryBtn = screen.getByRole('button', { name: /treasury allocation/i });
    await userEvent.click(treasuryBtn);

    expect(treasuryBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('allows free-form editing after a template is applied', async () => {
    render(<CreateProposalForm />);
    const select = screen.getByRole('combobox', { name: /template/i });
    await userEvent.selectOptions(select, 'treasury-allocation');

    const titleInput = screen.getByLabelText(/title/i);
    await userEvent.clear(titleInput);
    await userEvent.type(titleInput, 'My custom title');

    expect((titleInput as HTMLInputElement).value).toBe('My custom title');
  });

  it('calls onSubmit with form values when submitted', async () => {
    const onSubmit = vi.fn();
    render(<CreateProposalForm onSubmit={onSubmit} />);

    await userEvent.type(screen.getByLabelText(/title/i), 'Test proposal');
    await userEvent.type(screen.getByLabelText(/description/i), 'A test description.');
    await userEvent.type(screen.getByLabelText(/quorum/i), '5000');
    await userEvent.type(screen.getByLabelText(/voting duration/i), '604800');

    await userEvent.click(screen.getByRole('button', { name: /submit governance proposal/i }));

    expect(onSubmit).toHaveBeenCalledOnce();
    const args = onSubmit.mock.calls[0][0];
    expect(args.title).toBe('Test proposal');
    expect(args.description).toBe('A test description.');
    expect(args.quorum).toBe('5000');
    expect(args.duration).toBe('604800');
  });

  it('does not throw when submitted without an onSubmit handler', async () => {
    render(<CreateProposalForm />);
    await userEvent.type(screen.getByLabelText(/title/i), 'Test');
    await expect(
      userEvent.click(screen.getByRole('button', { name: /submit governance proposal/i }))
    ).resolves.not.toThrow();
  });

  it('resets fields to empty when Custom template is selected', async () => {
    render(<CreateProposalForm />);
    const select = screen.getByRole('combobox', { name: /template/i });

    await userEvent.selectOptions(select, 'treasury-allocation');
    await userEvent.selectOptions(select, 'custom');

    const titleInput = screen.getByLabelText(/title/i) as HTMLInputElement;
    // Custom template has an empty title
    expect(titleInput.value).toBe('');
  });
});
