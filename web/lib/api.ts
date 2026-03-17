const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

interface ApiOptions {
  method?: string;
  body?: any;
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
export async function getChallenge(walletAddress: string) {
  return api<{ message: string; message_hash: string }>("/api/auth/challenge", {
    method: "POST",
    body: { wallet_address: walletAddress },
  });
}

export async function verifySignature(
  walletAddress: string,
  message: string,
  signature: string,
  displayName?: string
) {
  return api<{ token: string; user: any; is_new: boolean }>("/api/auth/verify", {
    method: "POST",
    body: { wallet_address: walletAddress, message, signature, display_name: displayName },
  });
}

// Jobs
export async function listJobs(params?: Record<string, any>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return api<{ jobs: any[]; total: number }>(`/api/jobs${query}`);
}

export async function getJob(id: string, token?: string) {
  return api<any>(`/api/jobs/${id}`, { token });
}

export async function createJob(data: any, token: string) {
  return api<any>("/api/jobs", { method: "POST", body: data, token });
}

export async function publishJob(id: string, token: string) {
  return api<any>(`/api/jobs/${id}/publish`, { method: "POST", token });
}

export async function selectBid(jobId: string, bidId: string, token: string) {
  return api<any>(`/api/jobs/${jobId}/select-bid`, {
    method: "POST",
    body: { bid_id: bidId },
    token,
  });
}

export async function approveJob(id: string, token: string) {
  return api<any>(`/api/jobs/${id}/approve`, { method: "POST", token });
}

// Bids
export async function listBids(jobId: string, token?: string) {
  return api<{ bids: any[]; total: number }>(`/api/jobs/${jobId}/bids`, { token });
}

// Agents
export async function listAgents(params?: Record<string, any>) {
  const query = params ? `?${new URLSearchParams(params).toString()}` : "";
  return api<{ agents: any[]; total: number }>(`/api/agents${query}`);
}

export async function getAgent(id: string) {
  return api<any>(`/api/agents/${id}`);
}

// Escrow
export async function fundEscrow(jobId: string, signature: string, token: string) {
  return api<any>(`/api/escrow/${jobId}/release`, {
    method: "POST",
    body: { signature },
    token,
  });
}

// User
export async function getCurrentUser(token: string) {
  return api<any>("/api/users/me", { token });
}

export async function updateUser(data: any, token: string) {
  return api<any>("/api/users/me", { method: "PATCH", body: data, token });
}

// Stats
export async function getStats() {
  return api<{
    total_jobs: number;
    total_agents: number;
    online_agents: number;
    total_escrow: number;
    completion_rate: number;
  }>("/api/stats");
}
