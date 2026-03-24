import { http, HttpResponse } from 'msw';

// Base API URL - matches the fallback in lib/api.ts
const API_URL = 'http://localhost:3001';

// Mock data
export const mockUser = {
  id: 'user-1',
  wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
  display_name: 'Test User',
  email: 'test@example.com',
  bio: 'A test user',
  avatar_url: 'https://example.com/avatar.png',
  created_at: new Date().toISOString(),
};

export const mockAgent = {
  id: 'agent-1',
  wallet_address: '0xabcdef1234567890abcdef1234567890abcdef12',
  display_name: 'Test Agent',
  description: 'A skilled AI agent for testing',
  skills: ['coding', 'research', 'data'],
  is_active: true,
  trust_tier: 'established',
  created_at: new Date().toISOString(),
  reputation: {
    agent_id: 'agent-1',
    avg_rating: '4.8',
    total_ratings: 25,
    completion_rate: '95.0',
    completed_jobs: 50,
    quality_score: '4.9',
    speed_score: '4.7',
    communication_score: '4.8',
    job_success_score: '4.9',
    total_earnings_usdc: '15000.00',
    calculated_at: new Date().toISOString(),
  },
};

export const mockJob = {
  id: 'job-1',
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
  status: 'open',
  created_at: new Date().toISOString(),
  client_name: 'Test User',
  bid_count: 3,
};

export const mockBid = {
  id: 'bid-1',
  job_id: 'job-1',
  agent_id: 'agent-1',
  bid_amount: '350.00',
  estimated_hours: '24',
  estimated_completion: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
  proposal: 'I can build this landing page with React and Tailwind CSS.',
  approach: 'Will start with design mockup, then implement responsive components.',
  status: 'pending',
  revision_count: 0,
  created_at: new Date().toISOString(),
  agent_name: 'Test Agent',
  agent_rating: 4.8,
  agent_completed_jobs: 50,
  agent_trust_tier: 'established',
};

export const mockStats = {
  total_jobs: 150,
  total_agents: 45,
  online_agents: 12,
  total_escrow: 25000,
  completion_rate: 92.5,
};

export const mockMessage = {
  id: 'msg-1',
  job_id: 'job-1',
  sender_id: 'user-1',
  sender_type: 'client',
  sender_name: 'Test User',
  content: 'Hello, I have a question about the project.',
  created_at: new Date().toISOString(),
  read_at: null,
};

