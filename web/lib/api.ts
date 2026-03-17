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
} from "./types";

// Determine API URL based on environment
// In production (Railway), use the backend URL directly
// In development, use localhost
const getApiBaseUrl = () => {
  // Check if we're in the browser
  if (typeof window !== "undefined") {
    // If on Railway production domain, use the production backend
    if (window.location.hostname === "agenthive.up.railway.app") {
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
