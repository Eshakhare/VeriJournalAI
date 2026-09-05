import React from 'react';
import {
  ShieldCheck,
  FileCheck2,
  History,
  Compass,
  Lock,
  Server,
  Layers,
  HelpCircle,
  ExternalLink,
} from 'lucide-react';

export const AboutView: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn">
      {/* Title */}
      <div className="text-center space-y-2">
        <div className="w-12 h-12 rounded-xl bg-[#0F172A] text-[#38BDF8] flex items-center justify-center mx-auto shadow-sm">
          <ShieldCheck className="w-6 h-6" />
        </div>
        <div className="flex items-center justify-center gap-2">
          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            Architecture Contract 1.0
          </span>
          <span className="text-gray-400 text-xs">Owner-Isolated Storage</span>
        </div>
        <h1 className="text-2xl sm:text-3xl font-bold text-[#0F172A] tracking-tight">
          VeriJournal AI — Governance &amp; Security Architecture
        </h1>
        <p className="text-xs sm:text-sm text-gray-500 max-w-xl mx-auto leading-relaxed">
          Personal News &amp; Multimodal Integrity Journal with zero cross-user data leakage and cited verification.
        </p>
      </div>

      {/* Primary Enhancements Grid */}
      <div className="space-y-3">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest">
          Primary Verification Enhancements
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2.5 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center border border-blue-100">
              <FileCheck2 className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">1. Evidence Ledger</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Maintains a structured, reproducible record of extracted atomic claims, source URLs,
              publisher registries, retrieval timestamps, stances, and verbatim excerpts.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2.5 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-purple-50 text-purple-700 flex items-center justify-center border border-purple-100">
              <History className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">2. Claim Evolution Timeline</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Distinguishes reported event occurrences, camera EXIF capture dates, observed reverse-search
              crawl records, and fact-check registry reviews.
            </p>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-2.5 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center border border-emerald-100">
              <Compass className="w-4 h-4" />
            </div>
            <h3 className="text-sm font-bold text-[#0F172A]">3. Personal Reflection</h3>
            <p className="text-xs text-gray-600 leading-relaxed">
              Allows recording pre-evidence prior beliefs and post-evidence updated reflections,
              measuring how inspecting verified citations shifts individual perspective.
            </p>
          </div>
        </div>
      </div>

      {/* Security & Isolation Boundaries */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4 shadow-sm">
        <h2 className="text-xs font-bold text-gray-400 uppercase tracking-widest flex items-center gap-2">
          <Lock className="w-3.5 h-3.5 text-[#0284c7]" />
          <span>Security, Privacy &amp; Data Isolation Guarantees</span>
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-gray-700 leading-relaxed">
          <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-gray-200 space-y-1">
            <strong className="text-[#0F172A] block font-bold">Zero Cross-User Data Leakage:</strong>
            <p>
              Firestore security rules enforce strict owner isolation under <code className="font-mono text-gray-900 bg-white px-1 py-0.5 rounded border border-gray-200">users/&#123;uid&#125;</code>.
              Clients cannot read or write another user&apos;s reports or chat history.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-gray-200 space-y-1">
            <strong className="text-[#0F172A] block font-bold">No Browser Secret Exposure:</strong>
            <p>
              All provider API keys reside in Google Cloud Secret Manager or backend environment. The browser only holds a short-lived Firebase ID token.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-gray-200 space-y-1">
            <strong className="text-[#0F172A] block font-bold">Categorical Assessment Semantics:</strong>
            <p>
              Reports use evidence-based categories (<code className="font-mono text-gray-800">supported</code>, <code className="font-mono text-gray-800">contradicted</code>, <code className="font-mono text-gray-800">mixed</code>, <code className="font-mono text-gray-800">insufficient_evidence</code>)
              instead of presenting artificial probability numbers as absolute truth.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-[#F8FAFC] border border-gray-200 space-y-1">
            <strong className="text-[#0F172A] block font-bold">Durable Asynchronous Operations:</strong>
            <p>
              Verification submissions return HTTP <code className="font-mono text-gray-800">202 Accepted</code> immediately, with polling
              respecting <code className="font-mono text-gray-800">Retry-After</code> and ETag caching to survive network disconnects.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
