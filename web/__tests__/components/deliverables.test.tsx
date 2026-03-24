import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import Deliverables from '@/components/deliverables';
import { server } from '../setup';
import { http, HttpResponse } from 'msw';
import type { Deliverable, Requirement } from '@/lib/types';

const API_URL = 'http://localhost:3001';

// Mock deliverables
const mockDeliverables: Deliverable[] = [
  {
    id: 'del-1',
    job_id: 'job-1',
    requirement_id: 'req-1',
    agent_id: 'agent-1',
    title: 'Landing page design',
    description: 'Initial design for the landing page',
    file_url: 'https://example.com/files/design-v1.zip',
    file_name: 'design-v1.zip',
    file_size: 1024000,
    mime_type: 'application/zip',
    status: 'pending_review',
    version: 1,
    created_at: '2024-01-15T10:00:00Z',
    requirement_title: 'Design Requirements',
    agent_name: 'Test Agent',
  },
  {
    id: 'del-2',
    job_id: 'job-1',
    agent_id: 'agent-1',
    title: 'Backend API',
    description: 'RESTful API implementation',
    status: 'approved',
    version: 2,
    created_at: '2024-01-14T10:00:00Z',
    agent_name: 'Test Agent',
  },
  {
    id: 'del-3',
    job_id: 'job-1',
    agent_id: 'agent-1',
    title: 'Frontend components',
    description: 'React component library',
    status: 'changes_requested',
    client_feedback: 'Please add more accessibility features',
    version: 1,
    created_at: '2024-01-13T10:00:00Z',
    agent_name: 'Test Agent',
  },
];

const mockRequirements: Requirement[] = [
  {
    id: 'req-1',
    job_id: 'job-1',
    created_by: 'user-1',
    title: 'Design Requirements',
    description: 'Create responsive designs',
    priority: 'must_have',
    status: 'pending',
    position: 1,
    created_at: '2024-01-10T10:00:00Z',
    updated_at: '2024-01-10T10:00:00Z',
  },
];

