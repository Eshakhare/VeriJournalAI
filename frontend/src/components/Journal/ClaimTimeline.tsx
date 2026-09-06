import React, { useState } from 'react';
import {
  ExternalLink,
  Layers,
  Clock,
  Video,
  Image as ImageIcon,
  AlertCircle,
} from 'lucide-react';
import type { TimelineEvent, TimelineType, DateType } from '../../types/contract';

interface ClaimTimelineProps {
  timeline: TimelineEvent[];
}

export const ClaimTimeline: React.FC<ClaimTimelineProps> = ({ timeline }) => {
  const [activeType, setActiveType] = useState<TimelineType | 'all'>('all');

  const filteredTimeline = timeline.filter((event) => {
    if (activeType !== 'all' && event.timelineType !== activeType) {
      return false;
    }
    return true;
  });

  const getDateTypeBadge = (dateType: DateType) => {
    switch (dateType) {
      case 'claimed_event':
        return (
          <span className="text-[10px] font-mono uppercase bg-amber-100 text-amber-900 px-2 py-0.5 rounded font-semibold">
            Claimed Event Occurrence
          </span>
        );
      case 'published':
        return (
          <span className="text-[10px] font-mono uppercase bg-sky-100 text-sky-900 px-2 py-0.5 rounded font-semibold">
            Publication Date
          </span>
        );
      case 'modified':
        return (
          <span className="text-[10px] font-mono uppercase bg-neutral-100 text-neutral-800 px-2 py-0.5 rounded font-semibold">
            Article Revision
          </span>
        );
      case 'fact_check_review':
        return (
          <span className="text-[10px] font-mono uppercase bg-emerald-100 text-emerald-900 px-2 py-0.5 rounded font-semibold">
            Fact Check Registry Record
          </span>
        );
      case 'exif_capture':
        return (
          <span className="text-[10px] font-mono uppercase bg-purple-100 text-purple-900 px-2 py-0.5 rounded font-semibold">
            Camera EXIF Capture
          </span>
        );
      case 'video_timestamp':
        return (
          <span className="text-[10px] font-mono uppercase bg-rose-100 text-rose-900 px-2 py-0.5 rounded font-semibold">
            Video Timestamp Marker
          </span>
        );
      default:
        return (
          <span className="text-[10px] font-mono uppercase bg-neutral-100 text-neutral-700 px-2 py-0.5 rounded font-semibold">
            Retrieved
          </span>
        );
    }
  };

  return (
    <div className="bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] shadow-sm p-6 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-200 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
              Claim Evolution
            </h3>
            <span className="text-[10px] font-mono uppercase bg-purple-100 text-purple-900 px-2 py-0.5 rounded font-semibold">
              Chronology
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Chronological reconstruction distinguishing reported events, media discovery dates, and fact-check reviews.
          </p>
        </div>

        {/* Timeline Tabs */}
        <div className="flex items-center gap-1.5 p-1 bg-white border border-gray-200 rounded-lg text-xs font-medium self-start sm:self-auto">
          <button
            onClick={() => setActiveType('all')}
            className={`px-2.5 py-1 rounded text-xs transition ${
              activeType === 'all' ? 'bg-[#0F172A] text-white font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            All ({timeline.length})
          </button>
          <button
            onClick={() => setActiveType('claim_evidence')}
            className={`px-2.5 py-1 rounded text-xs transition flex items-center gap-1 ${
              activeType === 'claim_evidence' ? 'bg-[#0F172A] text-white font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3 h-3 text-[#38BDF8]" />
            <span>Evidence</span>
          </button>
          <button
            onClick={() => setActiveType('observed_media_history')}
            className={`px-2.5 py-1 rounded text-xs transition flex items-center gap-1 ${
              activeType === 'observed_media_history' ? 'bg-[#0F172A] text-white font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <ImageIcon className="w-3 h-3 text-emerald-500" />
            <span>Media History</span>
          </button>
          <button
            onClick={() => setActiveType('video_content')}
            className={`px-2.5 py-1 rounded text-xs transition flex items-center gap-1 ${
              activeType === 'video_content' ? 'bg-[#0F172A] text-white font-semibold' : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Video className="w-3 h-3 text-purple-500" />
            <span>Timestamps</span>
          </button>
        </div>
      </div>

      {activeType === 'observed_media_history' && (
        <div className="p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-900 text-xs flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
          <span>
            <strong>Observed Media History Notice:</strong> The earliest matching web page
            discovered via reverse search indicates the earliest crawl record found in this
            investigation—it is <em>not</em> proof of the first-ever original upload.
          </span>
        </div>
      )}

      {filteredTimeline.length === 0 ? (
        <div className="p-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-xl">
          No timeline events recorded for this view category.
        </div>
      ) : (
        <div className="relative pl-6 space-y-4 before:absolute before:left-2 before:top-2 before:bottom-2 before:w-0.5 before:bg-gray-200">
          {filteredTimeline.map((event) => (
            <div key={event.eventId} className="relative group">
              {/* Geometric Balance Dot */}
              <div className="absolute -left-6 top-1.5 w-3 h-3 rounded-full bg-[#38BDF8] border-2 border-white shadow-sm shrink-0" />

              <div className="bg-white border border-[#E2E8F0] rounded-lg p-3.5 hover:border-gray-300 transition space-y-2 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    {getDateTypeBadge(event.dateType)}
                    <span className="text-xs font-semibold text-[#0F172A] flex items-center gap-1">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {new Date(event.occurredAt).toLocaleString()}
                    </span>
                  </div>

                  {event.dateConfidence && (
                    <span className="text-[10px] font-mono text-gray-400">
                      Confidence: {event.dateConfidence}
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">
                  Evolution Marker
                </p>

                <p className="text-xs italic text-gray-600 leading-relaxed">
                  &ldquo;{event.description}&rdquo;
                </p>

                {event.sourceUrl && (
                  <a
                    href={event.sourceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs text-[#0284c7] hover:underline flex items-center gap-1 pt-1 break-all"
                  >
                    <span>{event.sourceUrl}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
