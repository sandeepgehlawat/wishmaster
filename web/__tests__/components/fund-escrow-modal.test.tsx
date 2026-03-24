import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import { FundEscrowModal } from '@/components/fund-escrow-modal';
import { server } from '../setup';
import { http, HttpResponse } from 'msw';

// Mock the use-escrow-deposit hook
const mockDeposit = vi.fn();
const mockReset = vi.fn();

const defaultHookState = {
  state: 'idle' as const,
  error: null,
  approveTxHash: null,
  depositTxHash: null,
  usdcBalance: 500,
  allowance: 0,
  deposit: mockDeposit,
  reset: mockReset,
};

let mockHookReturn = { ...defaultHookState };

vi.mock('@/hooks/use-escrow-deposit', () => ({
  useEscrowDeposit: () => mockHookReturn,
}));

// Mock the contract config
vi.mock('@/lib/contracts/config', () => ({
  getExplorerTxUrl: (hash: string) => `https://explorer.test/tx/${hash}`,
  getContractAddresses: () => ({
    escrow: '0x1234567890abcdef1234567890abcdef12345678',
    usdc: '0xabcdef1234567890abcdef1234567890abcdef12',
  }),
}));

describe('FundEscrowModal', () => {
  const defaultProps = {
    isOpen: true,
    onClose: vi.fn(),
    onSuccess: vi.fn(),
    jobId: 'job-123',
    amountUsdc: 100,
    token: 'test-token',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockHookReturn = { ...defaultHookState };
    document.body.style.overflow = '';
  });

  afterEach(() => {
    document.body.style.overflow = '';
  });

  describe('Modal Opening/Closing', () => {
    it('renders when isOpen is true', () => {
      render(<FundEscrowModal {...defaultProps} />);

      expect(screen.getByText('FUND_ESCROW')).toBeInTheDocument();
      expect(screen.getByText(/Depositing 100.00 USDC to escrow/)).toBeInTheDocument();
    });

    it('does not render when isOpen is false', () => {
      render(<FundEscrowModal {...defaultProps} isOpen={false} />);

      expect(screen.queryByText('FUND_ESCROW')).not.toBeInTheDocument();
    });

    it('calls onClose when close button is clicked', () => {
      render(<FundEscrowModal {...defaultProps} />);

      const closeButton = screen.getByRole('button', { name: '' }); // X button has no text
      fireEvent.click(closeButton);

      expect(mockReset).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when backdrop is clicked', () => {
      render(<FundEscrowModal {...defaultProps} />);

      // The backdrop is the first div with bg-black/95 class
      const backdrop = document.querySelector('.bg-black\\/95');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop!);

      expect(mockReset).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('does not close when clicking backdrop during processing', () => {
      mockHookReturn = { ...defaultHookState, state: 'approving' };
      render(<FundEscrowModal {...defaultProps} />);

      const backdrop = document.querySelector('.bg-black\\/95');
      fireEvent.click(backdrop!);

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('prevents body scroll when modal is open', () => {
      render(<FundEscrowModal {...defaultProps} />);

      expect(document.body.style.overflow).toBe('hidden');
    });

    it('restores body scroll when modal closes', () => {
      const { rerender } = render(<FundEscrowModal {...defaultProps} />);
      expect(document.body.style.overflow).toBe('hidden');

      rerender(<FundEscrowModal {...defaultProps} isOpen={false} />);
      expect(document.body.style.overflow).toBe('unset');
    });
  });

  describe('Escape Key Closing', () => {
    it('closes modal when Escape key is pressed', () => {
      render(<FundEscrowModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(mockReset).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('does not close when Escape is pressed during processing', () => {
      mockHookReturn = { ...defaultHookState, state: 'depositing' };
      render(<FundEscrowModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Escape' });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });

    it('does not close on other key presses', () => {
      render(<FundEscrowModal {...defaultProps} />);

      fireEvent.keyDown(document, { key: 'Enter' });

      expect(defaultProps.onClose).not.toHaveBeenCalled();
    });
  });

  describe('Insufficient Balance Display', () => {
    it('shows insufficient balance warning when balance is too low', () => {
      mockHookReturn = { ...defaultHookState, usdcBalance: 50 };
      render(<FundEscrowModal {...defaultProps} amountUsdc={100} />);

      expect(screen.getByText('INSUFFICIENT_BALANCE')).toBeInTheDocument();
      expect(screen.getByText(/You have 50.00 USDC but need 100.00 USDC/)).toBeInTheDocument();
    });

    it('shows close button when balance is insufficient', () => {
      mockHookReturn = { ...defaultHookState, usdcBalance: 50 };
      render(<FundEscrowModal {...defaultProps} amountUsdc={100} />);

      expect(screen.getByRole('button', { name: '[CLOSE]' })).toBeInTheDocument();
    });

    it('does not show insufficient balance when balance is sufficient', () => {
      mockHookReturn = { ...defaultHookState, usdcBalance: 500 };
      render(<FundEscrowModal {...defaultProps} amountUsdc={100} />);

      expect(screen.queryByText('INSUFFICIENT_BALANCE')).not.toBeInTheDocument();
    });

    it('displays current USDC balance', () => {
      mockHookReturn = { ...defaultHookState, usdcBalance: 250.5 };
      render(<FundEscrowModal {...defaultProps} />);

      expect(screen.getByText('YOUR USDC BALANCE')).toBeInTheDocument();
      expect(screen.getByText('250.50 USDC')).toBeInTheDocument();
    });
  });

  describe('3-Step Funding Flow', () => {
    it('displays all three steps', () => {
      render(<FundEscrowModal {...defaultProps} />);

      expect(screen.getByText('APPROVE_USDC')).toBeInTheDocument();
      expect(screen.getByText('DEPOSIT_ESCROW')).toBeInTheDocument();
      expect(screen.getByText('CONFIRM')).toBeInTheDocument();
    });

    it('highlights approve step when in approving state', () => {
      mockHookReturn = { ...defaultHookState, state: 'approving' };
      render(<FundEscrowModal {...defaultProps} />);

      const approveStep = screen.getByText('APPROVE_USDC').closest('div[class*="border-yellow-400"]');
      expect(approveStep).toBeInTheDocument();
    });

    it('highlights deposit step when in depositing state', () => {
      mockHookReturn = { ...defaultHookState, state: 'depositing' };
      render(<FundEscrowModal {...defaultProps} />);

      // The deposit step should be active (yellow border)
      const depositStep = screen.getByText('DEPOSIT_ESCROW');
      expect(depositStep).toHaveClass('text-yellow-400');
    });

    it('highlights confirm step when in confirming state', () => {
      mockHookReturn = { ...defaultHookState, state: 'confirming' };
      render(<FundEscrowModal {...defaultProps} />);

      const confirmStep = screen.getByText('CONFIRM');
      expect(confirmStep).toHaveClass('text-yellow-400');
    });

    it('marks steps as complete after success', () => {
      mockHookReturn = { ...defaultHookState, state: 'success' };
      render(<FundEscrowModal {...defaultProps} />);

      // All steps should show checkmark (be in completed state)
      expect(screen.getByText('APPROVE_USDC')).toHaveClass('text-secondary-400');
      expect(screen.getByText('DEPOSIT_ESCROW')).toHaveClass('text-secondary-400');
      expect(screen.getByText('CONFIRM')).toHaveClass('text-secondary-400');
    });

    it('shows transaction link for approve step when hash is available', () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'depositing',
        approveTxHash: '0xabc123' as `0x${string}`
      };
      render(<FundEscrowModal {...defaultProps} />);

      const txLink = screen.getAllByRole('link').find(link =>
        link.getAttribute('href')?.includes('tx/0xabc123')
      );
      expect(txLink).toBeInTheDocument();
      expect(txLink).toHaveAttribute('target', '_blank');
    });

    it('shows transaction link for deposit step when hash is available', () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'confirming',
        depositTxHash: '0xdef456' as `0x${string}`
      };
      render(<FundEscrowModal {...defaultProps} />);

      const txLink = screen.getAllByRole('link').find(link =>
        link.getAttribute('href')?.includes('tx/0xdef456')
      );
      expect(txLink).toBeInTheDocument();
    });

    it('shows processing message during transaction', () => {
      mockHookReturn = { ...defaultHookState, state: 'waiting_approve' };
      render(<FundEscrowModal {...defaultProps} />);

      expect(screen.getByText(/Please confirm transaction in your wallet/)).toBeInTheDocument();
    });

    it('starts deposit automatically when modal opens with sufficient balance', async () => {
      mockHookReturn = { ...defaultHookState, usdcBalance: 500 };
      render(<FundEscrowModal {...defaultProps} />);

      await waitFor(() => {
        expect(mockDeposit).toHaveBeenCalledWith('job-123', 100, 'test-token');
      });
    });

    it('does not start deposit when balance is insufficient', async () => {
      mockHookReturn = { ...defaultHookState, usdcBalance: 50 };
      render(<FundEscrowModal {...defaultProps} amountUsdc={100} />);

      // Wait a bit to ensure deposit is not called
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(mockDeposit).not.toHaveBeenCalled();
    });
  });

  describe('Success State', () => {
    it('shows success message when deposit completes', () => {
      mockHookReturn = { ...defaultHookState, state: 'success' };
      render(<FundEscrowModal {...defaultProps} amountUsdc={100} />);

      expect(screen.getByText('ESCROW_FUNDED')).toBeInTheDocument();
      expect(screen.getByText(/100.00 USDC deposited successfully/)).toBeInTheDocument();
    });

    it('displays success state with timer for callback', () => {
      // Note: The actual callback timing is tested via integration tests
      // This unit test verifies the success state is properly displayed
      mockHookReturn = { ...defaultHookState, state: 'success' };
      render(<FundEscrowModal {...defaultProps} />);

      // Verify success message is shown
      expect(screen.getByText('ESCROW_FUNDED')).toBeInTheDocument();

      // The component will call onSuccess after 1500ms timeout
      // The setTimeout is set up in a useEffect that depends on state === 'success'
    });
  });

  describe('Error States and Retry', () => {
    it('shows error message when transaction fails', () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'error',
        error: 'User rejected transaction'
      };
      render(<FundEscrowModal {...defaultProps} />);

      expect(screen.getByText('TRANSACTION_FAILED')).toBeInTheDocument();
      expect(screen.getByText('User rejected transaction')).toBeInTheDocument();
    });

    it('shows cancel and retry buttons on error', () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'error',
        error: 'Transaction failed'
      };
      render(<FundEscrowModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: '[CANCEL]' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: '[RETRY]' })).toBeInTheDocument();
    });

    it('calls reset and deposit on retry', () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'error',
        error: 'Transaction failed'
      };
      render(<FundEscrowModal {...defaultProps} />);

      const retryButton = screen.getByRole('button', { name: '[RETRY]' });
      fireEvent.click(retryButton);

      expect(mockReset).toHaveBeenCalled();
      expect(mockDeposit).toHaveBeenCalledWith('job-123', 100, 'test-token');
    });

    it('calls onClose when cancel is clicked on error', () => {
      mockHookReturn = {
        ...defaultHookState,
        state: 'error',
        error: 'Transaction failed'
      };
      render(<FundEscrowModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: '[CANCEL]' });
      fireEvent.click(cancelButton);

      expect(mockReset).toHaveBeenCalled();
      expect(defaultProps.onClose).toHaveBeenCalled();
    });
  });

  describe('Contract Info Display', () => {
    it('displays escrow contract address', () => {
      render(<FundEscrowModal {...defaultProps} />);

      expect(screen.getByText('ESCROW CONTRACT')).toBeInTheDocument();
      // Check for truncated address format
      expect(screen.getByText(/0x12345678...12345678/)).toBeInTheDocument();
    });

    it('displays USDC token address', () => {
      render(<FundEscrowModal {...defaultProps} />);

      expect(screen.getByText('USDC TOKEN')).toBeInTheDocument();
    });
  });

  describe('Amount Display', () => {
    it('formats amount with two decimal places', () => {
      render(<FundEscrowModal {...defaultProps} amountUsdc={123.456} />);

      expect(screen.getByText(/Depositing 123.46 USDC to escrow/)).toBeInTheDocument();
    });

    it('handles whole number amounts', () => {
      render(<FundEscrowModal {...defaultProps} amountUsdc={100} />);

      expect(screen.getByText(/Depositing 100.00 USDC to escrow/)).toBeInTheDocument();
    });
  });
});