describe('Deliverables Component', () => {
  const defaultProps = {
    jobId: 'job-1',
    deliverables: mockDeliverables,
    requirements: mockRequirements,
    token: 'test-token',
    userType: 'client' as const,
    onUpdate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    server.resetHandlers();
  });

  describe('Deliverable List Rendering', () => {
    it('renders the deliverables header', () => {
      render(<Deliverables {...defaultProps} />);

      expect(screen.getByText('DELIVERABLES')).toBeInTheDocument();
      expect(screen.getByText('3 items')).toBeInTheDocument();
    });

    it('renders all deliverables', () => {
      render(<Deliverables {...defaultProps} />);

      expect(screen.getByText('Landing page design')).toBeInTheDocument();
      expect(screen.getByText('Backend API')).toBeInTheDocument();
      expect(screen.getByText('Frontend components')).toBeInTheDocument();
    });

    it('shows pending count badge when there are pending deliverables', () => {
      render(<Deliverables {...defaultProps} />);

      expect(screen.getByText('1 PENDING')).toBeInTheDocument();
    });

    it('displays deliverable descriptions', () => {
      render(<Deliverables {...defaultProps} />);

      expect(screen.getByText('Initial design for the landing page')).toBeInTheDocument();
      expect(screen.getByText('RESTful API implementation')).toBeInTheDocument();
    });

    it('shows empty state when no deliverables', () => {
      render(<Deliverables {...defaultProps} deliverables={[]} />);

      expect(screen.getByText('No deliverables submitted yet.')).toBeInTheDocument();
    });

    it('displays agent name and date', () => {
      render(<Deliverables {...defaultProps} />);

      // Check for agent name
      const agentNames = screen.getAllByText(/by Test Agent/);
      expect(agentNames.length).toBeGreaterThan(0);
    });
  });

  describe('Status Indicators', () => {
    it('shows pending review status correctly', () => {
      render(<Deliverables {...defaultProps} />);

      expect(screen.getByText('Pending Review')).toBeInTheDocument();
    });

    it('shows approved status correctly', () => {
      render(<Deliverables {...defaultProps} />);

      expect(screen.getByText('Approved')).toBeInTheDocument();
    });

    it('shows changes requested status correctly', () => {
      render(<Deliverables {...defaultProps} />);

      expect(screen.getByText('Changes Requested')).toBeInTheDocument();
    });

    it('applies correct color classes for pending review', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      const statusLabel = screen.getByText('Pending Review');
      expect(statusLabel).toHaveClass('text-yellow-400');
    });

    it('applies correct color classes for approved', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[1]]} />);

      const statusLabel = screen.getByText('Approved');
      expect(statusLabel).toHaveClass('text-secondary-400');
    });

    it('applies correct color classes for changes requested', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[2]]} />);

      const statusLabel = screen.getByText('Changes Requested');
      expect(statusLabel).toHaveClass('text-red-400');
    });
  });

  describe('Version Display', () => {
    it('shows version number for version > 1', () => {
      render(<Deliverables {...defaultProps} />);

      expect(screen.getByText('v2')).toBeInTheDocument();
    });

    it('does not show version number for version 1', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      expect(screen.queryByText('v1')).not.toBeInTheDocument();
    });
  });

  describe('File Download Link', () => {
    it('shows download link when file_url is present', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      const downloadLink = screen.getByRole('link', { name: /design-v1.zip/i });
      expect(downloadLink).toBeInTheDocument();
      expect(downloadLink).toHaveAttribute('href', 'https://example.com/files/design-v1.zip');
      expect(downloadLink).toHaveAttribute('target', '_blank');
    });

    it('shows file size when available', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      expect(screen.getByText('(1000.0 KB)')).toBeInTheDocument();
    });

    it('does not show download link when no file_url', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[1]]} />);

      expect(screen.queryByRole('link', { name: /Download/i })).not.toBeInTheDocument();
    });

    it('shows "Download" as fallback when no file_name', () => {
      const deliverableNoFileName: Deliverable = {
        ...mockDeliverables[0],
        file_name: undefined,
      };
      render(<Deliverables {...defaultProps} deliverables={[deliverableNoFileName]} />);

      expect(screen.getByText('Download')).toBeInTheDocument();
    });
  });

  describe('Approve Button Click', () => {
    it('shows approve button for client on pending deliverables', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      expect(screen.getByRole('button', { name: 'Approve' })).toBeInTheDocument();
    });

    it('does not show approve button for agent', () => {
      render(<Deliverables {...defaultProps} userType="agent" deliverables={[mockDeliverables[0]]} />);

      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    });

    it('calls API and onUpdate when approve is clicked', async () => {
      server.use(
        http.post(`${API_URL}/api/deliverables/:id/approve`, () => {
          return HttpResponse.json({
            ...mockDeliverables[0],
            status: 'approved',
            reviewed_at: new Date().toISOString(),
          });
        })
      );

      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      const approveButton = screen.getByRole('button', { name: 'Approve' });
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(defaultProps.onUpdate).toHaveBeenCalled();
      });
    });

    it('shows loading state during approve', async () => {
      let resolveApprove: () => void;
      const approvePromise = new Promise<void>((resolve) => {
        resolveApprove = resolve;
      });

      server.use(
        http.post(`${API_URL}/api/deliverables/:id/approve`, async () => {
          await approvePromise;
          return HttpResponse.json({
            ...mockDeliverables[0],
            status: 'approved',
          });
        })
      );

      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      const approveButton = screen.getByRole('button', { name: 'Approve' });
      fireEvent.click(approveButton);

      // Button should be hidden and loader shown
      await waitFor(() => {
        expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
      });

      resolveApprove!();
    });

    it('does not show approve button for already approved deliverables', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[1]]} />);

      expect(screen.queryByRole('button', { name: 'Approve' })).not.toBeInTheDocument();
    });
  });

  describe('Request Changes with Feedback Form', () => {
    it('shows changes button for client on pending deliverables', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      expect(screen.getByRole('button', { name: 'Changes' })).toBeInTheDocument();
    });

    it('opens feedback form when changes button is clicked', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      const changesButton = screen.getByRole('button', { name: 'Changes' });
      fireEvent.click(changesButton);

      expect(screen.getByPlaceholderText('What changes are needed?')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Request Changes/i })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
    });

    it('submits feedback and calls onUpdate', async () => {
      server.use(
        http.post(`${API_URL}/api/deliverables/:id/request-changes`, async ({ request }) => {
          const body = await request.json() as { feedback: string };
          return HttpResponse.json({
            ...mockDeliverables[0],
            status: 'changes_requested',
            client_feedback: body.feedback,
          });
        })
      );

      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      // Open feedback form
      const changesButton = screen.getByRole('button', { name: 'Changes' });
      fireEvent.click(changesButton);

      // Enter feedback
      const textarea = screen.getByPlaceholderText('What changes are needed?');
      fireEvent.change(textarea, { target: { value: 'Please add responsive styles' } });

      // Submit
      const submitButton = screen.getByRole('button', { name: /Request Changes/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(defaultProps.onUpdate).toHaveBeenCalled();
      });
    });

    it('disables submit button when feedback is empty', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      const changesButton = screen.getByRole('button', { name: 'Changes' });
      fireEvent.click(changesButton);

      const submitButton = screen.getByRole('button', { name: /Request Changes/i });
      expect(submitButton).toBeDisabled();
    });

    it('enables submit button when feedback is entered', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      const changesButton = screen.getByRole('button', { name: 'Changes' });
      fireEvent.click(changesButton);

      const textarea = screen.getByPlaceholderText('What changes are needed?');
      fireEvent.change(textarea, { target: { value: 'Some feedback' } });

      const submitButton = screen.getByRole('button', { name: /Request Changes/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('closes feedback form when cancel is clicked', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      const changesButton = screen.getByRole('button', { name: 'Changes' });
      fireEvent.click(changesButton);

      expect(screen.getByPlaceholderText('What changes are needed?')).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(screen.queryByPlaceholderText('What changes are needed?')).not.toBeInTheDocument();
    });

    it('shows existing client feedback for changes_requested deliverables', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[2]]} />);

      expect(screen.getByText('Please add more accessibility features')).toBeInTheDocument();
    });
  });

  describe('Linked Requirement Display', () => {
    it('shows linked requirement title', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      expect(screen.getByText(/→ Design Requirements/)).toBeInTheDocument();
    });

    it('does not show requirement link when not linked', () => {
      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[1]]} />);

      expect(screen.queryByText(/→/)).not.toBeInTheDocument();
    });
  });

  describe('Agent View', () => {
    it('shows submit deliverable button for agents', () => {
      render(<Deliverables {...defaultProps} userType="agent" />);

      expect(screen.getByRole('button', { name: /Submit Deliverable/i })).toBeInTheDocument();
    });

    it('does not show submit button for clients', () => {
      render(<Deliverables {...defaultProps} userType="client" />);

      expect(screen.queryByRole('button', { name: /Submit Deliverable/i })).not.toBeInTheDocument();
    });

    it('opens add deliverable form when submit button is clicked', () => {
      render(<Deliverables {...defaultProps} userType="agent" />);

      const submitButton = screen.getByRole('button', { name: /Submit Deliverable/i });
      fireEvent.click(submitButton);

      expect(screen.getByPlaceholderText('Deliverable title...')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Description...')).toBeInTheDocument();
    });

    it('shows requirement dropdown in add form when requirements exist', () => {
      render(<Deliverables {...defaultProps} userType="agent" />);

      const submitButton = screen.getByRole('button', { name: /Submit Deliverable/i });
      fireEvent.click(submitButton);

      expect(screen.getByText('Link to requirement (optional)')).toBeInTheDocument();
    });

    it('submits new deliverable', async () => {
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/deliverables`, async ({ request }) => {
          const body = await request.json() as { title: string };
          return HttpResponse.json({
            id: 'new-del',
            job_id: 'job-1',
            agent_id: 'agent-1',
            title: body.title,
            status: 'pending_review',
            version: 1,
            created_at: new Date().toISOString(),
            agent_name: 'Test Agent',
          });
        })
      );

      render(<Deliverables {...defaultProps} userType="agent" />);

      // Open form
      const submitButton = screen.getByRole('button', { name: /Submit Deliverable/i });
      fireEvent.click(submitButton);

      // Fill form
      const titleInput = screen.getByPlaceholderText('Deliverable title...');
      fireEvent.change(titleInput, { target: { value: 'New deliverable' } });

      // Submit
      const submitFormButton = screen.getByRole('button', { name: 'Submit' });
      fireEvent.click(submitFormButton);

      await waitFor(() => {
        expect(defaultProps.onUpdate).toHaveBeenCalled();
      });
    });

    it('disables submit when title is empty', () => {
      render(<Deliverables {...defaultProps} userType="agent" />);

      const addButton = screen.getByRole('button', { name: /Submit Deliverable/i });
      fireEvent.click(addButton);

      const submitFormButton = screen.getByRole('button', { name: 'Submit' });
      expect(submitFormButton).toBeDisabled();
    });

    it('closes form when cancel is clicked', () => {
      render(<Deliverables {...defaultProps} userType="agent" />);

      const addButton = screen.getByRole('button', { name: /Submit Deliverable/i });
      fireEvent.click(addButton);

      expect(screen.getByPlaceholderText('Deliverable title...')).toBeInTheDocument();

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      fireEvent.click(cancelButton);

      expect(screen.queryByPlaceholderText('Deliverable title...')).not.toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('logs error when approve fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.post(`${API_URL}/api/deliverables/:id/approve`, () => {
          return HttpResponse.json(
            { error: { message: 'Approval failed' } },
            { status: 500 }
          );
        })
      );

      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      const approveButton = screen.getByRole('button', { name: 'Approve' });
      fireEvent.click(approveButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to approve:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });

    it('logs error when request changes fails', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      server.use(
        http.post(`${API_URL}/api/deliverables/:id/request-changes`, () => {
          return HttpResponse.json(
            { error: { message: 'Request failed' } },
            { status: 500 }
          );
        })
      );

      render(<Deliverables {...defaultProps} deliverables={[mockDeliverables[0]]} />);

      const changesButton = screen.getByRole('button', { name: 'Changes' });
      fireEvent.click(changesButton);

      const textarea = screen.getByPlaceholderText('What changes are needed?');
      fireEvent.change(textarea, { target: { value: 'Feedback' } });

      const submitButton = screen.getByRole('button', { name: /Request Changes/i });
      fireEvent.click(submitButton);

      await waitFor(() => {
        expect(consoleSpy).toHaveBeenCalledWith('Failed to request changes:', expect.any(Error));
      });

      consoleSpy.mockRestore();
    });
  });
});
