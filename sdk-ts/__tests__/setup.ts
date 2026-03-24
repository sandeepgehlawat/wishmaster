import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { beforeAll, afterEach, afterAll } from 'vitest';

// Mock data
export const mockAgent = {
  id: 'agent_123',
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  displayName: 'TestAgent',
  description: 'A test agent',
  skills: ['rust', 'typescript'],
  hourlyRate: 50,
  trustTier: 'established',
  reputationScore: 85,
  totalJobsCompleted: 10,
  isActive: true,
  identityNftId: 42,
  createdAt: '2024-01-01T00:00:00Z',
};

export const mockJob = {
  id: 'job_456',
  clientId: 'client_789',
  creatorType: 'client' as const,
  title: 'Build a REST API',
  description: 'Need a high-performance REST API built in Rust',
  taskType: 'development',
  requiredSkills: ['rust', 'api'],
  complexity: 'medium',
  budgetMin: 100,
  budgetMax: 200,
  pricingModel: 'fixed',
  urgency: 'normal',
  status: 'open' as const,
  createdAt: '2024-01-01T00:00:00Z',
  publishedAt: '2024-01-01T00:00:00Z',
  bidCount: 3,
};

export const mockBid = {
  id: 'bid_001',
  jobId: 'job_456',
  agentId: 'agent_123',
  bidAmount: 150,
  proposal: 'I can build this API efficiently using Rust and Actix-web',
  estimatedHours: 8,
  status: 'pending' as const,
  createdAt: '2024-01-02T00:00:00Z',
};

export const mockEscrow = {
  jobId: 'job_456',
  client: '0x1234567890abcdef1234567890abcdef12345678',
  agent: '0xabcdef1234567890abcdef1234567890abcdef12',
  amount: 150,
  status: 'funded' as const,
  createdAt: '2024-01-02T00:00:00Z',
};

export const mockOnChainReputation = {
  identityNftId: 42,
  walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
  totalFeedbackCount: 15,
  averageScore: 4.5,
  tags: { quality: 10, communication: 8, timeliness: 7 },
};

// API base URL for tests
export const BASE_URL = 'https://api.wishmaster.io';

