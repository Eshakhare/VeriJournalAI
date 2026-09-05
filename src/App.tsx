import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { CapabilitiesProvider, useCapabilities } from './context/CapabilitiesContext';
import { Header } from './components/Header';
import { MaintenanceBanner } from './components/MaintenanceBanner';
import { SessionExpiredModal } from './components/SessionExpiredModal';
import { SignInModal } from './components/Auth/SignInModal';
import { VerificationForm } from './components/VerificationInput/VerificationForm';
import { OperationWatcher } from './components/OperationProgress/OperationWatcher';
import { JournalListView } from './components/Journal/JournalListView';
import { JournalDetailView } from './components/Journal/JournalDetailView';
import { AboutView } from './components/About/AboutView';

type ViewMode = 'create' | 'journal' | 'about';

const MainContent: React.FC = () => {
  const { isMaintenanceMode } = useCapabilities();
  const [currentView, setCurrentView] = useState<ViewMode>('create');
  const [activeOperationId, setActiveOperationId] = useState<string | null>(null);
  const [selectedEntryId, setSelectedEntryId] = useState<string | null>(null);
  const [signInOpen, setSignInOpen] = useState<boolean>(false);

  // Parse URL hash on mount or hashchange (e.g. #op=op_123 or #entry=entry_456)
  useEffect(() => {
    const handleHashChange = () => {
      const hash = window.location.hash;
      if (hash.startsWith('#op=')) {
        setActiveOperationId(hash.replace('#op=', ''));
        setSelectedEntryId(null);
      } else if (hash.startsWith('#entry=')) {
        setSelectedEntryId(hash.replace('#entry=', ''));
        setActiveOperationId(null);
      } else if (hash === '#journal') {
        setCurrentView('journal');
        setActiveOperationId(null);
        setSelectedEntryId(null);
      } else if (hash === '#about') {
        setCurrentView('about');
        setActiveOperationId(null);
        setSelectedEntryId(null);
      }
    };

    handleHashChange();
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleNavigate = (view: ViewMode) => {
    setCurrentView(view);
    setActiveOperationId(null);
    setSelectedEntryId(null);
    window.location.hash = `#${view}`;
  };

  const handleOperationStarted = (operationId: string) => {
    setActiveOperationId(operationId);
    setSelectedEntryId(null);
    window.location.hash = `#op=${operationId}`;
  };

  const handleOperationComplete = (entryId: string) => {
    setActiveOperationId(null);
    setSelectedEntryId(entryId);
    window.location.hash = `#entry=${entryId}`;
  };

  const handleSelectEntry = (entryId: string) => {
    setSelectedEntryId(entryId);
    setActiveOperationId(null);
    window.location.hash = `#entry=${entryId}`;
  };

  const handleBackToJournal = () => {
    setSelectedEntryId(null);
    setActiveOperationId(null);
    setCurrentView('journal');
    window.location.hash = '#journal';
  };

  return (
    <div className="min-h-screen bg-[#F4F5F7] text-[#1A1A1B] flex flex-col font-sans antialiased selection:bg-[#38BDF8]/30 selection:text-[#0F172A]">
      <Header
        currentView={currentView}
        onNavigate={handleNavigate}
        onOpenSignIn={() => setSignInOpen(true)}
      />

      {isMaintenanceMode && <MaintenanceBanner />}
      <SessionExpiredModal />
      <SignInModal isOpen={signInOpen} onClose={() => setSignInOpen(false)} />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* If an active verification job is running, display the phased operation watcher */}
        {activeOperationId ? (
          <OperationWatcher
            operationId={activeOperationId}
            onComplete={handleOperationComplete}
            onCancel={() => {
              setActiveOperationId(null);
              window.location.hash = '#create';
            }}
          />
        ) : selectedEntryId ? (
          /* Detailed investigation report */
          <JournalDetailView
            entryId={selectedEntryId}
            onBack={handleBackToJournal}
          />
        ) : currentView === 'create' ? (
          /* Submission view */
          <div className="max-w-3xl mx-auto">
            <VerificationForm
              onOperationStarted={handleOperationStarted}
              onOpenSignIn={() => setSignInOpen(true)}
            />
          </div>
        ) : currentView === 'journal' ? (
          /* Journal list view */
          <JournalListView
            onSelectEntry={handleSelectEntry}
            onNewVerification={() => handleNavigate('create')}
          />
        ) : (
          /* About and governance view */
          <AboutView />
        )}
      </main>

      <footer className="border-t border-gray-200 bg-white py-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-[#38BDF8]"></span>
            <span className="font-semibold text-gray-700">VeriJournal AI</span>
            <span>• Geometric Balance Framework</span>
          </div>
          <span className="font-mono text-[11px] text-gray-400">
            Isolated Firestore Data Model • Epistemic Integrity
          </span>
        </div>
      </footer>
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <CapabilitiesProvider>
        <MainContent />
      </CapabilitiesProvider>
    </AuthProvider>
  );
}
