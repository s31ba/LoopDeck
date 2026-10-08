import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Scene } from '../types/scene';
import { formatTimestamp, formatDuration } from '../utils/time';
import {
  Plus,
  Minus,
  Activity,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Circle,
  Square,
  Film,
} from 'lucide-react';

interface TimelineProps {
  videoSrc?: string | null;
  duration: number;
  currentTime: number;
  scenes: Scene[];
  activeSceneId: string | null;
  selectedSceneId: string | null;
  // Record Scene Props
  isRecording?: boolean;
  recordingStartTime?: number | null;
  onToggleRecord?: () => void;
  // Standard callbacks
  onSeek: (time: number) => void;
  onSelectScene: (sceneId: string) => void;
  onPlayScene: (scene: Scene) => void;
  onUpdateSceneTimes: (sceneId: string, start: number, end: number) => void;
  onCreateSceneFromRange: (start: number, end: number) => void;
}

const ZOOM_PRESETS = [1, 1.5, 2, 3, 5, 8, 12];

export const Timeline: React.FC<TimelineProps> = ({
  videoSrc = null,
  duration,
  currentTime,
  scenes,
  activeSceneId,
  selectedSceneId,
  isRecording = false,
  recordingStartTime = null,
  onToggleRecord,
  onSeek,
  onSelectScene,
  onPlayScene,
  onUpdateSceneTimes,
  onCreateSceneFromRange,
}) => {
  const scrollWrapperRef = useRef<HTMLDivElement>(null);
  const trackContentRef = useRef<HTMLDivElement>(null);

  // Hover Thumbnail Preview Refs & State
  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const [hoverCursorX, setHoverCursorX] = useState<number | null>(null);
  const [hasPreviewFrame, setHasPreviewFrame] = useState<boolean>(false);
  const isSeekingPreviewRef = useRef<boolean>(false);
  const pendingSeekTimeRef = useRef<number | null>(null);

  const [isScrubbing, setIsScrubbing] = useState(false);
  const [hoverTime, setHoverTime] = useState<number | null>(null);

  // Setup preview video when videoSrc changes or when video is removed
  useEffect(() => {
    const video = previewVideoRef.current;
    if (!videoSrc || duration <= 0) {
      setHoverTime(null);
      setHoverCursorX(null);
      setHasPreviewFrame(false);
      isSeekingPreviewRef.current = false;
      pendingSeekTimeRef.current = null;
      if (video) {
        video.removeAttribute('src');
        video.load();
      }
      return;
    }

    setHasPreviewFrame(false);
    isSeekingPreviewRef.current = false;
    pendingSeekTimeRef.current = null;
    if (video) {
      video.src = videoSrc;
      video.load();
    }
  }, [videoSrc, duration]);

  // Request frame seek for hover preview
  const requestPreviewSeek = useCallback((targetTime: number) => {
    pendingSeekTimeRef.current = targetTime;
    const video = previewVideoRef.current;
    if (!video || video.readyState < HTMLMediaElement.HAVE_METADATA) return;

    if (!isSeekingPreviewRef.current) {
      isSeekingPreviewRef.current = true;
      const time = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = null;
      const safeTime = Math.max(0, Math.min(time, video.duration || time));
      if ('fastSeek' in video && typeof (video as unknown as { fastSeek: (t: number) => void }).fastSeek === 'function') {
        (video as unknown as { fastSeek: (t: number) => void }).fastSeek(safeTime);
      } else {
        video.currentTime = safeTime;
      }
    }
  }, []);

  // Handle preview video seeked event: draw to canvas
  const handlePreviewSeeked = useCallback(() => {
    const video = previewVideoRef.current;
    const canvas = previewCanvasRef.current;
    if (video && canvas && video.videoWidth > 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setHasPreviewFrame(true);
      }
    }

    if (pendingSeekTimeRef.current !== null && video) {
      const nextTime = pendingSeekTimeRef.current;
      pendingSeekTimeRef.current = null;
      const safeTime = Math.max(0, Math.min(nextTime, video.duration || nextTime));
      if ('fastSeek' in video && typeof (video as unknown as { fastSeek: (t: number) => void }).fastSeek === 'function') {
        (video as unknown as { fastSeek: (t: number) => void }).fastSeek(safeTime);
      } else {
        video.currentTime = safeTime;
      }
    } else {
      isSeekingPreviewRef.current = false;
    }
  }, []);

  const handlePreviewLoadedData = useCallback(() => {
    const video = previewVideoRef.current;
    const canvas = previewCanvasRef.current;
    if (video && canvas && video.videoWidth > 0) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
        setHasPreviewFrame(true);
      }
    }
  }, []);

  // Timeout safeguard for preview seeking
  useEffect(() => {
    const timer = setInterval(() => {
      if (isSeekingPreviewRef.current && pendingSeekTimeRef.current !== null) {
        const video = previewVideoRef.current;
        if (video && video.readyState >= HTMLMediaElement.HAVE_METADATA) {
          const nextTime = pendingSeekTimeRef.current;
          pendingSeekTimeRef.current = null;
          video.currentTime = Math.max(0, Math.min(nextTime, video.duration || nextTime));
        }
      }
    }, 150);
    return () => clearInterval(timer);
  }, []);

  // Zoom level: 1 = 100% (Fit), 2 = 200%, 3 = 300%, etc.
  const [zoomLevel, setZoomLevel] = useState<number>(1);

  const [draggingHandle, setDraggingHandle] = useState<{
    sceneId: string;
    type: 'start' | 'end';
  } | null>(null);

  const [selectionRange, setSelectionRange] = useState<{
    start: number;
    end: number;
  } | null>(null);

  const [isSelectingRange, setIsSelectingRange] = useState(false);

  const effectiveDuration = duration > 0 ? duration : 1;

  // Zoom In / Out Handlers
  const handleZoomIn = () => {
    const next = ZOOM_PRESETS.find((z) => z > zoomLevel);
    setZoomLevel(next || ZOOM_PRESETS[ZOOM_PRESETS.length - 1]);
  };

  const handleZoomOut = () => {
    const prev = [...ZOOM_PRESETS].reverse().find((z) => z < zoomLevel);
    setZoomLevel(prev || 1);
  };

  const handleFitZoom = () => {
    setZoomLevel(1);
    if (scrollWrapperRef.current) {
      scrollWrapperRef.current.scrollLeft = 0;
    }
  };

  // Convert clientX to timeline seconds taking zoom and horizontal scroll into account
  const getTimeFromX = useCallback(
    (clientX: number): number => {
      if (!scrollWrapperRef.current || !trackContentRef.current) return 0;
      const wrapperRect = scrollWrapperRef.current.getBoundingClientRect();
      const scrollLeft = scrollWrapperRef.current.scrollLeft;
      const totalTrackWidth = trackContentRef.current.offsetWidth;

      const clickX = Math.max(
        0,
        Math.min(clientX - wrapperRect.left + scrollLeft, totalTrackWidth)
      );
      const percentage = clickX / totalTrackWidth;
      return percentage * effectiveDuration;
    },
    [effectiveDuration]
  );

  // Auto-scroll when playhead moves near or past the visible boundary in zoomed view
  useEffect(() => {
    if (zoomLevel <= 1 || isScrubbing || draggingHandle || isSelectingRange) return;
    const wrapper = scrollWrapperRef.current;
    const track = trackContentRef.current;
    if (!wrapper || !track) return;

    const playheadPx = (currentTime / effectiveDuration) * track.offsetWidth;
    const viewLeft = wrapper.scrollLeft;
    const viewRight = viewLeft + wrapper.clientWidth;

    if (playheadPx > viewRight - 60 || playheadPx < viewLeft + 20) {
      wrapper.scrollTo({
        left: Math.max(0, playheadPx - wrapper.clientWidth * 0.3),
        behavior: 'smooth',
      });
    }
  }, [currentTime, zoomLevel, effectiveDuration, isScrubbing, draggingHandle, isSelectingRange]);

  // Center on current playback position when zoom level changes
  useEffect(() => {
    if (zoomLevel <= 1) return;
    const wrapper = scrollWrapperRef.current;
    const track = trackContentRef.current;
    if (!wrapper || !track) return;

    const raf = requestAnimationFrame(() => {
      const playheadPx = (currentTime / effectiveDuration) * track.offsetWidth;
      wrapper.scrollTo({
        left: Math.max(0, playheadPx - wrapper.clientWidth / 2),
        behavior: 'smooth',
      });
    });
    return () => cancelAnimationFrame(raf);
  }, [zoomLevel]);

  // Handle mouse wheel for horizontal scrolling and Ctrl+Wheel zooming
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      if (e.deltaY < 0) {
        handleZoomIn();
      } else {
        handleZoomOut();
      }
    } else if (zoomLevel > 1 && scrollWrapperRef.current) {
      // Horizontal pan with standard mouse wheel or trackpad
      const scrollDelta = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY;
      scrollWrapperRef.current.scrollLeft += scrollDelta;
    }
  };

  // Scrubbing & Dragging Handlers
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      // Auto-scroll when dragging near viewport edges in zoomed view
      if (zoomLevel > 1 && scrollWrapperRef.current && (isScrubbing || draggingHandle || isSelectingRange)) {
        const wrapperRect = scrollWrapperRef.current.getBoundingClientRect();
        if (e.clientX > wrapperRect.right - 40) {
          scrollWrapperRef.current.scrollLeft += 10;
        } else if (e.clientX < wrapperRect.left + 40) {
          scrollWrapperRef.current.scrollLeft -= 10;
        }
      }

      if (isScrubbing) {
        const time = getTimeFromX(e.clientX);
        onSeek(time);
      } else if (draggingHandle) {
        const newTime = Math.max(0, Math.min(getTimeFromX(e.clientX), effectiveDuration));
        const scene = scenes.find((s) => s.id === draggingHandle.sceneId);
        if (scene) {
          if (draggingHandle.type === 'start') {
            const validStart = Math.min(newTime, scene.endTime - 0.1);
            onUpdateSceneTimes(scene.id, validStart, scene.endTime);
          } else {
            const validEnd = Math.max(newTime, scene.startTime + 0.1);
            onUpdateSceneTimes(scene.id, scene.startTime, validEnd);
          }
        }
      } else if (isSelectingRange && selectionRange) {
        const currentMouseTime = Math.max(0, Math.min(getTimeFromX(e.clientX), effectiveDuration));
        setSelectionRange((prev) => (prev ? { ...prev, end: currentMouseTime } : null));
      }
    };

    const handleMouseUp = () => {
      if (isScrubbing) {
        setIsScrubbing(false);
      }
      if (draggingHandle) {
        setDraggingHandle(null);
      }
      if (isSelectingRange && selectionRange) {
        setIsSelectingRange(false);
        const start = Math.min(selectionRange.start, selectionRange.end);
        const end = Math.max(selectionRange.start, selectionRange.end);
        if (end - start > 0.2) {
          onCreateSceneFromRange(start, end);
        }
        setSelectionRange(null);
      }
    };

    if (isScrubbing || draggingHandle || isSelectingRange) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [
    isScrubbing,
    draggingHandle,
    isSelectingRange,
    selectionRange,
    effectiveDuration,
    zoomLevel,
    getTimeFromX,
    onSeek,
    onUpdateSceneTimes,
    onCreateSceneFromRange,
    scenes,
  ]);

  // Scaled Ruler Ticks based on Zoom Level
  const generateRulerTicks = () => {
    if (effectiveDuration <= 0) {
      return { ticks: [] as number[], step: 5, visibleSecs: 0 };
    }
    const visibleSecs = effectiveDuration / zoomLevel;

    let step = 5;
    if (visibleSecs <= 2) step = 0.25;
    else if (visibleSecs <= 5) step = 0.5;
    else if (visibleSecs <= 10) step = 1;
    else if (visibleSecs <= 25) step = 2;
    else if (visibleSecs <= 60) step = 5;
    else if (visibleSecs <= 180) step = 10;
    else if (visibleSecs <= 400) step = 20;
    else if (visibleSecs <= 800) step = 30;
    else step = 60;

    const ticks: number[] = [];
    for (let t = 0; t <= effectiveDuration; t += step) {
      ticks.push(Math.round(t * 1000) / 1000);
    }
    return { ticks, step, visibleSecs };
  };

  const { ticks, step, visibleSecs } = generateRulerTicks();

  // Distribute overlapping scenes into visual lanes
  const assignLanes = (sceneList: Scene[]) => {
    const sorted = [...sceneList].sort((a, b) => a.startTime - b.startTime);
    const lanes: Scene[][] = [];

    sorted.forEach((scene) => {
      let placed = false;
      for (let i = 0; i < lanes.length; i++) {
        const lastInLane = lanes[i][lanes[i].length - 1];
        if (scene.startTime >= lastInLane.endTime - 0.05) {
          lanes[i].push(scene);
          placed = true;
          break;
        }
      }
      if (!placed) {
        lanes.push([scene]);
      }
    });

    return lanes.length > 0 ? lanes : [[]];
  };

  const lanes = assignLanes(scenes);
  const trackHeight = 40;
  const tracksTotalHeight = Math.max(lanes.length * trackHeight + 16, 60);

  const playheadPercent = (currentTime / effectiveDuration) * 100;

  const wrapperWidth = scrollWrapperRef.current?.clientWidth || 800;
  const tooltipHalfWidth = 94;
  const clampedX =
    hoverCursorX !== null
      ? Math.max(tooltipHalfWidth + 10, Math.min(hoverCursorX, wrapperWidth - tooltipHalfWidth - 10))
      : 0;

  const hoveringScene =
    hoverTime !== null
      ? scenes.find((s) => hoverTime >= s.startTime && hoverTime <= s.endTime)
      : null;

  return (
    <div className="relative z-30 w-full bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 select-none flex flex-col gap-2.5 shadow-xl backdrop-blur-md">
      {/* Header Info & Zoom Controls Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-xs text-slate-300 px-1">
        {/* Left Side: Title & Scene Count */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Activity className="w-3.5 h-3.5" />
            </span>
            <span className="font-extrabold text-white tracking-wide text-xs">
              Interactive Timeline
            </span>
          </div>

          <span className="px-2.5 py-0.5 rounded-full bg-slate-800 text-cyan-300 font-mono text-[11px] font-bold border border-slate-700">
            {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
          </span>

          {Boolean(videoSrc) && hoverTime !== null && (
            <span className="font-mono bg-cyan-950/80 text-cyan-300 px-2.5 py-0.5 rounded-lg text-xs font-bold border border-cyan-500/40 shadow-sm">
              {formatTimestamp(hoverTime)}
            </span>
          )}
        </div>

        {/* Right Side: Timeline Zoom Controls: [-] 100% [+] [Fit] */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 rounded-xl p-1 shadow-inner">
            <button
              onClick={handleZoomOut}
              disabled={zoomLevel <= 1}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs font-mono font-bold"
              title="Zoom Out Timeline (-)"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>

            <span className="font-mono text-xs font-extrabold text-cyan-300 px-2 min-w-[54px] text-center select-none">
              {Math.round(zoomLevel * 100)}%
            </span>

            <button
              onClick={handleZoomIn}
              disabled={zoomLevel >= ZOOM_PRESETS[ZOOM_PRESETS.length - 1]}
              className="flex items-center justify-center w-7 h-7 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition-colors text-xs font-mono font-bold"
              title="Zoom In Timeline (+)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>

            <button
              onClick={handleFitZoom}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all border ${
                zoomLevel === 1
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                  : 'bg-slate-850 hover:bg-slate-800 text-slate-300 border-slate-700'
              }`}
              title="Fit Entire Video Timeline (100%)"
            >
              Fit
            </button>
          </div>
        </div>
      </div>

      {/* Timeline Track Area Container with Floating Hover Preview */}
      <div className="relative w-full z-40">
        {/* Floating Hover Video Thumbnail Tooltip - Only when video is loaded and available */}
        {Boolean(videoSrc) && duration > 0 && hoverTime !== null && hoverCursorX !== null && !isScrubbing && (
          <div
            className="absolute z-[100] pointer-events-none -translate-x-1/2 flex flex-col items-center drop-shadow-2xl transition-[left] duration-75 ease-out animate-in fade-in zoom-in-95 duration-100"
            style={{
              left: `${clampedX}px`,
              bottom: 'calc(100% + 12px)',
            }}
          >
            {/* Thumbnail Card */}
            <div className="bg-slate-950/95 border-2 border-cyan-400/80 rounded-xl p-1.5 shadow-[0_16px_40px_rgba(0,0,0,0.95),0_0_26px_rgba(6,182,212,0.45)] backdrop-blur-xl flex flex-col items-center gap-1.5">
              {/* Canvas Preview Container */}
              <div className="relative w-[184px] h-[103px] rounded-lg overflow-hidden bg-black flex items-center justify-center border border-slate-800 shadow-inner">
                <canvas
                  ref={previewCanvasRef}
                  width={184}
                  height={103}
                  className={`w-full h-full object-cover transition-opacity duration-150 ${
                    hasPreviewFrame ? 'opacity-100' : 'opacity-0'
                  }`}
                />
                {!hasPreviewFrame && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 text-slate-500 bg-slate-950">
                    <Film className="w-5 h-5 text-cyan-400 animate-pulse" />
                    <span className="text-[10px] font-mono text-slate-400">Loading frame...</span>
                  </div>
                )}

                {/* Optional Scene Tag Pill if hover position intersects a scene */}
                {hoveringScene && (
                  <div
                    className="absolute top-1.5 left-1.5 max-w-[164px] truncate px-1.5 py-0.5 rounded text-[9px] font-extrabold text-white shadow-md border border-white/30 backdrop-blur-sm"
                    style={{ backgroundColor: `${hoveringScene.color}ee` }}
                  >
                    {hoveringScene.hotkey ? `[${hoveringScene.hotkey}] ` : ''}
                    {hoveringScene.name}
                  </div>
                )}
              </div>

              {/* Exact Hover Timestamp Badge */}
              <div className="flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-slate-900 border border-cyan-500/40 font-mono text-[11px] font-extrabold text-cyan-300 shadow-sm">
                <span>{formatTimestamp(hoverTime)}</span>
              </div>
            </div>

            {/* Downward Pointer Triangle Arrow pointing directly at cursor position */}
            <div
              className="w-0 h-0 border-x-[7px] border-x-transparent border-t-[8px] border-t-cyan-400 -mt-px filter drop-shadow"
              style={{
                transform: `translateX(${Math.max(-75, Math.min(hoverCursorX - clampedX, 75))}px)`,
              }}
            />
          </div>
        )}

        {/* Hidden Standby Preview Video for Seeking Frames */}
        <video
          ref={previewVideoRef}
          src={videoSrc || undefined}
          preload="auto"
          muted
          playsInline
          onSeeked={handlePreviewSeeked}
          onLoadedData={handlePreviewLoadedData}
          className="hidden"
          style={{ display: 'none' }}
        />

        {/* Horizontal Scrollable Timeline Wrapper */}
        <div
          ref={scrollWrapperRef}
          onWheel={handleWheel}
          className="relative w-full rounded-xl bg-slate-950 border border-slate-800/90 overflow-x-auto overflow-y-hidden cursor-crosshair transition-all"
          style={{ height: `${tracksTotalHeight + 28}px` }}
          onMouseMove={(e) => {
            if (!videoSrc || duration <= 0) return;
            const t = getTimeFromX(e.clientX);
            setHoverTime(t);
            if (scrollWrapperRef.current) {
              const rect = scrollWrapperRef.current.getBoundingClientRect();
              setHoverCursorX(e.clientX - rect.left);
            }
            requestPreviewSeek(t);
          }}
          onMouseLeave={() => {
            setHoverTime(null);
            setHoverCursorX(null);
          }}
          onMouseDown={(e) => {
            if (e.shiftKey) {
              const clickTime = getTimeFromX(e.clientX);
              setIsSelectingRange(true);
              setSelectionRange({ start: clickTime, end: clickTime });
            } else {
              setIsScrubbing(true);
              onSeek(getTimeFromX(e.clientX));
            }
          }}
        >
        {/* Dynamic Zoomed Track Area */}
        <div
          ref={trackContentRef}
          className="relative h-full transition-all"
          style={{
            width: zoomLevel === 1 ? '100%' : `${zoomLevel * 100}%`,
            minWidth: '100%',
          }}
        >
          {/* Top Time Ruler */}
          <div className="absolute top-0 left-0 right-0 h-7 bg-slate-900/95 border-b border-slate-800 z-10 flex items-center pointer-events-none">
            {ticks.map((tick) => {
              const leftPct = (tick / effectiveDuration) * 100;
              return (
                <div
                  key={tick}
                  className="absolute top-0 bottom-0 flex flex-col justify-end"
                  style={{ left: `${leftPct}%` }}
                >
                  <div className="w-px h-3 bg-slate-600 mb-0.5"></div>
                  <span className="text-[10px] font-mono font-bold text-slate-400 leading-none pl-1 -translate-y-1">
                    {formatTimestamp(tick, visibleSecs < 10).substring(3)}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Scene Lanes Area */}
          <div className="absolute top-7 left-0 right-0 bottom-0 overflow-y-hidden">
            {/* Grid lines */}
            {lanes.map((_, laneIdx) => (
              <div
                key={laneIdx}
                className="absolute left-0 right-0 border-b border-slate-800/50"
                style={{
                  top: `${laneIdx * trackHeight}px`,
                  height: `${trackHeight}px`,
                }}
              />
            ))}

            {/* Render Scenes */}
            {lanes.map((laneScenes, laneIdx) =>
              laneScenes.map((scene) => {
                const startPct = Math.max(0, (scene.startTime / effectiveDuration) * 100);
                const endPct = Math.min(100, (scene.endTime / effectiveDuration) * 100);
                const widthPct = Math.max(0.4, endPct - startPct);
                const isActive = activeSceneId === scene.id;
                const isSelected = selectedSceneId === scene.id;

                return (
                  <div
                    key={scene.id}
                    className={`absolute rounded-lg cursor-pointer transition-all group flex items-center px-2 overflow-hidden select-none border ${
                      isActive
                        ? 'ring-2 ring-white ring-offset-2 ring-offset-slate-950 z-30 scale-[1.01]'
                        : isSelected
                        ? 'border-white z-20 shadow-md'
                        : 'border-white/30 hover:border-white/70 z-10'
                    }`}
                    style={{
                      left: `${startPct}%`,
                      width: `${widthPct}%`,
                      top: `${laneIdx * trackHeight + 5}px`,
                      height: `${trackHeight - 10}px`,
                      backgroundColor: `${scene.color}35`,
                      borderColor: isActive ? '#ffffff' : scene.color,
                      boxShadow: isActive
                        ? `0 0 16px ${scene.color}cc, 0 0 28px ${scene.color}40, inset 0 0 12px ${scene.color}55`
                        : undefined,
                    }}
                    onClick={(e) => {
                      e.stopPropagation();
                      onSelectScene(scene.id);
                    }}
                    onDoubleClick={(e) => {
                      e.stopPropagation();
                      onPlayScene(scene);
                    }}
                    title={`${scene.name} [Key: ${scene.hotkey}] (${formatTimestamp(scene.startTime)} - ${formatTimestamp(scene.endTime)}) - Double-click to loop`}
                  >
                    {/* Subtle ambient breathing glow aura when actively looping */}
                    {isActive && (
                      <div
                        className="absolute inset-0 rounded-lg pointer-events-none animate-loop-glow z-0"
                        style={{
                          backgroundColor: `${scene.color}30`,
                          boxShadow: `inset 0 0 16px ${scene.color}`,
                        }}
                      />
                    )}

                    {/* Real-time playback progress fill with bright leading edge */}
                    {isActive && currentTime >= scene.startTime && currentTime <= scene.endTime && (
                      <div
                        className="absolute left-0 top-0 bottom-0 pointer-events-none transition-[width] duration-75 ease-linear z-0"
                        style={{
                          width: `${Math.min(100, Math.max(0, ((currentTime - scene.startTime) / (scene.endTime - scene.startTime)) * 100))}%`,
                          backgroundColor: `${scene.color}40`,
                          borderRight: `2px solid #ffffff`,
                          boxShadow: `0 0 10px #ffffff, 0 0 18px ${scene.color}`,
                        }}
                      />
                    )}

                    {/* Shimmer light sweep beam across the looping bar */}
                    {isActive && (
                      <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-lg z-0 opacity-60">
                        <div
                          className="w-1/3 h-full animate-scan-beam"
                          style={{
                            background: `linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.45), transparent)`,
                          }}
                        />
                      </div>
                    )}

                    {/* Drag Handle: Start */}
                    <div
                      className="absolute left-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/50 group-hover:bg-white/30 z-20 flex items-center justify-center transition-colors"
                      title="Drag to adjust Start Time"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ sceneId: scene.id, type: 'start' });
                      }}
                    >
                      <div className="w-1 h-3.5 bg-white/90 rounded-full shadow" />
                    </div>

                    {/* Scene Content */}
                    <div className="flex items-center gap-2 min-w-0 text-white pl-1 pointer-events-none z-10">
                      {isActive && (
                        <span className="relative flex h-2 w-2 shrink-0">
                          <span
                            className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-80"
                            style={{ backgroundColor: scene.color }}
                          />
                          <span
                            className="relative inline-flex rounded-full h-2 w-2 shadow-sm"
                            style={{ backgroundColor: '#ffffff', boxShadow: `0 0 6px #ffffff` }}
                          />
                        </span>
                      )}

                      <span
                        className="font-mono font-extrabold text-[11px] px-1.5 py-0.5 rounded shadow text-slate-950 border border-white/40 shrink-0"
                        style={{ backgroundColor: scene.color }}
                      >
                        {scene.hotkey}
                      </span>
                      <span className="text-xs font-bold truncate text-white drop-shadow">
                        {scene.name}
                      </span>
                      <span className="text-[10px] text-slate-300 font-mono hidden md:inline shrink-0 opacity-90">
                        ({formatDuration(scene.endTime - scene.startTime)})
                      </span>
                    </div>

                    {/* Drag Handle: End */}
                    <div
                      className="absolute right-0 top-0 bottom-0 w-2.5 cursor-ew-resize hover:bg-white/50 group-hover:bg-white/30 z-20 flex items-center justify-center transition-colors"
                      title="Drag to adjust End Time"
                      onMouseDown={(e) => {
                        e.stopPropagation();
                        setDraggingHandle({ sceneId: scene.id, type: 'end' });
                      }}
                    >
                      <div className="w-1 h-3.5 bg-white/90 rounded-full shadow" />
                    </div>
                  </div>
                );
              })
            )}

            {/* LIVE RECORDING Range Highlight Block */}
            {isRecording && recordingStartTime !== null && (
              <div
                className="absolute top-1 bottom-1 bg-rose-500/35 border-2 border-rose-500 border-dashed rounded-lg z-30 pointer-events-none flex items-center justify-center shadow-lg shadow-rose-500/20"
                style={{
                  left: `${(Math.min(recordingStartTime, currentTime) / effectiveDuration) * 100}%`,
                  width: `${Math.max(0.5, (Math.abs(currentTime - recordingStartTime) / effectiveDuration) * 100)}%`,
                }}
              >
                <span className="text-[11px] font-extrabold text-white bg-rose-950/95 px-2.5 py-0.5 rounded shadow-lg border border-rose-500/80 flex items-center gap-1.5 whitespace-nowrap">
                  <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping" />
                  REC ({formatDuration(Math.abs(currentTime - recordingStartTime))})
                </span>
              </div>
            )}

            {/* Interactive Range Selection Box (Shift+Drag) */}
            {selectionRange && (
              <div
                className="absolute top-0 bottom-0 bg-cyan-500/30 border-2 border-cyan-400 border-dashed rounded-lg z-30 pointer-events-none flex items-center justify-center"
                style={{
                  left: `${(Math.min(selectionRange.start, selectionRange.end) / effectiveDuration) * 100}%`,
                  width: `${(Math.abs(selectionRange.end - selectionRange.start) / effectiveDuration) * 100}%`,
                }}
              >
                <span className="text-xs font-extrabold text-white bg-cyan-950/90 px-3 py-1 rounded-md shadow-lg border border-cyan-400/60">
                  + New Scene ({formatDuration(Math.abs(selectionRange.end - selectionRange.start))})
                </span>
              </div>
            )}
          </div>

          {/* Current Time Playhead Needle */}
          <div
            className="absolute top-0 bottom-0 w-0.5 bg-rose-500 z-40 pointer-events-none"
            style={{
              left: `${playheadPercent}%`,
              boxShadow: '0 0 10px rgba(244, 63, 94, 1)',
            }}
          >
            {/* Diamond Playhead Head */}
            <div className="absolute -top-0 -left-2 w-4 h-4 bg-rose-500 rounded-sm rotate-45 shadow-lg border border-white" />
          </div>

          {/* Hover Guideline */}
          {hoverTime !== null && !isScrubbing && (
            <div
              className="absolute top-0 bottom-0 w-px bg-cyan-400/70 z-20 pointer-events-none"
              style={{ left: `${(hoverTime / effectiveDuration) * 100}%` }}
            />
          )}
        </div>
      </div>
    </div>

      {/* Bottom Timeline Action Bar (Record Scene Mode + Add Scene from Playhead) */}
      <div className="flex flex-wrap items-center justify-between text-xs px-1 text-slate-300 pt-0.5 gap-2">
        <div className="font-mono text-xs flex items-center gap-1.5">
          <span className="text-slate-400">Playhead:</span>
          <strong className="text-cyan-400 font-bold">{formatTimestamp(currentTime)}</strong>
          <span className="text-slate-600">/</span>
          <span className="text-slate-400">{formatTimestamp(duration)}</span>
        </div>

        <div className="flex items-center gap-2">
          {/* RECORD SCENE BUTTON */}
          {onToggleRecord && (
            <button
              onClick={onToggleRecord}
              className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl font-bold text-xs shadow-md transition-all hover:scale-102 active:scale-98 ${
                isRecording
                  ? 'bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white shadow-rose-600/30 animate-pulse border border-rose-400'
                  : 'bg-slate-800/90 hover:bg-rose-500/20 text-rose-300 hover:text-white border border-slate-700/80 hover:border-rose-500/50'
              }`}
              title={
                isRecording
                  ? 'Click to Stop Recording and create scene'
                  : 'Start live recording scene from current playback time'
              }
            >
              {isRecording ? (
                <>
                  <Square className="w-3.5 h-3.5 fill-white text-white" />
                  <span>
                    Stop Recording{' '}
                    {recordingStartTime !== null
                      ? `(${formatDuration(Math.abs(currentTime - recordingStartTime))})`
                      : ''}
                  </span>
                </>
              ) : (
                <>
                  <Circle className="w-3.5 h-3.5 fill-rose-500 text-rose-500 animate-pulse" />
                  <span>Record Scene</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
