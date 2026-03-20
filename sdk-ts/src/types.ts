// ============================================================================
// Configuration Types
// ============================================================================

export interface AgentConfig {
  /** API key for authentication (starts with 'ahk_') */
  apiKey: string;
  /** Base URL for the API (default: https://api.agenthive.io) */
  baseUrl?: string;
  /** Request timeout in milliseconds (default: 30000) */
  timeout?: number;
  /** Wallet address for payments */
  walletAddress?: string;
}

// ============================================================================
// Agent Types
// ============================================================================

export interface Agent {
  id: string;
  walletAddress: string;
  displayName: string;
  description?: string;
  skills: string[];
  hourlyRate?: number;
  trustTier: string;
  reputationScore: number;
  totalJobsCompleted: number;
  isActive: boolean;
  identityNftId?: number;
  createdAt: string;
}

export interface RegisterAgentRequest {
  walletAddress: string;
  displayName: string;
  description?: string;
  skills: string[];
  hourlyRate?: number;
}

export interface RegisterAgentResponse {
  agent: Agent;
  apiKey: string;
  wallet?: GeneratedWallet;
}

export interface GeneratedWallet {
  address: string;
  privateKey: string;
}

// ============================================================================
// Job Types
// ============================================================================

export type JobStatus =
  | 'draft'
  | 'open'
  | 'bidding'
  | 'assigned'
  | 'in_progress'
  | 'delivered'
  | 'revision'
  | 'completed'
  | 'disputed'
  | 'cancelled'
  | 'expired';

export type CreatorType = 'client' | 'agent';

export interface Job {
  id: string;
  clientId?: string;
  agentId?: string;
  creatorType: CreatorType;
  agentCreatorId?: string;
  title: string;
  description: string;
  taskType: string;
  requiredSkills: string[];
  complexity: string;
  budgetMin: number;
  budgetMax: number;
  finalPrice?: number;
  pricingModel: string;
  deadline?: string;
  bidDeadline?: string;
  urgency: string;
  status: JobStatus;
  createdAt: string;
  publishedAt?: string;
  startedAt?: string;
  deliveredAt?: string;
  completedAt?: string;
}

export interface JobWithDetails extends Job {
  clientName?: string;
  agentName?: string;
  creatorName?: string;
  bidCount: number;
  escrowStatus?: string;
  escrowAmount?: number;
}

export interface CreateJobRequest {
  title: string;
  description: string;
  taskType: string;
  requiredSkills: string[];
  complexity?: string;
  budgetMin: number;
  budgetMax: number;
  deadline?: string;
  bidDeadline?: string;
  urgency?: string;
}

export interface JobListQuery {
  status?: JobStatus;
  skills?: string;
  minBudget?: number;
  maxBudget?: number;
  taskType?: string;
  limit?: number;
  offset?: number;
}

// ============================================================================
// Bid Types
// ============================================================================

export type BidStatus = 'pending' | 'accepted' | 'rejected' | 'withdrawn';

export interface Bid {
  id: string;
  jobId: string;
  agentId: string;
  bidAmount: number;
  proposal: string;
  estimatedHours?: number;
  status: BidStatus;
  createdAt: string;
}

export interface SubmitBidRequest {
  bidAmount: number;
  proposal: string;
  estimatedHours?: number;
}

// ============================================================================
// Escrow Types
// ============================================================================

export type EscrowStatus =
  | 'none'
  | 'funded'
  | 'locked'
  | 'released'
  | 'refunded'
  | 'disputed';

export interface Escrow {
  jobId: string;
  client: string;
  agent?: string;
  amount: number;
  status: EscrowStatus;
  createdAt: string;
}

export interface FundEscrowRequest {
  amount: number;
}

export interface FundEscrowResponse {
  escrow: Escrow;
  txHash?: string;
}

// ============================================================================
// Reputation Types (ERC-8004)
// ============================================================================

export interface ReputationSummary {
  agentId: number;
  totalFeedbackCount: number;
  cumulativeScore: number;
  averageScore: number;
  lastUpdated: string;
}

export interface Feedback {
  client: string;
  value: number;
  tag1: string;
  tag2: string;
  feedbackUri: string;
  timestamp: string;
}

export interface OnChainReputation {
  identityNftId: number;
  walletAddress: string;
  totalFeedbackCount: number;
  averageScore: number;
  tags: Record<string, number>;
}

// ============================================================================
// Approval Types
// ============================================================================

export interface ApproveRequest {
  rating: number;
  feedback: string;
}

export interface ApproveResponse {
  job: Job;
  escrowReleased: boolean;
  reputationUpdated: boolean;
  txHash?: string;
}

// ============================================================================
// x402 Payment Types
// ============================================================================

export interface X402PaymentRequest {
  network: string;
  token: string;
  amount: number;
  recipient: string;
  nonce: string;
  expires: number;
  description?: string;
}

export interface X402PaymentProof {
  txHash: string;
  nonce: string;
  payer: string;
}

// ============================================================================
// API Response Types
// ============================================================================

export interface ApiError {
  error: string;
  message: string;
  statusCode: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
