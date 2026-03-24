import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '../../../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../setup';
import JobDetailPage from '@/app/dashboard/jobs/[id]/page';
import { useAuthStore } from '@/lib/store';

// API URL for MSW handlers
const API_URL = 'http://localhost:3001';

// Mock next/navigation
const mockPush = vi.fn();
const mockParams = { id: 'job-123' };

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  useParams: () => mockParams,
}));

// Mock the escrow hooks
const mockDeposit = vi.fn();
const mockLockToAgent = vi.fn();
const mockResetDeposit = vi.fn();
const mockResetLock = vi.fn();

let mockDepositHookState = {
  state: 'idle' as const,
  error: null,
  approveTxHash: null,
  depositTxHash: null,
  usdcBalance: 500,
  allowance: 0,
  deposit: mockDeposit,
  reset: mockResetDeposit,
};

let mockLockHookState = {
  state: 'idle' as const,
  error: null,
  lockTxHash: null,
  excessRefunded: 0,
  lockToAgent: mockLockToAgent,
  reset: mockResetLock,
};

vi.mock('@/hooks/use-escrow-deposit', () => ({
  useEscrowDeposit: () => mockDepositHookState,
}));

vi.mock('@/hooks/use-escrow-lock', () => ({
  useEscrowLock: () => mockLockHookState,
}));

// Mock contract config
vi.mock('@/lib/contracts/config', () => ({
  getExplorerTxUrl: (hash: string) => `https://explorer.test/tx/${hash}`,
  getContractAddresses: () => ({
    escrow: '0x1234567890abcdef1234567890abcdef12345678',
    usdc: '0xabcdef1234567890abcdef1234567890abcdef12',
  }),
}));

// Mock job data
const createMockJob = (overrides = {}) => ({
  id: 'job-123',
  client_id: 'user-1',
  agent_id: null,
  title: 'Build a landing page',
  description: 'Create a responsive landing page with modern design',
  task_type: 'coding',
  required_skills: ['react', 'tailwind', 'typescript'],
  complexity: 'moderate',
  budget_min: 100,
  budget_max: 500,
  final_price: null,
  pricing_model: 'fixed',
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  urgency: 'standard',
  status: 'draft',
  created_at: new Date().toISOString(),
  client_name: 'Test User',
  bid_count: 0,
  escrow: null,
  ...overrides,
});

const createMockBid = (overrides = {}) => ({
  id: 'bid-1',
  job_id: 'job-123',
  agent_id: 'agent-1',
  bid_amount: '350.00',
  estimated_hours: '24',
  estimated_completion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  proposal: 'I can build this landing page with React and Tailwind CSS.',
  approach: 'Will start with design mockup, then implement responsive components.',
  status: 'pending',
  revision_count: 0,
  created_at: new Date().toISOString(),
  agent_wallet: '0xagent1234567890abcdef1234567890abcdef12',
  // Nested agent object as expected by the component
  agent: {
    id: 'agent-1',
    display_name: 'Test Agent',
    reputation: {
      avg_rating: '4.8',
    },
    completed_jobs: 50,
    trust_tier: 'established',
  },
  ...overrides,
});

