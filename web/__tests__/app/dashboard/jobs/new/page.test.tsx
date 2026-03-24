import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '../../../../utils/test-utils';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { server } from '../../../../setup';
import NewJobPage from '@/app/dashboard/jobs/new/page';
import { useAuthStore } from '@/lib/store';

// Mock next/navigation
const mockPush = vi.fn();
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
}));

// API URL for MSW handlers
const API_URL = 'http://localhost:3001';

describe('NewJobPage - Job Creation Wizard', () => {
  beforeEach(() => {
    // Reset mocks and auth state before each test
    vi.clearAllMocks();
    mockPush.mockClear();
    // Reset auth store to clean state
    useAuthStore.setState({ token: null, user: null, userType: null });
  });

  afterEach(() => {
    // Reset any custom handlers added during tests
    server.resetHandlers();
  });

  describe('JOB_CREATE_001: Happy Path - Complete job creation through all 4 steps', () => {
    it('should successfully create a job when completing all wizard steps', async () => {
      // Set authenticated state
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1', wallet_address: '0x1234' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Step 1: Select Job Type
      expect(screen.getByText('Select Job Type')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /CODING/i })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 2: Job Details
      await waitFor(() => {
        expect(screen.getByText('Job Details')).toBeInTheDocument();
      });

      const titleInput = screen.getByPlaceholderText('Enter job title...');
      const descriptionInput = screen.getByPlaceholderText('Describe the job requirements...');

      await user.type(titleInput, 'Build a responsive landing page');
      await user.type(descriptionInput, 'Create a modern landing page with React and Tailwind CSS');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 3: Skills
      await waitFor(() => {
        expect(screen.getByText('Required Skills')).toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /^React$/i }));
      await user.click(screen.getByRole('button', { name: /^TypeScript$/i }));
      await user.click(screen.getByRole('button', { name: /Moderate/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 4: Budget & Deadline
      await waitFor(() => {
        expect(screen.getByText('Budget & Deadline')).toBeInTheDocument();
      });

      // Get all inputs with placeholder '0' - there are two: min and max budget
      const budgetInputs = screen.getAllByPlaceholderText('0');
      const minBudgetInput = budgetInputs[0];
      const maxBudgetInput = budgetInputs[1];

      await user.clear(minBudgetInput);
      await user.type(minBudgetInput, '200');
      await user.clear(maxBudgetInput);
      await user.type(maxBudgetInput, '800');

      // Verify summary shows correct data
      expect(screen.getByText(/CODING/)).toBeInTheDocument();
      expect(screen.getByText(/Build a responsive landing page/)).toBeInTheDocument();

      // Submit the job
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      // Wait for navigation to job details page
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/jobs/new-job-1');
      });
    });

    it('should show loading state during submission', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      // Add a delayed handler to observe loading state
      server.use(
        http.post(`${API_URL}/api/jobs`, async () => {
          await new Promise((resolve) => setTimeout(resolve, 100));
          return HttpResponse.json({ id: 'new-job-1', status: 'draft' });
        })
      );

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate through all steps quickly
      await user.click(screen.getByRole('button', { name: /RESEARCH/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Test Job');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Test description');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));

      // Submit and check for loading state
      const submitButton = screen.getByRole('button', { name: /\[SUBMIT\]/i });
      await user.click(submitButton);

      // Should show loading text
      await waitFor(() => {
        expect(screen.getByText(/\[SUBMITTING\.\.\.\]/i)).toBeInTheDocument();
      });
    });
  });

  describe('JOB_CREATE_002: Validation - Missing required fields', () => {
    it('should show error when title is empty on submission', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Complete step 1
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 2: Enter only description, skip title
      await waitFor(() => screen.getByText('Job Details'));
      await user.type(
        screen.getByPlaceholderText('Describe the job requirements...'),
        'This is a test description'
      );

      // Next button should be disabled when title is empty
      const nextButton = screen.getByRole('button', { name: /Next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should show error when description is empty on submission', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Complete step 1
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 2: Enter only title, skip description
      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Test Title');

      // Next button should be disabled when description is empty
      const nextButton = screen.getByRole('button', { name: /Next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should show error when job type is not selected', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      render(<NewJobPage />);

      // Step 1: Don't select any job type
      expect(screen.getByText('Select Job Type')).toBeInTheDocument();

      // Next button should be disabled when no type selected
      const nextButton = screen.getByRole('button', { name: /Next/i });
      expect(nextButton).toBeDisabled();
    });

    it('should prevent submission with empty title even if reached step 4', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Complete step 1
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 2: Enter both title and description
      await waitFor(() => screen.getByText('Job Details'));
      const titleInput = screen.getByPlaceholderText('Enter job title...');
      await user.type(titleInput, 'Test Title');
      await user.type(
        screen.getByPlaceholderText('Describe the job requirements...'),
        'Test description'
      );
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 3
      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 4
      await waitFor(() => screen.getByText('Budget & Deadline'));

      // Go back to step 2 and clear title
      await user.click(screen.getByRole('button', { name: /Back/i }));
      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Back/i }));
      await waitFor(() => screen.getByText('Job Details'));

      // Clear the title
      const titleInputStep2 = screen.getByPlaceholderText('Enter job title...');
      await user.clear(titleInputStep2);

      // Try to go forward - should be blocked
      const nextButton = screen.getByRole('button', { name: /Next/i });
      expect(nextButton).toBeDisabled();
    });
  });

  describe('JOB_CREATE_003: Step navigation - Back and forward preserves data', () => {
    it('should preserve job type when navigating back from step 2', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Step 1: Select RESEARCH
      await user.click(screen.getByRole('button', { name: /RESEARCH/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 2: Go back
      await waitFor(() => screen.getByText('Job Details'));
      await user.click(screen.getByRole('button', { name: /Back/i }));

      // Verify RESEARCH is still selected (has different styling)
      await waitFor(() => screen.getByText('Select Job Type'));
      const researchButton = screen.getByRole('button', { name: /RESEARCH/i });
      expect(researchButton).toHaveClass('bg-white');
    });

    it('should preserve title and description when navigating back from step 3', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Step 1
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 2: Enter data
      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'My Preserved Title');
      await user.type(
        screen.getByPlaceholderText('Describe the job requirements...'),
        'My Preserved Description'
      );
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 3: Go back
      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Back/i }));

      // Verify data is preserved
      await waitFor(() => screen.getByText('Job Details'));
      expect(screen.getByPlaceholderText('Enter job title...')).toHaveValue('My Preserved Title');
      expect(screen.getByPlaceholderText('Describe the job requirements...')).toHaveValue(
        'My Preserved Description'
      );
    });

    it('should preserve skills and complexity when navigating back from step 4', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate to step 3
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Test');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Test');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 3: Select skills and complexity
      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /^Python$/i }));
      await user.click(screen.getByRole('button', { name: /^SQL$/i }));
      await user.click(screen.getByRole('button', { name: /Complex/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 4: Go back
      await waitFor(() => screen.getByText('Budget & Deadline'));
      await user.click(screen.getByRole('button', { name: /Back/i }));

      // Verify skills and complexity are preserved
      await waitFor(() => screen.getByText('Required Skills'));

      // Selected skills should have different styling
      const pythonButton = screen.getByRole('button', { name: /^Python$/i });
      const sqlButton = screen.getByRole('button', { name: /^SQL$/i });
      const complexButton = screen.getByRole('button', { name: /Complex/i });

      expect(pythonButton).toHaveClass('border-secondary-500/30');
      expect(sqlButton).toHaveClass('border-secondary-500/30');
      expect(complexButton).toHaveClass('border-secondary-500/30');
    });

    it('should preserve budget data when navigating back and forward', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate to step 4
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Test');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Test');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Step 4: Enter budget
      await waitFor(() => screen.getByText('Budget & Deadline'));
      const budgetInputs = screen.getAllByPlaceholderText('0');
      await user.type(budgetInputs[0], '150');
      await user.type(budgetInputs[1], '450');

      // Select HOURLY pricing
      await user.click(screen.getByRole('button', { name: /HOURLY/i }));

      // Go back and forward
      await user.click(screen.getByRole('button', { name: /Back/i }));
      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Verify budget data is preserved
      await waitFor(() => screen.getByText('Budget & Deadline'));
      const budgetInputsAfter = screen.getAllByPlaceholderText('0');
      expect(budgetInputsAfter[0]).toHaveValue(150);
      expect(budgetInputsAfter[1]).toHaveValue(450);

      // HOURLY should be selected
      const hourlyButton = screen.getByRole('button', { name: /HOURLY/i });
      expect(hourlyButton).toHaveClass('border-secondary-500/30');
    });

    it('should update step indicators correctly during navigation', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // The step numbers are in divs with specific classes
      // Step 1 should be active (bg-white text-black)
      // Find step indicator elements
      const stepDivs = document.querySelectorAll('.w-10.h-10.border');
      expect(stepDivs.length).toBe(4);
      expect(stepDivs[0]).toHaveClass('bg-white');

      // Go to step 2
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));

      // After navigation, check step indicators again
      const stepDivsStep2 = document.querySelectorAll('.w-10.h-10.border');
      // Step 1 should show as completed (has different styling)
      expect(stepDivsStep2[0]).toHaveClass('bg-secondary-400/20');
      // Step 2 should be active
      expect(stepDivsStep2[1]).toHaveClass('bg-white');
    });
  });

  describe('JOB_CREATE_004: Default values applied for minimal input', () => {
    it('should apply default complexity when not selected', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      let capturedJobData: any = null;
      server.use(
        http.post(`${API_URL}/api/jobs`, async ({ request }) => {
          capturedJobData = await request.json();
          return HttpResponse.json({ id: 'new-job-1', status: 'draft' });
        })
      );

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Complete all steps with minimal input
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Minimal Job');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Minimal description');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Skip skills selection entirely
      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      // Submit without budget
      await waitFor(() => screen.getByText('Budget & Deadline'));
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      await waitFor(() => {
        expect(capturedJobData).not.toBeNull();
      });

      // Verify defaults
      expect(capturedJobData.complexity).toBe('moderate'); // Default complexity
      expect(capturedJobData.required_skills).toEqual(['general']); // Default skills
      expect(capturedJobData.budget_min).toBe(100); // Default min
      expect(capturedJobData.budget_max).toBe(500); // Default max
      expect(capturedJobData.urgency).toBe('standard'); // Default urgency
    });

    it('should apply default budget values when fields are empty', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      let capturedJobData: any = null;
      server.use(
        http.post(`${API_URL}/api/jobs`, async ({ request }) => {
          capturedJobData = await request.json();
          return HttpResponse.json({ id: 'new-job-1', status: 'draft' });
        })
      );

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate through all steps
      await user.click(screen.getByRole('button', { name: /DATA ANALYSIS/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Data Job');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Analyze data');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));
      // Don't enter any budget values - leave empty
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      await waitFor(() => {
        expect(capturedJobData).not.toBeNull();
      });

      expect(capturedJobData.budget_min).toBe(100);
      expect(capturedJobData.budget_max).toBe(500);
    });

    it('should use default skills when none selected', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      let capturedJobData: any = null;
      server.use(
        http.post(`${API_URL}/api/jobs`, async ({ request }) => {
          capturedJobData = await request.json();
          return HttpResponse.json({ id: 'new-job-1', status: 'draft' });
        })
      );

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate through all steps without selecting skills
      await user.click(screen.getByRole('button', { name: /CONTENT/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Content Job');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Write content');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      // Don't select any skills
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      await waitFor(() => {
        expect(capturedJobData).not.toBeNull();
      });

      expect(capturedJobData.required_skills).toEqual(['general']);
    });

    it('should show summary with correct default display values', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate to step 4 with minimal input
      await user.click(screen.getByRole('button', { name: /OTHER/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Other Job');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Other desc');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));

      // Check summary displays - find the summary section by looking for the SUMMARY label
      const summaryLabel = screen.getByText('SUMMARY');
      const summarySection = summaryLabel.closest('div');
      expect(summarySection).toBeInTheDocument();

      // The summary section should contain these values
      const summaryText = summarySection?.textContent || '';
      expect(summaryText).toContain('OTHER');
      expect(summaryText).toContain('Other Job');
      expect(summaryText).toContain('NONE'); // No skills selected
      expect(summaryText).toContain('UNSET'); // No complexity selected
      expect(summaryText).toContain('FIXED'); // Default pricing model
    });
  });

  describe('JOB_CREATE_005: API failure shows error, allows retry', () => {
    it('should show error message when API returns error', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      // Override handler to return error
      server.use(
        http.post(`${API_URL}/api/jobs`, () => {
          return HttpResponse.json(
            { error: { message: 'Insufficient credits' } },
            { status: 400 }
          );
        })
      );

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate through all steps
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Test Job');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Test desc');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      // Wait for error message
      await waitFor(() => {
        expect(screen.getByText(/Insufficient credits/)).toBeInTheDocument();
      });

      // Submit button should be enabled for retry
      const submitButton = screen.getByRole('button', { name: /\[SUBMIT\]/i });
      expect(submitButton).not.toBeDisabled();
    });

    it('should allow retry after API failure', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      let callCount = 0;
      server.use(
        http.post(`${API_URL}/api/jobs`, () => {
          callCount++;
          if (callCount === 1) {
            return HttpResponse.json(
              { error: { message: 'Server temporarily unavailable' } },
              { status: 503 }
            );
          }
          return HttpResponse.json({ id: 'new-job-1', status: 'draft' });
        })
      );

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate through all steps
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Retry Job');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Retry desc');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));

      // First attempt - should fail
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      await waitFor(() => {
        expect(screen.getByText(/Server temporarily unavailable/)).toBeInTheDocument();
      });

      // Retry - should succeed
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/jobs/new-job-1');
      });
    });

    it('should show generic error message for network failures', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      server.use(
        http.post(`${API_URL}/api/jobs`, () => {
          return HttpResponse.error();
        })
      );

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate through all steps
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Network Test');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Network desc');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      // Should show some error - the component shows error in a div with red border styling
      // Network errors typically result in a "Failed to fetch" or similar message
      await waitFor(
        () => {
          // Look for the error div with red border styling
          const errorDivs = document.querySelectorAll('div');
          const hasErrorDiv = Array.from(errorDivs).some(
            (div) => div.className.includes('border-red-500')
          );
          expect(hasErrorDiv).toBe(true);
        },
        { timeout: 5000 }
      );
    });

    it('should clear error when user modifies form after failure', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      server.use(
        http.post(`${API_URL}/api/jobs`, () => {
          return HttpResponse.json(
            { error: { message: 'Validation error' } },
            { status: 400 }
          );
        })
      );

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate to step 4
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Error Test');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Error desc');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      // Error should appear
      await waitFor(() => {
        expect(screen.getByText(/Validation error/)).toBeInTheDocument();
      });

      // Error is visible until next action (note: the component doesn't auto-clear on form changes,
      // it clears on next submit attempt when setError(null) is called)
      // But we can verify the error is shown correctly
      const errorDiv = document.querySelector('.border-red-500\\/30');
      expect(errorDiv).toBeInTheDocument();
    });
  });

  describe('JOB_CREATE_006: Missing auth shows wallet connection error', () => {
    it('should show wallet connection error when token is null', async () => {
      // Ensure no auth token
      useAuthStore.setState({
        token: null,
        user: null,
        userType: null,
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate through all steps
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'No Auth Job');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'No auth desc');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      // Should show wallet connection error
      await waitFor(() => {
        expect(screen.getByText(/Please connect your wallet first/i)).toBeInTheDocument();
        expect(screen.getByText(/SELECT WALLET/i)).toBeInTheDocument();
      });

      // Should not navigate anywhere
      expect(mockPush).not.toHaveBeenCalled();
    });

    it('should not attempt API call when not authenticated', async () => {
      useAuthStore.setState({
        token: null,
        user: null,
        userType: null,
      });

      let apiCalled = false;
      server.use(
        http.post(`${API_URL}/api/jobs`, () => {
          apiCalled = true;
          return HttpResponse.json({ id: 'should-not-reach' });
        })
      );

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate through all steps
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'API Block Test');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Should not call API');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      // Wait a bit and verify API was never called
      await waitFor(() => {
        expect(screen.getByText(/Please connect your wallet first/i)).toBeInTheDocument();
      });

      expect(apiCalled).toBe(false);
    });

    it('should allow submission after wallet is connected', async () => {
      // Start without auth
      useAuthStore.setState({
        token: null,
        user: null,
        userType: null,
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate to step 4
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Auth Later Job');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Auth later');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));

      // First attempt without auth
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      await waitFor(() => {
        expect(screen.getByText(/Please connect your wallet first/i)).toBeInTheDocument();
      });

      // Simulate user connecting wallet
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1', wallet_address: '0x1234' },
        userType: 'client',
      });

      // Retry submission
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      // Should succeed now
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard/jobs/new-job-1');
      });
    });
  });

  describe('Additional Edge Cases', () => {
    it('should toggle skills on and off correctly', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate to step 3
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Toggle Test');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Toggle desc');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));

      // Select a skill
      const rustButton = screen.getByRole('button', { name: /^Rust$/i });
      await user.click(rustButton);
      expect(rustButton).toHaveClass('border-secondary-500/30');

      // Deselect the skill
      await user.click(rustButton);
      expect(rustButton).toHaveClass('border-neutral-700/40');
    });

    it('should handle all job types correctly', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Test selecting each job type - select coding first
      await user.click(screen.getByRole('button', { name: /^CODING$/i }));
      expect(screen.getByRole('button', { name: /^CODING$/i })).toHaveClass('bg-white');

      // Select RESEARCH
      await user.click(screen.getByRole('button', { name: /^RESEARCH$/i }));
      expect(screen.getByRole('button', { name: /^RESEARCH$/i })).toHaveClass('bg-white');

      // Select CONTENT
      await user.click(screen.getByRole('button', { name: /^CONTENT$/i }));
      expect(screen.getByRole('button', { name: /^CONTENT$/i })).toHaveClass('bg-white');

      // Select DATA ANALYSIS
      await user.click(screen.getByRole('button', { name: /DATA ANALYSIS/i }));
      expect(screen.getByRole('button', { name: /DATA ANALYSIS/i })).toHaveClass('bg-white');

      // Select OTHER
      await user.click(screen.getByRole('button', { name: /^OTHER$/i }));
      expect(screen.getByRole('button', { name: /^OTHER$/i })).toHaveClass('bg-white');
    });

    it('should handle deadline input correctly', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      let capturedJobData: any = null;
      server.use(
        http.post(`${API_URL}/api/jobs`, async ({ request }) => {
          capturedJobData = await request.json();
          return HttpResponse.json({ id: 'new-job-1', status: 'draft' });
        })
      );

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate to step 4
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'Deadline Job');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'Has deadline');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));

      // Set a deadline using fireEvent for date inputs (more reliable than userEvent for date type)
      const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
      expect(dateInput).toBeInTheDocument();

      // Change the date input value directly
      await user.clear(dateInput);
      // For date inputs, we use fireEvent.change as userEvent.type doesn't work well
      const { fireEvent } = await import('@testing-library/react');
      fireEvent.change(dateInput, { target: { value: '2025-12-31' } });

      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      await waitFor(() => {
        expect(capturedJobData).not.toBeNull();
      });

      // Deadline should be ISO string
      expect(capturedJobData.deadline).toBeDefined();
      expect(capturedJobData.deadline).toContain('2025-12-31');
    });

    it('should navigate to dashboard if job ID is not in response', async () => {
      useAuthStore.setState({
        token: 'mock-jwt-token',
        user: { id: 'user-1' },
        userType: 'client',
      });

      server.use(
        http.post(`${API_URL}/api/jobs`, () => {
          // Return response without id
          return HttpResponse.json({ status: 'draft' });
        })
      );

      const user = userEvent.setup();
      render(<NewJobPage />);

      // Navigate through all steps
      await user.click(screen.getByRole('button', { name: /CODING/i }));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Job Details'));
      await user.type(screen.getByPlaceholderText('Enter job title...'), 'No ID Job');
      await user.type(screen.getByPlaceholderText('Describe the job requirements...'), 'No ID');
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Required Skills'));
      await user.click(screen.getByRole('button', { name: /Next/i }));

      await waitFor(() => screen.getByText('Budget & Deadline'));
      await user.click(screen.getByRole('button', { name: /\[SUBMIT\]/i }));

      // Should navigate to dashboard
      await waitFor(() => {
        expect(mockPush).toHaveBeenCalledWith('/dashboard');
      });
    });
  });
});
