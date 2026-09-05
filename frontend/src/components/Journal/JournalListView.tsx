import React, { useEffect, useState, useCallback } from 'react';
import {
  BookOpen,
  DownloadCloud,
  Search,
  Filter,
  ArrowRight,
  Clock,
  Loader2,
  FileText,
  Globe,
  Share2,
  Image as ImageIcon,
  Video,
} from 'lucide-react';
import type { JournalEntrySummary, JournalInputType, EvidenceStatus } from '../../types/contract';
import { useAuth } from '../../context/AuthContext';

interface JournalListViewProps {
  onSelectEntry: (entryId: string) => void;
  onNewVerification: () => void;
}

export const JournalListView: React.FC<JournalListViewProps> = ({
  onSelectEntry,
  onNewVerification,
}) => {
  const { apiClient } = useAuth();

  const [entries, setEntries] = useState<JournalEntrySummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nextCursor, setNextCursor] = useState<string | null>(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [exporting, setExporting] = useState(false);
  const [exportNotice, setExportNotice] = useState<string | null>(null);

  const fetchEntries = useCallback(async (cursorArg?: string) => {
    setLoading(true);
    setError(null);
    try {
      const page = await apiClient.listJournalEntries(cursorArg, 20);
      setEntries(page.entries);
      setNextCursor(page.nextCursor || null);
    } catch (err: unknown) {
      console.error('Failed to list journal entries:', err);
      setError(err instanceof Error ? err.message : 'Could not retrieve journal history.');
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  const handleExportClick = async () => {
    setExporting(true);
    setExportNotice(null);
    try {
      const res = await apiClient.createUserExport();
      setExportNotice(`Export operation ${res.operationId} queued. Your machine-readable archive is being generated.`);
    } catch {
      setExportNotice('Export request failed. Please try again.');
    } finally {
      setExporting(false);
    }
  };

  const getStanceBadge = (status?: EvidenceStatus | null) => {
    switch (status) {
      case 'supported':
        return (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase tracking-wider">
            Supported
          </span>
        );
      case 'contradicted':
        return (
          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase tracking-wider">
            Contradicted
          </span>
        );
      case 'mixed':
        return (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wider">
            Mixed
          </span>
        );
      case 'insufficient_evidence':
        return (
          <span className="text-[10px] font-bold text-gray-700 bg-gray-100 border border-gray-300 px-2 py-0.5 rounded uppercase tracking-wider">
            Insufficient
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded uppercase tracking-wider">
            In Progress
          </span>
        );
    }
  };

  const getInputIcon = (type: JournalInputType) => {
    switch (type) {
      case 'article_url':
        return <Globe className="w-4 h-4 text-[#0284c7]" />;
      case 'text':
        return <FileText className="w-4 h-4 text-gray-600" />;
      case 'social_post':
        return <Share2 className="w-4 h-4 text-indigo-600" />;
      case 'image':
        return <ImageIcon className="w-4 h-4 text-emerald-600" />;
      case 'youtube_video':
      case 'video_upload':
        return <Video className="w-4 h-4 text-purple-600" />;
      default:
        return <BookOpen className="w-4 h-4 text-gray-600" />;
    }
  };

  const filteredEntries = entries.filter((entry) => {
    if (selectedType !== 'all' && entry.inputType !== selectedType) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        entry.title?.toLowerCase().includes(q) ||
        entry.entryId.toLowerCase().includes(q) ||
        entry.evidenceStatus?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6">
      {/* Geometric Balance Header with Export */}
      <header className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
              Journal Ledger
            </span>
            <span className="text-gray-400 text-xs">
              {entries.length} {entries.length === 1 ? 'Report' : 'Reports'} Archived
            </span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
            Personal Evidence &amp; Integrity Journal
          </h2>
          <p className="text-xs sm:text-sm text-gray-500 mt-0.5">
            Your private, owner-isolated historical reports with cited evidence ledgers and reflection tracking.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={handleExportClick}
            disabled={exporting}
            className="px-3.5 py-2 border border-gray-300 rounded-md bg-white text-xs sm:text-sm font-medium text-gray-700 hover:bg-gray-50 shadow-xs flex items-center gap-1.5 disabled:opacity-50"
          >
            {exporting ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-gray-500" />
            ) : (
              <DownloadCloud className="w-3.5 h-3.5 text-gray-600" />
            )}
            <span>Export Archive</span>
          </button>

          <button
            onClick={onNewVerification}
            className="px-4 py-2 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-[#0F172A] rounded-md text-xs sm:text-sm font-bold shadow-md transition flex items-center gap-1.5"
          >
            <span>+ New Verification</span>
          </button>
        </div>
      </header>

      {exportNotice && (
        <div className="p-3.5 rounded-lg bg-blue-50 border border-blue-200 text-blue-900 text-xs flex items-center justify-between">
          <span>{exportNotice}</span>
          <button
            onClick={() => setExportNotice(null)}
            className="text-blue-700 hover:text-blue-950 font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="bg-white rounded-xl border border-gray-200 p-3.5 flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between shadow-xs">
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search report titles, claims, or entry IDs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-md border border-gray-200 bg-[#F8FAFC] focus:bg-white focus:ring-2 focus:ring-[#38BDF8] focus:outline-none text-[#1A1A1B]"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-3.5 h-3.5 text-gray-400" />
          <select
            value={selectedType}
            onChange={(e) => setSelectedType(e.target.value)}
            className="text-xs py-1.5 px-2.5 rounded-md border border-gray-200 bg-white text-gray-700 focus:ring-2 focus:ring-[#38BDF8] focus:outline-none"
          >
            <option value="all">All Input Formats</option>
            <option value="article_url">Article / Web URL</option>
            <option value="text">Pasted Text</option>
            <option value="social_post">Social Post</option>
            <option value="image">Direct Image</option>
            <option value="youtube_video">YouTube Video</option>
            <option value="video_upload">Short Video</option>
          </select>
        </div>
      </div>

      {/* Entry List */}
      {loading ? (
        <div className="p-12 text-center text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-[#38BDF8]" />
          <p className="text-xs">Loading journal records...</p>
        </div>
      ) : error ? (
        <div className="p-8 text-center text-rose-700 bg-rose-50 rounded-xl border border-rose-200 text-xs">
          <p className="font-semibold mb-1">Failed to load journal entries</p>
          <p>{error}</p>
        </div>
      ) : filteredEntries.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <BookOpen className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <h3 className="text-sm font-bold text-[#0F172A]">No Journal Entries Found</h3>
          <p className="text-xs text-gray-500 max-w-sm mx-auto mt-1 leading-relaxed">
            {searchQuery
              ? 'No reports match your search query or format filter.'
              : 'Submit an article, claim, or media upload to record your first evidence-backed report.'}
          </p>
          <button
            onClick={onNewVerification}
            className="mt-4 px-4 py-2 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-[#0F172A] rounded-md text-xs font-bold transition shadow-sm"
          >
            Create Verification Report
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredEntries.map((entry) => (
            <div
              key={entry.entryId}
              onClick={() => onSelectEntry(entry.entryId)}
              className="bg-white rounded-xl border border-gray-200 p-4 hover:border-[#38BDF8] hover:shadow-md transition cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
            >
              <div className="flex items-start gap-3 min-w-0">
                <div className="w-9 h-9 rounded-lg bg-[#F8FAFC] border border-gray-200 flex items-center justify-center shrink-0 mt-0.5">
                  {getInputIcon(entry.inputType)}
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {getStanceBadge(entry.evidenceStatus)}
                    <span className="text-[10px] font-mono text-gray-400">
                      ID: {entry.entryId}
                    </span>
                    <span className="text-[10px] text-gray-400 flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {new Date(entry.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <h4 className="text-sm font-bold text-[#0F172A] group-hover:text-[#0284c7] transition truncate max-w-2xl">
                    {entry.title || 'Untitled Verification Report'}
                  </h4>
                </div>
              </div>

              <div className="flex items-center gap-3 shrink-0 self-end sm:self-center">
                {entry.evidenceConfidence && (
                  <span className="text-[11px] font-mono font-medium text-gray-600 bg-gray-50 border border-gray-200 px-2 py-0.5 rounded">
                    Confidence: {entry.evidenceConfidence}
                  </span>
                )}
                <ArrowRight className="w-4 h-4 text-gray-400 group-hover:text-[#0284c7] group-hover:translate-x-0.5 transition" />
              </div>
            </div>
          ))}

          {nextCursor && (
            <div className="pt-2 text-center">
              <button
                onClick={() => fetchEntries(nextCursor)}
                className="px-4 py-2 text-xs font-semibold text-[#0284c7] bg-sky-50 hover:bg-sky-100 border border-sky-200 rounded-md transition"
              >
                Load More Records
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
