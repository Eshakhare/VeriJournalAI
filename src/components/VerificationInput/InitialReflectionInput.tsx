import React from 'react';
import { Compass, Sparkles } from 'lucide-react';

interface InitialReflectionInputProps {
  confidence: number;
  onConfidenceChange: (val: number) => void;
  reflection: string;
  onReflectionChange: (val: string) => void;
  isOpen: boolean;
  onToggle: () => void;
}

export const InitialReflectionInput: React.FC<InitialReflectionInputProps> = ({
  confidence,
  onConfidenceChange,
  reflection,
  onReflectionChange,
  isOpen,
  onToggle,
}) => {
  return (
    <div className="border border-gray-200 bg-[#F8FAFC] rounded-xl p-4 transition-all">
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 text-left text-xs sm:text-sm font-bold text-[#0F172A] hover:text-[#0284c7] transition"
        >
          <Compass className="w-4 h-4 text-[#0284c7]" />
          <span>Personal Integrity Reflection (Pre-Verification Prior Belief)</span>
          <span className="text-[10px] font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded uppercase tracking-wider">
            Enhancement
          </span>
        </button>
        <button
          type="button"
          onClick={onToggle}
          className="text-xs font-bold text-[#0284c7] hover:underline"
        >
          {isOpen ? 'Minimize' : 'Add Prior Reflection'}
        </button>
      </div>

      <p className="text-xs text-gray-500 mt-1">
        Record your initial intuition before viewing fact-checks and evidence. This remains private
        to you and enables tracking how cited evidence shifts your assessment.
      </p>

      {isOpen && (
        <div className="mt-4 pt-3 border-t border-gray-200 space-y-4">
          <div>
            <div className="flex items-center justify-between text-xs font-medium text-gray-700 mb-1.5">
              <span>Initial Confidence in Claim:</span>
              <span className="font-mono font-bold bg-white px-2 py-0.5 rounded border border-gray-200 text-[#0F172A]">
                {confidence}%
              </span>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={confidence}
              onChange={(e) => onConfidenceChange(parseInt(e.target.value, 10))}
              className="w-full accent-[#38BDF8] cursor-pointer"
            />
            <div className="flex justify-between text-[10px] text-gray-500 font-mono mt-1">
              <span>0% (Strong Skepticism)</span>
              <span>50% (Neutral / Unsure)</span>
              <span>100% (High Prior Belief)</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-gray-700 mb-1">
              Why do you hold this prior impression? (Optional)
            </label>
            <textarea
              rows={2}
              maxLength={2000}
              value={reflection}
              onChange={(e) => onReflectionChange(e.target.value)}
              placeholder="e.g., The video editing seems too smooth for an amateur broadcast, or the speaker's claims match recent committee hearings..."
              className="w-full text-xs p-2.5 rounded-md border border-gray-200 bg-white focus:ring-2 focus:ring-[#38BDF8] focus:outline-none text-[#1A1A1B] placeholder:text-gray-400"
            />
          </div>
        </div>
      )}
    </div>
  );
};
