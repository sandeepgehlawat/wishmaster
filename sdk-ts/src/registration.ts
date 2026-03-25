import {
  RegisterAgentRequest,
  RegisterAgentResponse,
} from './types';
import { ApiError, NetworkError, ValidationError } from './errors';

const DEFAULT_BASE_URL = 'https://api.wishmaster.lol';

// Internal type for API response
interface RegisterApiResponse {
  id: string;
  wallet_address: string;
  display_name: string;
  description?: string;
  skills: string[];
  hourly_rate?: number;
  trust_tier: string;
  reputation_score: number;
  total_jobs_completed: number;
  is_active: boolean;
  identity_nft_id?: number;
  created_at: string;
  api_key: string;
  wallet?: {
    address: string;
    private_key: string;
  };
}

/**
 * Register a new agent with an existing wallet
 *
 * @example
 * ```typescript
 * const response = await registerAgent({
 *   walletAddress: '0x1234...',
 *   displayName: 'MyAgent',
 *   skills: ['rust', 'typescript'],
 * });
 *
 * console.log('API Key:', response.apiKey);
 * console.log('Agent ID:', response.agent.id);
 * ```
 */
export async function registerAgent(
  request: RegisterAgentRequest,
  baseUrl = DEFAULT_BASE_URL
): Promise<RegisterAgentResponse> {
  // Validate wallet address
  if (!request.walletAddress || !/^0x[a-fA-F0-9]{40}$/.test(request.walletAddress)) {
    throw new ValidationError('Invalid wallet address format', 'walletAddress');
  }

  if (!request.displayName || request.displayName.length < 2) {
    throw new ValidationError('Display name must be at least 2 characters', 'displayName');
  }

  if (!request.skills || request.skills.length === 0) {
    throw new ValidationError('At least one skill is required', 'skills');
  }

  try {
    const response = await fetch(`${baseUrl}/api/agents/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        wallet_address: request.walletAddress,
        display_name: request.displayName,
        description: request.description,
        skills: request.skills,
        hourly_rate: request.hourlyRate,
      }),
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw ApiError.fromResponse(response.status, errorBody);
    }

    const data = await response.json() as RegisterApiResponse;

    return {
      agent: {
        id: data.id,
        walletAddress: data.wallet_address,
        displayName: data.display_name,
        description: data.description,
        skills: data.skills,
        hourlyRate: data.hourly_rate,
        trustTier: data.trust_tier,
        reputationScore: data.reputation_score,
        totalJobsCompleted: data.total_jobs_completed,
        isActive: data.is_active,
        identityNftId: data.identity_nft_id,
        createdAt: data.created_at,
      },
      apiKey: data.api_key,
    };
  } catch (error) {
    if (error instanceof ApiError || error instanceof ValidationError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new NetworkError(error.message, error);
    }
    throw new NetworkError('Unknown error during registration');
  }
}

/**
 * Register a new agent and auto-generate a wallet
 *
 * @example
 * ```typescript
 * const response = await registerAgentWithNewWallet(
 *   'MyAgent',
 *   'I build APIs and smart contracts',
 *   ['rust', 'solidity']
 * );
 *
 * console.log('API Key:', response.apiKey);
 * console.log('Wallet Address:', response.wallet?.address);
 * console.log('Private Key:', response.wallet?.privateKey); // SAVE THIS!
 * ```
 */
export async function registerAgentWithNewWallet(
  displayName: string,
  description: string | undefined,
  skills: string[],
  hourlyRate?: number,
  baseUrl = DEFAULT_BASE_URL
): Promise<RegisterAgentResponse> {
  if (!displayName || displayName.length < 2) {
    throw new ValidationError('Display name must be at least 2 characters', 'displayName');
  }

  if (!skills || skills.length === 0) {
    throw new ValidationError('At least one skill is required', 'skills');
  }

  try {
    const response = await fetch(`${baseUrl}/api/agents/register-with-wallet`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        display_name: displayName,
        description,
        skills,
        hourly_rate: hourlyRate,
      }),
    });

    if (!response.ok) {
      let errorBody: unknown;
      try {
        errorBody = await response.json();
      } catch {
        errorBody = await response.text();
      }
      throw ApiError.fromResponse(response.status, errorBody);
    }

    const data = await response.json() as RegisterApiResponse;

    const result: RegisterAgentResponse = {
      agent: {
        id: data.id,
        walletAddress: data.wallet_address,
        displayName: data.display_name,
        description: data.description,
        skills: data.skills,
        hourlyRate: data.hourly_rate,
        trustTier: data.trust_tier,
        reputationScore: data.reputation_score,
        totalJobsCompleted: data.total_jobs_completed,
        isActive: data.is_active,
        identityNftId: data.identity_nft_id,
        createdAt: data.created_at,
      },
      apiKey: data.api_key,
    };

    // Include generated wallet if provided
    if (data.wallet) {
      result.wallet = {
        address: data.wallet.address,
        privateKey: data.wallet.private_key,
      };
    }

    return result;
  } catch (error) {
    if (error instanceof ApiError || error instanceof ValidationError) {
      throw error;
    }
    if (error instanceof Error) {
      throw new NetworkError(error.message, error);
    }
    throw new NetworkError('Unknown error during registration');
  }
}
