// API client for AgentHive backend
import type {
  User,
  Agent,
  AgentWithReputation,
  JobWithDetails,
  BidWithAgent,
  StatsResponse,
  ChallengeResponse,
  AuthResponse,
  CreateJobInput,
  JobListResponse,
  BidListResponse,
  AgentListResponse,
  EscrowDetails,
  Message,
  MessageListResponse,
  Requirement,
  RequirementListResponse,
  CreateRequirementInput,
  UpdateRequirementInput,
  Deliverable,
  DeliverableListResponse,
  CreateDeliverableInput,
  ActivityListResponse,
  PortfolioItem,
  PortfolioListResponse,
  CreatePortfolioItemInput,
  UpdatePortfolioItemInput,
  ManagedService,
  ServiceListResponse,
  CreateManagedServiceInput,
  UpdateManagedServiceInput,
  ServiceUpdate,
  ServiceUpdateListResponse,
  CreateServiceUpdateInput,
  BillingListResponse,
} from "./types";

// Determine API URL based on environment
// In production (Railway), use the backend URL directly
// In development, use localhost
const getApiBaseUrl = () => {
  // Check if we're in the browser
  if (typeof window !== "undefined") {
    const hostname = window.location.hostname;
    // If on Railway production domain, use the production backend
    // Support both old (agenthive) and new (wishmaster) domain names during transition
    if (hostname === "wishmaster.up.railway.app" || hostname === "agenthive.up.railway.app") {
      return "https://agenthivebackend.up.railway.app";
    }
  }
  // Fallback to env var or localhost
  return process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";
};

const API_BASE_URL = getApiBaseUrl();

interface ApiOptions {
  method?: string;
  body?: unknown;
  token?: string;
}

async function api<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { method = "GET", body, token } = options;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ message: "Unknown error" }));
    throw new Error(error.error?.message || error.message || "API error");
  }

  return response.json();
}

// Auth
export async function getChallenge(walletAddress: string): Promise<ChallengeResponse> {
  return api<ChallengeResponse>("/api/auth/challenge", {
    method: "POST",
    body: { wallet_address: walletAddress },
  });
}

export async function verifySignature(
  walletAddress: string,
  message: string,
  signature: string,
  displayName?: string
): Promise<AuthResponse> {
  return api<AuthResponse>("/api/auth/verify", {
    method: "POST",
    body: { wallet_address: walletAddress, message, signature, display_name: displayName },
  });
}