// Default handlers
export const handlers = [
  // Profile endpoints
  http.get(`${BASE_URL}/api/agent/profile`, ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json(mockAgent);
  }),

  http.post(`${BASE_URL}/api/agent/profile`, async ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockAgent, ...body });
  }),

  http.get(`${BASE_URL}/api/agent/reputation`, ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json(mockOnChainReputation);
  }),

  // Job endpoints
  http.get(`${BASE_URL}/api/jobs`, ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const offset = parseInt(url.searchParams.get('offset') || '0');

    // Return paginated jobs
    const jobs = [mockJob, { ...mockJob, id: 'job_457', title: 'Another job' }];
    return HttpResponse.json(jobs.slice(offset, offset + limit));
  }),

  http.get(`${BASE_URL}/api/jobs/:jobId`, ({ request, params }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }

    const { jobId } = params;
    if (jobId === 'job_456') {
      return HttpResponse.json(mockJob);
    }
    if (jobId === 'job_notfound') {
      return HttpResponse.json(
        { error: 'not_found', message: 'Job not found' },
        { status: 404 }
      );
    }
    return HttpResponse.json(
      { error: 'internal_error', message: 'Internal server error' },
      { status: 500 }
    );
  }),

  // Bid endpoints
  http.post(`${BASE_URL}/api/jobs/:jobId/bids`, async ({ request, params }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }

    const { jobId } = params;
    const body = await request.json() as Record<string, unknown>;

    return HttpResponse.json({
      id: 'bid_new',
      jobId,
      agentId: 'agent_123',
      bidAmount: body.bid_amount,
      proposal: body.proposal,
      estimatedHours: body.estimated_hours,
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  }),

  http.get(`${BASE_URL}/api/agent/bids`, ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json([mockBid]);
  }),

  http.post(`${BASE_URL}/api/jobs/:jobId/bids/:bidId/withdraw`, ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ ...mockBid, status: 'withdrawn' });
  }),

  // Agent job management endpoints
  http.get(`${BASE_URL}/api/agent/jobs/assigned`, ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json([{ ...mockJob, status: 'assigned', agentId: 'agent_123' }]);
  }),

  http.post(`${BASE_URL}/api/jobs/:jobId/deliver`, async ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ ...mockJob, status: 'delivered', deliveredAt: new Date().toISOString() });
  }),

  // Agent-created job endpoints
  http.post(`${BASE_URL}/api/agent/jobs`, async ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      id: 'job_new',
      creatorType: 'agent',
      agentCreatorId: 'agent_123',
      title: body.title,
      description: body.description,
      taskType: body.task_type,
      requiredSkills: body.required_skills,
      complexity: body.complexity || 'medium',
      budgetMin: body.budget_min,
      budgetMax: body.budget_max,
      pricingModel: 'fixed',
      urgency: body.urgency || 'normal',
      status: 'draft',
      createdAt: new Date().toISOString(),
      bidCount: 0,
    });
  }),

  http.get(`${BASE_URL}/api/agent/jobs`, ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json([{ ...mockJob, creatorType: 'agent', agentCreatorId: 'agent_123' }]);
  }),

  http.post(`${BASE_URL}/api/agent/jobs/:jobId/publish`, ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ ...mockJob, status: 'open', publishedAt: new Date().toISOString() });
  }),

  http.post(`${BASE_URL}/api/agent/jobs/:jobId/fund`, async ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    const body = await request.json() as { amount: number };
    return HttpResponse.json({
      escrow: { ...mockEscrow, amount: body.amount },
      txHash: '0xabc123',
    });
  }),

  http.get(`${BASE_URL}/api/agent/jobs/:jobId/bids`, ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json([mockBid]);
  }),

  http.post(`${BASE_URL}/api/agent/jobs/:jobId/select-bid`, async ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ ...mockJob, status: 'assigned', agentId: 'agent_123' });
  }),

  http.post(`${BASE_URL}/api/agent/jobs/:jobId/approve`, async ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json({
      job: { ...mockJob, status: 'completed', completedAt: new Date().toISOString() },
      escrowReleased: true,
      reputationUpdated: true,
      txHash: '0xdef456',
    });
  }),

  http.post(`${BASE_URL}/api/agent/jobs/:jobId/revision`, async ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ ...mockJob, status: 'revision' });
  }),

  http.post(`${BASE_URL}/api/agent/jobs/:jobId/cancel`, async ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }
    return HttpResponse.json({ ...mockJob, status: 'cancelled' });
  }),

  // Registration endpoints
  http.post(`${BASE_URL}/api/agents/register`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;

    if (!body.wallet_address || !/^0x[a-fA-F0-9]{40}$/.test(body.wallet_address as string)) {
      return HttpResponse.json(
        { error: 'validation_error', message: 'Invalid wallet address' },
        { status: 400 }
      );
    }

    return HttpResponse.json({
      id: 'agent_new',
      wallet_address: body.wallet_address,
      display_name: body.display_name,
      description: body.description,
      skills: body.skills,
      hourly_rate: body.hourly_rate,
      trust_tier: 'new',
      reputation_score: 0,
      total_jobs_completed: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      api_key: 'ahk_new_api_key_12345',
    });
  }),

  http.post(`${BASE_URL}/api/agents/register-with-wallet`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;

    return HttpResponse.json({
      id: 'agent_new',
      wallet_address: '0xNewGeneratedWallet1234567890abcdef12345678',
      display_name: body.display_name,
      description: body.description,
      skills: body.skills,
      hourly_rate: body.hourly_rate,
      trust_tier: 'new',
      reputation_score: 0,
      total_jobs_completed: 0,
      is_active: true,
      created_at: new Date().toISOString(),
      api_key: 'ahk_new_api_key_67890',
      wallet: {
        address: '0xNewGeneratedWallet1234567890abcdef12345678',
        private_key: '0xprivatekey1234567890abcdef1234567890abcdef1234567890abcdef12345678',
      },
    });
  }),

  // x402 payment required endpoint (for testing payment handling)
  http.get(`${BASE_URL}/api/premium/feature`, ({ request }) => {
    const apiKey = request.headers.get('X-API-Key');
    if (!apiKey || apiKey !== 'ahk_test_valid_key') {
      return HttpResponse.json(
        { error: 'unauthorized', message: 'Invalid API key' },
        { status: 401 }
      );
    }

    return new HttpResponse(null, {
      status: 402,
      headers: {
        'X-Payment-Network': 'base',
        'X-Payment-Token': 'USDC',
        'X-Payment-Amount': '100',
        'X-Payment-Recipient': '0xrecipient',
        'X-Payment-Nonce': 'nonce123',
        'X-Payment-Expires': '1704067200',
      },
    });
  }),
];

// Setup MSW server
export const server = setupServer(...handlers);

// Start server before all tests
beforeAll(() => server.listen({ onUnhandledRequest: 'error' }));

// Reset handlers after each test
afterEach(() => server.resetHandlers());

// Clean up after all tests
afterAll(() => server.close());
