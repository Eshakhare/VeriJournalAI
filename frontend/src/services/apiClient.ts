import type {
  CapabilitiesResponse,
  HealthResponse,
  OperationAccepted,
  OperationStatus,
  JournalEntry,
  JournalEntryPage,
  Reflection,
  ReflectionUpdate,
  ApiError,
  TextVerificationRequest,
  UrlVerificationRequest,
  SocialVerificationRequest,
  MediaVerificationRequest,
} from '../types/contract';
import { mockAdapter } from './mockAdapter';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';
const USE_DEV_MOCK =
  import.meta.env.DEV &&
  (import.meta.env.VITE_USE_DEV_MOCK === 'true' ||
    !import.meta.env.VITE_FIREBASE_API_KEY ||
    import.meta.env.VITE_FIREBASE_API_KEY.includes('placeholder'));

/**
 * Generate a cryptographically strong Idempotency-Key (min 16, max 128 chars)
 */
export function generateIdempotencyKey(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `idemp_${crypto.randomUUID().replace(/-/g, '')}_${Date.now()}`;
  }
  return `idemp_${Math.random().toString(36).substring(2)}${Date.now()}_${Math.random().toString(36).substring(2)}`;
}

export class VeriJournalApiClient {
  private getToken: (forceRefresh?: boolean) => Promise<string | null>;
  private onAuthExpired?: () => void;

  constructor(
    getToken: (forceRefresh?: boolean) => Promise<string | null>,
    onAuthExpired?: () => void
  ) {
    this.getToken = getToken;
    this.onAuthExpired = onAuthExpired;
  }

  public isMockActive(): boolean {
    return USE_DEV_MOCK;
  }

  /**
   * Internal authenticated fetch with single 401 token refresh retry defense
   */
  private async authenticatedFetch(
    url: string,
    options: RequestInit = {},
    hasRetried = false
  ): Promise<Response> {
    const token = await this.getToken(hasRetried);
    const headers = new Headers(options.headers || {});

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    const response = await fetch(`${API_BASE}${url}`, {
      ...options,
      headers,
    });

    if (response.status === 401 && !hasRetried) {
      // Re-authenticate or refresh once on 401 without infinite loop
      try {
        const freshToken = await this.getToken(true);
        if (freshToken) {
          headers.set('Authorization', `Bearer ${freshToken}`);
          return await fetch(`${API_BASE}${url}`, {
            ...options,
            headers,
          });
        }
      } catch (refreshErr) {
        console.warn('Token refresh failed on 401:', refreshErr);
      }

      if (this.onAuthExpired) {
        this.onAuthExpired();
      }
    }

    return response;
  }

