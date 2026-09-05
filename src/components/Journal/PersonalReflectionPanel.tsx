import React, { useState } from 'react';
import { Compass, CheckCircle2, TrendingDown, TrendingUp, Minus, Save, Sparkles, Loader2 } from 'lucide-react';
import type { Reflection } from '../../types/contract';
import { useAuth } from '../../context/AuthContext';

interface PersonalReflectionPanelProps {
  entryId: string;
  reflection: Reflection;
  onReflectionSaved: (newReflection: Reflection) => void;
}

export const PersonalReflectionPanel: React.FC<PersonalReflectionPanelProps> = ({
  entryId,
  reflection,
  onReflectionSaved,
}) => {
  const { apiClient } = useAuth();

  const [updatedConfidence, setUpdatedConfidence] = useState<number>(
    reflection.updatedConfidence ?? 50
  );
  const [updatedReflection, setUpdatedReflection] = useState<string>(
    reflection.updatedReflection || ''
  );
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const initialConf = reflection.initialConfidence ?? null;
  const currentConf = reflection.updatedConfidence ?? null;

  const delta =
    initialConf !== null && currentConf !== null ? currentConf - initialConf : null;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setSaveSuccess(false);
    setSaveError(null);

    try {
      const saved = await apiClient.updateReflection(entryId, {
        updatedConfidence,
        updatedReflection: updatedReflection.trim() ? updatedReflection.trim() : null,
      });
      onReflectionSaved(saved);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save reflection.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-md p-6 space-y-5">
      <div className="flex justify-between items-center border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Personal Reflection
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Epistemic growth tracking — private to your account
          </p>
        </div>
        <span className="text-[10px] text-emerald-600 font-bold uppercase tracking-wider bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
          {reflection.updatedReflection ? 'Saved' : 'Draft'}
        </span>
      </div>

      {/* Comparison Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* 1. Prior Belief (Before Evidence) */}
        <div className="p-4 rounded-lg border border-gray-200 bg-[#F8FAFC] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Prior Intuition
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white border border-gray-200 text-[#0F172A]">
              {initialConf !== null ? `${initialConf}%` : 'Not recorded'}
            </span>
          </div>
          <p className="border-l-2 border-gray-300 pl-3 py-1 text-xs leading-relaxed text-gray-600 italic min-h-[50px]">
            {reflection.initialReflection ? (
              `“${reflection.initialReflection}”`
            ) : (
              <span className="text-gray-400 not-italic">
                No initial prior reflection was submitted before verification started.
              </span>
            )}
          </p>
        </div>

        {/* 2. Informed Assessment (Post Evidence) */}
        <div className="p-4 rounded-lg border border-gray-200 bg-[#F8FAFC] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              Post-Evidence Assessment
            </span>
            <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-white border border-gray-200 text-[#0F172A]">
              {currentConf !== null ? `${currentConf}%` : 'Pending your reflection'}
            </span>
          </div>
          <p className="border-l-2 border-[#38BDF8] pl-3 py-1 text-xs leading-relaxed text-gray-600 italic min-h-[50px]">
            {reflection.updatedReflection ? (
              `“${reflection.updatedReflection}”`
            ) : (
              <span className="text-gray-400 not-italic">
                Review the evidence ledger and timeline, then record what shifted your stance below.
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Delta Shift Meter */}
      {delta !== null && (
        <div className="p-3 rounded-lg bg-gray-50 border border-gray-200 flex items-center justify-between text-xs">
          <span className="text-[11px] text-gray-500 font-medium">Epistemic Shift:</span>
          <div className="flex items-center gap-1.5 font-mono font-bold">
            {delta > 0 ? (
              <>
                <TrendingUp className="w-4 h-4 text-emerald-600" />
                <span className="text-emerald-700">+{delta}% Corroborated</span>
              </>
            ) : delta < 0 ? (
              <>
                <TrendingDown className="w-4 h-4 text-rose-600" />
                <span className="text-rose-700">{delta}% Skepticism Increase</span>
              </>
            ) : (
              <>
                <Minus className="w-4 h-4 text-gray-400" />
                <span className="text-gray-500">0% (Stabilized)</span>
              </>
            )}
          </div>
        </div>
      )}

      {/* Interactive Update Form */}
      <form onSubmit={handleSave} className="border-t border-gray-100 pt-4 space-y-4">
        <h4 className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
          Update Your Post-Evidence Reflection
        </h4>

        <div>
          <div className="flex items-center justify-between text-xs font-medium text-gray-800 mb-1.5">
            <span>Your Updated Confidence Level:</span>
            <span className="font-mono font-bold bg-gray-100 px-2 py-0.5 rounded text-[#0F172A]">
              {updatedConfidence}%
            </span>
          </div>
          <input
            type="range"
            min="0"
            max="100"
            value={updatedConfidence}
            onChange={(e) => setUpdatedConfidence(parseInt(e.target.value, 10))}
            className="w-full accent-[#38BDF8] cursor-pointer"
          />
          <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1">
            <span>0% (Disproven)</span>
            <span>50% (Mixed / Ambiguous)</span>
            <span>100% (Substantiated)</span>
          </div>
        </div>

        <div>
          <label htmlFor="updated-reflection-textarea" className="block text-xs font-medium text-gray-800 mb-1">
            What specific citations or timeline events influenced your perspective?
          </label>
          <textarea
            id="updated-reflection-textarea"
            rows={3}
            maxLength={2000}
            value={updatedReflection}
            onChange={(e) => setUpdatedReflection(e.target.value)}
            placeholder="e.g., The primary satellite telemetry published by NOAA convinced me the retreat figure was accurate, despite contradicting commentary on social media..."
            className="w-full text-xs p-3 rounded-lg border border-gray-200 bg-[#F8FAFC] focus:bg-white focus:ring-2 focus:ring-[#38BDF8] focus:outline-none text-[#1A1A1B] placeholder:text-gray-400 leading-relaxed"
          />
        </div>

        {saveError && (
          <p className="text-xs text-rose-600 font-medium">{saveError}</p>
        )}

        <div className="flex items-center justify-between pt-1">
          {saveSuccess ? (
            <span className="text-xs font-semibold text-emerald-700 flex items-center gap-1.5 animate-fadeIn">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              Reflection saved to your private journal
            </span>
          ) : (
            <span className="text-[11px] text-gray-400">
              Saves securely via authenticated PUT to your isolated journal document.
            </span>
          )}

          <button
            type="submit"
            disabled={isSaving}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-md text-xs font-bold transition shadow-sm disabled:opacity-50"
          >
            {isSaving ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-[#38BDF8]" />
                <span>Save Reflection</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
