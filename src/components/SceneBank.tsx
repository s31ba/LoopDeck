import React, { useState, useRef, useEffect } from 'react';
import { Scene, VideoItem } from '../types/scene';
import { Layers, Film } from 'lucide-react';

interface SceneBankProps {
  scenes: Scene[];
  activeSceneId: string | null;
  thumbnails: Record<string, string>;
  videos?: VideoItem[];
  activeVideoSrc?: string | null;
  isSuspended?: boolean;
  onActivateScene: (scene: Scene) => void;
}

interface SceneBankItemProps {
  scene: Scene;
  isActive: boolean;
  thumbnail?: string;
  videoSrc?: string | null;
  accentColor: string;
  videoName: string;
  isVR?: boolean;
  isSuspended?: boolean;
  onActivate: (scene: Scene) => void;
}

const SceneBankItem: React.FC<SceneBankItemProps> = ({
  scene,
  isActive,
  thumbnail,
  videoSrc,
  accentColor,
  videoName,
  isVR = false,
  isSuspended = false,
  onActivate,
}) => {
  const [isHovering, setIsHovering] = useState<boolean>(false);
  const videoRef = useRef<HTMLVideoElement>(null);

  const handleMouseEnter = () => {
    if (isSuspended) return;
    setIsHovering(true);
    if (videoRef.current) {
      videoRef.current.currentTime = scene.startTime;
      videoRef.current.play().catch(() => {});
    }
  };

  const handleMouseLeave = () => {
    setIsHovering(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = scene.startTime;
    }
  };

  const handleTimeUpdate = () => {
    const vid = videoRef.current;
    if (!vid) return;
    // Loop strictly inside this scene's start and end time
    if (vid.currentTime >= scene.endTime || vid.currentTime < scene.startTime - 0.2) {
      vid.currentTime = scene.startTime;
      vid.play().catch(() => {});
    }
  };

  // Ensure playback starts promptly if already hovered when videoSrc loads
  useEffect(() => {
    if (isHovering && videoRef.current) {
      videoRef.current.currentTime = scene.startTime;
      videoRef.current.play().catch(() => {});
    }
  }, [isHovering, scene.startTime]);

  return (
    <div
      onClick={() => onActivate(scene)}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      style={{
        borderColor: isActive ? accentColor : `${accentColor}35`,
        backgroundColor: isActive ? `${accentColor}18` : 'rgba(10, 15, 26, 0.85)',
      }}
      className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-xl transition-all cursor-pointer group border relative overflow-hidden ${
        isActive
          ? 'shadow-lg text-white'
          : 'hover:border-opacity-70 text-slate-300 hover:bg-slate-900/90'
      }`}
      title={`Video: ${videoName} | Scene: ${scene.name} (Hotkey: ${scene.hotkey || 'None'})`}
    >
      {/* Unique Source Video Vertical Color Accent Strip */}
      <div
        className="w-1.5 h-14 rounded-full shrink-0 transition-transform duration-200 group-hover:scale-y-110"
        style={{
          backgroundColor: accentColor,
          boxShadow: `0 0 8px ${accentColor}60`,
        }}
      />

      {/* 1. Scene Thumbnail with Hover Video Preview (No Scene Number) */}
      <div className="relative flex-1 h-20 rounded-lg overflow-hidden bg-black border border-slate-800/80 flex items-center justify-center shadow-inner">
        {/* Static Thumbnail Image */}
        {thumbnail ? (
          <img
            src={thumbnail}
            alt={scene.name}
            className={`w-full h-full object-cover transition-opacity duration-150 ${
              isHovering && videoSrc ? 'opacity-0' : 'opacity-100'
            }`}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-600">
            <Film className="w-5 h-5 text-cyan-500/50 animate-pulse" />
          </div>
        )}

        {/* Hover Loop Preview Video Element */}
        {videoSrc && (
          <video
            ref={videoRef}
            src={videoSrc}
            muted
            playsInline
            preload="auto"
            controls={false}
            onTimeUpdate={handleTimeUpdate}
            className={`absolute inset-0 w-full h-full object-cover pointer-events-none transition-opacity duration-150 ${
              isHovering ? 'opacity-100 z-10' : 'opacity-0 -z-10'
            }`}
          />
        )}

        {/* Hover Preview Indicator Badge */}
        {isHovering && videoSrc && (
          <div className="absolute top-1 left-1 z-20 flex items-center gap-1 bg-black/85 backdrop-blur-xs text-cyan-300 px-1.5 py-0.5 rounded text-[8px] font-mono font-bold border border-cyan-500/60 shadow">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            PREVIEW
          </div>
        )}

        {/* Active playing indicator badge */}
        {isActive && (
          <div
            className="absolute top-1 right-1 z-20 flex items-center gap-1 px-1.5 py-0.5 rounded text-[8px] font-mono font-black border shadow"
            style={{
              backgroundColor: 'rgba(0, 0, 0, 0.85)',
              color: accentColor,
              borderColor: `${accentColor}80`,
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-ping"
              style={{ backgroundColor: accentColor }}
            />
            PLAYING
          </div>
        )}

        {/* VR indicator badge */}
        {isVR && (
          <div
            className="absolute bottom-1 left-1 z-20 flex items-center gap-0.5 bg-black/85 backdrop-blur-xs text-cyan-300 px-1 py-0.2 rounded text-[7px] font-mono font-black border border-cyan-500/50 shadow"
            title={scene.vrView ? `VR View: Yaw ${Math.round(scene.vrView.yaw)}°, Pitch ${Math.round(scene.vrView.pitch)}°` : 'VR'}
          >
            VR{scene.vrView ? ` [${Math.round(scene.vrView.yaw)}°]` : ''}
          </div>
        )}
      </div>

      {/* 2. Assigned Hotkey */}
      <div
        className={`font-mono text-xs font-extrabold min-w-[34px] h-9 px-2 rounded-lg flex items-center justify-center border shadow-sm uppercase shrink-0 transition-colors ${
          isActive
            ? 'text-slate-950 font-black shadow-md'
            : 'bg-slate-900 text-amber-300 border-slate-800 group-hover:border-amber-500/40 group-hover:bg-slate-850'
        }`}
        style={
          isActive
            ? { backgroundColor: accentColor, borderColor: accentColor }
            : undefined
        }
      >
        {scene.hotkey || '-'}
      </div>
    </div>
  );
};

export const SceneBank: React.FC<SceneBankProps> = ({
  scenes,
  activeSceneId,
  thumbnails,
  videos = [],
  activeVideoSrc = null,
  isSuspended = false,
  onActivateScene,
}) => {
  return (
    <div className="w-full bg-slate-900/90 border border-slate-800/80 rounded-2xl p-3.5 shadow-xl backdrop-blur-md flex flex-col h-full overflow-hidden select-none">
      {/* Compact Header */}
      <div className="flex items-center justify-between px-1 pb-3 border-b border-slate-800/80 mb-2.5 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-xs font-extrabold text-white tracking-wider uppercase">
              Scene Bank
            </h3>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Loaded video color dots */}
          {videos.length > 1 && (
            <div className="flex items-center gap-1 bg-slate-950 px-2 py-1 rounded-full border border-slate-800">
              {videos.map((v) => (
                <span
                  key={v.id}
                  className="w-2 h-2 rounded-full"
                  style={{
                    backgroundColor: v.color || '#06b6d4',
                    boxShadow: `0 0 4px ${v.color || '#06b6d4'}80`,
                  }}
                  title={v.name}
                />
              ))}
            </div>
          )}

          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-950 text-cyan-300 border border-slate-800">
            {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
          </span>
        </div>
      </div>

      {/* Single-Column Scrollable List of All Scenes across Every Video */}
      <div className="flex-1 overflow-y-auto space-y-2 pr-1 min-h-0 custom-scrollbar">
        {scenes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center p-4 text-center text-slate-500">
            <Film className="w-8 h-8 text-slate-700 mb-2 stroke-[1.5]" />
            <p className="text-xs font-semibold text-slate-400">Scene Bank Empty</p>
            <p className="text-[11px] text-slate-500 mt-1 max-w-[170px]">
              Use Record Scene to populate the deck.
            </p>
          </div>
        ) : (
          scenes.map((scene) => {
            const isActive = activeSceneId === scene.id;
            const parentVideo = videos.find((v) => v.id === scene.videoId);
            const thumb = thumbnails[scene.id] || parentVideo?.thumbnail;
            const videoSrc = parentVideo?.src || (scene.videoId === activeVideoSrc ? activeVideoSrc : null);
            const accentColor = parentVideo?.color || scene.color || '#06b6d4';
            const videoName = parentVideo?.name || scene.videoName || 'Video';
            const isVR = !!parentVideo?.vrSettings?.enabled;

            return (
              <SceneBankItem
                key={scene.id}
                scene={scene}
                isActive={isActive}
                thumbnail={thumb}
                videoSrc={videoSrc}
                accentColor={accentColor}
                videoName={videoName}
                isVR={isVR}
                isSuspended={isSuspended}
                onActivate={onActivateScene}
              />
            );
          })
        )}
      </div>
    </div>
  );
};
