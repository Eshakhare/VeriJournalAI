import React, { useState } from 'react';
import {
  ExternalLink,
  ShieldAlert,
  HelpCircle,
  Building,
  Calendar,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Search,
} from 'lucide-react';
import type { EvidenceItem, Claim, FactCheckProviderStatus } from '../../types/contract';

interface EvidenceLedgerProps {
  claims: Claim[];
  evidence: EvidenceItem[];
  factCheckStatus?: FactCheckProviderStatus | null;
}

export const EvidenceLedger: React.FC<EvidenceLedgerProps> = ({
  claims,
  evidence,
  factCheckStatus,
}) => {
  const [selectedStance, setSelectedStance] = useState<string>('all');

  const filteredEvidence = evidence.filter((item) => {
    if (selectedStance !== 'all' && item.stance !== selectedStance) {
      return false;
    }
    return true;
  });

  const getStancePill = (stance: EvidenceItem['stance']) => {
    switch (stance) {
      case 'supports':
        return (
          <span className="inline-flex items-center gap-1 bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-emerald-300">
            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
            Supported
          </span>
        );
      case 'contradicts':
        return (
          <span className="inline-flex items-center gap-1 bg-red-100 text-red-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-red-300">
            <XCircle className="w-3 h-3 text-red-700" />
            Contradicted
          </span>
        );
      case 'contextual':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-amber-300">
            <AlertTriangle className="w-3 h-3 text-amber-700" />
            Contextual
          </span>
        );
      case 'insufficient':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-gray-100 text-gray-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider border border-gray-300">
            <HelpCircle className="w-3 h-3 text-gray-500" />
            Mixed / Insufficient
          </span>
        );
    }
  };

  const getFactCheckStatusBadge = (status?: FactCheckProviderStatus | null) => {
    switch (status) {
      case 'matched':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-800 bg-emerald-100/70 border border-emerald-300 px-2.5 py-1 rounded-lg">
            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
            Fact Check Registry: Match Identified
          </span>
        );
      case 'no_match':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-700 bg-neutral-100 border border-neutral-300 px-2.5 py-1 rounded-lg">
            <Search className="w-3.5 h-3.5 text-neutral-500" />
            Fact Check Registry: No Record Found
          </span>
        );
      case 'unavailable':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-1 rounded-lg">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
            Fact Check Registry: Provider Unavailable
          </span>
        );
      case 'invalid_response':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-rose-800 bg-rose-100 border border-rose-300 px-2.5 py-1 rounded-lg">
            <ShieldAlert className="w-3.5 h-3.5 text-rose-700" />
            Fact Check Registry: Schema Drift / Invalid Response
          </span>
        );
      case 'disabled':
        return (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-neutral-500 bg-neutral-100 border border-neutral-200 px-2.5 py-1 rounded-lg">
            Fact Check Registry: Disabled via Feature Flag
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden space-y-0">
      {/* Geometric Balance Ledger Header */}
      <div className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Evidence Ledger
            </h3>
            <span className="text-[10px] bg-white border border-gray-200 px-2 py-0.5 rounded text-gray-500 font-mono">
              IDEMPOTENCY: VERIFIED
            </span>
          </div>
          <p className="text-xs text-gray-500">
            Structured records of cited source documents, published dates, stances, and direct excerpts.
          </p>
        </div>

        {/* Fact Check Tools Provider Status */}
        {getFactCheckStatusBadge(factCheckStatus)}
      </div>

      {/* Filter Tabs by Stance */}
      <div className="px-6 py-3 bg-white border-b border-gray-100 flex items-center gap-2 flex-wrap text-xs">
        <span className="text-gray-400 font-bold uppercase tracking-widest text-[10px] mr-1">
          Filter Stance:
        </span>
        {['all', 'supports', 'contradicts', 'contextual', 'insufficient'].map((stanceKey) => (
          <button
            key={stanceKey}
            onClick={() => setSelectedStance(stanceKey)}
            className={`px-3 py-1 rounded text-xs font-semibold transition capitalize ${
              selectedStance === stanceKey
                ? 'bg-[#0F172A] text-white shadow-xs'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {stanceKey}
          </button>
        ))}
      </div>

      {/* Ledger Table / Cards */}
      {filteredEvidence.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-400">
          No cited evidence matches the selected stance filter.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {filteredEvidence.map((item) => {
            const linkedClaim = claims.find((c) => c.claimId === item.claimId);

            return (
              <div
                key={item.evidenceId}
                className={`p-6 transition hover:bg-gray-50/70 space-y-3 ${
                  item.stance === 'supports'
                    ? 'bg-emerald-50/10'
                    : item.stance === 'contradicts'
                    ? 'bg-red-50/10'
                    : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2.5 flex-wrap">
                    {getStancePill(item.stance)}
                    <span className="text-xs font-bold text-[#0F172A] flex items-center gap-1">
                      <Building className="w-3.5 h-3.5 text-gray-400" />
                      {item.publisher || 'Independent Source'}
                    </span>
                  </div>

                  <div className="flex items-center gap-3 text-[11px] text-gray-400 font-mono">
                    {item.publishedAt && (
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3 h-3 text-gray-400" />
                        Pub: {new Date(item.publishedAt).toLocaleDateString()}
                      </span>
                    )}
                    <span>Retrieved: {new Date(item.retrievedAt).toLocaleDateString()}</span>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-bold text-[#0F172A] leading-tight">
                    {item.sourceTitle}
                  </h4>
                  <a
                    href={item.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#0284c7] hover:text-[#0369a1] underline underline-offset-2 flex items-center gap-1 mt-1 break-all italic"
                  >
                    <span>{item.sourceUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                </div>

                {item.excerpt && (
                  <div className="bg-[#F8FAFC] p-3 rounded-lg border border-[#E2E8F0] text-xs text-gray-700 leading-relaxed italic border-l-2 border-[#38BDF8]">
                    &ldquo;{item.excerpt}&rdquo;
                  </div>
                )}

                {linkedClaim && (
                  <div className="text-[11px] text-gray-500 pt-1 border-t border-gray-100 flex items-center gap-1.5">
                    <span className="font-bold text-gray-700 uppercase text-[10px] tracking-wider">
                      Evaluates Proposition:
                    </span>
                    <span className="truncate italic text-gray-600">&ldquo;{linkedClaim.claimText}&rdquo;</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
