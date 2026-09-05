import React from 'react';
import { LogIn, ShieldAlert } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

export const SessionExpiredModal: React.FC = () => {
  const { sessionExpired, dismissSessionExpired, signInWithGoogle } = useAuth();

  if (!sessionExpired) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-neutral-900/60 backdrop-blur-sm"
    >
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6 border border-neutral-200">
        <div className="w-12 h-12 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center mb-4">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 id="session-expired-title" className="text-lg font-bold text-neutral-900">
          Authentication Session Expired
        </h3>
        <p className="text-sm text-neutral-600 mt-2 leading-relaxed">
          Your Firebase session has expired or the token could not be refreshed. For security and to
          prevent cross-user data leakage in Firestore, please sign in again.
        </p>
        <div className="mt-6 flex flex-col sm:flex-row gap-3 justify-end">
          <button
            onClick={dismissSessionExpired}
            className="px-4 py-2 text-sm font-medium text-neutral-600 hover:text-neutral-900 transition"
          >
            Dismiss
          </button>
          <button
            onClick={async () => {
              dismissSessionExpired();
              await signInWithGoogle();
            }}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-neutral-900 text-white rounded-lg text-sm font-medium hover:bg-neutral-800 transition shadow-sm"
          >
            <LogIn className="w-4 h-4" />
            <span>Sign In Again</span>
          </button>
        </div>
      </div>
    </div>
  );
};
