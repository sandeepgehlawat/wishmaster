import { describe, it, expect } from 'vitest';
import { http, HttpResponse } from 'msw';
import { registerAgent, registerAgentWithNewWallet } from '../src/registration';
import { ValidationError, ApiError, NetworkError } from '../src/errors';
import { server, BASE_URL } from './setup';

describe('Registration', () => {
  describe('registerAgent', () => {
    it('should register agent with valid wallet address', async () => {
      const response = await registerAgent({
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        displayName: 'TestAgent',
        skills: ['rust', 'typescript'],
      });

      expect(response).toBeDefined();
      expect(response.agent).toBeDefined();
      expect(response.apiKey).toBeDefined();
      expect(response.apiKey).toContain('ahk_');
      expect(response.agent.walletAddress).toBe('0x1234567890abcdef1234567890abcdef12345678');
      expect(response.agent.displayName).toBe('TestAgent');
      expect(response.agent.skills).toEqual(['rust', 'typescript']);
    });

    it('should register agent with description and hourly rate', async () => {
      const response = await registerAgent({
        walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
        displayName: 'TestAgent',
        description: 'A test agent for building APIs',
        skills: ['rust', 'api'],
        hourlyRate: 100,
      });

      expect(response.agent.description).toBe('A test agent for building APIs');
      expect(response.agent.hourlyRate).toBe(100);
    });

    it('should throw ValidationError for invalid wallet address format', async () => {
      await expect(
        registerAgent({
          walletAddress: 'invalid-address',
          displayName: 'TestAgent',
          skills: ['rust'],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty wallet address', async () => {
      await expect(
        registerAgent({
          walletAddress: '',
          displayName: 'TestAgent',
          skills: ['rust'],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for wallet address without 0x prefix', async () => {
      await expect(
        registerAgent({
          walletAddress: '1234567890abcdef1234567890abcdef12345678',
          displayName: 'TestAgent',
          skills: ['rust'],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for wallet address with wrong length', async () => {
      await expect(
        registerAgent({
          walletAddress: '0x123456',
          displayName: 'TestAgent',
          skills: ['rust'],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for short display name', async () => {
      await expect(
        registerAgent({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          displayName: 'A',
          skills: ['rust'],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty display name', async () => {
      await expect(
        registerAgent({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          displayName: '',
          skills: ['rust'],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty skills array', async () => {
      await expect(
        registerAgent({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          displayName: 'TestAgent',
          skills: [],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for undefined skills', async () => {
      await expect(
        registerAgent({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          displayName: 'TestAgent',
          skills: undefined as unknown as string[],
        })
      ).rejects.toThrow(ValidationError);
    });

    it('should allow custom base URL', async () => {
      server.use(
        http.post('https://custom.api.com/api/agents/register', async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          return HttpResponse.json({
            id: 'agent_custom',
            wallet_address: body.wallet_address,
            display_name: body.display_name,
            skills: body.skills,
            trust_tier: 'new',
            reputation_score: 0,
            total_jobs_completed: 0,
            is_active: true,
            created_at: new Date().toISOString(),
            api_key: 'ahk_custom_key',
          });
        })
      );

      const response = await registerAgent(
        {
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          displayName: 'TestAgent',
          skills: ['rust'],
        },
        'https://custom.api.com'
      );

      expect(response.apiKey).toBe('ahk_custom_key');
    });

    it('should throw ApiError for server errors', async () => {
      server.use(
        http.post(`${BASE_URL}/api/agents/register`, () => {
          return HttpResponse.json(
            { error: 'server_error', message: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      await expect(
        registerAgent({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          displayName: 'TestAgent',
          skills: ['rust'],
        })
      ).rejects.toThrow(ApiError);
    });

    it('should throw NetworkError for network failures', async () => {
      server.use(
        http.post(`${BASE_URL}/api/agents/register`, () => {
          return HttpResponse.error();
        })
      );

      await expect(
        registerAgent({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          displayName: 'TestAgent',
          skills: ['rust'],
        })
      ).rejects.toThrow(NetworkError);
    });

    it('should handle conflict error for duplicate wallet', async () => {
      server.use(
        http.post(`${BASE_URL}/api/agents/register`, () => {
          return HttpResponse.json(
            { error: 'conflict', message: 'Wallet already registered' },
            { status: 409 }
          );
        })
      );

      try {
        await registerAgent({
          walletAddress: '0x1234567890abcdef1234567890abcdef12345678',
          displayName: 'TestAgent',
          skills: ['rust'],
        });
        expect.fail('Should have thrown');
      } catch (error) {
        expect(error).toBeInstanceOf(ApiError);
        expect((error as ApiError).statusCode).toBe(409);
        expect((error as ApiError).message).toBe('Wallet already registered');
      }
    });
  });

  describe('registerAgentWithNewWallet', () => {
    it('should register agent and generate wallet', async () => {
      const response = await registerAgentWithNewWallet(
        'TestAgent',
        'A test agent description',
        ['rust', 'solidity']
      );

      expect(response).toBeDefined();
      expect(response.agent).toBeDefined();
      expect(response.apiKey).toBeDefined();
      expect(response.wallet).toBeDefined();
      expect(response.wallet?.address).toBeDefined();
      expect(response.wallet?.privateKey).toBeDefined();
      expect(response.wallet?.privateKey).toContain('0x');
    });

    it('should register agent with hourly rate', async () => {
      const response = await registerAgentWithNewWallet(
        'TestAgent',
        'Description',
        ['rust'],
        150
      );

      expect(response.agent.hourlyRate).toBe(150);
    });

    it('should register agent with undefined description', async () => {
      const response = await registerAgentWithNewWallet(
        'TestAgent',
        undefined,
        ['rust']
      );

      expect(response).toBeDefined();
      expect(response.agent).toBeDefined();
    });

    it('should throw ValidationError for short display name', async () => {
      await expect(
        registerAgentWithNewWallet('A', 'Description', ['rust'])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty display name', async () => {
      await expect(
        registerAgentWithNewWallet('', 'Description', ['rust'])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for empty skills array', async () => {
      await expect(
        registerAgentWithNewWallet('TestAgent', 'Description', [])
      ).rejects.toThrow(ValidationError);
    });

    it('should throw ValidationError for undefined skills', async () => {
      await expect(
        registerAgentWithNewWallet('TestAgent', 'Description', undefined as unknown as string[])
      ).rejects.toThrow(ValidationError);
    });

    it('should allow custom base URL', async () => {
      server.use(
        http.post('https://custom.api.com/api/agents/register-with-wallet', async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          return HttpResponse.json({
            id: 'agent_custom',
            wallet_address: '0xCustomGeneratedWallet1234567890abcdef12345',
            display_name: body.display_name,
            skills: body.skills,
            trust_tier: 'new',
            reputation_score: 0,
            total_jobs_completed: 0,
            is_active: true,
            created_at: new Date().toISOString(),
            api_key: 'ahk_custom_wallet_key',
            wallet: {
              address: '0xCustomGeneratedWallet1234567890abcdef12345',
              private_key: '0xcustomprivatekey',
            },
          });
        })
      );

      const response = await registerAgentWithNewWallet(
        'TestAgent',
        'Description',
        ['rust'],
        undefined,
        'https://custom.api.com'
      );

      expect(response.apiKey).toBe('ahk_custom_wallet_key');
      expect(response.wallet?.privateKey).toBe('0xcustomprivatekey');
    });

    it('should throw ApiError for server errors', async () => {
      server.use(
        http.post(`${BASE_URL}/api/agents/register-with-wallet`, () => {
          return HttpResponse.json(
            { error: 'server_error', message: 'Internal server error' },
            { status: 500 }
          );
        })
      );

      await expect(
        registerAgentWithNewWallet('TestAgent', 'Description', ['rust'])
      ).rejects.toThrow(ApiError);
    });

    it('should throw NetworkError for network failures', async () => {
      server.use(
        http.post(`${BASE_URL}/api/agents/register-with-wallet`, () => {
          return HttpResponse.error();
        })
      );

      await expect(
        registerAgentWithNewWallet('TestAgent', 'Description', ['rust'])
      ).rejects.toThrow(NetworkError);
    });

    it('should handle response without wallet field', async () => {
      server.use(
        http.post(`${BASE_URL}/api/agents/register-with-wallet`, async ({ request }) => {
          const body = await request.json() as Record<string, unknown>;
          return HttpResponse.json({
            id: 'agent_no_wallet',
            wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
            display_name: body.display_name,
            skills: body.skills,
            trust_tier: 'new',
            reputation_score: 0,
            total_jobs_completed: 0,
            is_active: true,
            created_at: new Date().toISOString(),
            api_key: 'ahk_no_wallet_key',
            // wallet field intentionally omitted
          });
        })
      );

      const response = await registerAgentWithNewWallet(
        'TestAgent',
        'Description',
        ['rust']
      );

      expect(response.apiKey).toBe('ahk_no_wallet_key');
      expect(response.wallet).toBeUndefined();
    });
  });

  describe('challenge and verification flow', () => {
    // Mock endpoints for challenge/verify flow (simulating wallet signature auth)
    it('should request authentication challenge', async () => {
      server.use(
        http.post(`${BASE_URL}/api/auth/challenge`, async ({ request }) => {
          const body = await request.json() as { wallet_address: string };
          return HttpResponse.json({
            challenge: 'Sign this message to authenticate: abc123',
            nonce: 'abc123',
            expires_at: new Date(Date.now() + 300000).toISOString(),
          });
        })
      );

      const response = await fetch(`${BASE_URL}/api/auth/challenge`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wallet_address: '0x1234567890abcdef1234567890abcdef12345678' }),
      });

      const data = await response.json() as { challenge: string; nonce: string; expires_at: string };
      expect(data.challenge).toContain('Sign this message');
      expect(data.nonce).toBe('abc123');
    });

    it('should verify signature and return token', async () => {
      server.use(
        http.post(`${BASE_URL}/api/auth/verify`, async ({ request }) => {
          const body = await request.json() as {
            wallet_address: string;
            signature: string;
            nonce: string;
          };

          if (body.signature === 'valid_signature' && body.nonce === 'abc123') {
            return HttpResponse.json({
              access_token: 'jwt_access_token_12345',
              refresh_token: 'jwt_refresh_token_67890',
              expires_in: 3600,
              token_type: 'Bearer',
            });
          }

          return HttpResponse.json(
            { error: 'invalid_signature', message: 'Signature verification failed' },
            { status: 401 }
          );
        })
      );

      // Test valid signature
      const validResponse = await fetch(`${BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
          signature: 'valid_signature',
          nonce: 'abc123',
        }),
      });

      const validData = await validResponse.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        token_type: string;
      };
      expect(validResponse.status).toBe(200);
      expect(validData.access_token).toBe('jwt_access_token_12345');
      expect(validData.refresh_token).toBe('jwt_refresh_token_67890');
      expect(validData.token_type).toBe('Bearer');

      // Test invalid signature
      const invalidResponse = await fetch(`${BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
          signature: 'invalid_signature',
          nonce: 'abc123',
        }),
      });

      expect(invalidResponse.status).toBe(401);
    });

    it('should refresh token', async () => {
      server.use(
        http.post(`${BASE_URL}/api/auth/refresh`, async ({ request }) => {
          const body = await request.json() as { refresh_token: string };

          if (body.refresh_token === 'valid_refresh_token') {
            return HttpResponse.json({
              access_token: 'jwt_new_access_token_12345',
              refresh_token: 'jwt_new_refresh_token_67890',
              expires_in: 3600,
              token_type: 'Bearer',
            });
          }

          return HttpResponse.json(
            { error: 'invalid_token', message: 'Invalid or expired refresh token' },
            { status: 401 }
          );
        })
      );

      // Test valid refresh
      const validResponse = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: 'valid_refresh_token',
        }),
      });

      const validData = await validResponse.json() as {
        access_token: string;
        refresh_token: string;
        expires_in: number;
        token_type: string;
      };
      expect(validResponse.status).toBe(200);
      expect(validData.access_token).toBe('jwt_new_access_token_12345');

      // Test invalid refresh token
      const invalidResponse = await fetch(`${BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          refresh_token: 'invalid_refresh_token',
        }),
      });

      expect(invalidResponse.status).toBe(401);
    });

    it('should handle expired challenge', async () => {
      server.use(
        http.post(`${BASE_URL}/api/auth/verify`, async ({ request }) => {
          const body = await request.json() as { nonce: string };

          if (body.nonce === 'expired_nonce') {
            return HttpResponse.json(
              { error: 'expired_challenge', message: 'Challenge has expired' },
              { status: 400 }
            );
          }

          return HttpResponse.json(
            { error: 'invalid_signature' },
            { status: 401 }
          );
        })
      );

      const response = await fetch(`${BASE_URL}/api/auth/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          wallet_address: '0x1234567890abcdef1234567890abcdef12345678',
          signature: 'some_signature',
          nonce: 'expired_nonce',
        }),
      });

      expect(response.status).toBe(400);
      const data = await response.json() as { error: string; message: string };
      expect(data.error).toBe('expired_challenge');
    });
  });
});
