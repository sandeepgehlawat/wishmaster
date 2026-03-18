// Core types for WishMaster frontend

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

// BidWithAgent has flattened Bid fields (backend uses #[serde(flatten)])
export interface BidWithAgent {
  // Bid fields (flattened)
  id: string;
  job_id: string;
  agent_id: string;
  bid_amount: string; // Decimal from backend
  estimated_hours?: string;
  estimated_completion?: string;
  proposal: string;
  approach?: string;
  status: string;
  revision_count: number;
  created_at: string;
  updated_at?: string;
  // Agent fields
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

// Message types
export interface Message {
  id: string;
  job_id: string;
  sender_id: string;
  sender_type: "client" | "agent";
  sender_name: string;
  content: string;
  created_at: string;
  read_at?: string;
}

export interface MessageListResponse {
  messages: Message[];
  total: number;
}

// ==================== Requirements ====================

export type RequirementPriority = 'must_have' | 'should_have' | 'nice_to_have';
export type RequirementStatus = 'pending' | 'in_progress' | 'delivered' | 'accepted' | 'rejected';

export interface Requirement {
  id: string;
  job_id: string;
  created_by: string;
  title: string;
  description?: string;
  acceptance_criteria?: string;
  priority: RequirementPriority;
  status: RequirementStatus;
  rejection_feedback?: string;
  position: number;
  created_at: string;
  updated_at: string;
  accepted_at?: string;
}

export interface CreateRequirementInput {
  title: string;
  description?: string;
  acceptance_criteria?: string;
  priority?: RequirementPriority;
  position?: number;
}

export interface UpdateRequirementInput {
  title?: string;
  description?: string;
  acceptance_criteria?: string;
  priority?: RequirementPriority;
  status?: RequirementStatus;
  position?: number;
}

export interface RequirementListResponse {
  requirements: Requirement[];
  total: number;
  completed: number;
}

// ==================== Deliverables ====================

export type DeliverableStatus = 'pending_review' | 'approved' | 'changes_requested';

export interface Deliverable {
  id: string;
  job_id: string;
  requirement_id?: string;
  agent_id: string;
  title: string;
  description?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
  status: DeliverableStatus;
  client_feedback?: string;
  version: number;
  parent_id?: string;
  created_at: string;
  reviewed_at?: string;
  // Joined fields
  requirement_title?: string;
  agent_name: string;
}

export interface CreateDeliverableInput {
  requirement_id?: string;
  title: string;
  description?: string;
  file_url?: string;
  file_name?: string;
  file_size?: number;
  mime_type?: string;
}

export interface DeliverableListResponse {
  deliverables: Deliverable[];
  total: number;
  pending_review: number;
}

// ==================== Activity ====================

export type ActivityActorType = 'client' | 'agent' | 'system';

export interface Activity {
  id: string;
  job_id: string;
  actor_id: string;
  actor_type: ActivityActorType;
  action: string;
  details: Record<string, unknown>;
  created_at: string;
  actor_name: string;
}

export interface ActivityListResponse {
  activities: Activity[];
  total: number;
}

// ==================== Portfolio ====================

export interface PortfolioItem {
  id: string;
  agent_id: string;
  job_id?: string;
  title: string;
  description?: string;
  category?: string;
  thumbnail_url?: string;
  demo_url?: string;
  github_url?: string;
  client_testimonial?: string;
  client_rating?: number;
  is_featured: boolean;
  created_at: string;
  updated_at: string;
}

export interface CreatePortfolioItemInput {
  job_id?: string;
  title: string;
  description?: string;
  category?: string;
  thumbnail_url?: string;
  demo_url?: string;
  github_url?: string;
  is_featured?: boolean;
}

export interface UpdatePortfolioItemInput {
  title?: string;
  description?: string;
  category?: string;
  thumbnail_url?: string;
  demo_url?: string;
  github_url?: string;
  is_featured?: boolean;
}

export interface PortfolioListResponse {
  items: PortfolioItem[];
  total: number;
}

// ==================== Managed Services ====================

export type ServiceStatus = 'pending' | 'active' | 'paused' | 'cancelled';
export type UpdateChangeType = 'feature' | 'fix' | 'upgrade' | 'security' | 'other';
export type UpdateStatus = 'pending' | 'approved' | 'rejected' | 'deployed';
export type BillingStatus = 'pending' | 'paid' | 'failed' | 'refunded';

export interface ManagedService {
  id: string;
  original_job_id: string;
  client_id: string;
  agent_id: string;
  name: string;
  description?: string;
  monthly_rate_usd: number;
  status: ServiceStatus;
  started_at?: string;
  next_billing_at?: string;
  paused_at?: string;
  cancelled_at?: string;
  created_at: string;
  updated_at: string;
  // Joined fields
  client_name?: string;
  agent_name?: string;
  job_title?: string;
}

export interface CreateManagedServiceInput {
  name: string;
  description?: string;
  monthly_rate_usd: number;
}

export interface UpdateManagedServiceInput {
  name?: string;
  description?: string;
  monthly_rate_usd?: number;
}

export interface ServiceListResponse {
  services: ManagedService[];
  total: number;
}

export interface ServiceUpdate {
  id: string;
  service_id: string;
  agent_id: string;
  title: string;
  description?: string;
  change_type?: UpdateChangeType;
  status: UpdateStatus;
  file_url?: string;
  file_name?: string;
  client_feedback?: string;
  created_at: string;
  reviewed_at?: string;
  deployed_at?: string;
}

export interface CreateServiceUpdateInput {
  title: string;
  description?: string;
  change_type?: UpdateChangeType;
  file_url?: string;
  file_name?: string;
}

export interface ServiceUpdateListResponse {
  updates: ServiceUpdate[];
  total: number;
  pending: number;
}

export interface ServiceBilling {
  id: string;
  service_id: string;
  period_start: string;
  period_end: string;
  amount_usd: number;
  status: BillingStatus;
  escrow_pda?: string;
  payment_tx?: string;
  paid_at?: string;
  created_at: string;
}

export interface BillingListResponse {
  records: ServiceBilling[];
  total: number;
  total_paid_usd: number;
}
