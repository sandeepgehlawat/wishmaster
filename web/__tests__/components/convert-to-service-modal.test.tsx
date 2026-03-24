import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import ConvertToServiceModal from '@/components/convert-to-service-modal';
import { server } from '../setup';
import { http, HttpResponse } from 'msw';
import type { JobWithDetails } from '@/lib/types';

// API URL
const API_URL = 'http://localhost:3001';

// Mock job data matching JobWithDetails type
const createMockJob = (overrides: Partial<JobWithDetails> = {}): JobWithDetails => ({
  id: 'job-123',
  client_id: 'user-1',
  agent_id: 'agent-1',
  title: 'Build a landing page',
  description: 'Create a responsive landing page with modern design',
  task_type: 'coding',
  required_skills: ['react', 'tailwind', 'typescript'],
  complexity: 'moderate',
  budget_min: 500,
  budget_max: 1000,
  final_price: 750,
  pricing_model: 'fixed',
  deadline: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
  urgency: 'standard',
  status: 'completed',
  created_at: new Date().toISOString(),
  client_name: 'Test User',
  agent_name: 'Test Agent',
  bid_count: 3,
  ...overrides,
});

describe('ConvertToServiceModal', () => {
  const defaultProps = {
    job: createMockJob(),
    token: 'test-token-123',
    onClose: vi.fn(),
    onSuccess: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('Modal Rendering', () => {
    it('renders modal with header and info box', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      expect(screen.getByText('CONVERT TO MANAGED SERVICE')).toBeInTheDocument();
      expect(screen.getByText('What is a Managed Service?')).toBeInTheDocument();
      expect(screen.getByText(/Turn this completed job into an ongoing service/)).toBeInTheDocument();
    });

    it('displays agent name from job', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      expect(screen.getByText('Test Agent')).toBeInTheDocument();
      expect(screen.getByText('Will manage your service')).toBeInTheDocument();
    });

    it('displays agent initial when name is not available', () => {
      const jobWithoutAgentName = createMockJob({ agent_name: undefined });
      render(<ConvertToServiceModal {...defaultProps} job={jobWithoutAgentName} />);

      // Should fall back to 'A'
      expect(screen.getByText('A')).toBeInTheDocument();
    });
  });

  describe('Pre-filled Defaults', () => {
    it('pre-fills service name based on job title', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const nameInput = screen.getByDisplayValue('Build a landing page - Ongoing Management');
      expect(nameInput).toBeInTheDocument();
    });

    it('pre-fills description based on job title', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const descriptionInput = screen.getByDisplayValue('Ongoing management and maintenance for Build a landing page');
      expect(descriptionInput).toBeInTheDocument();
    });

    it('pre-fills monthly rate as 20% of final_price', () => {
      const job = createMockJob({ final_price: 1000 });
      render(<ConvertToServiceModal {...defaultProps} job={job} />);

      // 20% of 1000 = 200
      const rateInput = screen.getByDisplayValue('200');
      expect(rateInput).toBeInTheDocument();
    });

    it('uses budget_min when final_price is null', () => {
      const job = createMockJob({ final_price: null, budget_min: 500 });
      render(<ConvertToServiceModal {...defaultProps} job={job} />);

      // 20% of 500 = 100
      const rateInput = screen.getByDisplayValue('100');
      expect(rateInput).toBeInTheDocument();
    });
  });

  describe('Empty Name Validation', () => {
    it('disables submit button when name is empty', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const nameInput = screen.getByDisplayValue('Build a landing page - Ongoing Management');
      fireEvent.change(nameInput, { target: { value: '' } });

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button when name is only whitespace', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const nameInput = screen.getByDisplayValue('Build a landing page - Ongoing Management');
      fireEvent.change(nameInput, { target: { value: '   ' } });

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button with valid name and rate', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Invalid Monthly Rate Validation', () => {
    it('disables submit button when rate is 0', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const rateInput = screen.getByRole('spinbutton');
      fireEvent.change(rateInput, { target: { value: '0' } });

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button when rate is negative', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const rateInput = screen.getByRole('spinbutton');
      fireEvent.change(rateInput, { target: { value: '-50' } });

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      expect(submitButton).toBeDisabled();
    });

    it('disables submit button when rate is empty (NaN)', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const rateInput = screen.getByRole('spinbutton');
      fireEvent.change(rateInput, { target: { value: '' } });

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      expect(submitButton).toBeDisabled();
    });

    it('allows positive rates', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const rateInput = screen.getByRole('spinbutton');
      fireEvent.change(rateInput, { target: { value: '100' } });

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('Custom Service Terms Submission', () => {
    it('submits with custom name and description', async () => {
      let capturedBody: any;
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/convert-to-service`, async ({ request }) => {
          capturedBody = await request.json();
          return HttpResponse.json({
            id: 'new-service-123',
            name: capturedBody.name,
            description: capturedBody.description,
            monthly_rate_usd: capturedBody.monthly_rate_usd,
            status: 'pending',
            client_id: 'user-1',
            agent_id: 'agent-1',
            created_at: new Date().toISOString(),
          });
        })
      );

      render(<ConvertToServiceModal {...defaultProps} />);

      // Change name
      const nameInput = screen.getByDisplayValue('Build a landing page - Ongoing Management');
      fireEvent.change(nameInput, { target: { value: 'Custom Service Name' } });

      // Change description
      const descriptionInput = screen.getByDisplayValue(/Ongoing management and maintenance/);
      fireEvent.change(descriptionInput, { target: { value: 'Custom description for service' } });

      // Change rate
      const rateInput = screen.getByRole('spinbutton');
      fireEvent.change(rateInput, { target: { value: '300' } });

      // Submit
      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(capturedBody).toMatchObject({
          name: 'Custom Service Name',
          description: 'Custom description for service',
          monthly_rate_usd: 300,
          agent_id: 'agent-1',
        });
      });
    });

    it('calls onSuccess with service ID on successful submission', async () => {
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/convert-to-service`, () => {
          return HttpResponse.json({
            id: 'created-service-456',
            name: 'Test Service',
            status: 'pending',
            created_at: new Date().toISOString(),
          });
        })
      );

      render(<ConvertToServiceModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalledWith('created-service-456');
      });
    });

    it('shows loading state during submission', async () => {
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/convert-to-service`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({
            id: 'new-service-123',
            status: 'pending',
          });
        })
      );

      render(<ConvertToServiceModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      fireEvent.click(submitButton);

      // Button should be disabled during submission
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });
    });
  });

  describe('Cancel Closes Modal', () => {
    it('calls onClose when cancel button is clicked', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const cancelButton = screen.getByRole('button', { name: /Cancel/i });
      fireEvent.click(cancelButton);

      expect(defaultProps.onClose).toHaveBeenCalled();
    });

    it('calls onClose when X button is clicked', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      // X button is in the header
      const closeButtons = screen.getAllByRole('button');
      const xButton = closeButtons.find(btn => btn.querySelector('svg'));

      if (xButton) {
        fireEvent.click(xButton);
        expect(defaultProps.onClose).toHaveBeenCalled();
      }
    });
  });

  describe('API Error Shows Error Message', () => {
    it('displays error message when API returns error', async () => {
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/convert-to-service`, () => {
          return HttpResponse.json(
            { error: { message: 'Service creation failed - agent not available' } },
            { status: 400 }
          );
        })
      );

      render(<ConvertToServiceModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Service creation failed - agent not available/)).toBeInTheDocument();
      });
    });

    it('displays error message when API returns 500', async () => {
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/convert-to-service`, () => {
          return HttpResponse.json(
            { error: { message: 'Internal server error' } },
            { status: 500 }
          );
        })
      );

      render(<ConvertToServiceModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Internal server error/)).toBeInTheDocument();
      });
    });

    it('displays fallback error message when no message in response', async () => {
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/convert-to-service`, () => {
          return HttpResponse.json({}, { status: 400 });
        })
      );

      render(<ConvertToServiceModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        // API fallback error is "API error", then component fallback is "Failed to create service"
        expect(screen.getByText(/API error|Failed to create service/)).toBeInTheDocument();
      });
    });

    it('allows retry after error by keeping form fields', async () => {
      let callCount = 0;
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/convert-to-service`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { error: { message: 'Temporary error' } },
              { status: 500 }
            );
          }
          return HttpResponse.json({
            id: 'new-service-123',
            status: 'pending',
          });
        })
      );

      render(<ConvertToServiceModal {...defaultProps} />);

      // First attempt fails
      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/Temporary error/)).toBeInTheDocument();
      });

      // Form fields should still have their values
      expect(screen.getByDisplayValue('Build a landing page - Ongoing Management')).toBeInTheDocument();

      // Retry
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onSuccess).toHaveBeenCalled();
      });
    });

    it('clears error on subsequent submission', async () => {
      let callCount = 0;
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/convert-to-service`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { error: { message: 'First error' } },
              { status: 500 }
            );
          }
          return HttpResponse.json({
            id: 'new-service-123',
            status: 'pending',
          });
        })
      );

      render(<ConvertToServiceModal {...defaultProps} />);

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText(/First error/)).toBeInTheDocument();
      });

      // Second click
      fireEvent.click(submitButton);

      await waitFor(() => {
        // Error should be cleared after successful submission
        expect(screen.queryByText(/First error/)).not.toBeInTheDocument();
      });
    });
  });

  describe('Does Not Submit Without Agent ID', () => {
    it('does not submit when agent_id is null', async () => {
      const apiMock = vi.fn();
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/convert-to-service`, () => {
          apiMock();
          return HttpResponse.json({ id: 'new-service' });
        })
      );

      const jobWithoutAgent = createMockJob({ agent_id: null });
      render(<ConvertToServiceModal {...defaultProps} job={jobWithoutAgent} />);

      const submitButton = screen.getByRole('button', { name: /Create Service Offer/i });
      fireEvent.click(submitButton);

      // Wait a bit to ensure API is not called
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(apiMock).not.toHaveBeenCalled();
    });
  });

  describe('Warning Display', () => {
    it('displays agent acceptance warning', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      expect(screen.getByText(/The agent must accept this offer before the service starts/)).toBeInTheDocument();
      expect(screen.getByText(/First month will be billed when they accept/)).toBeInTheDocument();
    });
  });

  describe('Form Interaction', () => {
    it('updates name field on change', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const nameInput = screen.getByDisplayValue('Build a landing page - Ongoing Management');
      fireEvent.change(nameInput, { target: { value: 'New Service Name' } });

      expect(screen.getByDisplayValue('New Service Name')).toBeInTheDocument();
    });

    it('updates description field on change', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const descriptionInput = screen.getByDisplayValue(/Ongoing management and maintenance/);
      fireEvent.change(descriptionInput, { target: { value: 'New description' } });

      expect(screen.getByDisplayValue('New description')).toBeInTheDocument();
    });

    it('updates monthly rate on change', () => {
      render(<ConvertToServiceModal {...defaultProps} />);

      const rateInput = screen.getByRole('spinbutton');
      fireEvent.change(rateInput, { target: { value: '500' } });

      expect(screen.getByDisplayValue('500')).toBeInTheDocument();
    });
  });
});
