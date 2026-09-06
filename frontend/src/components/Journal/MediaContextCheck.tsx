import React from 'react';
import {
  ShieldCheck,
  ShieldAlert,
  HelpCircle,
  Clock,
  MapPin,
  FileCheck,
  AlertTriangle,
} from 'lucide-react';
import type { MediaSummary, ConsistencyStatus, C2paStatus } from '../../types/contract';

interface MediaContextCheckProps {
  media: MediaSummary[];
}

export const MediaContextCheck: React.FC<MediaContextCheckProps> = ({ media }) => {
  if (!media || media.length === 0) return null;

  const getConsistencyBadge = (status?: ConsistencyStatus) => {
    switch (status) {
      case 'consistent':
        return (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded uppercase tracking-wider">
            Consistent
          </span>
        );
      case 'conflicting':
        return (
          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded uppercase tracking-wider">
            Conflicting
          </span>
        );
      case 'unknown':
        return (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded uppercase tracking-wider">
            Ambiguous
          </span>
        );
      case 'not_analyzed':
      default:
        return (
          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded uppercase tracking-wider">
            Not Analyzed
          </span>
        );
    }
  };

  const getC2paBadge = (status?: C2paStatus) => {
    switch (status) {
      case 'trusted':
        return (
          <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
            <ShieldCheck className="w-3 h-3 text-emerald-600" />
            C2PA: Verified Signed
          </span>
        );
      case 'valid_untrusted_signer':
        return (
          <span className="text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
            <AlertTriangle className="w-3 h-3 text-amber-600" />
            C2PA: Untrusted Signer
          </span>
        );
      case 'invalid':
        return (
          <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
            <ShieldAlert className="w-3 h-3 text-rose-600" />
            C2PA: Invalid Manifest
          </span>
        );
      case 'not_present':
        return (
          <span className="text-[10px] font-bold text-gray-600 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
            <FileCheck className="w-3 h-3 text-gray-400" />
            C2PA: No Manifest
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-bold text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded uppercase tracking-wider">
            C2PA: {status || 'Not Checked'}
          </span>
        );
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
      <div className="flex justify-between items-center border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Claim-versus-Media Provenance Check
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Objective consistency comparison against camera metadata, C2PA content credentials, and reverse-search
          </p>
        </div>
        <span className="text-[10px] text-blue-700 font-bold uppercase tracking-wider bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
          Multimodal
        </span>
      </div>

      <div className="p-3 rounded-lg bg-[#F8FAFC] border border-gray-200 text-xs text-gray-600 space-y-1">
        <p>
          <strong className="text-[#0F172A]">Forensic Integrity Notice:</strong> Metadata and visual consistency signals
          provide context, not an automated binary &ldquo;deepfake&rdquo; verdict. Absence of a C2PA
          manifest does <em>not</em> imply synthetic generation or falsification.
        </p>
      </div>

      <div className="space-y-4">
        {media.map((item, idx) => (
          <div
            key={item.mediaId || idx}
            className="p-4 rounded-xl border border-gray-200 bg-[#F8FAFC] space-y-4"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0F172A] capitalize">
                  {item.mediaType || 'Media'} Asset
                </span>
                <span className="text-[10px] font-mono text-gray-400">
                  ID: {item.mediaId || 'unknown'}
                </span>
              </div>
              {getC2paBadge(item.c2paStatus)}
            </div>

            {/* Consistency Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-3 rounded-lg bg-white border border-gray-200 text-xs space-y-1">
                <span className="text-[10px] font-mono uppercase text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3 text-gray-400" />
                  Date Alignment
                </span>
                <div>{getConsistencyBadge(item.dateConsistency)}</div>
              </div>

              <div className="p-3 rounded-lg bg-white border border-gray-200 text-xs space-y-1">
                <span className="text-[10px] font-mono uppercase text-gray-400 flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-gray-400" />
                  Location Alignment
                </span>
                <div>{getConsistencyBadge(item.locationConsistency)}</div>
              </div>

              <div className="p-3 rounded-lg bg-white border border-gray-200 text-xs space-y-1">
                <span className="text-[10px] font-mono uppercase text-gray-400 flex items-center gap-1">
                  <HelpCircle className="w-3 h-3 text-gray-400" />
                  Prior Context Match
                </span>
                <div>{getConsistencyBadge(item.priorContextConsistency)}</div>
              </div>
            </div>

            {item.earliestObservedMatchAt && (
              <div className="p-3 rounded-lg bg-white border border-gray-200 text-xs flex items-center justify-between">
                <span className="text-gray-600">Earliest Observed Reverse-Search Match:</span>
                <span className="font-mono font-bold text-[#0F172A]">
                  {new Date(item.earliestObservedMatchAt).toLocaleDateString()}
                </span>
              </div>
            )}

            {item.limitations && item.limitations.length > 0 && (
              <div className="text-[11px] text-gray-500 pt-2 border-t border-gray-200 space-y-1">
                <span className="font-bold text-gray-700">Specific Media Limitations:</span>
                <ul className="list-disc pl-4 space-y-0.5">
                  {item.limitations.map((lim, lIdx) => (
                    <li key={lIdx}>{lim}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
