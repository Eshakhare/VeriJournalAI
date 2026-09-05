import { describe, it, expect, vi } from 'vitest';
import { VeriJournalApiClient, generateIdempotencyKey } from '../../src/services/apiClient';

describe('VeriJournalApiClient Unit & Security Verification', () => {
  it('generates a valid formatted idempotency key with minimum 16 characters', () => {
    const key = generateIdempotencyKey();
    expect(typeof key).toBe('string');
    expect(key.length).toBeGreaterThanOrEqual(16);
    expect(key).toMatch(/^idemp_/);
  });

  it('correctly initializes with token provider and expiry callback', () => {
    const getToken = vi.fn().mockResolvedValue('test_token_123');
    const onAuthExpired = vi.fn();
    const client = new VeriJournalApiClient(getToken, onAuthExpired);

    expect(client).toBeDefined();
  });

  it('submits verification using dev mock adapter when in mock mode', async () => {
    const getToken = vi.fn().mockResolvedValue('mock_token');
    const client = new VeriJournalApiClient(getToken);

    const result = await client.submitTextVerification({
      text: 'Sample test claim for automated verification test suite.',
      initialConfidence: 75,
      initialReflection: 'Testing confidence baseline',
    });

    expect(result).toBeDefined();
    expect(result.contractVersion).toBe('1.0');
    expect(result.operationId).toMatch(/^op_/);
    expect(result.status).toBe('queued');
    expect(result.statusUrl).toContain(result.operationId);
  });

  it('retrieves operation status via mock adapter', async () => {
    const getToken = vi.fn().mockResolvedValue('mock_token');
    const client = new VeriJournalApiClient(getToken);

    const createRes = await client.submitUrlVerification({
      url: 'https://reuters.com/factcheck/sample-automated-test-article',
      initialConfidence: 80,
    });

    const op = await client.getOperation(createRes.operationId);
    expect(op.status).toBe(200);
    expect(op.data).toBeDefined();
    expect(op.data?.contractVersion).toBe('1.0');
    expect(op.data?.operationId).toBe(createRes.operationId);
  });
});
