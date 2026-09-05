import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertCircle,
  XCircle,
  RotateCw,
  Ban,
  ArrowRight,
  Shield,
  Layers,
  Sparkles,
} from 'lucide-react';
import type { OperationStatus, OperationStage } from '../../types/contract';
import { useAuth } from '../../context/AuthContext';

interface OperationWatcherProps {
  operationId: string;
  onComplete: (entryId: string) => void;
  onCancel: () => void;
}

const ORDERED_STAGES: Array<{
  key: OperationStage;
  label: string;
  description: string;
}> = [
  { key: 'validating_input', label: '1. Validating Input', description: 'Checking payload boundaries & structure' },
  { key: 'checking_url', label: '2. Checking URL Safety', description: 'Google Safe Browsing & SSRF prevention' },
  { key: 'extracting_content', label: '3. Extracting Content', description: 'Extracting readable text & platform context' },
  { key: 'extracting_claims', label: '4. Extracting Claims', description: 'Parsing checkable atomic statements' },
  { key: 'checking_fact_checks', label: '5. Checking Fact Checks', description: 'Querying Google Fact Check Tools API' },
  { key: 'retrieving_evidence', label: '6. Retrieving Evidence', description: 'Search-grounded RAG & stance discovery' },
  { key: 'analyzing_media', label: '7. Analyzing Media', description: 'EXIF/GPS, C2PA & Vision Web Detection' },
  { key: 'building_timeline', label: '8. Building Timelines', description: 'Constructing sourced chronological events' },
  { key: 'saving_report', label: '9. Saving Report', description: 'Storing isolated record in private journal' },
];

