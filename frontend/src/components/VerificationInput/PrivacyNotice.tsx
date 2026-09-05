import React from 'react';
import { Info, MapPin } from 'lucide-react';

interface PrivacyNoticeProps {
  showGpsOption?: boolean;
  saveExactGps: boolean;
  onGpsChange: (checked: boolean) => void;
}

export const PrivacyNotice: React.FC<PrivacyNoticeProps> = ({
  showGpsOption = false,
  saveExactGps,
  onGpsChange,
}) => {
  return (
    <div className="space-y-3 pt-2">
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-neutral-50 border border-neutral-200 text-neutral-600 text-xs leading-relaxed">
        <Info className="w-4 h-4 text-sky-700 shrink-0 mt-0.5" />
        <div className="space-y-1">
          <p>
            <strong>Evidence Disclaimer:</strong> Publisher classification (e.g. recognized vs.
            unknown) provides institutional context, <em>not</em> proof that a specific claim is
            true. VeriJournal AI extracts verifiable claims and cross-references public evidence
            ledgers and fact-checks.
          </p>
          <p className="text-neutral-500">
            Upload limits: Images &le; 10MB (JPEG, PNG, WebP). Videos &le; 50MB / 60 seconds (MP4,
            WebM). Temporary media is stored in private owner-isolated buckets and deleted per
            retention schedule.
          </p>
        </div>
      </div>

      {showGpsOption && (
        <div className="p-3 rounded-xl bg-amber-50/50 border border-amber-200/80 text-xs">
          <label className="flex items-start gap-2.5 cursor-pointer">
            <input
              type="checkbox"
              checked={saveExactGps}
              onChange={(e) => onGpsChange(e.target.checked)}
              className="mt-0.5 rounded border-amber-300 text-sky-700 focus:ring-sky-500 accent-sky-700"
            />
            <div>
              <span className="font-semibold text-neutral-900 flex items-center gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-amber-700" />
                Explicit Consent: Save exact GPS coordinates from file EXIF metadata
              </span>
              <p className="text-neutral-600 text-[11px] mt-0.5">
                By default, exact GPS is stripped and only approximate locality is analyzed.
                Checking this saves precise coordinates with your private report.
              </p>
            </div>
          </label>
        </div>
      )}
    </div>
  );
};
