import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import Modal from '../components/Modal';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { changeLanguage: vi.fn() },
  }),
}));

// useFocusTrap needs a ref — return a simple passthrough
vi.mock('../hooks/useFocusTrap', () => ({
  useFocusTrap: <T extends HTMLElement>(_open: boolean, _onClose: () => void) => {
    const { useRef } = require('react');
    return useRef<T>(null);
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Modal', () => {
  it('renders nothing when isOpen is false', () => {
    const { container } = render(
      <Modal isOpen={false} onClose={vi.fn()} title="Test modal">
        <p>Content</p>
      </Modal>
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders title and children when isOpen is true', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Governance action">
        <p>Modal body content</p>
      </Modal>
    );
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByText('Governance action')).toBeInTheDocument();
    expect(screen.getByText('Modal body content')).toBeInTheDocument();
  });

  it('has role="dialog" and aria-modal="true"', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Accessible modal">
        content
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
  });

  it('labels the dialog with the title via aria-labelledby', () => {
    render(
      <Modal isOpen onClose={vi.fn()} title="Labeled dialog">
        content
      </Modal>
    );
    const dialog = screen.getByRole('dialog');
    expect(dialog).toHaveAttribute('aria-labelledby', 'modal-title');
    expect(document.getElementById('modal-title')).toHaveTextContent('Labeled dialog');
  });

  it('calls onClose when the close button is clicked', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Close test">
        content
      </Modal>
    );
    await userEvent.click(screen.getByRole('button', { name: /common:closeDialog/i }));
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('calls onClose when clicking the backdrop', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Backdrop close">
        <span>inner</span>
      </Modal>
    );
    // The backdrop is the element with class modal-backdrop
    const backdrop = document.querySelector('.modal-backdrop') as HTMLElement;
    await userEvent.click(backdrop);
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('does not call onClose when clicking inside the dialog', async () => {
    const onClose = vi.fn();
    render(
      <Modal isOpen onClose={onClose} title="Click-through test">
        <button type="button">Inner button</button>
      </Modal>
    );
    await userEvent.click(screen.getByRole('button', { name: /inner button/i }));
    expect(onClose).not.toHaveBeenCalled();
  });
});
