import React, { useState, useRef } from 'react';
import {
  FileText,
  Globe,
  Share2,
  Image as ImageIcon,
  Video,
  Youtube,
  UploadCloud,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useCapabilities } from '../../context/CapabilitiesContext';
import { InitialReflectionInput } from './InitialReflectionInput';
import { PrivacyNotice } from './PrivacyNotice';

type InputMode = 'text' | 'article_url' | 'social_post' | 'image' | 'youtube' | 'video_upload';

interface VerificationFormProps {
  onOperationStarted: (operationId: string) => void;
  onOpenSignIn: () => void;
}

export const VerificationForm: React.FC<VerificationFormProps> = ({
  onOperationStarted,
  onOpenSignIn,
}) => {
  const { principal, apiClient } = useAuth();
  const { capabilities, isMaintenanceMode } = useCapabilities();

  // Mode state
  const [activeMode, setActiveMode] = useState<InputMode>('article_url');

  // Input states (persisted across tab switches so user draft is never lost)
  const [textInput, setTextInput] = useState('');
  const [articleUrlInput, setArticleUrlInput] = useState('');
  const [socialUrlInput, setSocialUrlInput] = useState('');
  const [socialClaimInput, setSocialClaimInput] = useState('');
  const [youtubeUrlInput, setYoutubeUrlInput] = useState('');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaClaimInput, setMediaClaimInput] = useState('');
  const [saveExactGps, setSaveExactGps] = useState(false);

  // Reflection states
  const [priorConfidence, setPriorConfidence] = useState<number>(50);
  const [priorReflection, setPriorReflection] = useState<string>('');
  const [reflectionOpen, setReflectionOpen] = useState(false);

  // Submission state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // File input ref for clicking
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      setMediaFile(e.dataTransfer.files[0]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!principal) {
      onOpenSignIn();
      return;
    }

    if (isMaintenanceMode) {
      setErrorMsg('The verification engine is in maintenance mode. Submissions are temporarily paused.');
      return;
    }

    setIsSubmitting(true);

    try {
      const reflectionPayload = {
        initialReflection: priorReflection.trim() ? priorReflection.trim() : null,
        initialConfidence: reflectionOpen ? priorConfidence : null,
      };

      let acceptedOp;

      if (activeMode === 'text') {
        if (!textInput.trim() || textInput.trim().length < 3) {
          throw new Error('Please enter at least 3 characters of text or claim.');
        }
        acceptedOp = await apiClient.submitTextVerification({
          text: textInput.trim(),
          ...reflectionPayload,
        });
      } else if (activeMode === 'article_url') {
        if (!articleUrlInput.trim() || !articleUrlInput.startsWith('http')) {
          throw new Error('Please enter a valid HTTP or HTTPS article URL.');
        }
        acceptedOp = await apiClient.submitUrlVerification({
          url: articleUrlInput.trim(),
          ...reflectionPayload,
        });
      } else if (activeMode === 'social_post') {
        if (!socialUrlInput.trim() || !socialUrlInput.startsWith('http')) {
          throw new Error('Please enter a valid social post URL.');
        }
        acceptedOp = await apiClient.submitSocialVerification({
          url: socialUrlInput.trim(),
          accompanyingClaim: socialClaimInput.trim() || null,
          ...reflectionPayload,
        });
      } else if (activeMode === 'youtube') {
        if (!youtubeUrlInput.trim() || !youtubeUrlInput.includes('youtube.com') && !youtubeUrlInput.includes('youtu.be')) {
          throw new Error('Please enter a canonical public YouTube video URL.');
        }
        acceptedOp = await apiClient.submitSocialVerification({
          url: youtubeUrlInput.trim(),
          accompanyingClaim: socialClaimInput.trim() || null,
          ...reflectionPayload,
        });
      } else if (activeMode === 'image' || activeMode === 'video_upload') {
        if (!mediaFile) {
          throw new Error('Please select an image or video file to verify.');
        }
        acceptedOp = await apiClient.submitMediaVerification({
          file: mediaFile,
          accompanyingClaim: mediaClaimInput.trim() || null,
          saveExactGps,
          ...reflectionPayload,
        });
      }

      if (acceptedOp?.operationId) {
        onOperationStarted(acceptedOp.operationId);
      } else {
        throw new Error('Verification request accepted, but no operation identifier was returned.');
      }
    } catch (err: unknown) {
      console.error('Submission error:', err);
      // NOTE: User input is intentionally kept intact so work is not lost
      setErrorMsg(err instanceof Error ? err.message : 'Failed to submit verification request.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const modeButtons: Array<{
    id: InputMode;
    label: string;
    icon: React.ReactNode;
    capabilityKey?: keyof NonNullable<typeof capabilities>;
  }> = [
    { id: 'article_url', label: 'Article / Blog URL', icon: <Globe className="w-4 h-4" />, capabilityKey: 'urlVerification' },
    { id: 'text', label: 'Pasted Text', icon: <FileText className="w-4 h-4" />, capabilityKey: 'textVerification' },
    { id: 'social_post', label: 'Social Post', icon: <Share2 className="w-4 h-4" />, capabilityKey: 'socialVerification' },
    { id: 'image', label: 'Direct Image', icon: <ImageIcon className="w-4 h-4" />, capabilityKey: 'imageProvenance' },
    { id: 'youtube', label: 'YouTube Video', icon: <Youtube className="w-4 h-4" />, capabilityKey: 'youtubeVideo' },
    { id: 'video_upload', label: 'Short Video', icon: <Video className="w-4 h-4" />, capabilityKey: 'shortVideoUpload' },
  ];

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
      {/* Geometric Balance Header */}
      <div className="p-6 pb-5 border-b border-gray-100 bg-[#F8FAFC]">
        <div className="flex items-center gap-2 mb-1">
          <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5 rounded uppercase tracking-wider">
            Integrity Verification
          </span>
          <span className="text-gray-400 text-xs">Asynchronous 202 Polling Job</span>
        </div>
        <h2 className="text-xl sm:text-2xl font-bold text-[#0F172A] tracking-tight">
          Submit Evidence for Multimodal Verification
        </h2>
        <p className="text-xs sm:text-sm text-gray-600 mt-1 leading-relaxed">
          VeriJournal AI extracts verifiable propositions, checks Google Fact Check Tools records,
          gathers search-grounded citations, and inspects media provenance without fabricating conclusions.
        </p>
      </div>

      {/* Mode Selection Tabs */}
      <div className="border-b border-gray-200 bg-[#F1F5F9] px-4 pt-3 flex flex-wrap gap-1.5 overflow-x-auto">
        {modeButtons.map((btn) => {
          const isSelected = activeMode === btn.id;
          const isDisabled = btn.capabilityKey && capabilities && capabilities[btn.capabilityKey] === false;

          return (
            <button
              key={btn.id}
              type="button"
              onClick={() => {
                if (!isDisabled) {
                  setActiveMode(btn.id);
                  setErrorMsg(null);
                }
              }}
              disabled={isDisabled}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-t-md transition border-t border-x ${
                isSelected
                  ? 'bg-white text-[#0F172A] border-gray-200 -mb-[1px] shadow-xs'
                  : isDisabled
                  ? 'text-gray-400 border-transparent cursor-not-allowed opacity-60'
                  : 'text-gray-600 border-transparent hover:text-gray-900 hover:bg-white/60'
              }`}
            >
              <span className={isSelected ? 'text-[#0284c7]' : 'text-gray-400'}>{btn.icon}</span>
              <span>{btn.label}</span>
              {isDisabled && (
                <span className="text-[10px] font-mono uppercase bg-gray-200 text-gray-600 px-1 py-0.2 rounded">
                  Disabled
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Form Content */}
      <form onSubmit={handleSubmit} className="p-6 space-y-6">
        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-start gap-2.5 animate-fadeIn"
          >
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="font-semibold">Submission Incomplete:</strong>
              <p>{errorMsg}</p>
            </div>
          </div>
        )}

        {/* 1. Article / Blog URL */}
        {activeMode === 'article_url' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="article-url-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                Article or Web Publication URL <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  id="article-url-input"
                  type="url"
                  required
                  placeholder="https://example.com/news/article-headline-2026"
                  value={articleUrlInput}
                  onChange={(e) => setArticleUrlInput(e.target.value)}
                  className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none text-neutral-900 placeholder:text-neutral-400 font-mono"
                />
              </div>
              <p className="text-[11px] text-neutral-500 mt-1">
                The URL is checked against Google Safe Browsing and SSRF security gates before bounded content extraction.
              </p>
            </div>
          </div>
        )}

        {/* 2. Pasted Text */}
        {activeMode === 'text' && (
          <div className="space-y-3">
            <div>
              <label htmlFor="text-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                Claim Text or Statement Excerpt <span className="text-rose-500">*</span>
              </label>
              <textarea
                id="text-input"
                required
                rows={5}
                minLength={3}
                maxLength={30000}
                placeholder="Paste news excerpt, speech quote, or factual assertion to check against verified evidence ledgers..."
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                className="w-full text-sm p-3 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none text-neutral-900 placeholder:text-neutral-400 leading-relaxed"
              />
              <div className="flex justify-between text-[11px] text-neutral-400 mt-1">
                <span>Min 3 characters</span>
                <span>{textInput.length} / 30,000</span>
              </div>
            </div>
          </div>
        )}

        {/* 3. Social Post URL */}
        {activeMode === 'social_post' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="social-url-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                Social Media Post URL <span className="text-rose-500">*</span>
              </label>
              <input
                id="social-url-input"
                type="url"
                required
                placeholder="https://x.com/username/status/1234567890"
                value={socialUrlInput}
                onChange={(e) => setSocialUrlInput(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none text-neutral-900 placeholder:text-neutral-400 font-mono"
              />
            </div>
            <div>
              <label htmlFor="social-claim-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                Accompanying Claim or Caption (Optional)
              </label>
              <input
                id="social-claim-input"
                type="text"
                placeholder="e.g. Video allegedly shows flood waters entering city transit station..."
                value={socialClaimInput}
                onChange={(e) => setSocialClaimInput(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none text-neutral-900 placeholder:text-neutral-400"
              />
              <p className="text-[11px] text-neutral-500 mt-1">
                For social media platforms where raw media bytes are not publicly accessible via compliant APIs, caption &amp; metadata analysis will be performed with honest partial coverage.
              </p>
            </div>
          </div>
        )}

        {/* 4. Public YouTube URL */}
        {activeMode === 'youtube' && (
          <div className="space-y-4">
            <div>
              <label htmlFor="youtube-url-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                Public YouTube Video URL <span className="text-rose-500">*</span>
              </label>
              <input
                id="youtube-url-input"
                type="url"
                required
                placeholder="https://www.youtube.com/watch?v=dQw4w9WgXcQ"
                value={youtubeUrlInput}
                onChange={(e) => setYoutubeUrlInput(e.target.value)}
                className="w-full text-sm px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none text-neutral-900 placeholder:text-neutral-400 font-mono"
              />
            </div>
            <div>
              <label htmlFor="yt-claim-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                Specific Claim or Scene of Interest (Optional)
              </label>
              <input
                id="yt-claim-input"
                type="text"
                placeholder="e.g. Speaker states at 02:40 that treaty signatories withdrew support..."
                value={socialClaimInput}
                onChange={(e) => setSocialClaimInput(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none text-neutral-900 placeholder:text-neutral-400"
              />
            </div>
          </div>
        )}

        {/* 5. Direct Image & 6. Short Video Upload */}
        {(activeMode === 'image' || activeMode === 'video_upload') && (
          <div className="space-y-4">
            <div>
              <span className="block text-xs font-semibold text-neutral-800 mb-1.5">
                {activeMode === 'image' ? 'Upload Image File (JPEG, PNG, WebP)' : 'Upload Short Video (MP4, WebM)'}{' '}
                <span className="text-rose-500">*</span>
              </span>

              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept={activeMode === 'image' ? 'image/jpeg,image/png,image/webp' : 'video/mp4,video/webm'}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    setMediaFile(e.target.files[0]);
                  }
                }}
              />

              <div
                onDragOver={(e) => e.preventDefault()}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                className={`border-2 border-dashed rounded-2xl p-6 text-center cursor-pointer transition ${
                  mediaFile
                    ? 'border-emerald-400 bg-emerald-50/30'
                    : 'border-neutral-300 hover:border-sky-500 hover:bg-sky-50/20'
                }`}
              >
                <div className="w-12 h-12 mx-auto rounded-full bg-sky-50 text-sky-700 flex items-center justify-center mb-3">
                  {mediaFile ? (
                    <CheckCircle2 className="w-6 h-6 text-emerald-600" />
                  ) : (
                    <UploadCloud className="w-6 h-6" />
                  )}
                </div>

                {mediaFile ? (
                  <div>
                    <p className="text-sm font-semibold text-neutral-900">{mediaFile.name}</p>
                    <p className="text-xs text-neutral-500 mt-0.5 font-mono">
                      {(mediaFile.size / (1024 * 1024)).toFixed(2)} MB • {mediaFile.type || 'Media File'}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setMediaFile(null);
                      }}
                      className="mt-2 text-xs font-medium text-rose-600 hover:underline"
                    >
                      Remove and choose another
                    </button>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm font-medium text-neutral-700">
                      Drag and drop your file here, or{' '}
                      <span className="text-sky-700 font-semibold underline underline-offset-2">browse</span>
                    </p>
                    <p className="text-[11px] text-neutral-400 mt-1">
                      {activeMode === 'image'
                        ? 'Max size: 10 MB. EXIF/GPS, C2PA, and Cloud Vision Web Detection will be checked.'
                        : 'Max size: 50 MB / 60 seconds duration. Keyframes will be analyzed.'}
                    </p>
                  </div>
                )}
              </div>
            </div>

            <div>
              <label htmlFor="media-claim-input" className="block text-xs font-semibold text-neutral-800 mb-1.5">
                Accompanying Claim Being Made About This Media
              </label>
              <input
                id="media-claim-input"
                type="text"
                placeholder="e.g. Photo claimed to be taken in downtown London during the blackout..."
                value={mediaClaimInput}
                onChange={(e) => setMediaClaimInput(e.target.value)}
                className="w-full text-xs px-3.5 py-2.5 rounded-xl border border-neutral-300 bg-white focus:ring-2 focus:ring-sky-500 focus:outline-none text-neutral-900 placeholder:text-neutral-400"
              />
            </div>
          </div>
        )}

        {/* Primary Enhancement: Personal Integrity Reflection Seed */}
        <InitialReflectionInput
          confidence={priorConfidence}
          onConfidenceChange={setPriorConfidence}
          reflection={priorReflection}
          onReflectionChange={setPriorReflection}
          isOpen={reflectionOpen}
          onToggle={() => setReflectionOpen(!reflectionOpen)}
        />

        {/* Privacy & Upload Consent Notice */}
        <PrivacyNotice
          showGpsOption={activeMode === 'image' || activeMode === 'video_upload'}
          saveExactGps={saveExactGps}
          onGpsChange={setSaveExactGps}
        />

        {/* Submission Action */}
        <div className="pt-2 flex items-center justify-between">
          <div className="text-[11px] text-neutral-500">
            {principal ? (
              <span>Authenticated as {principal.displayName || principal.email}</span>
            ) : (
              <span className="text-amber-700 font-medium">Sign in required to submit verification</span>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || isMaintenanceMode}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#38BDF8] hover:bg-[#38BDF8]/90 text-[#0F172A] font-bold rounded-md text-sm shadow-md transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin text-[#0F172A]" />
                <span>Enqueuing Verification...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-[#0F172A]" />
                <span>Begin Verification (202 Job)</span>
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
};
