import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, VideoItem } from '../../types/scene';
import { MultiBoxLayout, MultiBoxAssignment, DragItemPayload } from '../../types/multibox';
import { MultiBoxVideoSlot } from './MultiBoxVideoSlot';
import { MultiBoxSceneBank } from './MultiBoxSceneBank';
import {
  X,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Trash2,
  LayoutGrid,
  Maximize2,
  Minimize2,
  Layers,
} from 'lucide-react';

interface MultiBoxModalProps {
  isOpen: boolean;
  onClose: () => void;
  videos: VideoItem[];
  scenes: Scene[];
  thumbnails: Record<string, string>;
  initialVolume?: number;
}

export const MultiBoxModal: React.FC<MultiBoxModalProps> = ({
  isOpen,
  onClose,
  videos,
  scenes,
  thumbnails,
  initialVolume = 1,
}) => {
  // Container ref for HTML5 Fullscreen API
  const containerRef = useRef<HTMLDivElement>(null);

  // Fullscreen state (Requirement 1 & 3)
  const [isFullscreen, setIsFullscreen] = useState<boolean>(false);
  const [areControlsVisible, setAreControlsVisible] = useState<boolean>(true);
  const inactivityTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const isInteractingWithControlsRef = useRef<boolean>(false);

  const resetInactivityTimer = useCallback(() => {
    setAreControlsVisible(true);

    if (inactivityTimeoutRef.current) {
      clearTimeout(inactivityTimeoutRef.current);
      inactivityTimeoutRef.current = null;
    }

    if (isFullscreen) {
      inactivityTimeoutRef.current = setTimeout(() => {
        if (!isInteractingWithControlsRef.current) {
          setAreControlsVisible(false);
        }
      }, 3000);
    }
  }, [isFullscreen]);

  // Scene Bank sidebar visibility (in fullscreen, defaults to false so the entire video layout fills the screen; toggleable via header button)
  const [showSceneBank, setShowSceneBank] = useState<boolean>(true);

  // Default to 4 Boxes layout
  const [layout, setLayout] = useState<MultiBoxLayout>('4-box');

  // Slots assignments array (indices 0, 1, 2, 3) - ALWAYS starts empty
  const [assignments, setAssignments] = useState<(MultiBoxAssignment | null)[]>([
    null,
    null,
    null,
    null,
  ]);

  // Number of active visible slots for the current layout
  const visibleSlotCount =
    layout === '1-box'
      ? 1
      : layout === '2-box'
      ? 2
      : layout === '3A' || layout === '3B' || layout === '3-box'
      ? 3
      : 4;

  // Whenever modal closes, completely reset everything assigned to all boxes
  useEffect(() => {
    if (!isOpen) {
      setAssignments([null, null, null, null]);
      setIsFullscreen(false);
      setShowSceneBank(true);
    }
  }, [isOpen]);

  // Fullscreen handlers (Requirement 1, 3, 4, 5, 6)
  const enterFullscreen = useCallback(() => {
    setIsFullscreen(true);
    setShowSceneBank(false); // Maximize video boxes across full screen
    const elem = containerRef.current;
    if (elem) {
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if ((elem as any).webkitRequestFullscreen) {
        (elem as any).webkitRequestFullscreen();
      }
    }
  }, []);

  const exitFullscreen = useCallback(() => {
    setIsFullscreen(false);
    setShowSceneBank(true);
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (isFullscreen || document.fullscreenElement || (document as any).webkitFullscreenElement) {
      exitFullscreen();
    } else {
      enterFullscreen();
    }
  }, [isFullscreen, enterFullscreen, exitFullscreen]);

  // Synchronize when browser fullscreen state changes (e.g. Esc pressed natively in browser)
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isCurrentlyFullscreen = !!(
        document.fullscreenElement || (document as any).webkitFullscreenElement
      );
      setIsFullscreen(isCurrentlyFullscreen);
      if (!isCurrentlyFullscreen) {
        setShowSceneBank(true);
        setAreControlsVisible(true);
        isInteractingWithControlsRef.current = false;
        if (inactivityTimeoutRef.current) {
          clearTimeout(inactivityTimeoutRef.current);
          inactivityTimeoutRef.current = null;
        }
      } else {
        setAreControlsVisible(true);
        isInteractingWithControlsRef.current = false;
        if (inactivityTimeoutRef.current) {
          clearTimeout(inactivityTimeoutRef.current);
        }
        inactivityTimeoutRef.current = setTimeout(() => {
          if (!isInteractingWithControlsRef.current) {
            setAreControlsVisible(false);
          }
        }, 3000);
      }
    };

    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  // MultiBox fullscreen user activity & inactivity listener
  useEffect(() => {
    if (!isFullscreen || !isOpen) return;

    const handleUserActivity = () => {
      resetInactivityTimer();
    };

    const handlePointerUp = () => {
      if (isInteractingWithControlsRef.current) {
        isInteractingWithControlsRef.current = false;
        resetInactivityTimer();
      }
    };

    const container = containerRef.current;
    if (container) {
      container.addEventListener('mousemove', handleUserActivity);
      container.addEventListener('pointermove', handleUserActivity);
      container.addEventListener('mousedown', handleUserActivity);
      container.addEventListener('pointerdown', handleUserActivity);
      container.addEventListener('touchstart', handleUserActivity, { passive: true });
    }

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('mouseup', handlePointerUp);
    window.addEventListener('touchend', handlePointerUp);

    return () => {
      if (container) {
        container.removeEventListener('mousemove', handleUserActivity);
        container.removeEventListener('pointermove', handleUserActivity);
        container.removeEventListener('mousedown', handleUserActivity);
        container.removeEventListener('pointerdown', handleUserActivity);
        container.removeEventListener('touchstart', handleUserActivity);
      }
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('mouseup', handlePointerUp);
      window.removeEventListener('touchend', handlePointerUp);
    };
  }, [isFullscreen, isOpen, resetInactivityTimer]);

  // Clean close handler that completely resets all box assignments and playback state
  const handleClose = useCallback(() => {
    if (document.fullscreenElement || (document as any).webkitFullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any).webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
    setIsFullscreen(false);
    setAssignments([null, null, null, null]);
    onClose();
  }, [onClose]);

  // Keyboard shortcut: F for MultiBox Fullscreen, Escape to exit fullscreen or close MultiBox (Requirement 2 & 6)
  useEffect(() => {
    if (!isOpen) return;

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
      ) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return;

      // F: Toggle MultiBox Fullscreen (Requirement 2 & 5)
      if (e.key === 'f' || e.key === 'F' || e.code === 'KeyF') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        toggleFullscreen();
        return;
      }

      // Escape: Exit Fullscreen first if fullscreened; otherwise close MultiBox (Requirement 6)
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        e.stopImmediatePropagation();
        if (isFullscreen || document.fullscreenElement || (document as any).webkitFullscreenElement) {
          exitFullscreen();
        } else {
          handleClose();
        }
        return;
      }
    };

    window.addEventListener('keydown', onKeyDown, { capture: true });
    return () => window.removeEventListener('keydown', onKeyDown, { capture: true });
  }, [isOpen, isFullscreen, toggleFullscreen, exitFullscreen, handleClose]);

  if (!isOpen) return null;

  // Assign item to a slot
  const handleAssignSlot = (slotIndex: number, payload: DragItemPayload) => {
    const targetVideo = videos.find((v) => v.id === payload.videoId);
    if (!targetVideo) return;

    const targetScene = payload.sceneId ? scenes.find((s) => s.id === payload.sceneId) : undefined;

    const newAssignment: MultiBoxAssignment = {
      type: payload.type,
      videoId: targetVideo.id,
      sceneId: targetScene?.id,
      scene: targetScene,
      video: targetVideo,
      assignedAt: Date.now(),
    };

    setAssignments((prev) => {
      const next = [...prev];
      next[slotIndex] = newAssignment;
      return next;
    });
  };

  // Remove item from a slot
  const handleRemoveSlot = (slotIndex: number) => {
    setAssignments((prev) => {
      const next = [...prev];
      next[slotIndex] = null;
      return next;
    });
  };

  // Quick assign to first empty box or box 0
  const handleQuickAssign = (payload: DragItemPayload) => {
    let targetIndex = assignments.slice(0, visibleSlotCount).findIndex((a) => a === null);
    if (targetIndex === -1) {
      targetIndex = 0; // Replace first box if all are occupied
    }
    handleAssignSlot(targetIndex, payload);
  };

  // Clear all visible boxes
  const handleClearAll = () => {
    setAssignments([null, null, null, null]);
  };

  // Helper to render a video slot with auto-hide synchronized
  const renderSlot = (slotIndex: number) => (
    <MultiBoxVideoSlot
      key={`slot-${slotIndex}`}
      slotIndex={slotIndex}
      assignment={assignments[slotIndex]}
      onAssign={handleAssignSlot}
      onRemove={handleRemoveSlot}
      initialVolume={initialVolume}
      forceHideControls={isFullscreen && !areControlsVisible}
      isFullscreen={isFullscreen}
    />
  );

  return (
    <div
      ref={containerRef}
      data-multibox-modal="true"
      className={`${
        isFullscreen
          ? 'fixed inset-0 z-50 w-screen h-screen m-0 p-0 overflow-hidden bg-slate-950 flex flex-col select-none'
          : 'fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 select-none animate-in fade-in duration-200'
      } ${isFullscreen && !areControlsVisible ? 'cursor-none [&_*]:cursor-none' : ''}`}
    >
      {/* Blurred Backdrop (hidden during fullscreen) */}
      {!isFullscreen && (
        <div
          onClick={handleClose}
          className="fixed inset-0 bg-black/75 backdrop-blur-md cursor-pointer transition-opacity"
        />
      )}

      {/* MultiBox Window (takes 100% in fullscreen, or 96vw / 92vh in windowed mode) */}
      <div
        className={
          isFullscreen
            ? 'relative w-full h-full max-w-none max-h-none rounded-none border-none shadow-none bg-slate-950 flex flex-col z-10 overflow-hidden'
            : 'relative w-full max-w-[96vw] h-[92vh] bg-slate-950/95 border border-slate-800/90 rounded-3xl shadow-2xl overflow-hidden flex flex-col z-10 backdrop-blur-xl'
        }
      >
        {/* Top Header Bar */}
        <div
          onMouseEnter={() => {
            if (isFullscreen) {
              isInteractingWithControlsRef.current = true;
              if (inactivityTimeoutRef.current) {
                clearTimeout(inactivityTimeoutRef.current);
                inactivityTimeoutRef.current = null;
              }
              setAreControlsVisible(true);
            }
          }}
          onMouseLeave={() => {
            if (isFullscreen) {
              isInteractingWithControlsRef.current = false;
              resetInactivityTimer();
            }
          }}
          onPointerDown={() => {
            if (isFullscreen) {
              isInteractingWithControlsRef.current = true;
              if (inactivityTimeoutRef.current) {
                clearTimeout(inactivityTimeoutRef.current);
                inactivityTimeoutRef.current = null;
              }
              setAreControlsVisible(true);
            }
          }}
          onPointerUp={() => {
            if (isFullscreen) {
              isInteractingWithControlsRef.current = false;
              resetInactivityTimer();
            }
          }}
          className={`${
            isFullscreen ? 'px-4 py-2 bg-slate-900/95' : 'px-5 py-3.5 bg-slate-900/90'
          } border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 shrink-0 transition-opacity duration-300 ${
            isFullscreen
              ? areControlsVisible
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
              : 'opacity-100 pointer-events-auto'
          }`}
        >
          {/* Logo & Title */}
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-cyan-500 to-indigo-600 flex items-center justify-center text-slate-950 shadow-md shadow-cyan-500/30">
              <LayoutGrid className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-black text-white tracking-wider uppercase">
                  MultiBox <span className="text-cyan-400">Workspace</span>
                </h2>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-cyan-950/80 text-cyan-300 border border-cyan-500/40">
                  {visibleSlotCount} {visibleSlotCount === 1 ? 'Box' : 'Boxes'} Active
                </span>
                {isFullscreen && (
                  <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-emerald-950/80 text-emerald-300 border border-emerald-500/40 animate-pulse hidden sm:inline">
                    Fullscreen (F)
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block">
                Simultaneous multi-video scene grid • Drag or click items into any box
              </p>
            </div>
          </div>

          {/* Snap Layout Selector (Windows 11 Snap style - Requirement 4 & 5) */}
          <div className="flex items-center gap-2 bg-slate-950 p-1.5 rounded-2xl border border-slate-800">
            <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400 px-2 hidden md:inline">
              Layout:
            </span>

            {/* 1 Box */}
            <button
              onClick={() => setLayout('1-box')}
              className={`p-1.5 px-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold ${
                layout === '1-box'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              }`}
              title="1 Box: Single Large Display"
            >
              <div className="w-4 h-3 rounded-xs border-2 border-current" />
              <span className="text-[11px] font-mono">1</span>
            </button>

            {/* 2 Boxes */}
            <button
              onClick={() => setLayout('2-box')}
              className={`p-1.5 px-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold ${
                layout === '2-box'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              }`}
              title="2 Boxes: Side-by-Side Display"
            >
              <div className="w-4 h-3 rounded-xs border-2 border-current flex divide-x divide-current">
                <div className="w-1/2 h-full" />
                <div className="w-1/2 h-full" />
              </div>
              <span className="text-[11px] font-mono">2</span>
            </button>

            {/* 3A: 1 Large Left + 2 Stacked Right */}
            <button
              onClick={() => setLayout('3A')}
              className={`p-1.5 px-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold ${
                layout === '3A' || layout === '3-box'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              }`}
              title="3A: 1 Large Left + 2 Stacked Right"
            >
              <div className="w-4 h-3 rounded-xs border-2 border-current flex divide-x divide-current">
                <div className="w-1/2 h-full" />
                <div className="w-1/2 h-full flex flex-col divide-y divide-current">
                  <div className="h-1/2" />
                  <div className="h-1/2" />
                </div>
              </div>
              <span className="text-[11px] font-mono">3A</span>
            </button>

            {/* 3B: 1 Large Top + 2 Side-by-Side Bottom */}
            <button
              onClick={() => setLayout('3B')}
              className={`p-1.5 px-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold ${
                layout === '3B'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              }`}
              title="3B: 1 Large Top + 2 Side-by-Side Bottom"
            >
              <div className="w-4 h-3 rounded-xs border-2 border-current flex flex-col divide-y divide-current">
                <div className="h-1/2 w-full" />
                <div className="h-1/2 w-full flex divide-x divide-current">
                  <div className="w-1/2" />
                  <div className="w-1/2" />
                </div>
              </div>
              <span className="text-[11px] font-mono">3B</span>
            </button>

            {/* 4 Boxes (2x2 Grid - Default) */}
            <button
              onClick={() => setLayout('4-box')}
              className={`p-1.5 px-2 rounded-xl flex items-center gap-1.5 transition-all text-xs font-bold ${
                layout === '4-box'
                  ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-400/80 shadow-md shadow-cyan-500/20'
                  : 'text-slate-400 hover:text-white hover:bg-slate-800 border border-transparent'
              }`}
              title="4 Boxes: 2x2 Quad Grid (Default)"
            >
              <div className="w-4 h-3 rounded-xs border-2 border-current grid grid-cols-2 grid-rows-2">
                <div className="border-r border-b border-current" />
                <div className="border-b border-current" />
                <div className="border-r border-current" />
                <div />
              </div>
              <span className="text-[11px] font-mono">4</span>
            </button>
          </div>

          {/* Workspace Actions: Bank Toggle, Clear Boxes, Fullscreen, Close */}
          <div className="flex items-center gap-2">
            {/* Toggle Scene Bank Sidebar */}
            <button
              onClick={() => setShowSceneBank((prev) => !prev)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all ${
                showSceneBank
                  ? 'bg-indigo-500/20 text-indigo-300 border-indigo-500/40 shadow-sm'
                  : 'bg-slate-800/80 text-slate-400 border-slate-700/80 hover:text-white'
              }`}
              title={showSceneBank ? 'Hide MultiBox Scene Bank' : 'Show MultiBox Scene Bank'}
            >
              <Layers className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Bank</span>
            </button>

            {/* Clear All Visible Boxes Button */}
            <button
              onClick={handleClearAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-850 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700/80 hover:border-rose-500/40 text-xs font-bold transition-all"
              title="Clear all boxes to empty state"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Clear Boxes</span>
            </button>

            {/* MultiBox Fullscreen Toggle Button (Requirement 1 & 2) */}
            <button
              onClick={toggleFullscreen}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm ${
                isFullscreen
                  ? 'bg-cyan-500/25 text-cyan-300 border-cyan-400 hover:bg-cyan-500/35 shadow-cyan-500/20'
                  : 'bg-slate-800/90 text-slate-200 border-slate-700/80 hover:bg-slate-700 hover:text-white'
              }`}
              title={
                isFullscreen
                  ? 'Exit MultiBox Fullscreen (F or Esc)'
                  : 'MultiBox Fullscreen (F)'
              }
            >
              {isFullscreen ? (
                <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5 text-cyan-400" />
              )}
              <span>{isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}</span>
              <kbd className="hidden sm:inline px-1.5 py-0.2 rounded bg-slate-900 border border-slate-700 text-[10px] font-mono text-cyan-300 font-bold">
                F
              </kbd>
            </button>

            {/* Close Overlay Button */}
            <button
              onClick={handleClose}
              className="p-2 rounded-xl bg-slate-800/90 hover:bg-rose-600 text-slate-300 hover:text-white border border-slate-700 transition-all shadow-md group"
              title="Close MultiBox Window (Esc)"
            >
              <X className="w-4 h-4 group-hover:scale-110 transition-transform" />
            </button>
          </div>
        </div>

        {/* Main Workspace Body */}
        <div className="flex-1 flex overflow-hidden min-h-0">
          {/* LEFT: Dynamic Grid Video Workspace */}
          <div
            className={`flex-1 overflow-hidden flex flex-col min-h-0 bg-slate-950/60 ${
              isFullscreen ? 'p-2 sm:p-2.5' : 'p-3 sm:p-4'
            }`}
          >
            {layout === '1-box' && (
              <div className="w-full h-full">
                {renderSlot(0)}
              </div>
            )}

            {layout === '2-box' && (
              <div
                className={`w-full h-full grid grid-cols-1 md:grid-cols-2 ${
                  isFullscreen ? 'gap-2 sm:gap-2.5' : 'gap-3.5'
                }`}
              >
                {renderSlot(0)}
                {renderSlot(1)}
              </div>
            )}

            {/* Layout 3A: 1 Large Left + 2 Stacked Right */}
            {(layout === '3A' || layout === '3-box') && (
              <div
                className={`w-full h-full grid grid-cols-1 md:grid-cols-2 grid-rows-2 ${
                  isFullscreen ? 'gap-2 sm:gap-2.5' : 'gap-3.5'
                }`}
              >
                {/* Large Box Left (spans 2 rows) */}
                <div className="row-span-2 col-span-1 h-full min-h-0">
                  {renderSlot(0)}
                </div>
                {/* Top Right Box */}
                <div className="col-span-1 row-span-1 h-full min-h-0">
                  {renderSlot(1)}
                </div>
                {/* Bottom Right Box */}
                <div className="col-span-1 row-span-1 h-full min-h-0">
                  {renderSlot(2)}
                </div>
              </div>
            )}

            {/* Layout 3B: 1 Large Top + 2 Side-by-Side Bottom */}
            {layout === '3B' && (
              <div
                className={`w-full h-full grid grid-cols-2 grid-rows-2 ${
                  isFullscreen ? 'gap-2 sm:gap-2.5' : 'gap-3.5'
                }`}
              >
                {/* 1 Large Box across top half (spans 2 columns, 1 row) */}
                <div className="col-span-2 row-span-1 h-full min-h-0">
                  {renderSlot(0)}
                </div>
                {/* Bottom Left Box */}
                <div className="col-span-1 row-span-1 h-full min-h-0">
                  {renderSlot(1)}
                </div>
                {/* Bottom Right Box */}
                <div className="col-span-1 row-span-1 h-full min-h-0">
                  {renderSlot(2)}
                </div>
              </div>
            )}

            {layout === '4-box' && (
              <div
                className={`w-full h-full grid grid-cols-1 md:grid-cols-2 grid-rows-2 ${
                  isFullscreen ? 'gap-2 sm:gap-2.5' : 'gap-3.5'
                }`}
              >
                {renderSlot(0)}
                {renderSlot(1)}
                {renderSlot(2)}
                {renderSlot(3)}
              </div>
            )}
          </div>

          {/* RIGHT: Dedicated MultiBox Scene Bank Sidebar (collapsible in fullscreen) */}
          {showSceneBank && (
            <MultiBoxSceneBank
              videos={videos}
              scenes={scenes}
              thumbnails={thumbnails}
              onQuickAssign={handleQuickAssign}
            />
          )}
        </div>
      </div>
    </div>
  );
};
