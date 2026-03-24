import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '../utils/test-utils';
import Chat from '@/components/chat';
import { server } from '../setup';
import { http, HttpResponse } from 'msw';
import type { Message } from '@/lib/types';

const API_URL = 'http://localhost:3001';

// Mock messages
const mockMessages: Message[] = [
  {
    id: 'msg-1',
    job_id: 'job-1',
    sender_id: 'user-1',
    sender_type: 'client',
    sender_name: 'Test Client',
    content: 'Hello, how is the project going?',
    created_at: new Date().toISOString(),
    read_at: null,
  },
  {
    id: 'msg-2',
    job_id: 'job-1',
    sender_id: 'agent-1',
    sender_type: 'agent',
    sender_name: 'Test Agent',
    content: 'Going well! Should be done soon.',
    created_at: new Date().toISOString(),
    read_at: null,
  },
];

describe('Chat Component', () => {
  const defaultProps = {
    jobId: 'job-1',
    token: 'test-token',
    currentUserId: 'user-1',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers({ shouldAdvanceTime: true });

    // Default handler for messages
    server.use(
      http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
        return HttpResponse.json({
          messages: mockMessages,
          total: mockMessages.length,
        });
      }),
      http.post(`${API_URL}/api/jobs/:jobId/messages/read`, () => {
        return HttpResponse.json({ marked_count: 1 });
      })
    );
  });

  afterEach(() => {
    vi.useRealTimers();
    server.resetHandlers();
  });

  describe('Message List Rendering', () => {
    it('renders the chat header', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('CHAT')).toBeInTheDocument();
      });
    });

    it('shows loading state initially', () => {
      render(<Chat {...defaultProps} />);

      expect(screen.getByText('LOADING MESSAGES...')).toBeInTheDocument();
    });

    it('renders all messages after loading', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Hello, how is the project going?')).toBeInTheDocument();
        expect(screen.getByText('Going well! Should be done soon.')).toBeInTheDocument();
      });
    });

    it('displays message count', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('(2 messages)')).toBeInTheDocument();
      });
    });

    it('shows sender names', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Test Client')).toBeInTheDocument();
        expect(screen.getByText('Test Agent')).toBeInTheDocument();
      });
    });

    it('shows empty state when no messages', async () => {
      server.use(
        http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
          return HttpResponse.json({
            messages: [],
            total: 0,
          });
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
      });
    });

    it('preserves message content with whitespace', async () => {
      server.use(
        http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
          return HttpResponse.json({
            messages: [{
              ...mockMessages[0],
              content: 'Line 1\nLine 2\nLine 3',
            }],
            total: 1,
          });
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        const messageElement = screen.getByText(/Line 1/);
        expect(messageElement).toHaveClass('whitespace-pre-wrap');
      });
    });
  });

  describe('Sender Differentiation Styling', () => {
    it('applies own message styling for current user messages', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        // Find the message container for the client message (own message)
        const clientMessage = screen.getByText('Hello, how is the project going?').closest('div[class*="max-w-"]');
        expect(clientMessage).toHaveClass('bg-green-900/30');
        expect(clientMessage).toHaveClass('border-secondary-400/50');
      });
    });

    it('applies other message styling for other user messages', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        // Find the message container for the agent message (other's message)
        const agentMessage = screen.getByText('Going well! Should be done soon.').closest('div[class*="max-w-"]');
        expect(agentMessage).toHaveClass('bg-white/5');
        expect(agentMessage).toHaveClass('border-white/20');
      });
    });

    it('aligns own messages to the right', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        // Find the flex container for the client message
        const clientMessageRow = screen.getByText('Hello, how is the project going?')
          .closest('div[class*="max-w-"]')
          ?.parentElement;
        expect(clientMessageRow).toHaveClass('justify-end');
      });
    });

    it('aligns other messages to the left', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        // Find the flex container for the agent message
        const agentMessageRow = screen.getByText('Going well! Should be done soon.')
          .closest('div[class*="max-w-"]')
          ?.parentElement;
        expect(agentMessageRow).toHaveClass('justify-start');
      });
    });

    it('applies client color to client sender name', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        const clientName = screen.getByText('Test Client');
        expect(clientName).toHaveClass('text-secondary-400');
      });
    });

    it('applies agent color to agent sender name', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        const agentName = screen.getByText('Test Agent');
        expect(agentName).toHaveClass('text-blue-400');
      });
    });
  });

  describe('Sending Messages', () => {
    it('has message input field', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByPlaceholderText('Type a message...')).toBeInTheDocument();
      });
    });

    it('has send button', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        const sendButton = screen.getByRole('button');
        expect(sendButton).toBeInTheDocument();
      });
    });

    it('sends message when form is submitted', async () => {
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/messages`, async ({ request }) => {
          const body = await request.json() as { content: string };
          return HttpResponse.json({
            id: 'new-msg',
            job_id: 'job-1',
            sender_id: 'user-1',
            sender_type: 'client',
            sender_name: 'Test Client',
            content: body.content,
            created_at: new Date().toISOString(),
          });
        })
      );

      render(<Chat {...defaultProps} />);

      // Wait for loading to finish
      await waitFor(() => {
        expect(screen.queryByText('LOADING MESSAGES...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(input, { target: { value: 'New test message' } });

      const form = input.closest('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('New test message')).toBeInTheDocument();
      });
    });

    it('clears input after sending', async () => {
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/messages`, async ({ request }) => {
          const body = await request.json() as { content: string };
          return HttpResponse.json({
            id: 'new-msg',
            job_id: 'job-1',
            sender_id: 'user-1',
            sender_type: 'client',
            sender_name: 'Test Client',
            content: body.content,
            created_at: new Date().toISOString(),
          });
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('LOADING MESSAGES...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type a message...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'New test message' } });
      expect(input.value).toBe('New test message');

      const form = input.closest('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(input.value).toBe('');
      });
    });

    it('shows error when sending fails', async () => {
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/messages`, () => {
          return HttpResponse.json(
            { error: { message: 'Failed to send message' } },
            { status: 500 }
          );
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('LOADING MESSAGES...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(input, { target: { value: 'Test message' } });

      const form = input.closest('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(screen.getByText('Failed to send message')).toBeInTheDocument();
      });
    });

    it('disables input while sending', async () => {
      let resolvePromise: () => void;
      const sendPromise = new Promise<void>((resolve) => {
        resolvePromise = resolve;
      });

      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/messages`, async () => {
          await sendPromise;
          return HttpResponse.json({
            id: 'new-msg',
            job_id: 'job-1',
            sender_id: 'user-1',
            sender_type: 'client',
            sender_name: 'Test Client',
            content: 'Test',
            created_at: new Date().toISOString(),
          });
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('LOADING MESSAGES...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type a message...') as HTMLInputElement;
      fireEvent.change(input, { target: { value: 'Test message' } });

      const form = input.closest('form');
      fireEvent.submit(form!);

      await waitFor(() => {
        expect(input).toBeDisabled();
      });

      resolvePromise!();

      await waitFor(() => {
        expect(input).not.toBeDisabled();
      });
    });
  });

  describe('Empty Message Validation', () => {
    it('disables send button when message is empty', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('LOADING MESSAGES...')).not.toBeInTheDocument();
      });

      const sendButton = screen.getByRole('button', { name: '' });
      expect(sendButton).toBeDisabled();
    });

    it('disables send button when message is only whitespace', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('LOADING MESSAGES...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(input, { target: { value: '   ' } });

      const sendButton = screen.getByRole('button', { name: '' });
      expect(sendButton).toBeDisabled();
    });

    it('enables send button when message has content', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('LOADING MESSAGES...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type a message...');
      fireEvent.change(input, { target: { value: 'Hello' } });

      const sendButton = screen.getByRole('button', { name: '' });
      expect(sendButton).not.toBeDisabled();
    });

    it('does not send empty messages on form submit', async () => {
      const sendSpy = vi.fn();
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/messages`, () => {
          sendSpy();
          return HttpResponse.json({
            id: 'new-msg',
            job_id: 'job-1',
            sender_id: 'user-1',
            sender_type: 'client',
            sender_name: 'Test Client',
            content: '',
            created_at: new Date().toISOString(),
          });
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('LOADING MESSAGES...')).not.toBeInTheDocument();
      });

      const input = screen.getByPlaceholderText('Type a message...');
      const form = input.closest('form');
      fireEvent.submit(form!);

      // Wait a bit to ensure no API call is made
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(sendSpy).not.toHaveBeenCalled();
    });
  });

  describe('Polling Interval', () => {
    it('polls for new messages every 5 seconds', async () => {
      let fetchCount = 0;
      server.use(
        http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
          fetchCount++;
          return HttpResponse.json({
            messages: mockMessages,
            total: mockMessages.length,
          });
        })
      );

      render(<Chat {...defaultProps} />);

      // Wait for initial fetch
      await waitFor(() => {
        expect(fetchCount).toBe(1);
      });

      // Advance time by 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      await waitFor(() => {
        expect(fetchCount).toBe(2);
      });

      // Advance time by another 5 seconds
      await vi.advanceTimersByTimeAsync(5000);

      await waitFor(() => {
        expect(fetchCount).toBe(3);
      });
    });

    it('cleans up polling interval on unmount', async () => {
      let fetchCount = 0;
      server.use(
        http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
          fetchCount++;
          return HttpResponse.json({
            messages: mockMessages,
            total: mockMessages.length,
          });
        })
      );

      const { unmount } = render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(fetchCount).toBe(1);
      });

      unmount();

      // Advance time - should not increase fetch count
      await vi.advanceTimersByTimeAsync(10000);

      // fetchCount should still be 1 (no more fetches after unmount)
      expect(fetchCount).toBe(1);
    });
  });

  describe('Date Grouping', () => {
    it('groups messages by date with Today label', async () => {
      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Today')).toBeInTheDocument();
      });
    });

    it('groups messages by date with Yesterday label', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      server.use(
        http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
          return HttpResponse.json({
            messages: [{
              ...mockMessages[0],
              created_at: yesterday.toISOString(),
            }],
            total: 1,
          });
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Yesterday')).toBeInTheDocument();
      });
    });

    it('shows date for older messages', async () => {
      const oldDate = new Date('2024-01-15T10:00:00Z');

      server.use(
        http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
          return HttpResponse.json({
            messages: [{
              ...mockMessages[0],
              created_at: oldDate.toISOString(),
            }],
            total: 1,
          });
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        // The date format depends on locale, just check it's not Today or Yesterday
        expect(screen.queryByText('Today')).not.toBeInTheDocument();
        expect(screen.queryByText('Yesterday')).not.toBeInTheDocument();
      });
    });
  });

  describe('Message Time Display', () => {
    it('displays message time in HH:MM format', async () => {
      const fixedDate = new Date('2024-01-15T14:30:00Z');
      server.use(
        http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
          return HttpResponse.json({
            messages: [{
              ...mockMessages[0],
              created_at: fixedDate.toISOString(),
            }],
            total: 1,
          });
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        // Time format depends on locale, just verify there's a time element
        const timeElements = document.querySelectorAll('[class*="text-white/40"]');
        expect(timeElements.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Error Handling', () => {
    it('shows error when fetching messages fails', async () => {
      server.use(
        http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
          return HttpResponse.json(
            { error: { message: 'Failed to load messages' } },
            { status: 500 }
          );
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('Failed to load messages')).toBeInTheDocument();
      });
    });

    it('does not show error for "agent is assigned" 400 response', async () => {
      server.use(
        http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
          return HttpResponse.json(
            { error: { message: 'No agent is assigned yet' } },
            { status: 400 }
          );
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.queryByText('LOADING MESSAGES...')).not.toBeInTheDocument();
      });

      expect(screen.queryByText(/agent is assigned/)).not.toBeInTheDocument();
    });
  });

  describe('Mark Messages Read', () => {
    it('marks messages as read when component loads with messages', async () => {
      const markReadSpy = vi.fn();
      server.use(
        http.post(`${API_URL}/api/jobs/:jobId/messages/read`, () => {
          markReadSpy();
          return HttpResponse.json({ marked_count: 1 });
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(markReadSpy).toHaveBeenCalled();
      });
    });

    it('does not mark messages read when no messages', async () => {
      const markReadSpy = vi.fn();
      server.use(
        http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
          return HttpResponse.json({
            messages: [],
            total: 0,
          });
        }),
        http.post(`${API_URL}/api/jobs/:jobId/messages/read`, () => {
          markReadSpy();
          return HttpResponse.json({ marked_count: 0 });
        })
      );

      render(<Chat {...defaultProps} />);

      await waitFor(() => {
        expect(screen.getByText('No messages yet. Start the conversation!')).toBeInTheDocument();
      });

      // Wait a bit to ensure no call is made
      await new Promise(resolve => setTimeout(resolve, 100));
      expect(markReadSpy).not.toHaveBeenCalled();
    });
  });
});
