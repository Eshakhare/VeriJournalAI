import React, { useState } from 'react';
import { ShieldCheck, LogIn, FlaskConical, X, AlertCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface SignInModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SignInModal: React.FC<SignInModalProps> = ({ isOpen, onClose }) => {
  const { signInWithGoogle, signInAsDevMock } = useAuth();
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isSigningIn, setIsSigningIn] = useState(false);

  if (!isOpen) return null;

  const handleGoogleClick = async () => {
    setIsSigningIn(true);
    setErrorMsg(null);
    try {
      await signInWithGoogle();
      onClose();
    } catch (err: unknown) {
      const error = err as { code?: string; message?: string };
      if (error.code === 'auth/popup-closed-by-user') {
        setErrorMsg('Sign-in popup closed before completion.');
      } else if (
        error.code === 'auth/unauthorized-domain' ||
        error.code === 'auth/configuration-not-found'
      ) {
        setErrorMsg(
          'Firebase domain unauthorized in GCP console. Use the Dev Sandbox Session below for local preview.'
        );
      } else {
        setErrorMsg(error.message || 'Authentication failed. Please try again.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  const handleDevMockClick = () => {
    signInAsDevMock('lead.auditor@verijournal.dev', 'Integrity Analyst (Dev Session)');
    onClose();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="signin-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#0F172A]/70 backdrop-blur-xs"
    >
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 border border-gray-200 relative">
        <button
          onClick={onClose}
          aria-label="Close dialog"
          className="absolute top-4 right-4 p-1.5 text-gray-400 hover:text-gray-700 rounded-md hover:bg-gray-100 transition"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="w-10 h-10 rounded-md bg-[#0F172A] text-[#38BDF8] flex items-center justify-center mb-3">
          <ShieldCheck className="w-5 h-5" />
        </div>

        <div className="flex items-center gap-2 mb-1">
          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            Owner Identity
          </span>
          <span className="text-gray-400 text-xs font-mono">Firebase Auth</span>
        </div>

        <h3 id="signin-modal-title" className="text-xl font-bold text-[#0F172A] tracking-tight">
          Sign In to VeriJournal AI
        </h3>
        <p className="text-xs text-gray-600 mt-1 leading-relaxed">
          Authenticate to submit claims for multimodal verification, review cited evidence ledgers,
          and maintain your private journal history.
        </p>

        {errorMsg && (
          <div className="mt-4 p-3 rounded-md bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <span className="leading-snug">{errorMsg}</span>
          </div>
        )}

        <div className="mt-5 space-y-3">
          <button
            onClick={handleGoogleClick}
            disabled={isSigningIn}
            className="w-full flex items-center justify-center gap-2.5 px-4 py-2.5 bg-[#0F172A] hover:bg-[#1E293B] text-white rounded-md text-xs font-bold transition shadow-sm disabled:opacity-50"
          >
            <LogIn className="w-4 h-4 text-[#38BDF8]" />
            <span>{isSigningIn ? 'Signing In...' : 'Sign in with Google Account'}</span>
          </button>

          {import.meta.env.DEV && (
            <div className="pt-3 border-t border-gray-100">
              <p className="text-[10px] font-bold text-gray-400 mb-2 uppercase tracking-widest">
                Development Preview Options
              </p>
              <button
                onClick={handleDevMockClick}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-900 border border-amber-500/30 rounded-md text-xs font-bold transition"
              >
                <FlaskConical className="w-4 h-4 text-amber-600" />
                <span>Sign in as Dev Mock Auditor</span>
              </button>
            </div>
          )}
        </div>

        <div className="mt-5 pt-3 border-t border-gray-100 text-[10px] text-gray-500 leading-relaxed">
          <strong className="text-gray-700">Security Guarantee:</strong> Your Firebase ID token is
          never stored in localStorage, URLs, or query strings. It is only passed via encrypted Bearer
          headers to the backend. Firestore paths are owner-isolated with zero cross-user access.
        </div>
      </div>
    </div>
  );
};
