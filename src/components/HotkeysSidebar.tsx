import React, { useRef } from 'react';
import { Scene, VideoItem, ProjectData } from '../types/scene';
import {
  Download,
  Upload,
  Keyboard,
  FileJson,
  RotateCcw,
  Volume2,
  VolumeX,
  CheckCircle2,
  Film,
  Play,
  Sliders,
  Layers,
} from 'lucide-react';

interface HotkeysSidebarProps {
  scenes: Scene[];
  videos: VideoItem[];
  activeVideoId: string | null;
  activeSceneId: string | null;
  thumbnails?: Record<string, string>;
  soundEnabled: boolean;
  onToggleSound: () => void;
  onTriggerScene: (scene: Scene) => void;
  onExportProject: () => void;
  onImportProject: (data: ProjectData) => void;
  onResetScenes: () => void;
}

export const HotkeysSidebar: React.FC<HotkeysSidebarProps> = ({
  scenes,
  videos,
  activeVideoId,
  activeSceneId,
  thumbnails = {},
  soundEnabled,
  onToggleSound,
  onTriggerScene,
  onExportProject,
  onImportProject,
  onResetScenes,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsed = JSON.parse(text) as ProjectData;
        if (parsed && Array.isArray(parsed.scenes)) {
          onImportProject(parsed);
        } else {
          alert('Invalid project JSON structure.');
        }
      } catch (err) {
        alert('Could not parse project JSON file.');
      }
    };
    reader.readAsText(file);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="w-full flex flex-col gap-4">
      {/* Block Card 1: Keyboard Hotkeys Sampler Pad */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-3.5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Keyboard className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-wide">Performance Hotkeys</h3>
              <p className="text-[11px] text-slate-400">Instantly calls up scene from any video</p>
            </div>
          </div>

          <button
            onClick={onToggleSound}
            className={`px-2.5 py-1.5 rounded-xl text-xs flex items-center gap-1.5 border transition-all ${
              soundEnabled
                ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40 shadow-sm'
                : 'bg-slate-800 text-slate-400 border-slate-700'
            }`}
            title="Toggle audible click sound on hotkey triggers"
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5" />}
            <span className="text-[10px] font-bold">Chime</span>
          </button>
        </div>

        {/* Group 1: Playback & Timing */}
        <div className="flex flex-col gap-2">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-0.5">
            <Play className="w-3 h-3 text-cyan-400" />
            <span>Playback & Timing</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
              <span className="font-mono font-extrabold text-amber-300 bg-slate-850 px-2 py-0.5 rounded-lg text-[11px] border border-slate-700 shadow-sm">
                Space
              </span>
              <span className="text-slate-300 font-semibold text-[11px]">Play/Pause</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
              <span className="font-mono font-extrabold text-rose-300 bg-rose-950/80 px-2 py-0.5 rounded-lg text-[11px] border border-rose-800/60 shadow-sm">
                Esc
              </span>
              <span className="text-slate-300 font-semibold text-[11px]">Stop Loop</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
              <span className="font-mono font-extrabold text-cyan-300 bg-slate-850 px-2 py-0.5 rounded-lg text-[11px] border border-slate-700 shadow-sm">
                ← / →
              </span>
              <span className="text-slate-300 font-semibold text-[11px]">Seek ±5s</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
              <span className="font-mono font-extrabold text-cyan-300 bg-slate-850 px-2 py-0.5 rounded-lg text-[11px] border border-slate-700 shadow-sm">
                &lt; / &gt;
              </span>
              <span className="text-slate-300 font-semibold text-[11px]">Speed ±</span>
            </div>
          </div>
        </div>

        {/* Group 2: Audio & Display */}
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-0.5">
            <Sliders className="w-3 h-3 text-emerald-400" />
            <span>Audio & Display</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
              <span className="font-mono font-extrabold text-emerald-300 bg-slate-850 px-2 py-0.5 rounded-lg text-[11px] border border-slate-700 shadow-sm">
                ↑ / ↓
              </span>
              <span className="text-slate-300 font-semibold text-[11px]">Volume (0–200%)</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
              <span className="font-mono font-extrabold text-cyan-300 bg-slate-850 px-2.5 py-0.5 rounded-lg text-[11px] border border-slate-700 shadow-sm">
                M
              </span>
              <span className="text-slate-300 font-semibold text-[11px]">Mute</span>
            </div>

            <div className="col-span-2 flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
              <span className="font-mono font-extrabold text-emerald-300 bg-slate-850 px-2.5 py-0.5 rounded-lg text-[11px] border border-slate-700 shadow-sm">
                F
              </span>
              <span className="text-slate-300 font-semibold text-[11px]">Toggle Fullscreen (MultiBox / Video)</span>
            </div>
          </div>
        </div>

        {/* Group 3: Scenes & Deck */}
        <div className="flex flex-col gap-2 pt-1 border-t border-slate-800/60">
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-slate-400 uppercase tracking-wider px-0.5">
            <Layers className="w-3 h-3 text-rose-400" />
            <span>Scenes & Deck</span>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
              <span className="font-mono font-extrabold text-rose-400 bg-slate-850 px-2.5 py-0.5 rounded-lg text-[11px] border border-slate-700 shadow-sm">
                R
              </span>
              <span className="text-slate-300 font-semibold text-[11px]">Record Scene</span>
            </div>

            <div className="flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
              <span className="font-mono font-extrabold text-rose-400 bg-slate-850 px-2 py-0.5 rounded-lg text-[11px] border border-slate-700 shadow-sm">
                Delete
              </span>
              <span className="text-slate-300 font-semibold text-[11px]">Delete Scene</span>
            </div>

            <div className="col-span-2 flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
              <span className="font-mono font-extrabold text-indigo-300 bg-slate-850 px-2 py-0.5 rounded-lg text-[11px] border border-slate-700 shadow-sm">
                Shift+Drag
              </span>
              <span className="text-slate-300 font-semibold text-[11px]">Add Timeline Range</span>
            </div>

            <div className="col-span-2 flex items-center justify-between p-2 rounded-xl bg-slate-950/80 border border-slate-800/80 hover:border-slate-700/80 transition-colors">
              <span className="font-mono font-extrabold text-sky-300 bg-slate-850 px-2 py-0.5 rounded-lg text-[11px] border border-slate-700 shadow-sm">
                0-9 / A-Z
              </span>
              <span className="text-slate-300 font-semibold text-[11px]">Trigger Mapped Scene</span>
            </div>
          </div>
        </div>
      </div>

      {/* Block Card 2: Multi-Video Project Persistence */}
      <div className="bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-3.5">
        <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <FileJson className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-white tracking-wide">Multi-Video Project</h3>
              <p className="text-[11px] text-slate-400">Save & share performance setup</p>
            </div>
          </div>
          <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-bold bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/30">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Saved</span>
          </span>
        </div>

        {/* Video & Scene Summary */}
        <div className="text-xs bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex flex-col gap-1.5">
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold">Loaded Videos:</span>
            <span className="font-bold text-cyan-300 font-mono">
              {videos.length} {videos.length === 1 ? 'file' : 'files'}
            </span>
          </div>
          <div className="flex items-center justify-between text-slate-400">
            <span className="font-semibold">Total Scenes:</span>
            <span className="font-mono font-bold text-white">{scenes.length}</span>
          </div>
        </div>

        {/* Export & Import Buttons */}
        <div className="grid grid-cols-2 gap-2.5">
          <button
            onClick={onExportProject}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-cyan-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-all hover:scale-102 active:scale-98 shadow-sm"
            title="Download multi-video scene configuration as JSON"
          >
            <Download className="w-4 h-4" />
            <span>Export JSON</span>
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-cyan-300 hover:text-white border border-slate-700/80 text-xs font-bold transition-all hover:scale-102 active:scale-98 shadow-sm"
            title="Load project scene configuration from JSON"
          >
            <Upload className="w-4 h-4" />
            <span>Import JSON</span>
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        {/* Reset Option */}
        <div className="pt-2 border-t border-slate-800/80">
          <button
            onClick={onResetScenes}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-slate-850/50 hover:bg-rose-500/20 text-slate-400 hover:text-rose-300 border border-slate-800 hover:border-rose-500/30 text-xs font-semibold transition-all"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Clear All Scenes</span>
          </button>
        </div>
      </div>
    </div>
  );
};
