import { describe, it, expect } from 'vitest';
import operationStates from '../../../contracts/operation-states.json';
import errorCodes from '../../../contracts/error-codes.json';
import featureFlags from '../../../contracts/feature-flags.json';

describe('Canonical Contract Specification Verification', () => {
  it('enforces contract version 1.0 across all contract artifacts', () => {
    expect(operationStates.contractVersion).toBe('1.0');
    expect(errorCodes.contractVersion).toBe('1.0');
    expect(featureFlags.contractVersion).toBe('1.0');
  });

  it('defines the required 9 asynchronous verification stages', () => {
    const requiredStages = [
      'validating_input',
      'checking_url',
      'extracting_content',
      'extracting_claims',
      'checking_fact_checks',
      'retrieving_evidence',
      'analyzing_media',
      'building_timeline',
      'saving_report',
    ];

    for (const stage of requiredStages) {
      expect(operationStates.stages).toContain(stage);
    }
  });

  it('guarantees terminal states are strictly defined', () => {
    expect(operationStates.terminalStates).toEqual(['partial', 'complete', 'failed', 'cancelled']);
  });

  it('verifies essential error codes and HTTP mappings', () => {
    const errorMap = new Map(errorCodes.errors.map((e) => [e.code, e]));

    // Critical security and auth codes
    expect(errorMap.get('AUTH_REQUIRED')?.httpStatus).toBe(401);
    expect(errorMap.get('AUTH_REQUIRED')?.retryable).toBe(false);

    expect(errorMap.get('ACCESS_DENIED')?.httpStatus).toBe(403);
    expect(errorMap.get('ACCESS_DENIED')?.retryable).toBe(false);

    // Operational resilience codes
    expect(errorMap.get('RATE_LIMITED')?.httpStatus).toBe(429);
    expect(errorMap.get('RATE_LIMITED')?.retryable).toBe(true);

    expect(errorMap.get('OPERATION_NOT_FOUND')?.httpStatus).toBe(404);
  });

  it('validates contract polling rules', () => {
    expect(operationStates.rules.progressIsElapsedTimeEstimate).toBe(false);
    expect(operationStates.rules.preliminaryTruthVerdictsAllowed).toBe(false);
    expect(operationStates.rules.partialResultsMustBeValidated).toBe(true);
    expect(operationStates.rules.pollingHonorsRetryAfter).toBe(true);
  });
});
