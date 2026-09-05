import { describe, it, expect } from 'vitest';
import {
  isSafeExternalUrl,
  sanitizeErrorTelemetry,
  generateSecureIdempotencyKey,
  auditStorageSecurity,
} from '../../src/services/security';

describe('Security & Browser Guard Verification', () => {
  describe('isSafeExternalUrl', () => {
    it('allows valid HTTPS URLs', () => {
      expect(isSafeExternalUrl('https://reuters.com/world/article')).toBe(true);
      expect(isSafeExternalUrl('https://apnews.com/hub/ap-fact-check')).toBe(true);
    });

    it('allows valid HTTP URLs', () => {
      expect(isSafeExternalUrl('http://example.com/test')).toBe(true);
    });

    it('rejects dangerous javascript: URIs (XSS vector)', () => {
      expect(isSafeExternalUrl('javascript:alert(1)')).toBe(false);
      expect(isSafeExternalUrl('JAVASCRIPT:fetch("/steal")')).toBe(false);
    });

    it('rejects data: URIs', () => {
      expect(isSafeExternalUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    });

    it('rejects file: and vbscript: URIs', () => {
      expect(isSafeExternalUrl('file:///etc/passwd')).toBe(false);
      expect(isSafeExternalUrl('vbscript:msgbox(1)')).toBe(false);
    });

    it('rejects empty or malformed strings', () => {
      expect(isSafeExternalUrl('')).toBe(false);
      expect(isSafeExternalUrl('not-a-url')).toBe(false);
    });
  });

  describe('sanitizeErrorTelemetry', () => {
    it('redacts Bearer tokens from error strings', () => {
      const raw = 'Failed request with header Authorization: Bearer eyJhbGciOiJIUzI1NiJ9.user_token_abc.sig';
      const sanitized = sanitizeErrorTelemetry(raw);
      expect(sanitized).not.toContain('eyJhbGciOiJIUzI1NiJ9');
      expect(sanitized).toContain('[REDACTED]');
    });

    it('redacts raw JWT strings', () => {
      const jwt = 'eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1aWQiOiJ1c2VyMTIzIn0.signature1234567890';
      const err = new Error(`Authentication failure: ${jwt}`);
      const sanitized = sanitizeErrorTelemetry(err);
      expect(sanitized).not.toContain('eyJhbGciOiJSUzI1NiIsInR5cCI6IkpXVCJ9');
      expect(sanitized).toContain('[REDACTED_JWT]');
    });

    it('redacts Google API keys matching AIzaSy pattern', () => {
      const raw = 'Request failed: key=AIzaSyD1234567890123456789012345678901';
      const sanitized = sanitizeErrorTelemetry(raw);
      expect(sanitized).not.toContain('AIzaSyD1234567890123456789012345678901');
      expect(sanitized).toContain('[REDACTED_API_KEY]');
    });
  });

  describe('generateSecureIdempotencyKey', () => {
    it('generates a valid RFC 4122 v4 UUID', () => {
      const key1 = generateSecureIdempotencyKey();
      const key2 = generateSecureIdempotencyKey();

      // Check standard UUID v4 regex: 8-4-4-4-12 hex chars with version 4
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(key1).toMatch(uuidRegex);
      expect(key2).toMatch(uuidRegex);
      expect(key1).not.toBe(key2);
    });
  });

  describe('auditStorageSecurity', () => {
    it('passes audit when no sensitive keys exist in storage', () => {
      const result = auditStorageSecurity();
      expect(result.secure).toBe(true);
      expect(result.violations).toHaveLength(0);
    });
  });
});
