import React from 'react';
import {
  LogOut,
  LogIn,
  AlertTriangle,
  FlaskConical,
  BookOpen,
  PlusCircle,
  HelpCircle,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useCapabilities } from '../context/CapabilitiesContext';

interface HeaderProps {
  currentView: 'create' | 'journal' | 'about';
  onNavigate: (view: 'create' | 'journal' | 'about') => void;
  onOpenSignIn: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onNavigate, onOpenSignIn }) => {
  const { principal, signOut, apiClient } = useAuth();
  const { isMaintenanceMode } = useCapabilities();

  return (
    <header className="border-b border-[#1E293B] bg-[#0F172A] text-white sticky top-0 z-30 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Brand Logo & Name */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => onNavigate('create')}
              className="flex items-center gap-3 text-left focus:outline-none focus:ring-2 focus:ring-[#38BDF8] rounded p-1 group"
            >
              <div className="w-8 h-8 bg-[#38BDF8] rounded-sm flex items-center justify-center font-bold text-[#0F172A] italic shadow-sm group-hover:scale-105 transition-transform">
                V
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-bold text-white tracking-tight text-lg">
                    VeriJournal AI
                  </span>
                  <span className="hidden sm:inline-block text-[10px] font-mono uppercase tracking-widest px-2 py-0.5 rounded bg-[#1E293B] text-[#38BDF8] border border-[#38BDF8]/30">
                    Contract v1.0
                  </span>
                </div>
                <p className="text-[11px] text-gray-400 hidden md:block tracking-wide">
                  Personal News &amp; Multimodal Integrity Journal
                </p>
              </div>
            </button>
          </div>

          {/* Navigation Links */}
          <nav className="flex items-center gap-1.5 sm:gap-2">
            <button
              onClick={() => onNavigate('create')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                currentView === 'create'
                  ? 'bg-[#1E293B] text-[#38BDF8] border border-[#38BDF8]/40 shadow-xs'
                  : 'text-gray-300 hover:text-white hover:bg-[#1E293B]/60'
              }`}
            >
              <PlusCircle className={`w-4 h-4 ${currentView === 'create' ? 'text-[#38BDF8]' : 'text-gray-400'}`} />
              <span>New Verify</span>
            </button>

            <button
              onClick={() => onNavigate('journal')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                currentView === 'journal'
                  ? 'bg-[#1E293B] text-[#38BDF8] border border-[#38BDF8]/40 shadow-xs'
                  : 'text-gray-300 hover:text-white hover:bg-[#1E293B]/60'
              }`}
            >
              <BookOpen className={`w-4 h-4 ${currentView === 'journal' ? 'text-[#38BDF8]' : 'text-gray-400'}`} />
              <span>Personal Journal</span>
            </button>

            <button
              onClick={() => onNavigate('about')}
              className={`flex items-center gap-2 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-md transition-colors ${
                currentView === 'about'
                  ? 'bg-[#1E293B] text-[#38BDF8] border border-[#38BDF8]/40 shadow-xs'
                  : 'text-gray-300 hover:text-white hover:bg-[#1E293B]/60'
              }`}
            >
              <HelpCircle className={`w-4 h-4 ${currentView === 'about' ? 'text-[#38BDF8]' : 'text-gray-400'}`} />
              <span className="hidden sm:inline">Governance</span>
            </button>
          </nav>

          {/* Right Status & Auth Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {apiClient.isMockActive() && (
              <span
                title="Simulating API contract using in-memory mock adapter for pre-backend verification"
                className="hidden lg:flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300 bg-amber-500/10 border border-amber-500/30 px-2 py-1 rounded"
              >
                <FlaskConical className="w-3.5 h-3.5 text-amber-400" />
                <span>Dev Mock Active</span>
              </span>
            )}

            <div className="hidden xl:flex items-center gap-2 text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded border border-emerald-500/20">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div>
              <span className="tracking-wider">API CAPABILITIES READY</span>
            </div>

            {isMaintenanceMode && (
              <span className="flex items-center gap-1 text-xs text-rose-300 bg-rose-500/20 border border-rose-500/30 px-2 py-1 rounded font-medium">
                <AlertTriangle className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Maintenance</span>
              </span>
            )}

            {principal ? (
              <div className="flex items-center gap-2.5 pl-2.5 border-l border-[#1E293B]">
                <div className="text-right hidden sm:block">
                  <p className="text-xs font-semibold text-white truncate max-w-[130px]">
                    {principal.displayName || 'Alex Rivera'}
                  </p>
                  <p className="text-[10px] text-gray-400 uppercase tracking-widest truncate max-w-[130px]">
                    Verified Member
                  </p>
                </div>
                <div className="w-8 h-8 rounded-full bg-orange-400 text-[#0F172A] flex items-center justify-center font-bold text-xs shadow-sm">
                  {principal.displayName ? principal.displayName[0].toUpperCase() : 'A'}
                </div>
                <button
                  onClick={() => signOut()}
                  title="Sign out"
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-[#1E293B] rounded transition"
                  aria-label="Sign out"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onOpenSignIn}
                className="flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-bold bg-[#38BDF8] text-[#0F172A] rounded-md hover:bg-[#38BDF8]/90 transition shadow-sm"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