export const mockRequirement = {
  id: 'req-1',
  job_id: 'job-1',
  created_by: 'user-1',
  title: 'Responsive design',
  description: 'Must work on mobile and desktop',
  acceptance_criteria: 'Passes mobile audit in Lighthouse',
  priority: 'must_have',
  status: 'pending',
  position: 1,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

export const mockDeliverable = {
  id: 'del-1',
  job_id: 'job-1',
  requirement_id: 'req-1',
  agent_id: 'agent-1',
  title: 'Landing page v1',
  description: 'Initial version of the landing page',
  file_url: 'https://example.com/files/landing-v1.zip',
  file_name: 'landing-v1.zip',
  file_size: 1024000,
  mime_type: 'application/zip',
  status: 'pending_review',
  version: 1,
  created_at: new Date().toISOString(),
  agent_name: 'Test Agent',
};

export const mockService = {
  id: 'service-1',
  original_job_id: 'job-1',
  client_id: 'user-1',
  agent_id: 'agent-1',
  name: 'Website Maintenance',
  description: 'Monthly website updates and maintenance',
  monthly_rate_usd: 500,
  status: 'active',
  started_at: new Date().toISOString(),
  next_billing_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  client_name: 'Test User',
  agent_name: 'Test Agent',
  job_title: 'Build a landing page',
};

// API Handlers
export const handlers = [
  // Auth endpoints
  http.post(`${API_URL}/api/auth/challenge`, () => {
    return HttpResponse.json({
      message: 'Sign this message to authenticate with WishMaster: nonce-12345',
      message_hash: '0xabcdef1234567890',
    });
  }),

  http.post(`${API_URL}/api/auth/verify`, () => {
    return HttpResponse.json({
      token: 'mock-jwt-token-12345',
      user: mockUser,
      is_new: false,
    });
  }),

  // User endpoints
  http.get(`${API_URL}/api/users/me`, () => {
    return HttpResponse.json(mockUser);
  }),

  http.patch(`${API_URL}/api/users/me`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({ ...mockUser, ...body });
  }),

  // Stats endpoint
  http.get(`${API_URL}/api/stats`, () => {
    return HttpResponse.json(mockStats);
  }),

  // Jobs endpoints
  http.get(`${API_URL}/api/jobs`, () => {
    return HttpResponse.json({
      jobs: [mockJob],
      total: 1,
      page: 1,
      limit: 10,
    });
  }),

  http.get(`${API_URL}/api/jobs/mine`, () => {
    return HttpResponse.json({
      jobs: [mockJob],
      total: 1,
      page: 1,
      limit: 10,
    });
  }),

  http.get(`${API_URL}/api/jobs/:id`, ({ params }) => {
    return HttpResponse.json({
      ...mockJob,
      id: params.id,
    });
  }),

  http.post(`${API_URL}/api/jobs`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      ...mockJob,
      ...body,
      id: 'new-job-1',
      status: 'draft',
    });
  }),

  http.post(`${API_URL}/api/jobs/:id/publish`, ({ params }) => {
    return HttpResponse.json({
      job_id: params.id,
      escrow_pda: 'escrow-pda-12345',
      transaction: 'tx-12345',
      amount_usdc: 350,
    });
  }),

  http.post(`${API_URL}/api/jobs/:id/select-bid`, ({ params }) => {
    return HttpResponse.json({
      ...mockJob,
      id: params.id,
      status: 'assigned',
      agent_id: 'agent-1',
    });
  }),

  http.post(`${API_URL}/api/jobs/:id/approve`, ({ params }) => {
    return HttpResponse.json({
      completed: true,
      signature: 'sig-12345',
      agent_payout: 332.5,
      platform_fee: 17.5,
    });
  }),

  http.post(`${API_URL}/api/jobs/:id/cancel`, ({ params }) => {
    return HttpResponse.json({
      cancelled: true,
      refund_signature: 'refund-sig-12345',
    });
  }),

  // Bids endpoints
  http.get(`${API_URL}/api/jobs/:jobId/bids`, () => {
    return HttpResponse.json({
      bids: [mockBid],
      total: 1,
    });
  }),

  // Agents endpoints
  http.get(`${API_URL}/api/agents`, () => {
    return HttpResponse.json({
      agents: [mockAgent],
      total: 1,
      page: 1,
      limit: 10,
    });
  }),

  http.get(`${API_URL}/api/agents/:id`, ({ params }) => {
    return HttpResponse.json({
      ...mockAgent,
      id: params.id,
    });
  }),

  // Escrow endpoints
  http.get(`${API_URL}/api/escrow/:jobId`, ({ params }) => {
    return HttpResponse.json({
      id: 'escrow-1',
      job_id: params.jobId,
      escrow_pda: 'escrow-pda-12345',
      amount_usdc: 350,
      status: 'funded',
      client_wallet: mockUser.wallet_address,
      agent_wallet: mockAgent.wallet_address,
      created_at: new Date().toISOString(),
    });
  }),

  http.post(`${API_URL}/api/escrow/:jobId/release`, () => {
    return HttpResponse.json({
      funded: true,
      escrow_pda: 'escrow-pda-12345',
      status: 'funded',
    });
  }),

  http.post(`${API_URL}/api/escrow/:jobId/confirm`, () => {
    return HttpResponse.json({
      confirmed: true,
      escrow_status: 'funded',
    });
  }),

  // Messages endpoints
  http.get(`${API_URL}/api/jobs/:jobId/messages`, () => {
    return HttpResponse.json({
      messages: [mockMessage],
      total: 1,
    });
  }),

  http.post(`${API_URL}/api/jobs/:jobId/messages`, async ({ request }) => {
    const body = await request.json() as { content: string };
    return HttpResponse.json({
      ...mockMessage,
      id: 'new-msg-1',
      content: body.content,
      created_at: new Date().toISOString(),
    });
  }),

  http.post(`${API_URL}/api/jobs/:jobId/messages/read`, () => {
    return HttpResponse.json({
      marked_count: 1,
    });
  }),

  // Requirements endpoints
  http.get(`${API_URL}/api/jobs/:jobId/requirements`, () => {
    return HttpResponse.json({
      requirements: [mockRequirement],
      total: 1,
      completed: 0,
    });
  }),

  http.post(`${API_URL}/api/jobs/:jobId/requirements`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      ...mockRequirement,
      ...body,
      id: 'new-req-1',
    });
  }),

  http.patch(`${API_URL}/api/requirements/:id`, async ({ request, params }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      ...mockRequirement,
      ...body,
      id: params.id,
      updated_at: new Date().toISOString(),
    });
  }),

  http.delete(`${API_URL}/api/requirements/:id`, () => {
    return HttpResponse.json({ deleted: true });
  }),

  http.post(`${API_URL}/api/requirements/:id/deliver`, ({ params }) => {
    return HttpResponse.json({
      ...mockRequirement,
      id: params.id,
      status: 'delivered',
    });
  }),

  http.post(`${API_URL}/api/requirements/:id/accept`, ({ params }) => {
    return HttpResponse.json({
      ...mockRequirement,
      id: params.id,
      status: 'accepted',
      accepted_at: new Date().toISOString(),
    });
  }),

  http.post(`${API_URL}/api/requirements/:id/reject`, async ({ request, params }) => {
    const body = await request.json() as { feedback: string };
    return HttpResponse.json({
      ...mockRequirement,
      id: params.id,
      status: 'rejected',
      rejection_feedback: body.feedback,
    });
  }),

  // Deliverables endpoints
  http.get(`${API_URL}/api/jobs/:jobId/deliverables`, () => {
    return HttpResponse.json({
      deliverables: [mockDeliverable],
      total: 1,
      pending_review: 1,
    });
  }),

  http.post(`${API_URL}/api/jobs/:jobId/deliverables`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      ...mockDeliverable,
      ...body,
      id: 'new-del-1',
    });
  }),

  http.post(`${API_URL}/api/deliverables/:id/approve`, ({ params }) => {
    return HttpResponse.json({
      ...mockDeliverable,
      id: params.id,
      status: 'approved',
      reviewed_at: new Date().toISOString(),
    });
  }),

  http.post(`${API_URL}/api/deliverables/:id/request-changes`, async ({ request, params }) => {
    const body = await request.json() as { feedback: string };
    return HttpResponse.json({
      ...mockDeliverable,
      id: params.id,
      status: 'changes_requested',
      client_feedback: body.feedback,
      reviewed_at: new Date().toISOString(),
    });
  }),

  // Activity endpoints
  http.get(`${API_URL}/api/jobs/:jobId/activity`, () => {
    return HttpResponse.json({
      activities: [
        {
          id: 'activity-1',
          job_id: 'job-1',
          actor_id: 'user-1',
          actor_type: 'client',
          action: 'job_created',
          details: {},
          created_at: new Date().toISOString(),
          actor_name: 'Test User',
        },
      ],
      total: 1,
    });
  }),

  // Portfolio endpoints
  http.get(`${API_URL}/api/agents/:agentId/portfolio`, () => {
    return HttpResponse.json({
      items: [
        {
          id: 'portfolio-1',
          agent_id: 'agent-1',
          title: 'E-commerce Website',
          description: 'Built a full-stack e-commerce platform',
          category: 'coding',
          is_featured: true,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ],
      total: 1,
    });
  }),

  http.post(`${API_URL}/api/portfolio`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      id: 'new-portfolio-1',
      agent_id: 'agent-1',
      ...body,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
  }),

  // Services endpoints
  http.get(`${API_URL}/api/services`, () => {
    return HttpResponse.json({
      services: [mockService],
      total: 1,
    });
  }),

  http.get(`${API_URL}/api/services/:id`, ({ params }) => {
    return HttpResponse.json({
      ...mockService,
      id: params.id,
    });
  }),

  http.post(`${API_URL}/api/jobs/:jobId/convert-to-service`, async ({ request }) => {
    const body = await request.json() as Record<string, unknown>;
    return HttpResponse.json({
      ...mockService,
      ...body,
      id: 'new-service-1',
    });
  }),

  http.post(`${API_URL}/api/services/:id/accept`, ({ params }) => {
    return HttpResponse.json({
      ...mockService,
      id: params.id,
      status: 'active',
      started_at: new Date().toISOString(),
    });
  }),

  http.post(`${API_URL}/api/services/:id/pause`, ({ params }) => {
    return HttpResponse.json({
      ...mockService,
      id: params.id,
      status: 'paused',
      paused_at: new Date().toISOString(),
    });
  }),

  http.post(`${API_URL}/api/services/:id/resume`, ({ params }) => {
    return HttpResponse.json({
      ...mockService,
      id: params.id,
      status: 'active',
      paused_at: null,
    });
  }),

  http.post(`${API_URL}/api/services/:id/cancel`, ({ params }) => {
    return HttpResponse.json({
      ...mockService,
      id: params.id,
      status: 'cancelled',
      cancelled_at: new Date().toISOString(),
    });
  }),

  // Service updates endpoints
  http.get(`${API_URL}/api/services/:serviceId/updates`, () => {
    return HttpResponse.json({
      updates: [
        {
          id: 'update-1',
          service_id: 'service-1',
          agent_id: 'agent-1',
          title: 'Security patch',
          description: 'Updated dependencies for security',
          change_type: 'security',
          status: 'deployed',
          created_at: new Date().toISOString(),
          deployed_at: new Date().toISOString(),
        },
      ],
      total: 1,
      pending: 0,
    });
  }),

  // Service billing endpoints
  http.get(`${API_URL}/api/services/:serviceId/billing`, () => {
    return HttpResponse.json({
      records: [
        {
          id: 'billing-1',
          service_id: 'service-1',
          period_start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
          period_end: new Date().toISOString(),
          amount_usd: 500,
          status: 'paid',
          paid_at: new Date().toISOString(),
          created_at: new Date().toISOString(),
        },
      ],
      total: 1,
      total_paid_usd: 500,
    });
  }),
];

// Utility function to add custom handlers for specific tests
export function createMockHandler(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  response: unknown,
  status = 200
) {
  const fullPath = `${API_URL}${path}`;
  const httpMethod = {
    get: http.get,
    post: http.post,
    patch: http.patch,
    delete: http.delete,
  }[method];

  return httpMethod(fullPath, () => {
    return HttpResponse.json(response, { status });
  });
}

// Utility function to create error responses
export function createErrorHandler(
  method: 'get' | 'post' | 'patch' | 'delete',
  path: string,
  message: string,
  status = 400
) {
  const fullPath = `${API_URL}${path}`;
  const httpMethod = {
    get: http.get,
    post: http.post,
    patch: http.patch,
    delete: http.delete,
  }[method];

  return httpMethod(fullPath, () => {
    return HttpResponse.json(
      { error: { message } },
      { status }
    );
  });
}
