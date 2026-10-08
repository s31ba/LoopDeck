import React from 'react';
import { VideoVRSettings } from '../../types/scene';

interface VRControlsOverlayProps {
  vrSettings: VideoVRSettings;
  videoElement: HTMLVideoElement | null;
  onUpdateVRSettings: (newSettings: Partial<VideoVRSettings>) => void;
}

export const VRControlsOverlay: React.FC<VRControlsOverlayProps> = ({
  vrSettings,
  onUpdateVRSettings,
}) => {
  return (
    <div className="flex flex-col gap-2 pointer-events-auto">
      {/* VR Main Controls Ribbon */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-950/90 border border-slate-700/80 p-1.5 rounded-2xl shadow-2xl backdrop-blur-md text-xs text-white">
        {/* Projection: 180 (Default) vs 360 */}
        <div className="flex items-center bg-slate-900/90 rounded-xl p-0.5 border border-slate-800">
          <button
            onClick={() => onUpdateVRSettings({ projection: '180' })}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              vrSettings.projection === '180'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="180° Dome VR Projection (Default)"
          >
            180°
          </button>
          <button
            onClick={() => onUpdateVRSettings({ projection: '360' })}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              vrSettings.projection === '360'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="360° Spherical VR Projection"
          >
            360°
          </button>
        </div>

        {/* Eye Mode: Mono, Left, Right */}
        <div className="flex items-center bg-slate-900/90 rounded-xl p-0.5 border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400 px-1.5 hidden sm:inline">
            Eye:
          </span>
          <button
            onClick={() => onUpdateVRSettings({ eyeMode: 'mono' })}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
              vrSettings.eyeMode === 'mono'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Mono: Complete video frame across both eyes"
          >
            Mono
          </button>
          <button
            onClick={() => onUpdateVRSettings({ eyeMode: 'left' })}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
              vrSettings.eyeMode === 'left'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Left: Left half of Side-by-Side (SBS) stereo video"
          >
            Left
          </button>
          <button
            onClick={() => onUpdateVRSettings({ eyeMode: 'right' })}
            className={`px-2 py-1 rounded-lg text-xs font-bold transition-all ${
              vrSettings.eyeMode === 'right'
                ? 'bg-cyan-500 text-slate-950 shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Right: Right half of Side-by-Side (SBS) stereo video"
          >
            Right
          </button>
        </div>

        {/* Lens: Regular vs Fish Eye */}
        <div className="flex items-center bg-slate-900/90 rounded-xl p-0.5 border border-slate-800">
          <button
            onClick={() => onUpdateVRSettings({ lens: 'regular' })}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              vrSettings.lens === 'regular'
                ? 'bg-indigo-500 text-white shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Regular Lens: Standard VR projection"
          >
            Regular
          </button>
          <button
            onClick={() => onUpdateVRSettings({ lens: 'fisheye' })}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              vrSettings.lens === 'fisheye'
                ? 'bg-indigo-500 text-white shadow-sm font-extrabold'
                : 'text-slate-400 hover:text-white'
            }`}
            title="Fish Eye Lens: Fisheye curvature distortion"
          >
            Fish Eye
          </button>
        </div>

        {/* FOV / Zoom Slider */}
        <div className="flex items-center gap-1.5 bg-slate-900/90 rounded-xl px-2.5 py-1 border border-slate-800">
          <span className="text-[10px] font-mono text-slate-400">FOV:</span>
          <input
            type="range"
            min={40}
            max={115}
            step={1}
            value={vrSettings.fov || 75}
            onChange={(e) => onUpdateVRSettings({ fov: parseInt(e.target.value, 10) })}
            className="w-16 h-1 bg-slate-700 rounded-lg accent-cyan-400 cursor-pointer outline-none"
            title={`Field of View / Zoom: ${vrSettings.fov || 75}°`}
          />
          <span className="font-mono text-[10px] text-cyan-300 min-w-[28px] text-right">
            {vrSettings.fov || 75}°
          </span>
        </div>
      </div>
    </div>
  );
};