  private async parseError(response: Response): Promise<never> {
    try {
      const errJson = (await response.json()) as ApiError;
      if (errJson.error && errJson.error.message) {
        throw new Error(`[${errJson.error.code}] ${errJson.error.message}`);
      }
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message.startsWith('[')) {
        throw parseErr;
      }
    }
    throw new Error(`Request failed with HTTP status ${response.status}: ${response.statusText}`);
  }

  // Health
  async getHealth(): Promise<HealthResponse> {
    if (USE_DEV_MOCK) return mockAdapter.getHealth();
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) await this.parseError(res);
    return res.json();
  }

  // Capabilities
  async getCapabilities(): Promise<CapabilitiesResponse> {
    if (USE_DEV_MOCK) return mockAdapter.getCapabilities();
    const res = await this.authenticatedFetch('/me/capabilities');
    if (!res.ok) await this.parseError(res);
    return res.json();
  }

  // Verification submissions (All return 202 Accepted)
  async submitTextVerification(
    payload: TextVerificationRequest,
    idempotencyKey = generateIdempotencyKey()
  ): Promise<OperationAccepted> {
    if (USE_DEV_MOCK) {
      return mockAdapter.submitVerification('text', payload, idempotencyKey);
    }
    const res = await this.authenticatedFetch('/verifications/text', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    if (res.status !== 202) await this.parseError(res);
    return res.json();
  }

  async submitUrlVerification(
    payload: UrlVerificationRequest,
    idempotencyKey = generateIdempotencyKey()
  ): Promise<OperationAccepted> {
    if (USE_DEV_MOCK) {
      return mockAdapter.submitVerification('article_url', payload, idempotencyKey);
    }
    const res = await this.authenticatedFetch('/verifications/url', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    if (res.status !== 202) await this.parseError(res);
    return res.json();
  }

  async submitSocialVerification(
    payload: SocialVerificationRequest,
    idempotencyKey = generateIdempotencyKey()
  ): Promise<OperationAccepted> {
    if (USE_DEV_MOCK) {
      return mockAdapter.submitVerification('social_post', payload, idempotencyKey);
    }
    const res = await this.authenticatedFetch('/verifications/social', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Idempotency-Key': idempotencyKey,
      },
      body: JSON.stringify(payload),
    });
    if (res.status !== 202) await this.parseError(res);
    return res.json();
  }

  async submitMediaVerification(
    payload: MediaVerificationRequest,
    idempotencyKey = generateIdempotencyKey()
  ): Promise<OperationAccepted> {
    const isVideo =
      payload.file.type.startsWith('video/') ||
      (payload.file instanceof File && payload.file.name.match(/\.(mp4|webm|mov)$/i));
    const inputType = isVideo ? 'video_upload' : 'image';

    if (USE_DEV_MOCK) {
      return mockAdapter.submitVerification(inputType, payload, idempotencyKey);
    }

    const formData = new FormData();
    formData.append('file', payload.file);
    if (payload.accompanyingClaim) {
      formData.append('accompanyingClaim', payload.accompanyingClaim);
    }
    if (payload.initialReflection) {
      formData.append('initialReflection', payload.initialReflection);
    }
    if (payload.initialConfidence !== undefined && payload.initialConfidence !== null) {
      formData.append('initialConfidence', String(payload.initialConfidence));
    }
    if (payload.saveExactGps !== undefined) {
      formData.append('saveExactGps', String(payload.saveExactGps));
    }

    const res = await this.authenticatedFetch('/verifications/media', {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
      body: formData,
    });
    if (res.status !== 202) await this.parseError(res);
    return res.json();
  }

  // Operation Polling and Management
  async getOperation(
    operationId: string,
    etag?: string
  ): Promise<{ status: number; data?: OperationStatus; etag?: string; retryAfter?: number }> {
    if (USE_DEV_MOCK) {
      return mockAdapter.getOperation(operationId, etag);
    }

    const headers: Record<string, string> = {};
    if (etag) {
      headers['If-None-Match'] = etag;
    }

    const res = await this.authenticatedFetch(`/operations/${operationId}`, {
      method: 'GET',
      headers,
    });

    const responseEtag = res.headers.get('ETag') || undefined;
    const retryAfterHeader = res.headers.get('Retry-After');
    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : undefined;

    if (res.status === 304) {
      return { status: 304, etag: responseEtag, retryAfter };
    }

    if (!res.ok) {
      await this.parseError(res);
    }

    const data = (await res.json()) as OperationStatus;
    return { status: 200, data, etag: responseEtag, retryAfter };
  }

  async cancelOperation(operationId: string): Promise<OperationStatus> {
    if (USE_DEV_MOCK) {
      return mockAdapter.cancelOperation(operationId);
    }
    const res = await this.authenticatedFetch(`/operations/${operationId}/cancel`, {
      method: 'POST',
    });
    if (!res.ok) await this.parseError(res);
    return res.json();
  }

  async retryOperation(
    operationId: string,
    idempotencyKey = generateIdempotencyKey()
  ): Promise<OperationAccepted> {
    if (USE_DEV_MOCK) {
      return mockAdapter.retryOperation(operationId);
    }
    const res = await this.authenticatedFetch(`/operations/${operationId}/retry`, {
      method: 'POST',
      headers: {
        'Idempotency-Key': idempotencyKey,
      },
    });
    if (res.status !== 202) await this.parseError(res);
    return res.json();
  }

  // Journal entries
  async listJournalEntries(cursor?: string, limit = 20): Promise<JournalEntryPage> {
    if (USE_DEV_MOCK) {
      return mockAdapter.listJournalEntries(cursor, limit);
    }
    const params = new URLSearchParams();
    if (cursor) params.set('cursor', cursor);
    params.set('limit', String(limit));

    const res = await this.authenticatedFetch(`/journal/entries?${params.toString()}`);
    if (!res.ok) await this.parseError(res);
    return res.json();
  }

  async getJournalEntry(entryId: string): Promise<JournalEntry> {
    if (USE_DEV_MOCK) {
      return mockAdapter.getJournalEntry(entryId);
    }
    const res = await this.authenticatedFetch(`/journal/entries/${entryId}`);
    if (!res.ok) await this.parseError(res);
    return res.json();
  }

  async deleteJournalEntry(entryId: string): Promise<void> {
    if (USE_DEV_MOCK) {
      return mockAdapter.deleteJournalEntry(entryId);
    }
    const res = await this.authenticatedFetch(`/journal/entries/${entryId}`, {
      method: 'DELETE',
    });
    if (!res.ok && res.status !== 204) await this.parseError(res);
  }

  async updateReflection(entryId: string, update: ReflectionUpdate): Promise<Reflection> {
    if (USE_DEV_MOCK) {
      return mockAdapter.updateReflection(entryId, update);
    }
    const res = await this.authenticatedFetch(`/journal/entries/${entryId}/reflection`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(update),
    });
    if (!res.ok) await this.parseError(res);
    return res.json();
  }

  async createUserExport(): Promise<OperationAccepted> {
    if (USE_DEV_MOCK) {
      return mockAdapter.createUserExport();
    }
    const res = await this.authenticatedFetch('/me/export', {
      method: 'POST',
    });
    if (res.status !== 202) await this.parseError(res);
    return res.json();
  }

  /**
   * Authenticated SSE fetch streaming for multi-turn Gemini chat.
   * Never puts bearer tokens in query parameters or uses native unauthenticated EventSource.
   */
  async *streamEntryChat(
    entryId: string,
    message: string,
    signal?: AbortSignal
  ): AsyncGenerator<string, void, unknown> {
    if (USE_DEV_MOCK) {
      yield* mockAdapter.streamChat(entryId, message);
      return;
    }

    const token = await this.getToken();
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`${API_BASE}/journal/entries/${entryId}/chat`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message }),
      signal,
    });

    if (!response.ok) {
      await this.parseError(response);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error('Streaming response body is unavailable.');
    }

    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || '';

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const rawData = line.slice(6).trim();
          if (rawData === '[DONE]') return;
          try {
            const parsed = JSON.parse(rawData);
            if (typeof parsed === 'string') {
              yield parsed;
            } else if (parsed.text) {
              yield parsed.text;
            }
          } catch {
            yield rawData;
          }
        }
      }
    }
  }
}
