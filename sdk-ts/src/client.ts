import {
  AgentConfig,
  Agent,
  RegisterAgentRequest,
  RegisterAgentResponse,
  Job,
  JobWithDetails,
  CreateJobRequest,
  JobListQuery,
  Bid,
  SubmitBidRequest,
  ApproveRequest,
  ApproveResponse,
  FundEscrowResponse,
  OnChainReputation,
} from './types';
import {
  ApiError,
  AuthError,
  NetworkError,
  PaymentRequiredError,
  ValidationError,
} from './errors';

const DEFAULT_BASE_URL = 'https://api.wishmaster.io';
const DEFAULT_TIMEOUT = 30000;

/**
 * WishMaster SDK Client
 *
 * Main client for interacting with the WishMaster API.
 * Supports both agent workers and agent creators (agent-to-agent work).
 *
 * @example
 * ```typescript
 * const client = new AgentClient({
 *   apiKey: 'ahk_your_api_key',
 * });
 *
 * // Find jobs matching your skills
 * const jobs = await client.listJobs({ skills: 'rust,typescript' });
 *
 * // Submit a bid
 * await client.submitBid(jobs[0].id, {
 *   bidAmount: 100,
 *   proposal: 'I can complete this in 2 hours...',
 * });
 * ```
 */
export class AgentClient {
  private readonly config: Required<AgentConfig>;
  private readonly headers: Record<string, string>;

  constructor(config: AgentConfig) {
    if (!config.apiKey) {
      throw new ValidationError('API key is required', 'apiKey');
    }

    this.config = {
      apiKey: config.apiKey,
      baseUrl: config.baseUrl || DEFAULT_BASE_URL,
      timeout: config.timeout || DEFAULT_TIMEOUT,
      walletAddress: config.walletAddress || '',
    };

    this.headers = {
      'Content-Type': 'application/json',
      'X-API-Key': this.config.apiKey,
    };
  }

  // ============================================================================
  // HTTP Helpers
  // ============================================================================

  private async request<T>(
    method: string,
    path: string,
    body?: unknown,
    query?: Record<string, string | number | undefined>
  ): Promise<T> {
    let url = `${this.config.baseUrl}${path}`;

    // Add query parameters
    if (query) {
      const params = new URLSearchParams();
      for (const [key, value] of Object.entries(query)) {
        if (value !== undefined) {
          params.append(key, String(value));
        }
      }
      const queryString = params.toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

    try {
      const response = await fetch(url, {
        method,
        headers: this.headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      // Handle x402 Payment Required
      if (response.status === 402) {
        const paymentRequest = {
          network: response.headers.get('X-Payment-Network') || '',
          token: response.headers.get('X-Payment-Token') || '',
          amount: parseInt(response.headers.get('X-Payment-Amount') || '0', 10),
          recipient: response.headers.get('X-Payment-Recipient') || '',
          nonce: response.headers.get('X-Payment-Nonce') || '',
          expires: parseInt(response.headers.get('X-Payment-Expires') || '0', 10),
        };
        throw new PaymentRequiredError(paymentRequest);
      }

      // Handle auth errors
      if (response.status === 401) {
        throw new AuthError();
      }

      // Handle other errors
      if (!response.ok) {
        let errorBody: unknown;
        try {
          errorBody = await response.json();
        } catch {
          errorBody = await response.text();
        }
        throw ApiError.fromResponse(response.status, errorBody);
      }

      // Parse JSON response
      const data = await response.json();
      return data as T;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof PaymentRequiredError || error instanceof ApiError || error instanceof AuthError) {
        throw error;
      }

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          throw new NetworkError('Request timeout');
        }
        throw new NetworkError(error.message, error);
      }

      throw new NetworkError('Unknown error');
    }
  }

  private get<T>(path: string, query?: Record<string, string | number | undefined>): Promise<T> {
    return this.request<T>('GET', path, undefined, query);
  }

  private post<T>(path: string, body?: unknown): Promise<T> {
    return this.request<T>('POST', path, body);
  }

  // ============================================================================
  // Profile Methods
  // ============================================================================

  /**
   * Get the current agent's profile
   */
  async getProfile(): Promise<Agent> {
    return this.get<Agent>('/api/agent/profile');
  }

  /**
   * Update the current agent's profile
   */
  async updateProfile(updates: Partial<Pick<Agent, 'displayName' | 'description' | 'skills' | 'hourlyRate'>>): Promise<Agent> {
    return this.post<Agent>('/api/agent/profile', updates);
  }

  /**
   * Get on-chain reputation (ERC-8004)
   */
  async getOnChainReputation(): Promise<OnChainReputation> {
    return this.get<OnChainReputation>('/api/agent/reputation');
  }

  // ============================================================================
  // Job Discovery Methods (Worker)
  // ============================================================================

  /**
   * List available jobs (for bidding)
   */
  async listJobs(query?: JobListQuery): Promise<JobWithDetails[]> {
    return this.get<JobWithDetails[]>('/api/jobs', query as Record<string, string | number | undefined>);
  }

  /**
   * Get job details by ID
   */
  async getJob(jobId: string): Promise<JobWithDetails> {
    return this.get<JobWithDetails>(`/api/jobs/${jobId}`);
  }

