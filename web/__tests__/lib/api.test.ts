import { describe, it, expect, beforeEach } from 'vitest';
import { server } from '../setup';
import { createErrorHandler } from '../mocks/handlers';
import {
  getChallenge,
  verifySignature,
  getCurrentUser,
  getStats,
  listJobs,
  getJob,
  listAgents,
  getAgent,
  getMessages,
  sendMessage,
} from '@/lib/api';

describe('API Client', () => {
  describe('Auth endpoints', () => {
    it('should get authentication challenge', async () => {
      const result = await getChallenge('0x1234567890abcdef1234567890abcdef12345678');

      expect(result).toHaveProperty('message');
      expect(result).toHaveProperty('message_hash');
      expect(result.message).toContain('Sign this message');
    });

    it('should verify signature and return token', async () => {
      const result = await verifySignature(
        '0x1234567890abcdef1234567890abcdef12345678',
        'test message',
        '0xsignature'
      );

      expect(result).toHaveProperty('token');
      expect(result).toHaveProperty('user');
      expect(result.token).toBe('mock-jwt-token-12345');
    });
  });

  describe('User endpoints', () => {
    it('should get current user', async () => {
      const result = await getCurrentUser('mock-token');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('wallet_address');
      expect(result).toHaveProperty('display_name');
    });
  });

  describe('Stats endpoint', () => {
    it('should get platform stats', async () => {
      const result = await getStats();

      expect(result).toHaveProperty('total_jobs');
      expect(result).toHaveProperty('total_agents');
      expect(result).toHaveProperty('online_agents');
      expect(result).toHaveProperty('total_escrow');
      expect(result).toHaveProperty('completion_rate');
    });
  });

  describe('Jobs endpoints', () => {
    it('should list jobs', async () => {
      const result = await listJobs();

      expect(result).toHaveProperty('jobs');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.jobs)).toBe(true);
    });

    it('should get a specific job', async () => {
      const result = await getJob('job-1');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('title');
      expect(result).toHaveProperty('status');
    });
  });

  describe('Agents endpoints', () => {
    it('should list agents', async () => {
      const result = await listAgents();

      expect(result).toHaveProperty('agents');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.agents)).toBe(true);
    });

    it('should get a specific agent', async () => {
      const result = await getAgent('agent-1');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('display_name');
      expect(result).toHaveProperty('skills');
      expect(result).toHaveProperty('reputation');
    });
  });

  describe('Messages endpoints', () => {
    it('should get messages for a job', async () => {
      const result = await getMessages('job-1', 'mock-token');

      expect(result).toHaveProperty('messages');
      expect(result).toHaveProperty('total');
      expect(Array.isArray(result.messages)).toBe(true);
    });

    it('should send a message', async () => {
      const result = await sendMessage('job-1', 'Hello world', 'mock-token');

      expect(result).toHaveProperty('id');
      expect(result).toHaveProperty('content');
      expect(result.content).toBe('Hello world');
    });
  });

  describe('Error handling', () => {
    it('should throw on API error', async () => {
      server.use(
        createErrorHandler('get', '/api/jobs/invalid', 'Job not found', 404)
      );

      await expect(getJob('invalid')).rejects.toThrow('Job not found');
    });
  });
});
