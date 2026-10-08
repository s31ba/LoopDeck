import React, { useState } from 'react';
import { Scene, VideoItem } from '../types/scene';
import { formatTimestamp, parseTimestamp, formatDuration, normalizeKey } from '../utils/time';
import { exportSceneClip } from '../utils/sceneExporter';
import { ConfirmRemoveScenesModal } from './ConfirmRemoveScenesModal';
import {
  Trash2,
  Key,
  AlertTriangle,
  Check,
  Edit2,
  Copy,
  Layers,
  Sparkles,
  Film,
  Repeat,
  Download,
  Loader2,
} from 'lucide-react';

interface SceneListProps {
  scenes: Scene[];
  videos: VideoItem[];
  activeVideoId: string | null;
  activeSceneId: string | null;
  selectedSceneId: string | null;
  currentTime: number;
  thumbnails?: Record<string, string>;
  isRecording?: boolean;
  recordingStartTime?: number | null;
  onToggleRecord?: () => void;
  onSelectScene: (id: string) => void;
  onPlayScene: (scene: Scene) => void;
  onAddScene: () => void;
  onUpdateScene: (updated: Scene) => void;
  onDeleteScene: (id: string) => void;
  onDuplicateScene: (scene: Scene) => void;
  onSwitchVideo: (videoId: string) => void;
  onRemoveAllScenes?: () => void;
}