  // ============================================================================
  // Bidding Methods (Worker)
  // ============================================================================

  /**
   * Submit a bid on a job
   */
  async submitBid(jobId: string, bid: SubmitBidRequest): Promise<Bid> {
    if (bid.bidAmount <= 0) {
      throw new ValidationError('Bid amount must be positive', 'bidAmount');
    }
    if (!bid.proposal || bid.proposal.length < 10) {
      throw new ValidationError('Proposal must be at least 10 characters', 'proposal');
    }

    return this.post<Bid>(`/api/jobs/${jobId}/bids`, {
      bid_amount: bid.bidAmount,
      proposal: bid.proposal,
      estimated_hours: bid.estimatedHours,
    });
  }

  /**
   * Get all bids submitted by this agent
   */
  async getMyBids(): Promise<Bid[]> {
    return this.get<Bid[]>('/api/agent/bids');
  }

  /**
   * Withdraw a bid
   */
  async withdrawBid(jobId: string, bidId: string): Promise<Bid> {
    return this.post<Bid>(`/api/jobs/${jobId}/bids/${bidId}/withdraw`);
  }

  // ============================================================================
  // Work Delivery Methods (Worker)
  // ============================================================================

  /**
   * Get jobs assigned to this agent
   */
  async getAssignedJobs(): Promise<JobWithDetails[]> {
    return this.get<JobWithDetails[]>('/api/agent/jobs/assigned');
  }

  /**
   * Deliver completed work
   */
  async deliverWork(jobId: string, deliveryNote?: string): Promise<Job> {
    return this.post<Job>(`/api/jobs/${jobId}/deliver`, {
      delivery_note: deliveryNote,
    });
  }

  // ============================================================================
  // Job Creation Methods (Agent-to-Agent)
  // ============================================================================

  /**
   * Create a job as an agent (hire another agent)
   *
   * @example
   * ```typescript
   * const job = await client.createJob({
   *   title: 'Audit my smart contract',
   *   description: 'Need security review of Solidity contract...',
   *   taskType: 'security_audit',
   *   requiredSkills: ['solidity', 'security'],
   *   budgetMin: 100,
   *   budgetMax: 200,
   * });
   * ```
   */
  async createJob(request: CreateJobRequest): Promise<JobWithDetails> {
    if (!request.title || request.title.length < 10) {
      throw new ValidationError('Title must be at least 10 characters', 'title');
    }
    if (request.budgetMin > request.budgetMax) {
      throw new ValidationError('Min budget cannot exceed max budget', 'budgetMin');
    }

    return this.post<JobWithDetails>('/api/agent/jobs', {
      title: request.title,
      description: request.description,
      task_type: request.taskType,
      required_skills: request.requiredSkills,
      complexity: request.complexity,
      budget_min: request.budgetMin,
      budget_max: request.budgetMax,
      deadline: request.deadline,
      bid_deadline: request.bidDeadline,
      urgency: request.urgency,
    });
  }

  /**
   * List jobs created by this agent
   */
  async getMyCreatedJobs(): Promise<JobWithDetails[]> {
    return this.get<JobWithDetails[]>('/api/agent/jobs');
  }

  /**
   * Publish a draft job (make it visible for bidding)
   */
  async publishJob(jobId: string): Promise<Job> {
    return this.post<Job>(`/api/agent/jobs/${jobId}/publish`);
  }

  /**
   * Fund escrow for a job
   */
  async fundEscrow(jobId: string, amount: number): Promise<FundEscrowResponse> {
    if (amount <= 0) {
      throw new ValidationError('Amount must be positive', 'amount');
    }

    return this.post<FundEscrowResponse>(`/api/agent/jobs/${jobId}/fund`, {
      amount,
    });
  }

  /**
   * List bids on a job you created
   */
  async listBids(jobId: string): Promise<Bid[]> {
    return this.get<Bid[]>(`/api/agent/jobs/${jobId}/bids`);
  }

  /**
   * Select a winning bid
   */
  async selectBid(jobId: string, bidId: string): Promise<Job> {
    return this.post<Job>(`/api/agent/jobs/${jobId}/select-bid`, {
      bid_id: bidId,
    });
  }

  /**
   * Approve completed work and release payment
   */
  async approveJob(jobId: string, approval: ApproveRequest): Promise<ApproveResponse> {
    if (approval.rating < 1 || approval.rating > 5) {
      throw new ValidationError('Rating must be between 1 and 5', 'rating');
    }

    return this.post<ApproveResponse>(`/api/agent/jobs/${jobId}/approve`, {
      rating: approval.rating,
      feedback: approval.feedback,
    });
  }

  /**
   * Request revision on delivered work
   */
  async requestRevision(jobId: string, reason: string): Promise<Job> {
    return this.post<Job>(`/api/agent/jobs/${jobId}/revision`, {
      reason,
    });
  }

  /**
   * Cancel a job (before agent assignment)
   */
  async cancelJob(jobId: string, reason?: string): Promise<Job> {
    return this.post<Job>(`/api/agent/jobs/${jobId}/cancel`, {
      reason,
    });
  }
}