describe('JobDetailPage - Job Actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPush.mockClear();

    // Reset hook states
    mockDepositHookState = {
      state: 'idle' as const,
      error: null,
      approveTxHash: null,
      depositTxHash: null,
      usdcBalance: 500,
      allowance: 0,
      deposit: mockDeposit,
      reset: mockResetDeposit,
    };

    mockLockHookState = {
      state: 'idle' as const,
      error: null,
      lockTxHash: null,
      excessRefunded: 0,
      lockToAgent: mockLockToAgent,
      reset: mockResetLock,
    };

    // Default auth state
    useAuthStore.setState({
      token: 'mock-jwt-token',
      user: { id: 'user-1', wallet_address: '0x1234' },
      userType: 'client',
    });
  });

  afterEach(() => {
    server.resetHandlers();
  });

  // ==================== Job Publishing Flow ====================
  describe('JOB_PUB_001: Happy path - Click PUBLISH, see success modal', () => {
    it('should publish job and show success modal on successful publish', async () => {
      // Setup handlers for draft job
      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(createMockJob({ status: 'draft' }));
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.post(`${API_URL}/api/jobs/job-123/publish`, () => {
          return HttpResponse.json({
            job_id: 'job-123',
            escrow_pda: 'escrow-pda-12345',
            transaction: 'tx-12345',
            amount_usdc: 350,
          });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      // Check draft status - get the status badge specifically (excludes the timeline)
      const statusBadge = screen.getByText('DRAFT', { selector: 'span.border-2' });
      expect(statusBadge).toBeInTheDocument();

      // Find and click PUBLISH button
      const publishButton = screen.getByRole('button', { name: /\[PUBLISH\]/i });
      expect(publishButton).toBeInTheDocument();

      await user.click(publishButton);

      // Wait for success modal
      await waitFor(() => {
        expect(screen.getByText('JOB_PUBLISHED')).toBeInTheDocument();
      });

      expect(screen.getByText(/Your job is now LIVE on the marketplace/)).toBeInTheDocument();
    });

    it('should show loading state during publish', async () => {
      // Add delay to observe loading state
      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(createMockJob({ status: 'draft' }));
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.post(`${API_URL}/api/jobs/job-123/publish`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            job_id: 'job-123',
            escrow_pda: 'escrow-pda-12345',
            transaction: 'tx-12345',
            amount_usdc: 350,
          });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      const publishButton = screen.getByRole('button', { name: /\[PUBLISH\]/i });
      await user.click(publishButton);

      // Should show publishing state
      await waitFor(() => {
        expect(screen.getByText(/\[PUBLISHING\.\.\.\]/i)).toBeInTheDocument();
      });
    });
  });

  describe('JOB_PUB_002: Network failure shows error, allows retry', () => {
    it('should show error message when publish fails and allow retry', async () => {
      let publishAttempts = 0;

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(createMockJob({ status: 'draft' }));
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.post(`${API_URL}/api/jobs/job-123/publish`, () => {
          publishAttempts++;
          if (publishAttempts === 1) {
            return HttpResponse.json(
              { error: { message: 'Network error: Connection refused' } },
              { status: 503 }
            );
          }
          return HttpResponse.json({
            job_id: 'job-123',
            escrow_pda: 'escrow-pda-12345',
            transaction: 'tx-12345',
            amount_usdc: 350,
          });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      // First publish attempt - should fail
      const publishButton = screen.getByRole('button', { name: /\[PUBLISH\]/i });
      await user.click(publishButton);

      await waitFor(() => {
        expect(screen.getByText(/Network error: Connection refused/)).toBeInTheDocument();
      });

      // Retry - should succeed
      const retryButton = screen.getByRole('button', { name: /\[PUBLISH\]/i });
      expect(retryButton).not.toBeDisabled();
      await user.click(retryButton);

      await waitFor(() => {
        expect(screen.getByText('JOB_PUBLISHED')).toBeInTheDocument();
      });
    });

    it('should show generic error for server errors', async () => {
      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(createMockJob({ status: 'draft' }));
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.post(`${API_URL}/api/jobs/job-123/publish`, () => {
          return HttpResponse.json(
            { error: { message: 'Internal server error' } },
            { status: 500 }
          );
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      const publishButton = screen.getByRole('button', { name: /\[PUBLISH\]/i });
      await user.click(publishButton);

      await waitFor(() => {
        expect(screen.getByText(/Internal server error/)).toBeInTheDocument();
      });
    });
  });

  describe('JOB_PUB_003: Success modal close button works', () => {
    it('should close success modal when CLOSE button is clicked', async () => {
      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(createMockJob({ status: 'draft' }));
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.post(`${API_URL}/api/jobs/job-123/publish`, () => {
          return HttpResponse.json({
            job_id: 'job-123',
            escrow_pda: 'escrow-pda-12345',
            transaction: 'tx-12345',
            amount_usdc: 350,
          });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /\[PUBLISH\]/i }));

      await waitFor(() => {
        expect(screen.getByText('JOB_PUBLISHED')).toBeInTheDocument();
      });

      // Click close button
      const closeButton = screen.getByRole('button', { name: /\[CLOSE\]/i });
      await user.click(closeButton);

      // Modal should be closed
      await waitFor(() => {
        expect(screen.queryByText('JOB_PUBLISHED')).not.toBeInTheDocument();
      });
    });

    it('should close success modal when clicking backdrop', async () => {
      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(createMockJob({ status: 'draft' }));
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.post(`${API_URL}/api/jobs/job-123/publish`, () => {
          return HttpResponse.json({
            job_id: 'job-123',
            escrow_pda: 'escrow-pda-12345',
            transaction: 'tx-12345',
            amount_usdc: 350,
          });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /\[PUBLISH\]/i }));

      await waitFor(() => {
        expect(screen.getByText('JOB_PUBLISHED')).toBeInTheDocument();
      });

      // Click backdrop (the bg-black/95 overlay)
      const backdrop = document.querySelector('.bg-black\\/95');
      expect(backdrop).toBeInTheDocument();
      fireEvent.click(backdrop!);

      await waitFor(() => {
        expect(screen.queryByText('JOB_PUBLISHED')).not.toBeInTheDocument();
      });
    });
  });

  // ==================== Bid Selection Flow ====================
  describe('BID_SEL_001: Select bid with EVM wallet shows lock modal', () => {
    it('should show lock escrow modal when selecting bid with EVM wallet', async () => {
      const mockJobWithBids = createMockJob({
        status: 'open',
        escrow: { amount_usdc: '500.00', status: 'funded' },
      });

      const mockBidWithEVMWallet = createMockBid({
        agent_wallet: '0xagent1234567890abcdef1234567890abcdef12',
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockJobWithBids);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [mockBidWithEVMWallet], total: 1 });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      // Wait for bids to load
      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument();
      });

      // Click SELECT button on bid - only one should exist at this point
      const bidSelectButton = screen.getByRole('button', { name: /\[SELECT\]/i });
      await user.click(bidSelectButton);

      // Should show confirmation modal first
      await waitFor(() => {
        expect(screen.getByText('SELECT_BID')).toBeInTheDocument();
      });

      // Wait a bit for state to settle, then find and click confirm button in the modal
      await waitFor(async () => {
        // Get all SELECT buttons - should be 2 now (one in bids, one in modal)
        const allSelectButtons = screen.getAllByRole('button', { name: /\[SELECT\]/i });
        expect(allSelectButtons.length).toBeGreaterThanOrEqual(2);
      });

      // Click the modal's confirm button (the second one with bg-white class for primary action)
      const allButtons = screen.getAllByRole('button', { name: /\[SELECT\]/i });
      // Find the button that's in the modal (has different styling - bg-white)
      const modalConfirmButton = allButtons.find(btn =>
        btn.className.includes('bg-white') && btn.className.includes('border-2')
      ) || allButtons[allButtons.length - 1];
      await user.click(modalConfirmButton);

      // Should show lock escrow modal
      await waitFor(() => {
        expect(screen.getByText('LOCK_ESCROW_TO_AGENT')).toBeInTheDocument();
      }, { timeout: 3000 });
    });
  });

  describe('BID_SEL_002: Non-EVM wallet goes directly to backend', () => {
    it('should call backend directly for non-EVM (Solana) wallet', async () => {
      const mockJobWithBids = createMockJob({
        status: 'open',
        escrow: { amount_usdc: '500.00', status: 'funded' },
      });

      const mockBidWithSolanaWallet = createMockBid({
        agent_wallet: 'So1ana1234567890abcdef1234567890abcdef12',
      });

      let selectBidCalled = false;

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockJobWithBids);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [mockBidWithSolanaWallet], total: 1 });
        }),
        http.post(`${API_URL}/api/jobs/job-123/select-bid`, () => {
          selectBidCalled = true;
          return HttpResponse.json({
            ...mockJobWithBids,
            status: 'assigned',
            agent_id: 'agent-1',
          });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument();
      });

      // Click SELECT on the bid (the small one in the bids list)
      const bidSelectButtons = screen.getAllByRole('button', { name: /\[SELECT\]/i });
      await user.click(bidSelectButtons[0]); // First SELECT button is in bids list

      // Confirm selection
      await waitFor(() => {
        expect(screen.getByText('SELECT_BID')).toBeInTheDocument();
      });

      // Find the modal and click confirm button (the one with [SELECT] text inside the modal)
      const modal = document.querySelector('.fixed.inset-0.z-50');
      const confirmButtons = modal?.querySelectorAll('button');
      const confirmButton = Array.from(confirmButtons || []).find(
        (btn) => btn.textContent?.includes('[SELECT]')
      ) as HTMLButtonElement;
      await user.click(confirmButton);

      // Should directly call backend without showing lock modal
      await waitFor(() => {
        expect(selectBidCalled).toBe(true);
      });

      // Should show success modal
      await waitFor(() => {
        expect(screen.getByText('BID_SELECTED')).toBeInTheDocument();
      });
    });

    it('should handle missing agent wallet by going directly to backend', async () => {
      const mockJobWithBids = createMockJob({
        status: 'open',
        escrow: { amount_usdc: '500.00', status: 'funded' },
      });

      const mockBidNoWallet = createMockBid({
        agent_wallet: null,
      });

      let selectBidCalled = false;

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockJobWithBids);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [mockBidNoWallet], total: 1 });
        }),
        http.post(`${API_URL}/api/jobs/job-123/select-bid`, () => {
          selectBidCalled = true;
          return HttpResponse.json({
            ...mockJobWithBids,
            status: 'assigned',
            agent_id: 'agent-1',
          });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument();
      });

      const bidSelectButtons = screen.getAllByRole('button', { name: /\[SELECT\]/i });
      await user.click(bidSelectButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('SELECT_BID')).toBeInTheDocument();
      });

      // Find confirm button in modal
      const modal = document.querySelector('.fixed.inset-0.z-50');
      const confirmButtons = modal?.querySelectorAll('button');
      const confirmButton = Array.from(confirmButtons || []).find(
        (btn) => btn.textContent?.includes('[SELECT]')
      ) as HTMLButtonElement;
      await user.click(confirmButton);

      await waitFor(() => {
        expect(selectBidCalled).toBe(true);
      });
    });
  });

  describe('BID_SEL_003: Cancel selection closes modal', () => {
    it('should close modal when clicking CANCEL', async () => {
      const mockJobWithBids = createMockJob({
        status: 'open',
        escrow: { amount_usdc: '500.00', status: 'funded' },
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockJobWithBids);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [createMockBid()], total: 1 });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument();
      });

      const bidSelectButtons = screen.getAllByRole('button', { name: /\[SELECT\]/i });
      await user.click(bidSelectButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('SELECT_BID')).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole('button', { name: /\[CANCEL\]/i });
      await user.click(cancelButton);

      await waitFor(() => {
        expect(screen.queryByText('SELECT_BID')).not.toBeInTheDocument();
      });
    });

    it('should close modal when clicking X button', async () => {
      const mockJobWithBids = createMockJob({
        status: 'open',
        escrow: { amount_usdc: '500.00', status: 'funded' },
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockJobWithBids);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [createMockBid()], total: 1 });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument();
      });

      const bidSelectButtons = screen.getAllByRole('button', { name: /\[SELECT\]/i });
      await user.click(bidSelectButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('SELECT_BID')).toBeInTheDocument();
      });

      // Click X button (the close button in top-right)
      const closeButtons = document.querySelectorAll('button');
      const xButton = Array.from(closeButtons).find((btn) =>
        btn.querySelector('svg.lucide-x')
      );
      expect(xButton).toBeDefined();
      fireEvent.click(xButton!);

      await waitFor(() => {
        expect(screen.queryByText('SELECT_BID')).not.toBeInTheDocument();
      });
    });
  });

  describe('BID_SEL_004: Lock transaction failure shows error', () => {
    it('should show error when lock transaction fails', async () => {
      // Set hook state to error
      mockLockHookState = {
        ...mockLockHookState,
        state: 'error' as const,
        error: 'User rejected transaction',
      };

      const mockJobWithBids = createMockJob({
        status: 'open',
        escrow: { amount_usdc: '500.00', status: 'funded' },
      });

      const mockBidWithEVMWallet = createMockBid({
        agent_wallet: '0xagent1234567890abcdef1234567890abcdef12',
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockJobWithBids);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [mockBidWithEVMWallet], total: 1 });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument();
      });

      const bidSelectButtons = screen.getAllByRole('button', { name: /\[SELECT\]/i });
      await user.click(bidSelectButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('SELECT_BID')).toBeInTheDocument();
      });

      // Find confirm button in modal
      const modal = document.querySelector('.fixed.inset-0.z-50');
      const confirmButtons = modal?.querySelectorAll('button');
      const confirmButton = Array.from(confirmButtons || []).find(
        (btn) => btn.textContent?.includes('[SELECT]')
      ) as HTMLButtonElement;
      await user.click(confirmButton);

      // Lock modal should show with error state
      await waitFor(() => {
        expect(screen.getByText('LOCK_ESCROW_TO_AGENT')).toBeInTheDocument();
      });

      // Error should be displayed
      expect(screen.getByText('TRANSACTION_FAILED')).toBeInTheDocument();
      expect(screen.getByText('User rejected transaction')).toBeInTheDocument();
    });
  });

  describe('BID_SEL_005: Excess refund displayed correctly', () => {
    it('should display excess refund when bid is less than escrow', async () => {
      // Set hook state to show refund info
      mockLockHookState = {
        ...mockLockHookState,
        state: 'success' as const,
        excessRefunded: 150,
      };

      const mockJobWithBids = createMockJob({
        status: 'open',
        escrow: { amount_usdc: '500.00', status: 'funded' },
      });

      const mockBidWithEVMWallet = createMockBid({
        agent_wallet: '0xagent1234567890abcdef1234567890abcdef12',
        bid_amount: '350.00',
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockJobWithBids);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [mockBidWithEVMWallet], total: 1 });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument();
      });

      const bidSelectButtons = screen.getAllByRole('button', { name: /\[SELECT\]/i });
      await user.click(bidSelectButtons[0]);

      await waitFor(() => {
        expect(screen.getByText('SELECT_BID')).toBeInTheDocument();
      });

      // Find confirm button in modal
      const modal = document.querySelector('.fixed.inset-0.z-50');
      const confirmButtons = modal?.querySelectorAll('button');
      const confirmButton = Array.from(confirmButtons || []).find(
        (btn) => btn.textContent?.includes('[SELECT]')
      ) as HTMLButtonElement;
      await user.click(confirmButton);

      await waitFor(() => {
        expect(screen.getByText('LOCK_ESCROW_TO_AGENT')).toBeInTheDocument();
      });

      // Verify refund display (500 - 350 = 150)
      expect(screen.getByText(/REFUND TO YOU/)).toBeInTheDocument();
      expect(screen.getByText(/\+150\.00 USDC/)).toBeInTheDocument();
    });
  });

  // ==================== Job Completion Flow ====================
  describe('JOB_COMP_001: Approve delivery releases payment', () => {
    it('should release payment when approving delivery', async () => {
      const mockDeliveredJob = createMockJob({
        status: 'delivered',
        agent_id: 'agent-1',
        escrow: { amount_usdc: '350.00', status: 'locked' },
      });

      let approveCalled = false;

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, ({ request }) => {
          if (approveCalled) {
            return HttpResponse.json({ ...mockDeliveredJob, status: 'completed' });
          }
          return HttpResponse.json(mockDeliveredJob);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/requirements`, () => {
          return HttpResponse.json({ requirements: [], total: 0, completed: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/deliverables`, () => {
          return HttpResponse.json({ deliverables: [], total: 0, pending_review: 0 });
        }),
        http.post(`${API_URL}/api/jobs/job-123/approve`, () => {
          approveCalled = true;
          return HttpResponse.json({
            completed: true,
            signature: 'sig-12345',
            agent_payout: 332.5,
            platform_fee: 17.5,
          });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      // Should show approve button for delivered status
      const approveButton = screen.getByRole('button', { name: /\[APPROVE & RELEASE PAYMENT\]/i });
      expect(approveButton).toBeInTheDocument();

      await user.click(approveButton);

      // Confirmation modal should appear
      await waitFor(() => {
        expect(screen.getByText('APPROVE_DELIVERY')).toBeInTheDocument();
      });

      // Click approve in modal
      const confirmButton = screen.getByRole('button', { name: /\[APPROVE\]/i });
      await user.click(confirmButton);

      // Should show success modal
      await waitFor(() => {
        expect(screen.getByText('JOB_COMPLETED')).toBeInTheDocument();
        expect(screen.getByText(/Payment of 332.5 USDC released to agent/)).toBeInTheDocument();
      });
    });
  });

  describe('JOB_COMP_002: Request revision with reason', () => {
    it('should allow requesting revision with a reason', async () => {
      const mockDeliveredJob = createMockJob({
        status: 'delivered',
        agent_id: 'agent-1',
      });

      let revisionCalled = false;
      let revisionReason = '';

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, ({ request }) => {
          if (revisionCalled) {
            return HttpResponse.json({ ...mockDeliveredJob, status: 'in_progress' });
          }
          return HttpResponse.json(mockDeliveredJob);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/requirements`, () => {
          return HttpResponse.json({ requirements: [], total: 0, completed: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/deliverables`, () => {
          return HttpResponse.json({ deliverables: [], total: 0, pending_review: 0 });
        }),
        http.post(`${API_URL}/api/jobs/job-123/revision`, async ({ request }) => {
          const body = await request.json() as { reason: string; details?: string };
          revisionCalled = true;
          revisionReason = body.reason;
          return HttpResponse.json({ ...mockDeliveredJob, status: 'in_progress' });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      // Click REQUEST REVISION button
      const revisionButton = screen.getByRole('button', { name: /\[REQUEST REVISION\]/i });
      await user.click(revisionButton);

      // Input modal should appear
      await waitFor(() => {
        expect(screen.getByText('REQUEST_REVISION')).toBeInTheDocument();
      });

      // Fill in reason
      const reasonInput = screen.getByPlaceholderText('What needs to be changed?');
      await user.type(reasonInput, 'Need responsive mobile design');

      // Submit
      const requestButton = screen.getByRole('button', { name: /\[REQUEST\]/i });
      await user.click(requestButton);

      await waitFor(() => {
        expect(revisionCalled).toBe(true);
        expect(revisionReason).toBe('Need responsive mobile design');
      });

      // Success modal
      await waitFor(() => {
        expect(screen.getByText('REVISION_REQUESTED')).toBeInTheDocument();
      });
    });
  });

  describe('JOB_COMP_003: File dispute with reason', () => {
    it('should allow filing dispute with reason', async () => {
      const mockDeliveredJob = createMockJob({
        status: 'delivered',
        agent_id: 'agent-1',
      });

      let disputeCalled = false;
      let disputeReason = '';

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, ({ request }) => {
          if (disputeCalled) {
            return HttpResponse.json({ ...mockDeliveredJob, status: 'disputed' });
          }
          return HttpResponse.json(mockDeliveredJob);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/requirements`, () => {
          return HttpResponse.json({ requirements: [], total: 0, completed: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/deliverables`, () => {
          return HttpResponse.json({ deliverables: [], total: 0, pending_review: 0 });
        }),
        http.post(`${API_URL}/api/jobs/job-123/dispute`, async ({ request }) => {
          const body = await request.json() as { reason: string; details?: string };
          disputeCalled = true;
          disputeReason = body.reason;
          return HttpResponse.json({
            disputed: true,
            message: 'Dispute filed successfully',
          });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      // Click DISPUTE button
      const disputeButton = screen.getByRole('button', { name: /\[DISPUTE\]/i });
      await user.click(disputeButton);

      // Input modal should appear
      await waitFor(() => {
        expect(screen.getByText('FILE_DISPUTE')).toBeInTheDocument();
      });

      // Fill in reason
      const reasonInput = screen.getByPlaceholderText('Reason for dispute');
      await user.type(reasonInput, 'Work does not match requirements');

      // Submit
      const fileDisputeButton = screen.getByRole('button', { name: /\[FILE DISPUTE\]/i });
      await user.click(fileDisputeButton);

      await waitFor(() => {
        expect(disputeCalled).toBe(true);
        expect(disputeReason).toBe('Work does not match requirements');
      });

      // Success modal
      await waitFor(() => {
        expect(screen.getByText('DISPUTE_FILED')).toBeInTheDocument();
      });
    });
  });

  describe('JOB_COMP_004-006: Empty reason validation', () => {
    it('should disable submit button when revision reason is empty', async () => {
      const mockDeliveredJob = createMockJob({
        status: 'delivered',
        agent_id: 'agent-1',
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockDeliveredJob);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/requirements`, () => {
          return HttpResponse.json({ requirements: [], total: 0, completed: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/deliverables`, () => {
          return HttpResponse.json({ deliverables: [], total: 0, pending_review: 0 });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      // Click REQUEST REVISION button
      await user.click(screen.getByRole('button', { name: /\[REQUEST REVISION\]/i }));

      await waitFor(() => {
        expect(screen.getByText('REQUEST_REVISION')).toBeInTheDocument();
      });

      // Submit button should be disabled with empty reason
      const requestButton = screen.getByRole('button', { name: /\[REQUEST\]/i });
      expect(requestButton).toBeDisabled();
    });

    it('should disable submit button when dispute reason is empty', async () => {
      const mockDeliveredJob = createMockJob({
        status: 'delivered',
        agent_id: 'agent-1',
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockDeliveredJob);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/requirements`, () => {
          return HttpResponse.json({ requirements: [], total: 0, completed: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/deliverables`, () => {
          return HttpResponse.json({ deliverables: [], total: 0, pending_review: 0 });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      // Click DISPUTE button
      await user.click(screen.getByRole('button', { name: /\[DISPUTE\]/i }));

      await waitFor(() => {
        expect(screen.getByText('FILE_DISPUTE')).toBeInTheDocument();
      });

      // Submit button should be disabled with empty reason
      const fileDisputeButton = screen.getByRole('button', { name: /\[FILE DISPUTE\]/i });
      expect(fileDisputeButton).toBeDisabled();
    });

    it('should enable submit button when reason is provided', async () => {
      const mockDeliveredJob = createMockJob({
        status: 'delivered',
        agent_id: 'agent-1',
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockDeliveredJob);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/requirements`, () => {
          return HttpResponse.json({ requirements: [], total: 0, completed: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/deliverables`, () => {
          return HttpResponse.json({ deliverables: [], total: 0, pending_review: 0 });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /\[REQUEST REVISION\]/i }));

      await waitFor(() => {
        expect(screen.getByText('REQUEST_REVISION')).toBeInTheDocument();
      });

      // Initially disabled
      const requestButton = screen.getByRole('button', { name: /\[REQUEST\]/i });
      expect(requestButton).toBeDisabled();

      // Type reason
      const reasonInput = screen.getByPlaceholderText('What needs to be changed?');
      await user.type(reasonInput, 'Need fixes');

      // Should be enabled now
      expect(requestButton).not.toBeDisabled();
    });

    it('should disable submit button when reason is only whitespace', async () => {
      const mockDeliveredJob = createMockJob({
        status: 'delivered',
        agent_id: 'agent-1',
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockDeliveredJob);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/requirements`, () => {
          return HttpResponse.json({ requirements: [], total: 0, completed: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/deliverables`, () => {
          return HttpResponse.json({ deliverables: [], total: 0, pending_review: 0 });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /\[DISPUTE\]/i }));

      await waitFor(() => {
        expect(screen.getByText('FILE_DISPUTE')).toBeInTheDocument();
      });

      // Type only whitespace
      const reasonInput = screen.getByPlaceholderText('Reason for dispute');
      await user.type(reasonInput, '   ');

      // Should still be disabled
      const fileDisputeButton = screen.getByRole('button', { name: /\[FILE DISPUTE\]/i });
      expect(fileDisputeButton).toBeDisabled();
    });
  });

  // ==================== Additional Edge Cases ====================
  describe('Edge Cases and Error Handling', () => {
    it('should show loading state while fetching job', async () => {
      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json(createMockJob());
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        })
      );

      render(<JobDetailPage />);

      // Should show loading
      expect(screen.getByText(/LOADING JOB/)).toBeInTheDocument();

      // Wait for content
      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });
    });

    it('should show error when job fetch fails', async () => {
      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(
            { error: { message: 'Job not found' } },
            { status: 404 }
          );
        })
      );

      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText(/Job not found/)).toBeInTheDocument();
      });

      // Back button should be available
      expect(screen.getByText(/\[BACK TO JOBS\]/)).toBeInTheDocument();
    });

    it('should require authentication for publish', async () => {
      // Clear auth
      useAuthStore.setState({
        token: null,
        user: null,
        userType: null,
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(createMockJob({ status: 'draft' }));
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        })
      );

      const user = userEvent.setup();
      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      const publishButton = screen.getByRole('button', { name: /\[PUBLISH\]/i });
      await user.click(publishButton);

      // Should show wallet connection error
      await waitFor(() => {
        expect(screen.getByText(/Please connect your wallet first/)).toBeInTheDocument();
      });
    });

    it('should show delete button for draft jobs', async () => {
      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(createMockJob({ status: 'draft' }));
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        })
      );

      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /\[DELETE\]/i })).toBeInTheDocument();
    });

    it('should show cancel job button for open jobs', async () => {
      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(createMockJob({ status: 'open' }));
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        })
      );

      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      expect(screen.getByRole('button', { name: /\[CANCEL JOB\]/i })).toBeInTheDocument();
    });

    it('should show work in progress for in_progress status', async () => {
      const mockInProgressJob = createMockJob({
        status: 'in_progress',
        agent_id: 'agent-1',
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockInProgressJob);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/requirements`, () => {
          return HttpResponse.json({ requirements: [], total: 0, completed: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/deliverables`, () => {
          return HttpResponse.json({ deliverables: [], total: 0, pending_review: 0 });
        })
      );

      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      expect(screen.getByText('WORK IN PROGRESS')).toBeInTheDocument();
    });

    it('should show completed state with convert to service option', async () => {
      const mockCompletedJob = createMockJob({
        status: 'completed',
        agent_id: 'agent-1',
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockCompletedJob);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/requirements`, () => {
          return HttpResponse.json({ requirements: [], total: 0, completed: 0 });
        }),
        http.get(`${API_URL}/api/jobs/job-123/deliverables`, () => {
          return HttpResponse.json({ deliverables: [], total: 0, pending_review: 0 });
        })
      );

      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      expect(screen.getByText('JOB COMPLETED')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /\[CONVERT TO MANAGED SERVICE\]/i })).toBeInTheDocument();
    });

    it('should display job budget and escrow information', async () => {
      const mockJobWithEscrow = createMockJob({
        status: 'open',
        escrow: { amount_usdc: '350.00', status: 'funded' },
      });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockJobWithEscrow);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [], total: 0 });
        })
      );

      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      // Check budget display
      expect(screen.getByText(/100 - 500 USDC/)).toBeInTheDocument();

      // Check escrow display
      expect(screen.getByText('350 USDC')).toBeInTheDocument();
      expect(screen.getByText('FUNDED')).toBeInTheDocument();
    });

    it('should display bids correctly', async () => {
      const mockJobWithBids = createMockJob({ status: 'open' });

      server.use(
        http.get(`${API_URL}/api/jobs/job-123`, () => {
          return HttpResponse.json(mockJobWithBids);
        }),
        http.get(`${API_URL}/api/jobs/job-123/bids`, () => {
          return HttpResponse.json({ bids: [createMockBid()], total: 1 });
        })
      );

      render(<JobDetailPage />);

      await waitFor(() => {
        expect(screen.getByText('Build a landing page')).toBeInTheDocument();
      });

      // Check bid is displayed
      await waitFor(() => {
        expect(screen.getByText('Test Agent')).toBeInTheDocument();
        expect(screen.getByText('350 USDC')).toBeInTheDocument();
        expect(screen.getByText(/I can build this landing page/)).toBeInTheDocument();
      });
    });
  });
});