export const SceneList: React.FC<SceneListProps> = ({
  scenes,
  videos,
  activeVideoId,
  activeSceneId,
  selectedSceneId,
  currentTime,
  thumbnails = {},
  onSelectScene,
  onPlayScene,
  onUpdateScene,
  onDeleteScene,
  onDuplicateScene,
  onSwitchVideo,
  onRemoveAllScenes,
}) => {
  const [listeningSceneId, setListeningSceneId] = useState<string | null>(null);
  const [filterMode, setFilterMode] = useState<'all' | 'current'>('all');
  const [isConfirmRemoveAllOpen, setIsConfirmRemoveAllOpen] = useState(false);

  // Editable row state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');

  // Download clip state
  const [downloadingSceneId, setDownloadingSceneId] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<number>(0);

  const handleDownloadScene = async (scene: Scene) => {
    const parentVideo = videos.find((v) => v.id === scene.videoId);
    const videoSrc = parentVideo?.src || (videos.length > 0 ? videos[0].src : null);
    if (!videoSrc) {
      alert('Video source is not loaded or unavailable for download.');
      return;
    }

    setDownloadingSceneId(scene.id);
    setDownloadProgress(0);

    try {
      await exportSceneClip({
        videoSrc,
        startTime: scene.startTime,
        endTime: scene.endTime,
        videoName: parentVideo?.name || scene.videoName || 'video',
        sceneName: scene.name || 'scene',
        onProgress: (pct) => setDownloadProgress(pct),
      });
    } catch (err) {
      console.error('Failed to export scene clip:', err);
      alert('Export failed: ' + (err instanceof Error ? err.message : String(err)));
    } finally {
      setDownloadingSceneId(null);
      setDownloadProgress(0);
    }
  };

  // Check for duplicate hotkeys
  const hotkeyCounts: Record<string, number> = {};
  scenes.forEach((s) => {
    if (s.hotkey) {
      const k = s.hotkey.toUpperCase();
      hotkeyCounts[k] = (hotkeyCounts[k] || 0) + 1;
    }
  });

  const duplicateHotkeys = Object.keys(hotkeyCounts).filter((k) => hotkeyCounts[k] > 1);

  const startEditing = (scene: Scene) => {
    setEditingId(scene.id);
    setEditName(scene.name);
    setEditStart(formatTimestamp(scene.startTime));
    setEditEnd(formatTimestamp(scene.endTime));
  };

  const saveEditing = (scene: Scene) => {
    const parsedStart = parseTimestamp(editStart);
    const parsedEnd = parseTimestamp(editEnd);

    const validStart = parsedStart !== null ? parsedStart : scene.startTime;
    let validEnd = parsedEnd !== null ? parsedEnd : scene.endTime;

    if (validEnd <= validStart) {
      validEnd = validStart + 1.0;
    }

    onUpdateScene({
      ...scene,
      name: editName.trim() || scene.name,
      startTime: validStart,
      endTime: validEnd,
    });
    setEditingId(null);
  };

  // Hotkey listener window hook when listeningSceneId is active
  React.useEffect(() => {
    if (!listeningSceneId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (e.key === 'Escape') {
        setListeningSceneId(null);
        return;
      }

      const keyName = normalizeKey(e);
      const targetScene = scenes.find((s) => s.id === listeningSceneId);
      if (targetScene) {
        onUpdateScene({
          ...targetScene,
          hotkey: keyName,
        });
      }
      setListeningSceneId(null);
    };

    window.addEventListener('keydown', handleKeyDown, true);
    return () => {
      window.removeEventListener('keydown', handleKeyDown, true);
    };
  }, [listeningSceneId, scenes, onUpdateScene]);

  // Display scenes based on filter
  const displayedScenes = filterMode === 'current' && activeVideoId
    ? scenes.filter((s) => s.videoId === activeVideoId)
    : scenes;

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800/80 rounded-2xl p-5 shadow-xl backdrop-blur-md flex flex-col gap-4">
      {/* Header Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-4">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-tr from-cyan-500/20 to-indigo-500/20 text-cyan-400 border border-cyan-500/30">
            <Layers className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-white tracking-wide flex items-center gap-2">
              Performance Scene Sampler
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                {scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}
              </span>
            </h2>
            <p className="text-xs text-slate-400">
              Manage scene ranges, key mappings, and loop configurations
            </p>
          </div>
        </div>

        {/* Action Controls & Filters */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {/* Filter Tabs if multiple videos */}
          {videos.length > 1 && (
            <div className="flex items-center bg-slate-950 p-1 rounded-xl border border-slate-800 text-xs">
              <button
                onClick={() => setFilterMode('all')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  filterMode === 'all'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Videos ({scenes.length})
              </button>
              <button
                onClick={() => setFilterMode('current')}
                className={`px-3 py-1 rounded-lg font-bold transition-all ${
                  filterMode === 'current'
                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Current Video ({scenes.filter((s) => s.videoId === activeVideoId).length})
              </button>
            </div>
          )}

          {/* Remove All Scene Button */}
          {onRemoveAllScenes && (
            <button
              onClick={() => setIsConfirmRemoveAllOpen(true)}
              disabled={scenes.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-rose-500/15 hover:bg-rose-500/25 active:bg-rose-500/35 text-rose-300 hover:text-rose-100 border border-rose-500/30 hover:border-rose-500/50 text-xs font-bold transition-all shadow-sm disabled:opacity-40 disabled:pointer-events-none cursor-pointer"
              title="Remove all scenes"
            >
              <Trash2 className="w-3.5 h-3.5 text-rose-400" />
              <span>Remove All Scene</span>
            </button>
          )}
        </div>
      </div>

      {/* Duplicate Hotkey Alert */}
      {duplicateHotkeys.length > 0 && (
        <div className="flex items-center gap-3 p-3.5 rounded-xl bg-amber-500/15 border border-amber-500/40 text-amber-200 text-xs shadow-md">
          <span title="Duplicate hotkey collision">
            <AlertTriangle className="w-5 h-5 shrink-0 text-amber-400" />
          </span>
          <div>
            <strong className="text-white font-bold">Hotkey conflict detected:</strong> Multiple scenes share the key{' '}
            {duplicateHotkeys.map((k) => (
              <span key={k} className="mx-1 px-2 py-0.5 bg-amber-400/20 text-amber-300 rounded-md font-mono font-extrabold border border-amber-400/30">
                [{k}]
              </span>
            ))}
            . Reassign one to ensure distinct instant triggering.
          </div>
        </div>
      )}

      {/* Listening Mode Banner */}
      {listeningSceneId && (
        <div className="p-4 bg-gradient-to-r from-indigo-950/90 to-purple-950/90 border border-indigo-500/60 rounded-xl flex items-center justify-between text-xs text-indigo-100 shadow-xl animate-pulse">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-500/20 text-indigo-300 border border-indigo-400/30">
              <Key className="w-4 h-4 animate-bounce" />
            </div>
            <div>
              <strong className="text-sm font-bold text-white block">Press any keyboard key now...</strong>
              <span className="text-indigo-300 text-xs">
                Supports 0-9, A-Z, F1-F12, Space, Arrow keys. Press <strong>Esc</strong> to cancel.
              </span>
            </div>
          </div>
          <button
            onClick={() => setListeningSceneId(null)}
            className="text-xs bg-slate-800 hover:bg-slate-700 px-3 py-1.5 rounded-lg text-white font-semibold border border-slate-700 transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Scenes Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-300 border-collapse">
          <thead>
            <tr className="border-b border-slate-800 text-[11px] font-bold text-slate-400 uppercase tracking-wider">
              <th className="py-3 px-3 w-12 text-center">#</th>
              <th className="py-3 px-3 w-28">Thumbnail</th>
              <th className="py-3 px-3 w-24">Hotkey</th>
              {videos.length > 1 && <th className="py-3 px-3">Video</th>}
              <th className="py-3 px-3">Scene Name</th>
              <th className="py-3 px-3">Start Time</th>
              <th className="py-3 px-3">End Time</th>
              <th className="py-3 px-3">Duration</th>
              <th className="py-3 px-3 text-center">Loop</th>
              <th className="py-3 px-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60 font-medium">
            {displayedScenes.length === 0 ? (
              <tr>
                <td colSpan={videos.length > 1 ? 10 : 9} className="py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <span className="p-3 rounded-2xl bg-slate-800/80 text-cyan-400">
                      <Sparkles className="w-6 h-6" />
                    </span>
                    <span className="text-sm font-semibold text-slate-300">No scenes created yet</span>
                    <span className="text-xs text-slate-400 max-w-sm">
                      Use the <strong>Record Scene</strong> button or Shift+Drag on the timeline to create scenes.
                    </span>
                  </div>
                </td>
              </tr>
            ) : (
              displayedScenes.map((scene, index) => {
                const isActive = activeSceneId === scene.id;
                const isSelected = selectedSceneId === scene.id;
                const isDuplicate = hotkeyCounts[scene.hotkey.toUpperCase()] > 1;
                const isListening = listeningSceneId === scene.id;
                const isEditing = editingId === scene.id;

                const parentVideo = videos.find((v) => v.id === scene.videoId);
                const isCurrentVideo = scene.videoId === activeVideoId;
                const thumb = thumbnails[scene.id];

                return (
                  <tr
                    key={scene.id}
                    onClick={() => {
                      onSelectScene(scene.id);
                      if (scene.videoId !== activeVideoId) {
                        onSwitchVideo(scene.videoId);
                      }
                    }}
                    className={`transition-all cursor-pointer group ${
                      isActive
                        ? 'bg-cyan-500/10 text-white font-semibold shadow-inner'
                        : isSelected
                        ? 'bg-slate-850/60 hover:bg-slate-800/60'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    {/* Index Number */}
                    <td className="py-3 px-3 text-center font-mono text-slate-500 font-bold">
                      {index + 1}
                    </td>

                    {/* Scene Thumbnail Preview (Requirement 1) */}
                    <td className="py-3 px-3">
                      <div className="relative w-20 h-11 rounded-lg overflow-hidden bg-black border border-slate-800 flex items-center justify-center shadow-inner">
                        {thumb ? (
                          <img
                            src={thumb}
                            alt={scene.name}
                            className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          />
                        ) : (
                          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-950 text-slate-600">
                            <Film className="w-4 h-4 text-cyan-500/50 animate-pulse" />
                          </div>
                        )}
                        {isActive && (
                          <div className="absolute top-1 right-1 w-2 h-2 rounded-full bg-cyan-400 animate-ping shadow" />
                        )}
                      </div>
                    </td>

                    {/* Hotkey Column */}
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setListeningSceneId(scene.id);
                          }}
                          className={`font-mono font-extrabold text-xs px-2.5 py-1.5 rounded-xl transition-all flex items-center gap-1 border shadow-sm ${
                            isListening
                              ? 'bg-indigo-600 text-white animate-pulse border-indigo-400 ring-2 ring-indigo-400/50'
                              : isDuplicate
                              ? 'bg-amber-500/20 text-amber-300 border-amber-500/60 hover:bg-amber-500/30'
                              : 'bg-slate-800/90 hover:bg-slate-700 text-amber-300 border-slate-700 hover:border-slate-500'
                          }`}
                          title="Click to assign hotkey"
                        >
                          <Key className="w-3 h-3 text-slate-400" />
                          <span className="tracking-wider uppercase">{isListening ? '...' : scene.hotkey || '-'}</span>
                        </button>
                        {isDuplicate && (
                          <span title="Duplicate hotkey collision">
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          </span>
                        )}
                      </div>
                    </td>

                    {/* Video Name Badge (if multiple videos) */}
                    {videos.length > 1 && (
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-lg border text-[11px] font-semibold truncate max-w-[130px] block ${
                            isCurrentVideo
                              ? 'bg-cyan-950/40 border-cyan-500/40 text-cyan-300'
                              : 'bg-slate-950/60 border-slate-800 text-slate-400'
                          }`}
                          title={parentVideo?.name || scene.videoName || 'Video'}
                        >
                          {parentVideo?.name || scene.videoName || 'Video'}
                        </span>
                      </td>
                    )}

                    {/* Scene Name Column */}
                    <td className="py-3 px-3">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editName}
                          onChange={(e) => setEditName(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-full bg-slate-950 border border-cyan-500 rounded-xl px-2.5 py-1 text-white font-semibold text-xs focus:outline-none"
                          placeholder="Scene name"
                        />
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0 shadow-sm"
                            style={{ backgroundColor: scene.color }}
                          />
                          <span className="font-bold text-slate-200 group-hover:text-white tracking-wide">
                            {scene.name}
                          </span>
                          {isActive && (
                            <span className="px-1.5 py-0.2 rounded bg-cyan-500/20 text-cyan-300 text-[9px] font-mono font-bold border border-cyan-500/40">
                              ACTIVE
                            </span>
                          )}
                          {parentVideo?.vrSettings?.enabled && (
                            <span
                              className="px-1.5 py-0.2 rounded bg-cyan-950/70 text-cyan-300 text-[9px] font-mono font-bold border border-cyan-500/40"
                              title={
                                scene.vrView
                                  ? `VR View Saved: Yaw ${Math.round(scene.vrView.yaw)}°, Pitch ${Math.round(scene.vrView.pitch)}°`
                                  : 'VR Video Scene'
                              }
                            >
                              VR{scene.vrView ? ` [${Math.round(scene.vrView.yaw)}°]` : ''}
                            </span>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Start Time Column */}
                    <td className="py-3 px-3 font-mono">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editStart}
                          onChange={(e) => setEditStart(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-28 bg-slate-950 border border-cyan-500 rounded-xl px-2 py-1 text-white text-xs font-mono font-bold focus:outline-none"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300 font-semibold">{formatTimestamp(scene.startTime)}</span>
                          {isCurrentVideo && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateScene({
                                  ...scene,
                                  startTime: currentTime,
                                  endTime: Math.max(scene.endTime, currentTime + 0.5),
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white text-[10px] font-bold border border-slate-700 transition-all"
                              title="Set Start to current video time"
                            >
                              Set
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* End Time Column */}
                    <td className="py-3 px-3 font-mono">
                      {isEditing ? (
                        <input
                          type="text"
                          value={editEnd}
                          onChange={(e) => setEditEnd(e.target.value)}
                          onClick={(e) => e.stopPropagation()}
                          className="w-28 bg-slate-950 border border-cyan-500 rounded-xl px-2 py-1 text-white text-xs font-mono font-bold focus:outline-none"
                        />
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <span className="text-slate-300 font-semibold">{formatTimestamp(scene.endTime)}</span>
                          {isCurrentVideo && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onUpdateScene({
                                  ...scene,
                                  endTime: Math.max(scene.startTime + 0.5, currentTime),
                                });
                              }}
                              className="opacity-0 group-hover:opacity-100 px-1.5 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-white text-[10px] font-bold border border-slate-700 transition-all"
                              title="Set End to current video time"
                            >
                              Set
                            </button>
                          )}
                        </div>
                      )}
                    </td>

                    {/* Duration Column */}
                    <td className="py-3 px-3 font-mono text-cyan-400/90 text-xs font-bold">
                      {formatDuration(scene.endTime - scene.startTime)}
                    </td>

                    {/* Loop Toggle Column */}
                    <td className="py-3 px-3 text-center">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onUpdateScene({ ...scene, loop: !scene.loop });
                        }}
                        className={`px-2.5 py-1 rounded-lg font-mono text-[10px] font-extrabold transition-all border flex items-center justify-center gap-1 mx-auto ${
                          scene.loop
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40 hover:bg-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                        title="Toggle Scene Looping"
                      >
                        <Repeat className="w-3 h-3" />
                        <span>{scene.loop ? 'ON' : 'OFF'}</span>
                      </button>
                    </td>

                    {/* Actions Column (Edit, Duplicate, Delete) */}
                    <td className="py-3 px-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {isEditing ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              saveEditing(scene);
                            }}
                            className="p-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm"
                            title="Save Changes"
                          >
                            <Check className="w-3.5 h-3.5" />
                          </button>
                        ) : (
                          <>
                            {/* Download Scene Clip Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDownloadScene(scene);
                              }}
                              disabled={downloadingSceneId === scene.id}
                              className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                                downloadingSceneId === scene.id
                                  ? 'bg-cyan-500/20 text-cyan-300 border-cyan-400 animate-pulse'
                                  : 'bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-cyan-300 border-slate-700'
                              }`}
                              title={
                                downloadingSceneId === scene.id
                                  ? `Exporting clip: ${downloadProgress}%`
                                  : `Download Scene Clip (${formatTimestamp(scene.startTime)} - ${formatTimestamp(scene.endTime)})`
                              }
                            >
                              {downloadingSceneId === scene.id ? (
                                <>
                                  <Loader2 className="w-3.5 h-3.5 animate-spin text-cyan-400" />
                                  <span className="text-[10px] font-mono font-bold text-cyan-300">
                                    {downloadProgress}%
                                  </span>
                                </>
                              ) : (
                                <Download className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Edit Button */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                startEditing(scene);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                              title="Edit Scene Details"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Duplicate Scene */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDuplicateScene(scene);
                              }}
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white border border-slate-700 transition-colors"
                              title="Duplicate Scene"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete Scene */}
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                onDeleteScene(scene.id);
                              }}
                              className="p-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-600 text-rose-400 hover:text-white border border-rose-500/30 transition-colors"
                              title="Delete Scene"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Confirmation Modal for Removing All Scenes */}
      <ConfirmRemoveScenesModal
        isOpen={isConfirmRemoveAllOpen}
        scenesCount={scenes.length}
        onConfirm={() => {
          setIsConfirmRemoveAllOpen(false);
          if (onRemoveAllScenes) {
            onRemoveAllScenes();
          }
        }}
        onCancel={() => setIsConfirmRemoveAllOpen(false)}
      />
    </div>
  );
};
