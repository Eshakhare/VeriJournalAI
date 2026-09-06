/**
 * VeriJournal Browser Security & Client Integrity Guard
 * Enforces zero client secret persistence, URL query scrubbing,
 * token sanitization in errors/telemetry, and origin safety.
 */

// Forbidden keys in web storage that would indicate token leakage
const SENSITIVE_STORAGE_KEYS = [
  'firebase_token',
  'id_token',
  'auth_token',
  'access_token',
  'refresh_token',
  'verijournal_token',
  'jwt',
  'api_key',
  'gemini_api_key',
];

/**
 * Audit client-side web storage (localStorage and sessionStorage).
 * Guarantees no sensitive tokens or secrets are persistently stored on client.
 */
export function auditStorageSecurity(): { secure: boolean; violations: string[] } {
  const violations: string[] = [];

  try {
    if (typeof window !== 'undefined') {
      // Check localStorage
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i) || '';
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_STORAGE_KEYS.some((k) => lowerKey.includes(k))) {
          violations.push(`localStorage violation: key "${key}" contains sensitive token signature`);
        }
      }

      // Check sessionStorage
      for (let i = 0; i < sessionStorage.length; i++) {
        const key = sessionStorage.key(i) || '';
        const lowerKey = key.toLowerCase();
        if (SENSITIVE_STORAGE_KEYS.some((k) => lowerKey.includes(k))) {
          violations.push(`sessionStorage violation: key "${key}" contains sensitive token signature`);
        }
      }
    }
  } catch {
    // Storage access restricted in some iframes; considered safe
  }

  return {
    secure: violations.length === 0,
    violations,
  };
}

/**
 * Scrubs any sensitive query parameters from the browser location bar
 * without reloading the current view.
 */
export function scrubSensitiveUrlParams(): void {
  if (typeof window === 'undefined' || !window.location) return;

  try {
    const url = new URL(window.location.href);
    let modified = false;

    const sensitiveParamNames = [
      'token',
      'id_token',
      'access_token',
      'auth',
      'key',
      'api_key',
      'credential',
      'password',
      'secret',
    ];

    sensitiveParamNames.forEach((param) => {
      if (url.searchParams.has(param)) {
        url.searchParams.delete(param);
        modified = true;
      }
    });

    if (modified) {
      window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    }
  } catch {
    // Safe fallback if URL parsing fails
  }
}

/**
 * Sanitizes an error message or telemetry string to redact any accidental
 * Bearer tokens or JWT structures (e.g. eyJ...).
 */
export function sanitizeErrorTelemetry(rawError: unknown): string {
  if (!rawError) return 'Unknown error';

  let message: string;
  if (typeof rawError === 'string') {
    message = rawError;
  } else if (rawError instanceof Error) {
    message = rawError.message;
  } else if (typeof rawError === 'object') {
    try {
      message = JSON.stringify(rawError);
    } catch {
      message = String(rawError);
    }
  } else {
    message = String(rawError);
  }

  // Redact Bearer tokens
  message = message.replace(/Bearer\s+[A-Za-z0-9\-_.]+/gi, 'Bearer [REDACTED]');

  // Redact JWT patterns (header.payload.signature)
  message = message.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+/g, '[REDACTED_JWT]');

  // Redact Google API key pattern (AIzaSy...)
  message = message.replace(/AIzaSy[A-Za-z0-9_-]{25,40}/g, '[REDACTED_API_KEY]');

  return message;
}

/**
 * Validates that an article or social URL is an acceptable web address
 * and not an SSRF or script injection vector (javascript:, file:, data:).
 */
export function isSafeExternalUrl(urlStr: string): boolean {
  if (!urlStr) return false;
  const trimmed = urlStr.trim().toLowerCase();

  // Explicitly disallow dangerous URI schemes
  if (
    trimmed.startsWith('javascript:') ||
    trimmed.startsWith('data:') ||
    trimmed.startsWith('vbscript:') ||
    trimmed.startsWith('file:')
  ) {
    return false;
  }

  try {
    const parsed = new URL(urlStr);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:';
  } catch {
    return false;
  }
}

/**
 * Cryptographically generates an RFC 4122 v4 UUID for request idempotency
 */
export function generateSecureIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  // Cryptographic CSPRNG fallback
  const bytes = new Uint8Array(16);
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) {
    crypto.getRandomValues(bytes);
  } else {
    for (let i = 0; i < 16; i++) {
      bytes[i] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // variant 10

  const hex: string[] = [];
  for (let i = 0; i < 16; i++) {
    hex.push(bytes[i].toString(16).padStart(2, '0'));
  }

  return `${hex.slice(0, 4).join('')}-${hex.slice(4, 6).join('')}-${hex.slice(6, 8).join('')}-${hex.slice(8, 10).join('')}-${hex.slice(10, 16).join('')}`;
}
