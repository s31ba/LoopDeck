import React, { useState, useEffect, useRef } from 'react';
import {
  Link2,
  X,
  Play,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Globe,
  Film,
} from 'lucide-react';
import { generateVideoThumbnail } from '../utils/thumbnail';

interface LinkVideoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoLoaded: (videoData: {
    id: string;
    name: string;
    src: string;
    duration: number;
    thumbnail: string;
  }) => void;
}

type LoadingStep = 'idle' | 'connecting' | 'checking' | 'preparing' | 'ready' | 'error';

export const LinkVideoModal: React.FC<LinkVideoModalProps> = ({
  isOpen,
  onClose,
  onVideoLoaded,
}) => {
  // Input URL starts completely empty
  const [url, setUrl] = useState<string>('');
  const [step, setStep] = useState<LoadingStep>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [detailMessage, setDetailMessage] = useState<string>('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Focus input and reset state when opened
  useEffect(() => {
    if (isOpen) {
      setUrl('');
      setStep('idle');
      setErrorMessage(null);
      setDetailMessage('');
      setTimeout(() => inputRef.current?.focus(), 80);
    }
  }, [isOpen]);

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  // Test direct browser playback and CORS thumbnail extraction
  const testDirectPlayback = (
    testUrl: string
  ): Promise<{ ok: boolean; duration: number; thumbnail: string }> => {
    return new Promise((resolve) => {
      const video = document.createElement('video');
      // NOTE: Do NOT set video.crossOrigin = 'anonymous' here!
      // Browsers can play ANY cross-origin video in <video> elements natively,
      // but setting crossOrigin='anonymous' blocks servers that lack CORS headers.
      video.muted = true;
      video.playsInline = true;
      video.preload = 'metadata';

      let resolved = false;
      const cleanUp = () => {
        video.removeAttribute('src');
        video.load();
        video.remove();
      };

      const finish = (ok: boolean, duration = 0, thumbnail = '') => {
        if (resolved) return;
        resolved = true;
        clearTimeout(timer);
        cleanUp();
        resolve({ ok, duration, thumbnail });
      };

      // Timeout for direct playback check
      const timer = setTimeout(() => {
        finish(false, 0, '');
      }, 4000);

      const tryExtractThumbnail = (): string => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext('2d');
          if (ctx && video.videoWidth > 0) {
            ctx.drawImage(video, 0, 0, 160, 90);
            return canvas.toDataURL('image/jpeg', 0.65);
          }
        } catch {
          // Canvas tainted due to cross-origin restriction - that is completely normal,
          // the video still plays perfectly in the HTML5 video element!
        }
        return '';
      };

      video.onloadeddata = () => {
        const thumb = tryExtractThumbnail();
        finish(true, video.duration || 0, thumb);
      };

      video.oncanplay = () => {
        const thumb = tryExtractThumbnail();
        finish(true, video.duration || 0, thumb);
      };

      video.onloadedmetadata = () => {
        if (video.duration > 0) {
          // Give a brief window to capture a frame thumbnail if available
          setTimeout(() => {
            const thumb = tryExtractThumbnail();
            finish(true, video.duration || 0, thumb);
          }, 500);
        }
      };

      video.onerror = () => {
        finish(false, 0, '');
      };

      video.src = testUrl;
      video.load();
    });
  };

  const handleLoadVideo = async () => {
    const trimmed = url.trim();
    if (!trimmed) {
      setErrorMessage('Please enter a video URL.');
      return;
    }

    if (!/^https?:\/\//i.test(trimmed)) {
      setErrorMessage('URL must begin with http:// or https://');
      return;
    }

    setErrorMessage(null);
    setStep('connecting');
    setDetailMessage('Testing direct browser playback...');

    try {
      // 1. Try direct browser playback first (works on ALL hosts, including GitHub Pages)
      const directResult = await testDirectPlayback(trimmed);

      if (directResult.ok) {
        setStep('ready');
        setDetailMessage('Direct video playback verified!');

        let name = 'Linked Video';
        try {
          const parsed = new URL(trimmed);
          const base = parsed.pathname.split('/').filter(Boolean).pop();
          if (base && base.length > 2) {
            name = decodeURIComponent(base);
          } else {
            name = `${parsed.hostname}_video`;
          }
        } catch {
          name = 'Linked Video';
        }

        const videoId = `video-link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        onVideoLoaded({
          id: videoId,
          name,
          src: trimmed,
          duration: directResult.duration,
          thumbnail: directResult.thumbnail,
        });

        setTimeout(() => onClose(), 450);
        return;
      }

      // 2. Direct playback failed: fallback to server-side remote retrieval / proxy layer (if fullstack)
      setStep('checking');
      setDetailMessage('Connecting via server proxy layer...');

      // Transition to preparing step to inform user
      const prepTimer = setTimeout(() => {
        setStep('preparing');
        setDetailMessage('Analyzing media stream, remuxing/transcoding if needed...');
      }, 1200);

      let res: Response;
      try {
        res = await fetch('/api/link-video', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ url: trimmed }),
        });
      } catch {
        clearTimeout(prepTimer);
        throw new Error(
          'Could not connect to backend server. On static hosting like GitHub Pages, please provide a direct playable video link (such as .mp4 or .webm) or upload the video file directly.'
        );
      }

      clearTimeout(prepTimer);

      if (!res.ok) {
        if (res.status === 405 || res.status === 404) {
          throw new Error(
            'This video link could not be played directly in the browser. Note: On static GitHub Pages, server-side transcoding (/api) is unavailable. Please link a direct video file (.mp4, .webm) or use the Upload Video button.'
          );
        }
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Server responded with HTTP ${res.status}`);
      }

      const data = await res.json();
      if (!data.streamUrl) {
        throw new Error('Server did not return a valid stream URL.');
      }

      setStep('ready');
      setDetailMessage(
        data.transcoded
          ? 'Video transcoded to browser-compatible H.264 format!'
          : data.remuxed
          ? 'Video remuxed into browser MP4 container!'
          : 'Video prepared and ready!'
      );

      // Generate thumbnail from proxied media
      const thumb = await generateVideoThumbnail(data.streamUrl);

      const videoId = `video-link-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
      onVideoLoaded({
        id: videoId,
        name: data.name || 'Linked Video',
        src: data.streamUrl,
        duration: data.duration || 0,
        thumbnail: thumb,
      });

      setTimeout(() => onClose(), 500);
    } catch (err: any) {
      console.error('Link video loading error:', err);
      setStep('error');
      setErrorMessage(
        err?.message || 'Could not load video from the provided URL. Please verify the link and try again.'
      );
      setDetailMessage('');
    }
  };

  const stepsList = [
    { key: 'connecting', label: 'Connecting' },
    { key: 'checking', label: 'Checking Video' },
    { key: 'preparing', label: 'Preparing Video' },
    { key: 'ready', label: 'Ready' },
  ];

  const getStepIndex = (s: LoadingStep) => {
    switch (s) {
      case 'connecting':
        return 0;
      case 'checking':
        return 1;
      case 'preparing':
        return 2;
      case 'ready':
        return 3;
      default:
        return -1;
    }
  };

  const activeIndex = getStepIndex(step);
  const isLoading = step === 'connecting' || step === 'checking' || step === 'preparing';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 select-none animate-in fade-in duration-200">
      {/* Blurred Backdrop */}
      <div
        onClick={isLoading ? undefined : onClose}
        className="fixed inset-0 bg-black/80 backdrop-blur-md cursor-pointer transition-opacity"
      />

      {/* Modal Dialog Box */}
      <div className="relative w-full max-w-lg bg-slate-900/95 border border-slate-800 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 backdrop-blur-xl">
        {/* Top Header */}
        <div className="px-6 py-4 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/20">
              <Link2 className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <h3 className="text-sm font-black text-white uppercase tracking-wider">
                Link Video <span className="text-cyan-400">URL</span>
              </h3>
              <p className="text-[11px] text-slate-400">
                Load remote video via direct playback or server proxy
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            disabled={isLoading}
            className="p-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700/80 transition-colors disabled:opacity-50"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex flex-col gap-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!isLoading) handleLoadVideo();
            }}
            className="flex flex-col gap-3"
          >
            <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5 text-cyan-400" />
              <span>Video Web Address</span>
            </label>

            <div className="relative flex items-center">
              <input
                ref={inputRef}
                type="url"
                value={url}
                onChange={(e) => {
                  setUrl(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                disabled={isLoading}
                placeholder="https://example.com/video.mp4 or streaming URL..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400/50 transition-all font-mono disabled:opacity-60"
              />
              {url && !isLoading && (
                <button
                  type="button"
                  onClick={() => setUrl('')}
                  className="absolute right-3 p-1 rounded-lg text-slate-500 hover:text-slate-300 transition-colors"
                  title="Clear URL"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              Accepts direct video links (MP4, WebM, OGG). Direct video files play natively in the browser on any host (including GitHub Pages). Webpage URLs (like YouTube watch pages) require the fullstack backend transcoding server.
            </p>
          </form>

          {/* Stepper Progress Indicator (when loading or completed) */}
          {(isLoading || step === 'ready') && (
            <div className="mt-1 p-3.5 rounded-2xl bg-slate-950/80 border border-slate-800/80 flex flex-col gap-2.5 animate-in fade-in">
              <div className="grid grid-cols-4 gap-1.5 text-center">
                {stepsList.map((s, idx) => {
                  const isCurrent = activeIndex === idx;
                  const isDone = activeIndex > idx;
                  return (
                    <div
                      key={s.key}
                      className={`flex flex-col items-center gap-1 p-1.5 rounded-xl border text-[10px] font-bold transition-all ${
                        isCurrent
                          ? 'border-cyan-400 bg-cyan-950/50 text-cyan-300 shadow-sm shadow-cyan-500/20'
                          : isDone
                          ? 'border-emerald-500/40 bg-emerald-950/30 text-emerald-400'
                          : 'border-slate-800/80 bg-slate-900/40 text-slate-500'
                      }`}
                    >
                      <div className="flex items-center justify-center">
                        {isDone ? (
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                        ) : isCurrent ? (
                          <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                        ) : (
                          <div className="w-3 h-3 rounded-full border border-slate-600" />
                        )}
                      </div>
                      <span className="truncate max-w-full">{s.label}</span>
                    </div>
                  );
                })}
              </div>

              {detailMessage && (
                <p className="text-[11px] text-center font-medium text-slate-300 animate-pulse">
                  {detailMessage}
                </p>
              )}
            </div>
          )}

          {/* Error Message & Retry Box */}
          {step === 'error' && (
            <div className="p-3.5 rounded-2xl bg-rose-950/30 border border-rose-500/40 text-rose-200 flex flex-col gap-2.5 animate-in shake duration-200">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                <div className="text-xs font-semibold leading-relaxed">
                  {errorMessage || 'Failed to load video from URL.'}
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-1 border-t border-rose-500/20">
                <button
                  type="button"
                  onClick={handleLoadVideo}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/50 text-xs font-bold transition-all"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>Retry</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950/80 border-t border-slate-800/80 flex items-center justify-end gap-2.5">
          <button
            type="button"
            onClick={onClose}
            disabled={isLoading}
            className="px-4 py-2 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white text-xs font-bold border border-slate-700/80 transition-colors disabled:opacity-50"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={handleLoadVideo}
            disabled={isLoading || !url.trim()}
            className="flex items-center gap-2 px-5 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:via-sky-400 hover:to-indigo-500 text-white font-extrabold text-xs shadow-lg shadow-cyan-500/25 transition-all hover:scale-102 active:scale-98 disabled:opacity-50 disabled:pointer-events-none"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Processing Video...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Load Video</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
