import React, { useRef, useState, useEffect } from 'react';
import { MultiBoxAssignment, DragItemPayload } from '../../types/multibox';
import { formatTimestamp } from '../../utils/time';
import { VRCanvas } from '../VRPlayer/VRCanvas';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  X,
  Repeat,
  Film,
  Plus,
  Layers,
  Sparkles,
} from 'lucide-react';

interface MultiBoxVideoSlotProps {
  slotIndex: number;
  assignment: MultiBoxAssignment | null;
  onAssign: (slotIndex: number, payload: DragItemPayload) => void;
  onRemove: (slotIndex: number) => void;
  initialVolume?: number;
  className?: string;
}

export const MultiBoxVideoSlot: React.FC<MultiBoxVideoSlotProps> = ({
  slotIndex,
  assignment,
  onAssign,
  onRemove,
  initialVolume = 1,
  className = '',
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [volume, setVolume] = useState<number>(initialVolume);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [isDragOver, setIsDragOver] = useState<boolean>(false);
  const [showControls, setShowControls] = useState<boolean>(false);

  const isScene = assignment?.type === 'scene' && !!assignment.scene;
  const scene = assignment?.scene;
  const video = assignment?.video;
  const accentColor = video?.color || scene?.color || '#06b6d4';

  const startTime = isScene && scene ? scene.startTime : 0;
  const endTime = isScene && scene ? scene.endTime : duration || 0;
  const slotEffectiveDuration = Math.max(0.1, endTime - startTime);

  // Sync initial volume if updated
  useEffect(() => {
    if (initialVolume !== undefined) {
      setVolume(initialVolume);
      if (videoRef.current) {
        videoRef.current.volume = initialVolume;
      }
    }
  }, [initialVolume]);

  // Initialize and seek when assignment changes
  useEffect(() => {
    if (!assignment || !videoRef.current) return;
    const v = videoRef.current;

    v.currentTime = startTime;
    v.volume = volume;
    v.muted = isMuted;

    const playPromise = v.play();
    if (playPromise !== undefined) {
      playPromise
        .then(() => setIsPlaying(true))
        .catch(() => {
          // Autoplay policy fallback: mute and play
          v.muted = true;
          setIsMuted(true);
          v.play()
            .then(() => setIsPlaying(true))
            .catch(() => setIsPlaying(false));
        });
    }
  }, [assignment?.assignedAt, startTime]);

  // Handle loop logic & time updates
  const handleTimeUpdate = () => {
    const v = videoRef.current;
    if (!v) return;

    setCurrentTime(v.currentTime);

    if (isScene && scene) {
      // Loop strictly inside scene boundaries
      if (v.currentTime >= scene.endTime || v.currentTime < scene.startTime - 0.2) {
        v.currentTime = scene.startTime;
        v.play().catch(() => {});
      }
    } else {
      // Whole video loop
      if (v.ended) {
        v.currentTime = 0;
        v.play().catch(() => {});
      }
    }
  };

  const handleLoadedMetadata = () => {
    const v = videoRef.current;
    if (!v) return;
    setDuration(v.duration || 0);
    v.currentTime = startTime;
  };

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) {
      v.play()
        .then(() => setIsPlaying(true))
        .catch(() => {});
    } else {
      v.pause();
      setIsPlaying(false);
    }
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setVolume(val);
    if (videoRef.current) {
      videoRef.current.volume = val;
      if (val === 0) {
        videoRef.current.muted = true;
        setIsMuted(true);
      } else {
        videoRef.current.muted = false;
        setIsMuted(false);
      }
    } else {
      if (val > 0) {
        setIsMuted(false);
      }
    }
  };

  const toggleMute = () => {
    if (videoRef.current) {
      const nextMuted = !isMuted;
      videoRef.current.muted = nextMuted;
      setIsMuted(nextMuted);
    }
  };

  const handleScrub = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fraction = parseFloat(e.target.value);
    const targetTime = startTime + fraction * slotEffectiveDuration;
    if (videoRef.current) {
      videoRef.current.currentTime = targetTime;
      setCurrentTime(targetTime);
    }
  };

  // Drag and Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    try {
      const dataStr = e.dataTransfer.getData('application/json');
      if (dataStr) {
        const payload = JSON.parse(dataStr) as DragItemPayload;
        if (payload && payload.videoId) {
          onAssign(slotIndex, payload);
        }
      }
    } catch (err) {
      console.error('Failed to parse dropped item', err);
    }
  };

  const progressFraction =
    slotEffectiveDuration > 0
      ? Math.max(0, Math.min(1, (currentTime - startTime) / slotEffectiveDuration))
      : 0;

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onMouseEnter={() => setShowControls(true)}
      onMouseLeave={() => setShowControls(false)}
      className={`relative w-full h-full rounded-2xl overflow-hidden flex flex-col items-center justify-center transition-all border ${
        isDragOver
          ? 'border-cyan-400 bg-cyan-950/40 shadow-2xl shadow-cyan-500/30 scale-[1.01]'
          : assignment
          ? 'border-slate-800 bg-black shadow-xl'
          : 'border-dashed border-slate-800/90 bg-slate-950/70 hover:border-slate-700/90 hover:bg-slate-900/60'
      } ${className}`}
    >
      {assignment && video ? (
        <>
          {/* Active Box Video Player */}
          <video
            ref={videoRef}
            src={video.src}
            playsInline
            controls={false}
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onClick={togglePlay}
            className={`w-full h-full object-contain bg-black cursor-pointer transition-opacity ${
              video.vrSettings?.enabled ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          />

          {/* Spherical VR Canvas in MultiBox Slot */}
          {video.vrSettings?.enabled && (
            <div className="absolute inset-0 z-10">
              <VRCanvas
                videoElement={videoRef.current}
                vrSettings={video.vrSettings}
                initialYaw={assignment?.scene?.vrView?.yaw}
                initialPitch={assignment?.scene?.vrView?.pitch}
                initialFov={assignment?.scene?.vrView?.fov}
              />
            </div>
          )}

          {/* Top Bar (Overlay) */}
          <div
            className={`absolute top-0 inset-x-0 p-3 bg-gradient-to-b from-black/85 via-black/40 to-transparent flex items-center justify-between transition-opacity duration-200 z-20 ${
              showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Source & Scene Tag */}
            <div className="flex items-center gap-2 max-w-[80%]">
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}80` }}
              />
              <div className="flex flex-col truncate">
                <span className="text-xs font-bold text-white truncate drop-shadow flex items-center gap-1.5">
                  <span>{isScene && scene ? scene.name : video.name}</span>
                  {video.vrSettings?.enabled && (
                    <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-black uppercase bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
                      VR {video.vrSettings.projection}°
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-mono text-slate-300 truncate drop-shadow flex items-center gap-1.5">
                  <span className="text-slate-400">{video.name}</span>
                  {isScene && scene ? (
                    <span
                      className="px-1.5 py-0.2 rounded text-[9px] font-extrabold border"
                      style={{
                        backgroundColor: `${accentColor}20`,
                        color: accentColor,
                        borderColor: `${accentColor}50`,
                      }}
                    >
                      LOOP [{formatTimestamp(scene.startTime)} - {formatTimestamp(scene.endTime)}]
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.2 rounded text-[9px] font-extrabold bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                      WHOLE VIDEO
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Remove from Slot "X" Button */}
            <button
              onClick={() => onRemove(slotIndex)}
              className="p-1.5 rounded-lg bg-black/60 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-white/10 hover:border-rose-500/40 transition-all shadow-md shrink-0"
              title={`Remove content from Box ${slotIndex + 1}`}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Large Center Play/Pause Indicator (when paused) */}
          {!isPlaying && (
            <button
              onClick={togglePlay}
              className="absolute inset-0 m-auto w-14 h-14 rounded-full bg-cyan-500/90 text-slate-950 flex items-center justify-center shadow-2xl shadow-cyan-500/50 hover:scale-110 active:scale-95 transition-all z-20"
              title="Play Box"
            >
              <Play className="w-6 h-6 fill-slate-950 ml-1" />
            </button>
          )}

          {/* Bottom Controls Bar (Overlay) */}
          <div
            className={`absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/90 via-black/50 to-transparent flex flex-col gap-1.5 transition-opacity duration-200 z-20 ${
              showControls || !isPlaying ? 'opacity-100' : 'opacity-0'
            }`}
          >
            {/* Scrubber Track */}
            <div className="relative w-full flex items-center group/track">
              <input
                type="range"
                min={0}
                max={1}
                step={0.001}
                value={isNaN(progressFraction) ? 0 : progressFraction}
                onChange={handleScrub}
                className="w-full h-1.5 rounded-lg bg-slate-700/80 accent-cyan-400 cursor-pointer appearance-none outline-none"
              />
            </div>

            {/* Bottom Actions Row */}
            <div className="flex items-center justify-between text-xs text-white">
              <div className="flex items-center gap-2">
                <button
                  onClick={togglePlay}
                  className="p-1 rounded-md hover:bg-white/10 text-slate-200 hover:text-white transition-colors"
                  title={isPlaying ? 'Pause' : 'Play'}
                >
                  {isPlaying ? (
                    <Pause className="w-4 h-4 fill-current" />
                  ) : (
                    <Play className="w-4 h-4 fill-current" />
                  )}
                </button>

                <div className="flex items-center gap-1 group/vol">
                  <button
                    onClick={toggleMute}
                    className="p-1 rounded-md hover:bg-white/10 text-slate-200 hover:text-white transition-colors"
                    title={isMuted ? 'Unmute' : 'Mute'}
                  >
                    {isMuted || volume === 0 ? (
                      <VolumeX className="w-4 h-4 text-rose-400" />
                    ) : (
                      <Volume2 className="w-4 h-4" />
                    )}
                  </button>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={volume}
                    onChange={handleVolumeChange}
                    className="w-14 h-1 bg-slate-700 rounded-lg accent-cyan-400 cursor-pointer appearance-none outline-none"
                    title={`Volume: ${Math.round(volume * 100)}%${isMuted ? ' (Muted)' : ''}`}
                  />
                </div>

                <span className="font-mono text-[10px] text-slate-300">
                  {formatTimestamp(Math.max(0, currentTime - startTime), false)} /{' '}
                  {formatTimestamp(slotEffectiveDuration, false)}
                </span>
              </div>

              {/* Loop badge */}
              <div className="flex items-center gap-1 text-[10px] font-mono text-cyan-300 font-bold bg-slate-900/80 px-2 py-0.5 rounded-md border border-cyan-500/30">
                <Repeat className="w-3 h-3 text-cyan-400" />
                <span>{isScene ? 'LOOPING' : 'WHOLE'}</span>
              </div>
            </div>
          </div>
        </>
      ) : (
        /* Empty Slot Drop Target State */
        <div className="flex flex-col items-center justify-center p-6 text-center select-none cursor-pointer group">
          <div
            className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-3 transition-all ${
              isDragOver
                ? 'bg-cyan-500 text-slate-950 scale-110 shadow-lg shadow-cyan-500/50'
                : 'bg-slate-900 text-slate-400 group-hover:bg-slate-800 group-hover:text-cyan-400 border border-slate-800 group-hover:border-cyan-500/40'
            }`}
          >
            {isDragOver ? <Sparkles className="w-7 h-7" /> : <Plus className="w-7 h-7" />}
          </div>

          <span className="font-mono text-xs font-black tracking-wider uppercase text-cyan-400/90 mb-1">
            Box {slotIndex + 1}
          </span>
          <p className="text-xs font-bold text-slate-300 group-hover:text-white transition-colors">
            {isDragOver ? 'Drop to Load!' : 'Drop Scene or Whole Video Here'}
          </p>
          <p className="text-[11px] text-slate-500 mt-1 max-w-[200px]">
            Drag any scene or whole video from the MultiBox Scene Bank on the right.
          </p>
        </div>
      )}
    </div>
  );
};