export const OperationWatcher: React.FC<OperationWatcherProps> = ({
  operationId,
  onComplete,
  onCancel,
}) => {
  const { apiClient } = useAuth();

  const [operation, setOperation] = useState<OperationStatus | null>(null);
  const [etag, setEtag] = useState<string | undefined>(undefined);
  const [isPolling, setIsPolling] = useState(true);
  const [pollError, setPollError] = useState<string | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);

  // Polling controller & timeout refs
  const abortControllerRef = useRef<AbortController | null>(null);
  const timeoutIdRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTabVisibleRef = useRef<boolean>(true);

  // Stop polling helper
  const stopPolling = useCallback(() => {
    setIsPolling(false);
    if (timeoutIdRef.current) {
      clearTimeout(timeoutIdRef.current);
      timeoutIdRef.current = null;
    }
  }, []);

  // Poll loop
  const pollOperation = useCallback(async () => {
    try {
      // If document tab is hidden, substantially slow down polling to 8 seconds
      const pollDelayMs = isTabVisibleRef.current ? 2000 : 8000;

      const response = await apiClient.getOperation(operationId, etag);

      if (response.status === 304) {
        // ETag unchanged; wait for next cycle
        timeoutIdRef.current = setTimeout(pollOperation, response.retryAfter ? response.retryAfter * 1000 : pollDelayMs);
        return;
      }

      if (response.data) {
        const op = response.data;
        setOperation(op);
        if (response.etag) {
          setEtag(response.etag);
        }

        // Check for terminal states: complete, failed, cancelled, partial
        if (op.status === 'complete') {
          stopPolling();
          if (op.resultUrl) {
            const entryId = op.resultUrl.split('/').pop() || op.operationId;
            // Delay navigation slightly so user sees 100% completion
            setTimeout(() => onComplete(entryId), 1200);
          }
          return;
        }

        if (op.status === 'failed' || op.status === 'cancelled') {
          stopPolling();
          return;
        }

        // Schedule next poll respecting Retry-After
        const nextInterval = response.retryAfter ? response.retryAfter * 1000 : pollDelayMs;
        timeoutIdRef.current = setTimeout(pollOperation, nextInterval);
      }
    } catch (err: unknown) {
      console.warn('Polling error:', err);
      setPollError(err instanceof Error ? err.message : 'Transient communication error');
      // Retry after conservative delay on transient network failure
      timeoutIdRef.current = setTimeout(pollOperation, 4000);
    }
  }, [apiClient, operationId, etag, onComplete, stopPolling]);

  // Tab visibility listener to pause or slow down polling when tab is hidden
  useEffect(() => {
    const handleVisibilityChange = () => {
      isTabVisibleRef.current = document.visibilityState === 'visible';
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  // Lifecycle start / unmount stop
  useEffect(() => {
    abortControllerRef.current = new AbortController();
    pollOperation();

    return () => {
      stopPolling();
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [operationId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCancelClick = async () => {
    setIsCancelling(true);
    try {
      const res = await apiClient.cancelOperation(operationId);
      setOperation(res);
      stopPolling();
    } catch (err) {
      console.error('Cancel request failed:', err);
    } finally {
      setIsCancelling(false);
    }
  };

  const handleRetryClick = async () => {
    setIsRetrying(true);
    try {
      const accepted = await apiClient.retryOperation(operationId);
      // Restart polling with fresh operation
      window.location.hash = `#op=${accepted.operationId}`;
      setIsPolling(true);
      setPollError(null);
    } catch (err) {
      console.error('Retry request failed:', err);
    } finally {
      setIsRetrying(false);
    }
  };

  const status = operation?.status || 'queued';
  const progressPercent = operation?.progressPercent ?? 10;
  const completedStages = operation?.completedStages || [];
  const currentStage = operation?.stage || 'validating_input';
  const partialResult = operation?.partialResult;

  const isTerminal = status === 'complete' || status === 'failed' || status === 'cancelled';
  const isRetryable = operation?.error?.error.retryable;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-fadeIn space-y-0">
      {/* Live Region for Screen Readers */}
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        Verification operation status: {status}, stage {currentStage}, {progressPercent} percent completed.
      </div>

      {/* Geometric Balance 202 Progress Section */}
      <section className="bg-amber-50 border-b border-amber-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-amber-400/20 border border-amber-300/60 flex items-center justify-center rounded-lg shrink-0">
            <span className="text-amber-700 font-extrabold text-base tracking-tight">202</span>
          </div>
          <div>
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded">
                Job #{operationId.substring(0, 8)}
              </span>
              <span className="text-[11px] text-amber-800 font-mono">
                Stage {completedStages.length + 1}/9
              </span>
            </div>
            <p className="text-sm font-bold text-amber-950">
              Verification in Progress: {operation?.message || 'Analyzing content...'}
            </p>
            <p className="text-xs text-amber-700 font-medium">
              Stage: {currentStage.replace(/_/g, ' ')}
            </p>
          </div>
        </div>

        <div className="flex flex-col sm:items-end gap-2 shrink-0">
          <div className="w-48 h-1.5 bg-amber-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 ${
                status === 'failed'
                  ? 'bg-rose-600'
                  : status === 'cancelled'
                  ? 'bg-gray-400'
                  : status === 'complete'
                  ? 'bg-emerald-600'
                  : 'bg-amber-600'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>

          <div className="flex items-center gap-2">
            {!isTerminal && (
              <button
                onClick={handleCancelClick}
                disabled={isCancelling}
                className="px-2.5 py-1 text-[11px] font-bold text-rose-700 bg-white hover:bg-rose-50 border border-rose-200 rounded-md transition disabled:opacity-50"
              >
                {isCancelling ? 'Cancelling...' : 'Cancel'}
              </button>
            )}

            {status === 'failed' && isRetryable && (
              <button
                onClick={handleRetryClick}
                disabled={isRetrying}
                className="px-3 py-1 text-[11px] font-bold text-[#0F172A] bg-[#38BDF8] hover:bg-[#38BDF8]/90 rounded-md transition shadow-xs disabled:opacity-50"
              >
                Retry
              </button>
            )}

            {status === 'complete' && operation?.resultUrl && (
              <button
                onClick={() => {
                  const entryId = operation.resultUrl?.split('/').pop() || operation.operationId;
                  onComplete(entryId);
                }}
                className="flex items-center gap-1.5 px-3.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition shadow-sm"
              >
                <span>View Report</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            )}

            <button
              onClick={onCancel}
              className="px-2.5 py-1 text-[11px] font-medium text-gray-500 hover:text-gray-900 rounded-md hover:bg-white/80 transition"
            >
              Close
            </button>
          </div>
        </div>
      </section>

      {pollError && (
        <div className="m-6 mb-0 p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
          <span>{pollError} — Retrying polling cycle...</span>
        </div>
      )}

      {/* Terminal Error Alert */}
      {operation?.error && (
        <div className="m-6 mb-0 p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-900 text-xs space-y-1">
          <div className="flex items-center gap-2 font-bold text-rose-700">
            <XCircle className="w-4 h-4" />
            <span>Operation Terminated with Code: {operation.error.error.code}</span>
          </div>
          <p className="leading-relaxed">{operation.error.error.message}</p>
          <p className="text-[11px] text-rose-600 font-mono">
            Request ID: {operation.error.error.requestId} • Retryable: {String(operation.error.error.retryable)}
          </p>
        </div>
      )}

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stages Checklist (2 cols) */}
        <div className="lg:col-span-2 space-y-2">
          <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-3 flex items-center gap-2">
            <Layers className="w-3.5 h-3.5 text-neutral-500" />
            <span>Canonical Verification Stages</span>
          </h3>

          <div className="space-y-1.5">
            {ORDERED_STAGES.map((stage) => {
              const isCompleted = completedStages.includes(stage.key) || status === 'complete';
              const isActive = currentStage === stage.key && !isCompleted && !isTerminal;

              return (
                <div
                  key={stage.key}
                  className={`p-3 rounded-xl border flex items-center justify-between transition ${
                    isCompleted
                      ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950'
                      : isActive
                      ? 'bg-sky-50/60 border-sky-300 text-sky-950 shadow-xs'
                      : 'bg-neutral-50/50 border-neutral-200 text-neutral-500 opacity-80'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div className="shrink-0">
                      {isCompleted ? (
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      ) : isActive ? (
                        <div className="w-4 h-4 rounded-full border-2 border-sky-700 border-t-transparent animate-spin" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border border-neutral-300 bg-white" />
                      )}
                    </div>
                    <div>
                      <p className={`text-xs font-semibold ${isCompleted ? 'text-emerald-950' : isActive ? 'text-sky-950' : 'text-neutral-700'}`}>
                        {stage.label}
                      </p>
                      <p className="text-[11px] text-neutral-500">{stage.description}</p>
                    </div>
                  </div>

                  <span
                    className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded font-semibold ${
                      isCompleted
                        ? 'bg-emerald-100 text-emerald-800'
                        : isActive
                        ? 'bg-sky-100 text-sky-800 animate-pulse'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {isCompleted ? 'Complete' : isActive ? 'Processing' : 'Pending'}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Validated Partial Results Panel (1 col) */}
        <div className="space-y-4">
          <div className="border border-neutral-200 rounded-xl p-4 bg-neutral-50/60 h-full">
            <h3 className="text-xs font-bold text-neutral-900 uppercase tracking-wider mb-2 flex items-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-neutral-500" />
              <span>Validated Partial Signals</span>
            </h3>
            <p className="text-[11px] text-neutral-500 mb-3 leading-relaxed">
              Displays verified server outputs emitted by stages prior to final synthesis.
            </p>

            {partialResult ? (
              <div className="space-y-3">
                {partialResult.safeBrowsingStatus && (
                  <div className="p-2.5 rounded-lg bg-white border border-neutral-200 text-xs">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase block">
                      Google Safe Browsing
                    </span>
                    <span className="font-semibold text-neutral-900 capitalize">
                      {partialResult.safeBrowsingStatus.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}

                {partialResult.publisherRegistryMatch && (
                  <div className="p-2.5 rounded-lg bg-white border border-neutral-200 text-xs">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase block">
                      Publisher Classification
                    </span>
                    <span className="font-semibold text-neutral-900 capitalize">
                      {partialResult.publisherRegistryMatch.replace(/_/g, ' ')}
                    </span>
                  </div>
                )}

                {partialResult.claims && partialResult.claims.length > 0 && (
                  <div className="p-2.5 rounded-lg bg-white border border-neutral-200 text-xs space-y-1.5">
                    <span className="text-[10px] font-mono text-neutral-500 uppercase block">
                      Extracted Propositions ({partialResult.claims.length})
                    </span>
                    {partialResult.claims.map((c) => (
                      <p key={c.claimId} className="text-neutral-800 text-[11px] italic leading-tight">
                        &ldquo;{c.claimText}&rdquo;
                      </p>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center text-xs text-neutral-400">
                <Sparkles className="w-5 h-5 mx-auto mb-2 text-neutral-300" />
                <span>Awaiting validated stage output...</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
