import React, { useRef } from 'react';
import { formatTimestamp } from '../utils/time';
import { getVolumeColor, getVolumeTrackStyle } from '../utils/volumeColor';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  SkipBack,
  SkipForward,
  FastForward,
  Square,
  Repeat,
} from 'lucide-react';

interface PlaybackControlsProps {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  isSceneLooping: boolean;
  repeatWholeVideo?: boolean;
  onToggleRepeatWholeVideo?: () => void;
  onTogglePlay: () => void;
  onSeek: (time: number) => void;
  onVolumeChange: (vol: number) => void;
  onToggleMute: () => void;
  onPlaybackRateChange: (rate: number) => void;
  onStepFrame: (direction: number) => void;
  onPrevScene: () => void;
  onNextScene: () => void;
  onStopSceneLoop: () => void;
  onToggleFullscreen: () => void;
}

export const PlaybackControls: React.FC<PlaybackControlsProps> = ({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  playbackRate,
  isSceneLooping,
  repeatWholeVideo = false,
  onToggleRepeatWholeVideo,
  onTogglePlay,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onPlaybackRateChange,
  onStepFrame,
  onPrevScene,
  onNextScene,
  onStopSceneLoop,
  onToggleFullscreen,
}) => {
  const seekbarRef = useRef<HTMLInputElement>(null);
  const speedOptions = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 2];

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800/80 rounded-2xl px-5 py-3.5 flex flex-col gap-3 shadow-xl backdrop-blur-md select-none">
      {/* High-visibility Seek Bar with Gradient Track */}
      <div className="relative flex items-center group">
        <input
          ref={seekbarRef}
          type="range"
          min="0"
          max={duration || 100}
          step="0.01"
          value={currentTime}
          onChange={(e) => onSeek(parseFloat(e.target.value))}
          className="w-full h-2.5 bg-slate-950 rounded-lg appearance-none cursor-pointer accent-cyan-400 hover:accent-cyan-300 transition-all focus:outline-none border border-slate-800"
        />
      </div>

      {/* Control Buttons Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 text-slate-300">
        {/* Left Controls: Play/Pause, Step Frames, Prev/Next Scene */}
        <div className="flex items-center gap-2">
          {/* Main Play / Pause Button with Vibrant Gradient */}
          <button
            onClick={onTogglePlay}
            className={`px-4 py-2 rounded-xl text-white font-bold flex items-center justify-center gap-1.5 transition-all shadow-lg hover:scale-104 active:scale-96 ${
              isPlaying
                ? 'bg-gradient-to-r from-amber-500 to-orange-600 shadow-amber-500/25'
                : 'bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 shadow-cyan-500/30'
            }`}
            title="Play / Pause (Space)"
          >
            {isPlaying ? (
              <>
                <Pause className="w-4 h-4 fill-white" />
                <span className="text-xs">Pause</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-white ml-0.5" />
                <span className="text-xs">Play</span>
              </>
            )}
          </button>

          {/* Frame Step Back */}
          <button
            onClick={() => onStepFrame(-1)}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Step Back 1 Frame (-0.033s)"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Frame Step Forward */}
          <button
            onClick={() => onStepFrame(1)}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Step Forward 1 Frame (+0.033s)"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          <div className="h-5 w-px bg-slate-800 mx-1" />

          {/* Prev Scene */}
          <button
            onClick={onPrevScene}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Jump to Previous Scene"
          >
            <SkipBack className="w-4 h-4" />
          </button>

          {/* Next Scene */}
          <button
            onClick={onNextScene}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Jump to Next Scene"
          >
            <SkipForward className="w-4 h-4" />
          </button>

          {/* Stop Scene Loop (Vibrant pulsing banner when looping) */}
          {isSceneLooping && (
            <button
              onClick={onStopSceneLoop}
              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/50 text-xs font-bold transition-all animate-pulse shadow-md shadow-rose-500/20"
              title="Stop Scene Loop and return to normal playback (Esc)"
            >
              <Square className="w-3.5 h-3.5 fill-rose-400" />
              <span>Stop Loop (Esc)</span>
            </button>
          )}

          {/* High Contrast Time Display */}
          <div className="font-mono text-xs sm:text-sm text-slate-300 ml-2 px-3 py-1.5 rounded-xl bg-slate-950/80 border border-slate-800 flex items-center gap-1.5 shadow-inner">
            <span className="text-cyan-400 font-bold tracking-tight">{formatTimestamp(currentTime)}</span>
            <span className="text-slate-600 font-semibold">/</span>
            <span className="text-slate-400 font-medium">{formatTimestamp(duration)}</span>
          </div>
        </div>

        {/* Right Controls: Playback Rate, Volume, Fullscreen */}
        <div className="flex items-center gap-2.5">
          {/* Playback Speed Selector */}
          <div className="flex items-center gap-1.5 bg-slate-800/80 border border-slate-700/80 rounded-xl px-2.5 py-1 shadow-sm">
            <FastForward className="w-3.5 h-3.5 text-cyan-400" />
            <select
              value={playbackRate}
              onChange={(e) => onPlaybackRateChange(parseFloat(e.target.value))}
              className="bg-transparent text-xs text-white font-mono font-bold py-1 pr-1 focus:outline-none cursor-pointer"
              title="Playback Speed"
            >
              {speedOptions.map((rate) => (
                <option key={rate} value={rate} className="bg-slate-950 text-white">
                  {rate}x
                </option>
              ))}
            </select>
          </div>

          {/* Repeat Entire Video Toggle Button */}
          {onToggleRepeatWholeVideo && (
            <button
              type="button"
              onClick={onToggleRepeatWholeVideo}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs font-bold transition-all shadow-sm cursor-pointer ${
                repeatWholeVideo
                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/50 shadow-cyan-500/20 shadow-md ring-1 ring-cyan-400/40'
                  : 'bg-slate-800/80 hover:bg-slate-750 text-slate-400 hover:text-slate-200 border-slate-700/80'
              }`}
              title={
                repeatWholeVideo
                  ? 'Repeat Video: ON'
                  : 'Repeat Video: OFF'
              }
            >
              <Repeat
                className={`w-3.5 h-3.5 transition-transform ${
                  repeatWholeVideo ? 'text-cyan-400 scale-110' : 'text-slate-400'
                }`}
              />
              <span className="font-mono text-[11px]">
                {repeatWholeVideo ? 'Repeat ON' : 'Repeat OFF'}
              </span>
            </button>
          )}

          {/* Volume Control (0% to 200% range with smooth Green -> Yellow -> Red color transition) */}
          <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/80 rounded-xl px-3 py-1.5 shadow-sm">
            <button
              onClick={onToggleMute}
              className="text-slate-400 hover:text-white transition-colors flex items-center justify-center"
              title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
            >
              {isMuted || volume === 0 ? (
                <VolumeX className="w-4 h-4 text-rose-400" />
              ) : (
                <Volume2
                  className="w-4 h-4 transition-colors"
                  style={{ color: getVolumeColor(volume) }}
                />
              )}
            </button>
            <div className="relative flex items-center">
              <input
                type="range"
                min="0"
                max="2"
                step="0.05"
                value={volume}
                onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
                style={getVolumeTrackStyle(volume, isMuted)}
                className="w-20 sm:w-24 h-1.5 rounded-lg appearance-none cursor-pointer transition-all"
                title={`Volume: ${Math.round(volume * 100)}%${isMuted ? ' (Muted)' : ''}`}
              />
              {/* 100% midpoint marker (unity gain default) */}
              <div
                className="absolute left-1/2 top-0 bottom-0 w-0.5 pointer-events-none bg-slate-900/90 -translate-x-1/2"
                title="100% (Default Volume)"
              />
            </div>
            <span
              className="font-mono text-xs font-bold min-w-[42px] text-right transition-colors"
              style={{ color: isMuted ? '#94a3b8' : getVolumeColor(volume) }}
            >
              {isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}
            </span>
          </div>

          {/* Fullscreen Button */}
          <button
            onClick={onToggleFullscreen}
            className="p-2.5 rounded-xl bg-slate-800/80 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 transition-all hover:scale-105 active:scale-95 shadow-sm"
            title="Toggle Fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
