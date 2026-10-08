import React, { useState } from 'react';
import { Scene, VideoItem } from '../../types/scene';
import { DragItemPayload } from '../../types/multibox';
import { formatDuration, formatTimestamp } from '../../utils/time';
import {
  Film,
  Layers,
  GripVertical,
  Plus,
  PlayCircle,
  Video,
} from 'lucide-react';

interface MultiBoxSceneBankProps {
  videos: VideoItem[];
  scenes: Scene[];
  thumbnails: Record<string, string>;
  onQuickAssign?: (payload: DragItemPayload) => void;
}

export const MultiBoxSceneBank: React.FC<MultiBoxSceneBankProps> = ({
  videos,
  scenes,
  thumbnails,
  onQuickAssign,
}) => {
  const [filterQuery, setFilterQuery] = useState('');

  // Handle Drag Start
  const handleDragStart = (
    e: React.DragEvent,
    payload: DragItemPayload
  ) => {
    e.dataTransfer.setData('application/json', JSON.stringify(payload));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const filteredScenes = scenes.filter((s) => {
    if (!filterQuery) return true;
    const q = filterQuery.toLowerCase();
    const vid = videos.find((v) => v.id === s.videoId);
    return (
      s.name.toLowerCase().includes(q) ||
      (vid && vid.name.toLowerCase().includes(q)) ||
      (s.hotkey && s.hotkey.toLowerCase().includes(q))
    );
  });

  return (
    <div className="w-80 md:w-84 xl:w-96 bg-slate-900/95 border-l border-slate-800 flex flex-col h-full overflow-hidden select-none">
      {/* Header */}
      <div className="p-3.5 border-b border-slate-800/80 shrink-0 flex flex-col gap-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
              <Layers className="w-3.5 h-3.5" />
            </div>
            <div>
              <h3 className="text-xs font-black text-white tracking-wider uppercase">
                MultiBox Deck
              </h3>
              <p className="text-[10px] text-slate-400">Drag items into any box</p>
            </div>
          </div>
          <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-slate-950 text-cyan-300 border border-slate-800">
            {videos.length} vids • {scenes.length} scenes
          </span>
        </div>

        {/* Quick Filter Search */}
        <input
          type="text"
          value={filterQuery}
          onChange={(e) => setFilterQuery(e.target.value)}
          placeholder="Filter scenes or videos..."
          className="w-full bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500/60"
        />
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 custom-scrollbar">
        {/* SECTION 1: WHOLE VIDEO ITEMS (Requirement 4) */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <Video className="w-3.5 h-3.5 text-indigo-400" />
            <h4 className="text-[11px] font-extrabold text-indigo-300 uppercase tracking-wider">
              Whole Videos ({videos.length})
            </h4>
          </div>

          {videos.length === 0 ? (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center text-slate-500 text-xs">
              No videos loaded in deck.
            </div>
          ) : (
            <div className="space-y-2">
              {videos.map((vid) => {
                const accentColor = vid.color || '#06b6d4';
                const payload: DragItemPayload = {
                  type: 'video',
                  videoId: vid.id,
                };

                return (
                  <div
                    key={vid.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, payload)}
                    onClick={() => onQuickAssign && onQuickAssign(payload)}
                    style={{
                      borderColor: `${accentColor}40`,
                      backgroundColor: 'rgba(12, 18, 32, 0.85)',
                    }}
                    className="group relative flex items-center gap-2.5 p-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing hover:border-cyan-400 hover:bg-slate-800/90 shadow-sm"
                    title={`Drag to Box: ${vid.name} (Whole Video)`}
                  >
                    {/* Drag Handle Icon */}
                    <div className="text-slate-600 group-hover:text-slate-300 shrink-0">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>

                    {/* Color side indicator strip */}
                    <div
                      className="w-1.5 h-12 rounded-full shrink-0"
                      style={{
                        backgroundColor: accentColor,
                        boxShadow: `0 0 6px ${accentColor}80`,
                      }}
                    />

                    {/* Video Thumbnail */}
                    <div className="relative w-16 h-11 rounded-lg overflow-hidden bg-black border border-slate-800 shrink-0 flex items-center justify-center">
                      {vid.thumbnail ? (
                        <img
                          src={vid.thumbnail}
                          alt={vid.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Film className="w-4 h-4 text-indigo-400/50" />
                      )}
                      <div className="absolute inset-0 bg-indigo-950/30 flex items-center justify-center group-hover:bg-transparent transition-colors">
                        <PlayCircle className="w-4 h-4 text-white/80 group-hover:scale-110 transition-transform" />
                      </div>
                      {vid.vrSettings?.enabled && (
                        <span className="absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded bg-black/85 text-cyan-300 text-[7px] font-mono font-black border border-cyan-500/50">
                          VR
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="px-1.5 py-0.2 rounded text-[8px] font-mono font-black uppercase bg-indigo-500/20 text-indigo-300 border border-indigo-500/40">
                          Full Video
                        </span>
                        {vid.duration > 0 && (
                          <span className="text-[10px] font-mono text-slate-400">
                            {formatDuration(vid.duration)}
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-bold text-white truncate mt-0.5" title={vid.name}>
                        {vid.name}
                      </p>
                    </div>

                    {/* Quick Add Button */}
                    {onQuickAssign && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAssign(payload);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-indigo-600/80 hover:bg-indigo-500 text-white transition-opacity shrink-0 shadow"
                        title="Add to first empty box"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* SECTION 2: SCENES ITEMS (Requirement 4 & 11) */}
        <div>
          <div className="flex items-center gap-1.5 mb-2 px-1">
            <Layers className="w-3.5 h-3.5 text-cyan-400" />
            <h4 className="text-[11px] font-extrabold text-cyan-300 uppercase tracking-wider">
              Scenes ({filteredScenes.length})
            </h4>
          </div>

          {filteredScenes.length === 0 ? (
            <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800/60 text-center text-slate-500 text-xs">
              No scenes matching criteria.
            </div>
          ) : (
            <div className="space-y-2">
              {filteredScenes.map((sc) => {
                const parentVid = videos.find((v) => v.id === sc.videoId);
                const accentColor = parentVid?.color || sc.color || '#06b6d4';
                const thumb = thumbnails[sc.id];
                const isVR = !!parentVid?.vrSettings?.enabled;

                const payload: DragItemPayload = {
                  type: 'scene',
                  videoId: sc.videoId,
                  sceneId: sc.id,
                };

                return (
                  <div
                    key={sc.id}
                    draggable
                    onDragStart={(e) => handleDragStart(e, payload)}
                    onClick={() => onQuickAssign && onQuickAssign(payload)}
                    style={{
                      borderColor: `${accentColor}35`,
                      backgroundColor: 'rgba(10, 15, 26, 0.85)',
                    }}
                    className="group relative flex items-center gap-2 p-2 rounded-xl border transition-all cursor-grab active:cursor-grabbing hover:border-cyan-400 hover:bg-slate-800/90 shadow-sm"
                    title={`Drag to Box: ${sc.name} (${formatTimestamp(sc.startTime)} - ${formatTimestamp(sc.endTime)})`}
                  >
                    {/* Drag Handle */}
                    <div className="text-slate-600 group-hover:text-slate-300 shrink-0">
                      <GripVertical className="w-3.5 h-3.5" />
                    </div>

                    {/* Color side indicator strip */}
                    <div
                      className="w-1.5 h-12 rounded-full shrink-0"
                      style={{
                        backgroundColor: accentColor,
                        boxShadow: `0 0 6px ${accentColor}80`,
                      }}
                    />

                    {/* Scene Thumbnail */}
                    <div className="relative w-16 h-11 rounded-lg overflow-hidden bg-black border border-slate-800 shrink-0 flex items-center justify-center">
                      {thumb ? (
                        <img
                          src={thumb}
                          alt={sc.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      ) : (
                        <Film className="w-4 h-4 text-cyan-500/50" />
                      )}
                      {isVR && (
                        <span className="absolute bottom-0.5 left-0.5 px-1 py-0.2 rounded bg-black/85 text-cyan-300 text-[7px] font-mono font-black border border-cyan-500/50">
                          VR
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span
                          className="text-[9px] font-mono font-bold truncate max-w-[100px]"
                          style={{ color: accentColor }}
                          title={parentVid?.name || sc.videoName}
                        >
                          {parentVid?.name || sc.videoName || 'Video'}
                        </span>
                        <span className="text-[9px] font-mono text-slate-500">
                          {formatDuration(sc.endTime - sc.startTime)}
                        </span>
                      </div>
                      <p className="text-xs font-bold text-slate-200 group-hover:text-white truncate" title={sc.name}>
                        {sc.name}
                      </p>
                    </div>

                    {/* Hotkey Badge */}
                    <div
                      className="font-mono text-[10px] font-extrabold min-w-[26px] h-6 px-1.5 rounded-md flex items-center justify-center border shadow-xs uppercase shrink-0 bg-slate-900 text-amber-300 border-slate-800"
                    >
                      {sc.hotkey || '-'}
                    </div>

                    {/* Quick Add Button */}
                    {onQuickAssign && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onQuickAssign(payload);
                        }}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 transition-opacity shrink-0 shadow font-bold"
                        title="Add to first empty box"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
