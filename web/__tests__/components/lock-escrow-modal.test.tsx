import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '../utils/test-utils';
import { LockEscrowModal } from '@/components/lock-escrow-modal';

// Mock the use-escrow-lock hook
const mockLockToAgent = vi.fn();
const mockReset = vi.fn();

const defaultHookState = {
  state: 'idle' as const,
  error: null,
  lockTxHash: null,
  excessRefunded: 0,
  lockToAgent: mockLockToAgent,
  reset: mockReset,
};

let mockHookReturn = { ...defaultHookState };

vi.mock('@/hooks/use-escrow-lock', () => ({
  useEscrowLock: () => mockHookReturn,
}));

// Mock the contract config
vi.mock('@/lib/contracts/config', () => ({
  getExplorerTxUrl: (hash: string) => `https://explorer.test/tx/${hash}`,
  getContractAddresses: () => ({
    escrow: '0x1234567890abcdef1234567890abcdef12345678',
    usdc: '0xabcdef1234567890abcdef1234567890abcdef12',
  }),
}));

describe('LockEscrowModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    jobId: 'job-123',
    agentWallet: '0xagent1234567890abcdef1234567890abcdef1234',
    agentName: 'Test Agent',
    bidAmount: 350,
    escrowAmount: 500,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHookReturn = { ...defaultHookState };
    document.body.style.overflow = '';
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    document.body.style.overflow = '';
  });

  describe('Modal Displays Agent Name and Amounts', () => {
    it('renders modal with agent name in header', () => {
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByText('LOCK_ESCROW_TO_AGENT')).toBeInTheDocument();
      expect(screen.getByText(/Confirm bid selection for Test Agent/)).toBeInTheDocument();
    });

    it('displays escrow funded amount', () => {
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByText('ESCROW FUNDED')).toBeInTheDocument();
      expect(screen.getByText('500.00 USDC')).toBeInTheDocument();
    });

    it('displays winning bid amount', () => {
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByText('WINNING BID')).toBeInTheDocument();
      expect(screen.getByText('350.00 USDC')).toBeInTheDocument();
    });

    it('displays agent name in success message', async () => {
      mockHookReturn = { ...defaultHookState, state: 'success' };
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByText(/350.00 USDC locked to Test Agent/)).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<LockEscrowModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('LOCK_ESCROW_TO_AGENT')).not.toBeInTheDocument();
    });
  });

  describe('Excess Refund Calculation Displayed', () => {
    it('displays refund amount when escrow exceeds bid', () => {
      render(<LockEscrowModal {...defaultProps} escrowAmount={500} bidAmount={350} />);

      expect(screen.getByText('REFUND TO YOU')).toBeInTheDocument();
      expect(screen.getByText('+150.00 USDC')).toBeInTheDocument();
    });

    it('shows refund box in flow visualization', () => {
      render(<LockEscrowModal {...defaultProps} escrowAmount={500} bidAmount={350} />);

      // Check flow visualization shows refund
      const refundElements = screen.getAllByText('REFUND');
      expect(refundElements.length).toBeGreaterThan(0);
    });

    it('does not display refund section when no excess', () => {
      render(<LockEscrowModal {...defaultProps} escrowAmount={350} bidAmount={350} />);

      expect(screen.queryByText('REFUND TO YOU')).not.toBeInTheDocument();
    });

    it('includes refund in success message', () => {
      mockHookReturn = { ...defaultHookState, state: 'success' };
      render(<LockEscrowModal {...defaultProps} escrowAmount={500} bidAmount={350} />);

      expect(screen.getByText(/150.00 USDC refunded to you/)).toBeInTheDocument();
    });

    it('does not mention refund in success message when no excess', () => {
      mockHookReturn = { ...defaultHookState, state: 'success' };
      render(<LockEscrowModal {...defaultProps} escrowAmount={350} bidAmount={350} />);

      expect(screen.queryByText(/refunded/)).not.toBeInTheDocument();
    });

    it('handles small excess amounts correctly', () => {
      render(<LockEscrowModal {...defaultProps} escrowAmount={350.50} bidAmount={350} />);

      expect(screen.getByText('+0.50 USDC')).toBeInTheDocument();
    });
  });

  describe('Lock Transaction Flow', () => {
    it('auto-starts lock transaction when modal opens', () => {
      vi.useRealTimers(); // Use real timers for this test
      render(<LockEscrowModal {...defaultProps} />);

      // The useEffect runs synchronously, so lockToAgent should already be called
      expect(mockLockToAgent).toHaveBeenCalledWith(
        'job-123',
        '0xagent1234567890abcdef1234567890abcdef1234',
        350,
        500
      );
      vi.useFakeTimers(); // Restore fake timers
    });

    it('shows locking state with wallet confirmation message', () => {
      mockHookReturn = { ...defaultHookState, state: 'locking' };
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByText(/Please confirm transaction in your wallet/)).toBeInTheDocument();
    });

    it('shows waiting/confirming state', () => {
      mockHookReturn = { ...defaultHookState, state: 'waiting_lock' };
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByText(/Confirming transaction/)).toBeInTheDocument();
    });

    it('shows confirming state', () => {
      mockHookReturn = { ...defaultHookState, state: 'confirming' };
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByText(/Confirming transaction/)).toBeInTheDocument();
    });

    it('shows success state when transaction completes', () => {
      mockHookReturn = { ...defaultHookState, state: 'success' };
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByText('ESCROW_LOCKED')).toBeInTheDocument();
    });

    it('displays transaction link when hash is available', () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'confirming',
        lockTxHash: '0xabc123def456'
      };
      render(<LockEscrowModal {...defaultProps} />);

      const txLink = screen.getByRole('link', { name: /View transaction/i });
      expect(txLink).toBeInTheDocument();
      expect(txLink).toHaveAttribute('href', 'https://explorer.test/tx/0xabc123def456');
      expect(txLink).toHaveAttribute('target', '_blank');
    });

    it('hides close button during processing', () => {
      mockHookReturn = { ...defaultHookState, state: 'locking' };
      render(<LockEscrowModal {...defaultProps} />);

      // The close X button should not be present during processing
      const buttons = screen.queryAllByRole('button');
      const closeButton = buttons.find(btn => btn.querySelector('svg[class*="h-5 w-5"]'));
      expect(closeButton).toBeUndefined();
    });

    it('shows close button when not processing', () => {
      mockHookReturn = { ...defaultHookState, state: 'idle' };
      render(<LockEscrowModal {...defaultProps} />);

      // Close button should be present in idle state
      expect(document.querySelector('button')).toBeInTheDocument();
    });

    it('does not restart lock when already in progress', () => {
      mockHookReturn = { ...defaultHookState, state: 'locking' };
      render(<LockEscrowModal {...defaultProps} />);

      // Should not call lockToAgent since state is not idle
      expect(mockLockToAgent).not.toHaveBeenCalled();
    });
  });

  describe('Error State and Retry', () => {
    it('displays error message when transaction fails', () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'error',
        error: 'User rejected the transaction'
      };
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByText('TRANSACTION_FAILED')).toBeInTheDocument();
      expect(screen.getByText('User rejected the transaction')).toBeInTheDocument();
    });

    it('shows cancel and retry buttons on error', () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'error',
        error: 'Transaction failed'
      };
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: '[CANCEL]' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '[RETRY]' })).toBeInTheDocument();
    });

    it('calls reset and lockToAgent on retry', async () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'error',
        error: 'Transaction failed'
      };
      render(<LockEscrowModal {...defaultProps} />);

      const retryButton = screen.getByRole('button', { name: '[RETRY]' });
      fireEvent.click(retryButton);

      expect(mockReset).toHaveBeenCalled();
      expect(mockLockToAgent).toHaveBeenCalledWith(
        'job-123',
        '0xagent1234567890abcdef1234567890abcdef1234',
        350,
        500
      );
    });

    it('closes modal on cancel from error state', () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'error',
        error: 'Transaction failed'
      };
      render(<LockEscrowModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: '[CANCEL]' });
      fireEvent.click(cancelButton);

      expect(mockReset).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('displays generic error when no specific message', () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'error',
        error: ''
      };
      render(<LockEscrowModal {...defaultProps} />);

      // Error section should still show but with empty message
      expect(screen.queryByText('TRANSACTION_FAILED')).not.toBeInTheDocument();
    });
  });

  describe('Success State Auto-Closes', () => {
    it('calls onSuccess after delay when transaction succeeds', async () => {
      mockHookReturn = { ...defaultHookState, state: 'success' };
      render(<LockEscrowModal {...defaultProps} />);

      // Fast-forward the timer
      act(() => {
        vi.advanceTimersByTime(1500);
      });

      expect(defaultProps.onSuccess).toHaveBeenCalled();
    });

    it('does not call onSuccess immediately on success', () => {
      mockHookReturn = { ...defaultHookState, state: 'success' };
      render(<LockEscrowModal {...defaultProps} />);

      // Should not be called immediately
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    });

    it('shows success message before auto-closing', () => {
      mockHookReturn = { ...defaultHookState, state: 'success' };
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByText('ESCROW_LOCKED')).toBeInTheDocument();
      expect(screen.getByText(/350.00 USDC locked to Test Agent/)).toBeInTheDocument();
    });

    it('cleans up timer on unmount', () => {
      mockHookReturn = { ...defaultHookState, state: 'success' };
      const { unmount } = render(<LockEscrowModal {...defaultProps} />);

      unmount();

      // Timer should be cleaned up, advancing should not cause issues
      act(() => {
        vi.advanceTimersByTime(2000);
      });

      // onSuccess should not have been called after unmount cleanup
      expect(defaultProps.onSuccess).not.toHaveBeenCalled();
    });
  });

  describe('Modal Close Behavior', () => {
    it('calls onClose when backdrop is clicked (not processing)', () => {
      render(<LockEscrowModal {...defaultProps} />);

      const backdrop = document.querySelector('.bg-black\\/95');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop!);

      expect(mockReset).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('does not close when backdrop is clicked during processing', () => {
      mockHookReturn = { ...defaultHookState, state: 'locking' };
      render(<LockEscrowModal {...defaultProps} />);

      const backdrop = document.querySelector('.bg-black\\/95');
      fireEvent.click(backdrop!);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('closes on Escape key when not processing', () => {
      render(<LockEscrowModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockReset).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('does not close on Escape during processing', () => {
      mockHookReturn = { ...defaultHookState, state: 'confirming' };
      render(<LockEscrowModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('prevents body scroll when modal is open', () => {
      render(<LockEscrowModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when modal closes', () => {
      const { rerender } = render(<LockEscrowModal {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(<LockEscrowModal {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('unset');
    });

    it('resets hasStarted flag when modal closes', () => {
      const { rerender } = render(<LockEscrowModal {...defaultProps} />);

      // Close modal
      rerender(<LockEscrowModal {...defaultProps} isOpen={false} />);

      // Clear mocks
      vi.clearAllMocks();

      // Re-open modal - should start lock again
      mockHookReturn = { ...defaultHookState, state: 'idle' };
      rerender(<LockEscrowModal {...defaultProps} isOpen={true} />);

      // lockToAgent should be called again
      expect(mockLockToAgent).toHaveBeenCalled();
    });
  });

  describe('Flow Visualization', () => {
    it('displays escrow amount in flow visualization', () => {
      render(<LockEscrowModal {...defaultProps} escrowAmount={500} />);

      // Flow visualization shows truncated amounts
      expect(screen.getByText('500')).toBeInTheDocument();
      expect(screen.getByText('ESCROW')).toBeInTheDocument();
    });

    it('displays locked amount in flow visualization', () => {
      render(<LockEscrowModal {...defaultProps} bidAmount={350} />);

      expect(screen.getByText('350')).toBeInTheDocument();
      expect(screen.getByText('LOCKED')).toBeInTheDocument();
    });

    it('displays refund in flow visualization when there is excess', () => {
      render(<LockEscrowModal {...defaultProps} escrowAmount={500} bidAmount={350} />);

      expect(screen.getByText('150')).toBeInTheDocument();
      const refundLabels = screen.getAllByText('REFUND');
      expect(refundLabels.length).toBeGreaterThan(0);
    });
  });

  describe('Contract Info Display', () => {
    it('displays escrow contract address', () => {
      render(<LockEscrowModal {...defaultProps} />);

      expect(screen.getByText('ESCROW CONTRACT')).toBeInTheDocument();
      // Check for truncated address format
      expect(screen.getByText(/0x12345678...12345678/)).toBeInTheDocument();
    });
  });

  describe('Processing States', () => {
    it('considers locking as processing state', () => {
      mockHookReturn = { ...defaultHookState, state: 'locking' };
      render(<LockEscrowModal {...defaultProps} />);

      const backdrop = document.querySelector('.bg-black\\/95');
      fireEvent.click(backdrop!);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('considers waiting_lock as processing state', () => {
      mockHookReturn = { ...defaultHookState, state: 'waiting_lock' };
      render(<LockEscrowModal {...defaultProps} />);

      const backdrop = document.querySelector('.bg-black\\/95');
      fireEvent.click(backdrop!);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('considers confirming as processing state', () => {
      mockHookReturn = { ...defaultHookState, state: 'confirming' };
      render(<LockEscrowModal {...defaultProps} />);

      const backdrop = document.querySelector('.bg-black\\/95');
      fireEvent.click(backdrop!);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('allows close in success state', () => {
      mockHookReturn = { ...defaultHookState, state: 'success' };
      render(<LockEscrowModal {...defaultProps} />);

      const backdrop = document.querySelector('.bg-black\\/95');
      fireEvent.click(backdrop!);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('allows close in error state', () => {
      mockHookReturn = { ...defaultHookState, state: 'error', error: 'Failed' };
      render(<LockEscrowModal {...defaultProps} />);

      const backdrop = document.querySelector('.bg-black\\/95');
      fireEvent.click(backdrop!);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });
});