// Jobs
export interface JobListParams {
  status?: string;
  task_type?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export async function listJobs(params?: JobListParams): Promise<JobListResponse> {
  const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : "";
  return api<JobListResponse>(`/api/jobs${query}`);
}

export async function listMyJobs(token: string, params?: JobListParams): Promise<JobListResponse> {
  const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : "";
  return api<JobListResponse>(`/api/jobs/mine${query}`, { token });
}

export async function getJob(id: string, token?: string): Promise<JobWithDetails> {
  return api<JobWithDetails>(`/api/jobs/${id}`, { token });
}

export async function getJobBids(jobId: string): Promise<BidListResponse> {
  return api<BidListResponse>(`/api/jobs/${jobId}/bids`);
}

export async function createJob(data: CreateJobInput, token: string): Promise<JobWithDetails> {
  return api<JobWithDetails>("/api/jobs", { method: "POST", body: data, token });
}

export interface PublishJobResponse {
  job_id: string;
  escrow_pda: string;
  transaction: string;
  amount_usdc: number;
}

export async function publishJob(id: string, token: string): Promise<PublishJobResponse> {
  return api<PublishJobResponse>(`/api/jobs/${id}/publish`, { method: "POST", token });
}

export async function selectBid(jobId: string, bidId: string, token: string): Promise<JobWithDetails> {
  return api<JobWithDetails>(`/api/jobs/${jobId}/select-bid`, {
    method: "POST",
    body: { bid_id: bidId },
    token,
  });
}

export interface ApproveJobResponse {
  completed: boolean;
  signature: string;
  agent_payout: number;
  platform_fee: number;
}

export async function approveJob(id: string, token: string): Promise<ApproveJobResponse> {
  return api<ApproveJobResponse>(`/api/jobs/${id}/approve`, { method: "POST", token });
}

export interface CancelJobResponse {
  cancelled: boolean;
  refund_signature?: string;
}

export async function cancelJob(id: string, token: string): Promise<CancelJobResponse> {
  return api<CancelJobResponse>(`/api/jobs/${id}/cancel`, { method: "POST", token });
}

export async function requestRevision(
  id: string,
  reason: string,
  details?: string,
  token?: string
): Promise<JobWithDetails> {
  return api<JobWithDetails>(`/api/jobs/${id}/revision`, {
    method: "POST",
    body: { reason, details },
    token,
  });
}

export interface DisputeJobResponse {
  disputed: boolean;
  message: string;
}

export async function disputeJob(
  id: string,
  reason: string,
  details: string,
  token: string
): Promise<DisputeJobResponse> {
  return api<DisputeJobResponse>(`/api/jobs/${id}/dispute`, {
    method: "POST",
    body: { reason, details },
    token,
  });
}

// Bids
export async function listBids(jobId: string, token?: string): Promise<BidListResponse> {
  return api<BidListResponse>(`/api/jobs/${jobId}/bids`, { token });
}

// Agents
export interface AgentListParams {
  skills?: string;
  trust_tier?: string;
  page?: number;
  limit?: number;
  search?: string;
}

export async function listAgents(params?: AgentListParams): Promise<AgentListResponse> {
  const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : "";
  return api<AgentListResponse>(`/api/agents${query}`);
}

export async function getAgent(id: string): Promise<AgentWithReputation> {
  return api<AgentWithReputation>(`/api/agents/${id}`);
}

// Escrow
export interface FundEscrowResponse {
  funded: boolean;
  escrow_pda: string;
  status: string;
}

export async function fundEscrow(
  jobId: string,
  signature: string,
  token: string
): Promise<FundEscrowResponse> {
  return api<FundEscrowResponse>(`/api/escrow/${jobId}/release`, {
    method: "POST",
    body: { signature },
    token,
  });
}

export async function getEscrow(jobId: string, token: string): Promise<EscrowDetails> {
  return api<EscrowDetails>(`/api/escrow/${jobId}`, { token });
}

// Dev-only: Fund escrow without real USDC (for testing)
export async function devFundEscrow(jobId: string, token: string): Promise<FundEscrowResponse> {
  return api<FundEscrowResponse>(`/api/escrow/${jobId}/dev-fund`, {
    method: "POST",
    token,
  });
}

// Confirm escrow funding with on-chain transaction hash
export interface ConfirmFundingResponse {
  confirmed: boolean;
  escrow_status: string;
}

export async function confirmEscrowFunding(
  jobId: string,
  txHash: string,
  token: string
): Promise<ConfirmFundingResponse> {
  return api<ConfirmFundingResponse>(`/api/escrow/${jobId}/confirm`, {
    method: "POST",
    body: { tx_hash: txHash },
    token,
  });
}

// Dev-only: Mark job as delivered (for testing)
export interface DevDeliverResponse {
  delivered: boolean;
  message: string;
}

export async function devDeliverJob(jobId: string): Promise<DevDeliverResponse> {
  return api<DevDeliverResponse>(`/api/jobs/${jobId}/dev-deliver`, {
    method: "POST",
  });
}

// Dev-only: Approve job bypassing escrow (for testing)
export interface DevApproveResponse {
  completed: boolean;
  dev_mode: boolean;
  signature: string;
  agent_payout: number;
  platform_fee: number;
  message: string;
}

export async function devApproveJob(jobId: string): Promise<DevApproveResponse> {
  return api<DevApproveResponse>(`/api/jobs/${jobId}/dev-approve`, {
    method: "POST",
  });
}

// User
export async function getCurrentUser(token: string): Promise<User> {
  return api<User>("/api/users/me", { token });
}

export interface UpdateUserInput {
  display_name?: string;
  email?: string;
  bio?: string;
  avatar_url?: string;
}

export async function updateUser(data: UpdateUserInput, token: string): Promise<User> {
  return api<User>("/api/users/me", { method: "PATCH", body: data, token });
}

// Stats
export async function getStats(): Promise<StatsResponse> {
  return api<StatsResponse>("/api/stats");
}

// Messages
export async function getMessages(jobId: string, token: string): Promise<MessageListResponse> {
  return api<MessageListResponse>(`/api/jobs/${jobId}/messages`, { token });
}

export async function sendMessage(jobId: string, content: string, token: string): Promise<Message> {
  return api<Message>(`/api/jobs/${jobId}/messages`, {
    method: "POST",
    body: { content },
    token,
  });
}

export interface MarkReadResponse {
  marked_count: number;
}

export async function markMessagesRead(jobId: string, token: string): Promise<MarkReadResponse> {
  return api<MarkReadResponse>(`/api/jobs/${jobId}/messages/read`, {
    method: "POST",
    token,
  });
}

// ==================== Requirements ====================

export async function getRequirements(jobId: string, token: string): Promise<RequirementListResponse> {
  return api<RequirementListResponse>(`/api/jobs/${jobId}/requirements`, { token });
}

export async function addRequirement(
  jobId: string,
  data: CreateRequirementInput,
  token: string
): Promise<Requirement> {
  return api<Requirement>(`/api/jobs/${jobId}/requirements`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function updateRequirement(
  id: string,
  data: UpdateRequirementInput,
  token: string
): Promise<Requirement> {
  return api<Requirement>(`/api/requirements/${id}`, {
    method: "PATCH",
    body: data,
    token,
  });
}

export async function deleteRequirement(id: string, token: string): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/api/requirements/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function deliverRequirement(id: string, token: string): Promise<Requirement> {
  return api<Requirement>(`/api/requirements/${id}/deliver`, {
    method: "POST",
    token,
  });
}

export async function acceptRequirement(id: string, token: string): Promise<Requirement> {
  return api<Requirement>(`/api/requirements/${id}/accept`, {
    method: "POST",
    token,
  });
}

export async function rejectRequirement(
  id: string,
  feedback: string,
  token: string
): Promise<Requirement> {
  return api<Requirement>(`/api/requirements/${id}/reject`, {
    method: "POST",
    body: { feedback },
    token,
  });
}

// ==================== Deliverables ====================

export async function getDeliverables(jobId: string, token: string): Promise<DeliverableListResponse> {
  return api<DeliverableListResponse>(`/api/jobs/${jobId}/deliverables`, { token });
}

export async function submitDeliverable(
  jobId: string,
  data: CreateDeliverableInput,
  token: string
): Promise<Deliverable> {
  return api<Deliverable>(`/api/jobs/${jobId}/deliverables`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function approveDeliverable(id: string, token: string): Promise<Deliverable> {
  return api<Deliverable>(`/api/deliverables/${id}/approve`, {
    method: "POST",
    token,
  });
}

export async function requestChanges(
  id: string,
  feedback: string,
  token: string
): Promise<Deliverable> {
  return api<Deliverable>(`/api/deliverables/${id}/request-changes`, {
    method: "POST",
    body: { feedback },
    token,
  });
}

// ==================== Activity ====================

export interface ActivityListParams {
  limit?: number;
  offset?: number;
  action?: string;
}

export async function getActivities(
  jobId: string,
  token: string,
  params?: ActivityListParams
): Promise<ActivityListResponse> {
  const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : "";
  return api<ActivityListResponse>(`/api/jobs/${jobId}/activity${query}`, { token });
}

// ==================== Portfolio ====================

export interface PortfolioListParams {
  category?: string;
  featured_only?: boolean;
  limit?: number;
  offset?: number;
}

export async function getAgentPortfolio(
  agentId: string,
  params?: PortfolioListParams
): Promise<PortfolioListResponse> {
  const query = params ? `?${new URLSearchParams(params as Record<string, string>).toString()}` : "";
  return api<PortfolioListResponse>(`/api/agents/${agentId}/portfolio${query}`);
}

export async function createPortfolioItem(
  data: CreatePortfolioItemInput,
  token: string
): Promise<PortfolioItem> {
  return api<PortfolioItem>("/api/portfolio", {
    method: "POST",
    body: data,
    token,
  });
}

export async function updatePortfolioItem(
  id: string,
  data: UpdatePortfolioItemInput,
  token: string
): Promise<PortfolioItem> {
  return api<PortfolioItem>(`/api/portfolio/${id}`, {
    method: "PATCH",
    body: data,
    token,
  });
}

export async function deletePortfolioItem(id: string, token: string): Promise<{ deleted: boolean }> {
  return api<{ deleted: boolean }>(`/api/portfolio/${id}`, {
    method: "DELETE",
    token,
  });
}

export async function createPortfolioFromJob(
  jobId: string,
  token: string
): Promise<{ created: boolean; item?: PortfolioItem }> {
  return api<{ created: boolean; item?: PortfolioItem }>(`/api/portfolio/from-job/${jobId}`, {
    method: "POST",
    token,
  });
}

// ==================== Managed Services ====================

export async function getServices(token: string): Promise<ServiceListResponse> {
  return api<ServiceListResponse>("/api/services", { token });
}

export async function getService(id: string, token: string): Promise<ManagedService> {
  return api<ManagedService>(`/api/services/${id}`, { token });
}

export async function convertToService(
  jobId: string,
  agentId: string,
  data: CreateManagedServiceInput,
  token: string
): Promise<ManagedService> {
  return api<ManagedService>(`/api/jobs/${jobId}/convert-to-service`, {
    method: "POST",
    body: { agent_id: agentId, ...data },
    token,
  });
}

export async function acceptService(id: string, token: string): Promise<ManagedService> {
  return api<ManagedService>(`/api/services/${id}/accept`, {
    method: "POST",
    token,
  });
}

export async function updateService(
  id: string,
  data: UpdateManagedServiceInput,
  token: string
): Promise<ManagedService> {
  return api<ManagedService>(`/api/services/${id}`, {
    method: "PATCH",
    body: data,
    token,
  });
}

export async function pauseService(id: string, token: string): Promise<ManagedService> {
  return api<ManagedService>(`/api/services/${id}/pause`, {
    method: "POST",
    token,
  });
}

export async function resumeService(id: string, token: string): Promise<ManagedService> {
  return api<ManagedService>(`/api/services/${id}/resume`, {
    method: "POST",
    token,
  });
}

export async function cancelService(id: string, token: string): Promise<ManagedService> {
  return api<ManagedService>(`/api/services/${id}/cancel`, {
    method: "POST",
    token,
  });
}

// ==================== Service Updates ====================

export async function getServiceUpdates(serviceId: string, token: string): Promise<ServiceUpdateListResponse> {
  return api<ServiceUpdateListResponse>(`/api/services/${serviceId}/updates`, { token });
}

export async function createServiceUpdate(
  serviceId: string,
  data: CreateServiceUpdateInput,
  token: string
): Promise<ServiceUpdate> {
  return api<ServiceUpdate>(`/api/services/${serviceId}/updates`, {
    method: "POST",
    body: data,
    token,
  });
}

export async function approveServiceUpdate(id: string, token: string): Promise<ServiceUpdate> {
  return api<ServiceUpdate>(`/api/service-updates/${id}/approve`, {
    method: "POST",
    token,
  });
}

export async function rejectServiceUpdate(
  id: string,
  feedback: string,
  token: string
): Promise<ServiceUpdate> {
  return api<ServiceUpdate>(`/api/service-updates/${id}/reject`, {
    method: "POST",
    body: { feedback },
    token,
  });
}

export async function deployServiceUpdate(id: string, token: string): Promise<ServiceUpdate> {
  return api<ServiceUpdate>(`/api/service-updates/${id}/deploy`, {
    method: "POST",
    token,
  });
}

// ==================== Service Billing ====================

export async function getServiceBilling(serviceId: string, token: string): Promise<BillingListResponse> {
  return api<BillingListResponse>(`/api/services/${serviceId}/billing`, { token });
}
