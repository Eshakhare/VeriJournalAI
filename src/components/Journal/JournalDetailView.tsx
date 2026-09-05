import React, { useEffect, useState, useCallback } from 'react';
import {
  ArrowLeft,
  Trash2,
  ExternalLink,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  HelpCircle,
  Globe,
  FileText,
  Share2,
  Image as ImageIcon,
  Video,
  Clock,
  MessageSquare,
  AlertOctagon,
  Loader2,
  Sparkles,
} from 'lucide-react';
import type { JournalEntry, EvidenceStatus, EvidenceConfidence, Reflection } from '../../types/contract';
import { useAuth } from '../../context/AuthContext';
import { EvidenceLedger } from './EvidenceLedger';
import { ClaimTimeline } from './ClaimTimeline';
import { PersonalReflectionPanel } from './PersonalReflectionPanel';
import { MediaContextCheck } from './MediaContextCheck';
import { ReportChat } from './ReportChat';

interface JournalDetailViewProps {
  entryId: string;
  onBack: () => void;
}

export const JournalDetailView: React.FC<JournalDetailViewProps> = ({ entryId, onBack }) => {
  const { apiClient } = useAuth();

  const [entry, setEntry] = useState<JournalEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [activeTab, setActiveTab] = useState<'evidence' | 'timeline' | 'reflection' | 'media' | 'chat'>('evidence');

  const fetchEntry = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getJournalEntry(entryId);
      setEntry(data);
    } catch (err: unknown) {
      console.error('Failed to load journal entry:', err);
      setError(err instanceof Error ? err.message : 'Could not load report details.');
    } finally {
      setLoading(false);
    }
  }, [apiClient, entryId]);

  useEffect(() => {
    fetchEntry();
  }, [fetchEntry]);

  const handleDeleteEntry = async () => {
    setIsDeleting(true);
    try {
      await apiClient.deleteJournalEntry(entryId);
      onBack();
    } catch (err: unknown) {
      console.error('Failed to delete report:', err);
      alert(err instanceof Error ? err.message : 'Delete operation failed.');
    } finally {
      setIsDeleting(false);
      setShowDeleteModal(false);
    }
  };

  const handleReflectionSaved = (newReflection: Reflection) => {
    if (entry) {
      setEntry({
        ...entry,
        reflection: newReflection,
      });
    }
  };

  const getEvidenceStatusBadge = (status?: EvidenceStatus | null) => {
    switch (status) {
      case 'supported':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-emerald-50 border border-emerald-300 text-emerald-900 font-semibold text-xs shadow-2xs">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Categorical Verdict: Supported by Evidence</span>
          </div>
        );
      case 'contradicted':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-rose-50 border border-rose-300 text-rose-900 font-semibold text-xs shadow-2xs">
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Categorical Verdict: Contradicted by Evidence</span>
          </div>
        );
      case 'mixed':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-amber-50 border border-amber-300 text-amber-900 font-semibold text-xs shadow-2xs">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <span>Categorical Verdict: Mixed / Partially Confirmed</span>
          </div>
        );
      case 'insufficient_evidence':
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-slate-100 border border-slate-300 text-slate-800 font-semibold text-xs shadow-2xs">
            <HelpCircle className="w-4 h-4 text-slate-600" />
            <span>Categorical Verdict: Insufficient Evidence</span>
          </div>
        );
      case 'could_not_complete':
      default:
        return (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-xl bg-neutral-100 border border-neutral-300 text-neutral-800 font-semibold text-xs shadow-2xs">
            <AlertOctagon className="w-4 h-4 text-neutral-500" />
            <span>Could Not Complete Analysis</span>
          </div>
        );
    }
  };

  const getConfidencePill = (conf?: EvidenceConfidence | null) => {
    if (!conf) return null;
    return (
      <span className="text-xs font-mono font-medium px-2.5 py-1 rounded-lg bg-white border border-neutral-200 text-neutral-700 shadow-2xs">
        Evidence Confidence: <strong className="capitalize text-neutral-900">{conf}</strong>
      </span>
    );
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-16 text-center shadow-sm">
        <Loader2 className="w-8 h-8 animate-spin mx-auto mb-3 text-sky-700" />
        <h3 className="text-sm font-semibold text-neutral-800">Loading Investigation Report...</h3>
        <p className="text-xs text-neutral-400 mt-1">Retrieving isolated journal records</p>
      </div>
    );
  }

  if (error || !entry) {
    return (
      <div className="bg-white rounded-2xl border border-neutral-200 p-8 text-center space-y-4">
        <div className="text-rose-600 text-sm font-semibold">{error || 'Report not found.'}</div>
        <button
          onClick={onBack}
          className="px-4 py-2 bg-neutral-900 text-white rounded-xl text-xs font-medium hover:bg-neutral-800 transition"
        >
          Return to Journal List
        </button>
      </div>
    );
  }

  const hasMedia = entry.media && entry.media.length > 0;

  return (
    <div className="space-y-6 animate-fadeIn">
      {/* Geometric Balance Header */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              Job #{entry.entryId.substring(0, 7).toUpperCase()}
            </span>
            <span className="text-gray-400 text-xs italic">
              Recorded {new Date(entry.createdAt).toLocaleDateString()}
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
            Personal Integrity Report
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            {entry.title || 'Untitled Multimodal Verification Report'}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onBack}
            className="px-3.5 py-1.5 border border-gray-300 rounded-md bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-xs flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Journal List</span>
          </button>

          <button
            onClick={() => setShowDeleteModal(true)}
            className="px-3 py-1.5 text-xs font-semibold text-rose-700 hover:text-rose-900 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-md flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Delete</span>
          </button>
        </div>
      </header>

      {/* Primary Report Card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 sm:p-8 space-y-6">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4 border-b border-gray-100 pb-6">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono uppercase bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 font-bold">
                Format: {entry.inputType.replace(/_/g, ' ')}
              </span>
              <span className="text-xs text-gray-400 font-mono">
                Entry ID: {entry.entryId}
              </span>
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Clock className="w-3.5 h-3.5" />
                {new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            <h1 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight leading-snug">
              {entry.title || 'Untitled Verification Report'}
            </h1>

            {entry.canonicalUrl && (
              <a
                href={entry.canonicalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs text-[#0284c7] hover:underline underline-offset-2 flex items-center gap-1 break-all italic"
              >
                <span>{entry.canonicalUrl}</span>
                <ExternalLink className="w-3 h-3 shrink-0" />
              </a>
            )}
          </div>

          <div className="flex flex-col sm:items-end gap-2 shrink-0">
            {getEvidenceStatusBadge(entry.evidenceStatus)}
            {getConfidencePill(entry.evidenceConfidence)}
          </div>
        </div>

        {/* High Level Assessment Explanation */}
        {entry.assessmentExplanation && (
          <div className="p-4 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-xs sm:text-sm text-gray-800 leading-relaxed space-y-1">
            <span className="font-bold text-[#0F172A] block uppercase text-[10px] tracking-wider">
              Investigation Assessment:
            </span>
            <p>{entry.assessmentExplanation}</p>
          </div>
        )}

        {/* Extracted Atomic Claims */}
        <div className="space-y-3">
          <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">
            Material Claims Extracted ({entry.claims.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {entry.claims.map((claim) => (
              <div
                key={claim.claimId}
                className="p-4 rounded-lg border border-gray-200 bg-[#F8FAFC] space-y-2"
              >
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-mono text-gray-400">Claim: {claim.claimId}</span>
                  <span className="font-mono uppercase px-2 py-0.5 rounded bg-blue-50 text-blue-800 font-bold border border-blue-100">
                    Worthiness: {claim.checkWorthiness}
                  </span>
                </div>
                <p className="text-xs sm:text-sm font-bold text-[#0F172A] leading-snug">
                  &ldquo;{claim.claimText}&rdquo;
                </p>
                {claim.speaker && (
                  <p className="text-[11px] text-gray-500">
                    <strong>Attributed:</strong> {claim.speaker}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tab Navigation for Enhancements */}
      <div className="flex items-center gap-2 border-b border-gray-200 pb-1 overflow-x-auto text-xs sm:text-sm font-medium">
        <button
          onClick={() => setActiveTab('evidence')}
          className={`px-4 py-2 rounded-t-lg transition border-b-2 -mb-1 ${
            activeTab === 'evidence'
              ? 'border-[#0F172A] text-[#0F172A] font-bold bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          1. Evidence Ledger ({entry.evidence.length})
        </button>

        <button
          onClick={() => setActiveTab('timeline')}
          className={`px-4 py-2 rounded-t-lg transition border-b-2 -mb-1 ${
            activeTab === 'timeline'
              ? 'border-[#0F172A] text-[#0F172A] font-bold bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          2. Evolution Timeline ({entry.timeline.length})
        </button>

        <button
          onClick={() => setActiveTab('reflection')}
          className={`px-4 py-2 rounded-t-lg transition border-b-2 -mb-1 ${
            activeTab === 'reflection'
              ? 'border-[#0F172A] text-[#0F172A] font-bold bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          3. Personal Reflection
        </button>

        {hasMedia && (
          <button
            onClick={() => setActiveTab('media')}
            className={`px-4 py-2 rounded-t-lg transition border-b-2 -mb-1 ${
              activeTab === 'media'
                ? 'border-[#0F172A] text-[#0F172A] font-bold bg-white'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            Media Provenance
          </button>
        )}

        <button
          onClick={() => setActiveTab('chat')}
          className={`px-4 py-2 rounded-t-lg transition border-b-2 -mb-1 flex items-center gap-1.5 ${
            activeTab === 'chat'
              ? 'border-[#0F172A] text-[#0F172A] font-bold bg-white'
              : 'border-transparent text-gray-500 hover:text-gray-800'
          }`}
        >
          <MessageSquare className="w-3.5 h-3.5 text-[#38BDF8]" />
          <span>Report Discussion</span>
        </button>
      </div>

      {/* Tab Panels */}
      {activeTab === 'evidence' && (
        <EvidenceLedger
          claims={entry.claims}
          evidence={entry.evidence}
          factCheckStatus={entry.factCheckProviderStatus}
        />
      )}

      {activeTab === 'timeline' && <ClaimTimeline timeline={entry.timeline} />}

      {activeTab === 'reflection' && (
        <PersonalReflectionPanel
          entryId={entry.entryId}
          reflection={entry.reflection}
          onReflectionSaved={handleReflectionSaved}
        />
      )}

      {activeTab === 'media' && hasMedia && <MediaContextCheck media={entry.media!} />}

      {activeTab === 'chat' && (
        <ReportChat entryId={entry.entryId} reportTitle={entry.title} />
      )}

      {/* Limitations & Legal Notice */}
      {entry.limitations && entry.limitations.length > 0 && (
        <div className="p-5 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 space-y-2">
          <span className="font-bold text-neutral-800 block uppercase tracking-wider">
            Analysis Limitations &amp; Scope Boundary:
          </span>
          <ul className="list-disc pl-5 space-y-1">
            {entry.limitations.map((lim, lIdx) => (
              <li key={lIdx}>{lim}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm"
        >
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 border border-neutral-200 space-y-4">
            <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center">
              <Trash2 className="w-5 h-5" />
            </div>
            <h3 className="text-base font-bold text-neutral-900">Delete Journal Entry?</h3>
            <p className="text-xs text-neutral-600 leading-relaxed">
              This scheduled deletion will permanently remove the report, associated atomic claims,
              evidence ledger citations, and temporary media assets from your isolated Firestore tree.
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isDeleting}
                className="px-3.5 py-1.5 text-xs font-semibold text-neutral-600 hover:text-neutral-900 rounded-lg"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEntry}
                disabled={isDeleting}
                className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-xs font-semibold shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'Deleting...' : 'Confirm Deletion'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
