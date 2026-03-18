// Core types for AgentHive frontend

// User types
export interface User {
  id: string;
  wallet_address: string;
  display_name: string;
  email?: string;
  bio?: string;
  avatar_url?: string;
  company_name?: string;
  created_at: string;
  updated_at?: string;
}

// Agent types
export interface Agent {
  id: string;
  wallet_address: string;
  display_name: string;
  description: string;
  skills: string[];
  is_active: boolean;
  trust_tier: "new" | "rising" | "established" | "top_rated";
  last_seen_at?: string;
  created_at: string;
}

export interface AgentReputation {
  agent_id: string;
  avg_rating?: number;
  completed_jobs: number;
  success_rate: number;
  job_success_score: number;
  total_earned_usdc: number;
  avg_response_time?: number;
}

export interface AgentWithReputation {
  agent: Agent;
  reputation?: AgentReputation;
}

// Job types
export type JobStatus =
  | "draft"
  | "publishing"
  | "open"
  | "bidding"
  | "assigned"
  | "in_progress"
  | "delivered"
  | "approving"
  | "completed"
  | "cancelled"
  | "disputed"
  | "revision";

export type TaskType = "coding" | "research" | "content" | "data" | "other";
export type Complexity = "simple" | "moderate" | "complex";
export type Urgency = "standard" | "priority" | "critical";

export interface Job {
  id: string;
  client_id: string;
  agent_id?: string;
  title: string;
  description: string;
  task_type: TaskType;
  required_skills: string[];
  complexity: Complexity;
  budget_min: number;
  budget_max: number;
  final_price?: number;
  pricing_model: string;
  deadline?: string;
  bid_deadline?: string;
  urgency: Urgency;
  status: JobStatus;
  created_at: string;
  published_at?: string;
  started_at?: string;
  delivered_at?: string;
  completed_at?: string;
}

// JobWithDetails - matches backend's #[serde(flatten)] structure
// All Job fields are at the top level, not nested under "job"
export type JobWithDetails = Job & {
  client_name: string;
  agent_name?: string;
  bid_count: number;
};

// Bid types
export type BidStatus = "pending" | "accepted" | "rejected" | "withdrawn";

export interface Bid {
  id: string;
  job_id: string;
  agent_id: string;
  bid_amount: number;
  estimated_hours?: number;
  estimated_completion?: string;
  proposal: string;
  approach?: string;
  status: BidStatus;
  revision_count: number;
  created_at: string;
  updated_at?: string;
}

export interface BidWithAgent {
  bid: Bid;
  agent_name: string;
  agent_rating?: number;
  agent_completed_jobs?: number;
  agent_trust_tier: string;
}

// Escrow types
export type EscrowStatus =
  | "pending"
  | "funded"
  | "locked"
  | "releasing"
  | "released"
  | "refunding"
  | "refunded"
  | "disputed";

export interface EscrowDetails {
  id: string;
  job_id: string;
  escrow_pda: string;
  amount_usdc: number;
  status: EscrowStatus;
  client_wallet: string;
  agent_wallet?: string;
  created_at: string;
  funded_at?: string;
  released_at?: string;
}

// Rating types
export interface Rating {
  id: string;
  job_id: string;
  rater_type: "client" | "agent";
  rater_id: string;
  ratee_type: "client" | "agent";
  ratee_id: string;
  overall: number;
  dimension_1?: number;
  dimension_2?: number;
  dimension_3?: number;
  review_text?: string;
  is_public: boolean;
  created_at: string;
}

export interface RatingWithDetails {
  rating: Rating;
  job_title: string;
  rater_name: string;
}

// API response types
export interface JobListResponse {
  jobs: JobWithDetails[];
  total: number;
  page: number;
  limit: number;
}

export interface BidListResponse {
  bids: BidWithAgent[];
  total: number;
}

export interface AgentListResponse {
  agents: AgentWithReputation[];
  total: number;
  page: number;
  limit: number;
}

export interface RatingListResponse {
  ratings: RatingWithDetails[];
  total: number;
  average: number;
}

export interface StatsResponse {
  total_jobs: number;
  total_agents: number;
  online_agents: number;
  total_escrow: number;
  completion_rate: number;
}

// Auth types
export interface AuthResponse {
  token: string;
  user: User;
  is_new: boolean;
}

export interface ChallengeResponse {
  message: string;
  message_hash: string;
}

// Form input types
export interface CreateJobInput {
  title: string;
  description: string;
  task_type: TaskType;
  required_skills: string[];
  complexity?: Complexity;
  budget_min: number;
  budget_max: number;
  deadline?: string;
  bid_deadline?: string;
  urgency?: Urgency;
}

export interface SubmitBidInput {
  bid_amount: number;
  estimated_hours?: number;
  estimated_completion?: string;
  proposal: string;
  approach?: string;
}

export interface SubmitRatingInput {
  overall: number;
  dimension_1?: number;
  dimension_2?: number;
  dimension_3?: number;
  review_text?: string;
  is_public?: boolean;
}
