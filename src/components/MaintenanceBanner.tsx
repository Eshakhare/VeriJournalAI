import React from 'react';
import { AlertOctagon } from 'lucide-react';

export const MaintenanceBanner: React.FC = () => {
  return (
    <div
      role="alert"
      className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-amber-900 text-xs sm:text-sm font-medium flex items-center justify-center gap-2"
    >
      <AlertOctagon className="w-4 h-4 text-amber-700 shrink-0" />
      <span>
        <strong>Maintenance Mode Active:</strong> The verification engine is currently undergoing
        scheduled maintenance or safety throttles. Submissions are temporarily paused, but your
        historical journal reports remain readable.
      </span>
    </div>
  );
};
