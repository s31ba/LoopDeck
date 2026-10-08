import React, { useRef } from 'react';
import { VideoItem, Scene } from '../types/scene';
import { formatTimestamp } from '../utils/time';
import {
  Film,
  Plus,
  Trash2,
  Play,
  Layers,
  CheckCircle2,
  Clock,
  Sparkles,
  Link2,
} from 'lucide-react';

interface VideoDeckSwitcherProps {
  videos: VideoItem[];
  activeVideoId: string | null;
  scenes: Scene[];
  onSelectVideo: (videoId: string) => void;
  onAddVideos: (files: FileList | File[]) => void;
  onRemoveVideo: (videoId: string) => void;
  onOpenLinkVideo?: () => void;
}

export const VideoDeckSwitcher: React.FC<VideoDeckSwitcherProps> = ({
  videos,
  activeVideoId,
  scenes,
  onSelectVideo,
  onAddVideos,
  onRemoveVideo,
  onOpenLinkVideo,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const activeVideo = videos.find((v) => v.id === activeVideoId) || videos[0] || null;
  // Other videos to display in the thumbnail sidebar
  const otherVideos = videos.filter((v) => v.id !== activeVideoId);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      onAddVideos(e.target.files);
      e.target.value = '';
    }
  };

  return (
    <div className="w-full bg-slate-900/90 border border-slate-800/80 rounded-2xl p-4 shadow-xl backdrop-blur-md flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 rounded-lg bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">
            <Film className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-extrabold text-white tracking-wide flex items-center gap-2">
              Video Deck
              <span className="text-[10px] font-mono px-2 py-0.2 rounded-full bg-slate-800 text-cyan-300 border border-slate-700">
                {videos.length} {videos.length === 1 ? 'clip' : 'clips'}
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">Click to switch main player</p>
          </div>
        </div>

        {/* Action Buttons: Add Video / Link Video */}
        <div className="flex items-center gap-1.5">
          {onOpenLinkVideo && (
            <button
              onClick={onOpenLinkVideo}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700/80 font-bold text-xs transition-all hover:scale-103 active:scale-97"
              title="Add Video via URL"
            >
              <Link2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Link</span>
            </button>
          )}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-cyan-500 to-indigo-600 hover:from-cyan-400 hover:to-indigo-500 text-white font-bold text-xs shadow-md shadow-cyan-500/20 transition-all hover:scale-103 active:scale-97"
            title="Add another video to the performance deck"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add</span>
          </button>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="video/*,.mp4,.webm,.mov,.mkv,.avi,.m4v,.gif,image/gif"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* Active Video Status Block */}
      {activeVideo && (
        <div className="p-2.5 rounded-xl bg-cyan-950/30 border border-cyan-500/40 flex items-center justify-between gap-2 shadow-inner">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="relative w-12 h-8 rounded-lg overflow-hidden bg-slate-950 border border-cyan-500/50 shrink-0">
              {activeVideo.thumbnail ? (
                <img src={activeVideo.thumbnail} alt={activeVideo.name} className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-cyan-400">
                  <Film className="w-4 h-4" />
                </div>
              )}
              <span className="absolute bottom-0 right-0 px-1 text-[8px] font-mono bg-black/80 text-cyan-300 font-bold rounded-tl">
                MAIN
              </span>
            </div>
            <div className="min-w-0">
              <span className="text-[10px] text-cyan-400 font-bold uppercase tracking-wider block">
                Active in Main Player
              </span>
              <span className="text-xs font-bold text-white truncate block max-w-[130px]" title={activeVideo.name}>
                {activeVideo.name}
              </span>
            </div>
          </div>

          <button
            onClick={() => onRemoveVideo(activeVideo.id)}
            className="p-1.5 rounded-lg bg-rose-500/15 hover:bg-rose-500/30 text-rose-300 hover:text-white border border-rose-500/30 transition-colors shrink-0"
            title={`Remove "${activeVideo.name}" and its scenes from LoopDeck`}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Other Videos Thumbnail Cards */}
      <div className="flex flex-col gap-2 overflow-y-auto max-h-[360px] pr-1">
        {otherVideos.length === 0 ? (
          <div className="text-center py-6 px-3 rounded-xl bg-slate-950/50 border border-slate-800/80 text-xs text-slate-400 flex flex-col items-center gap-2">
            <Layers className="w-5 h-5 text-slate-600" />
            <span className="text-slate-400 font-medium">No other videos in deck</span>
            <span className="text-[11px] text-slate-500">
              Click <strong>Add Video</strong> above to load multiple clips and switch between them instantly.
            </span>
          </div>
        ) : (
          otherVideos.map((video) => {
            const videoScenesCount = scenes.filter((s) => s.videoId === video.id).length;

            return (
              <div
                key={video.id}
                onClick={() => onSelectVideo(video.id)}
                className="group relative p-2.5 rounded-xl bg-slate-950/80 hover:bg-slate-850 border border-slate-800 hover:border-cyan-500/50 transition-all cursor-pointer flex items-center justify-between gap-3 shadow-md hover:scale-[1.01]"
              >
                {/* Thumbnail & Info */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="relative w-16 h-10 rounded-lg overflow-hidden bg-slate-900 border border-slate-700/80 shrink-0 group-hover:border-cyan-400 transition-colors">
                    {video.thumbnail ? (
                      <img src={video.thumbnail} alt={video.name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-slate-500">
                        <Film className="w-5 h-5" />
                      </div>
                    )}
                    {/* Play hover overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                      <Play className="w-4 h-4 text-cyan-300 fill-cyan-300" />
                    </div>
                    {video.duration > 0 && (
                      <span className="absolute bottom-0 right-0 px-1 py-0.2 text-[8px] font-mono bg-black/80 text-slate-300 rounded-tl">
                        {formatTimestamp(video.duration, false).substring(3)}
                      </span>
                    )}
                  </div>

                  <div className="min-w-0">
                    <span
                      className="text-xs font-bold text-slate-200 group-hover:text-white truncate block max-w-[130px]"
                      title={video.name}
                    >
                      <span className="truncate">{video.name}</span>
                    </span>
                    <div className="flex items-center gap-1.5 mt-0.5">
                      <span className="text-[10px] font-mono font-semibold px-1.5 py-0.2 rounded bg-slate-850 text-cyan-400 border border-slate-800">
                        {videoScenesCount} {videoScenesCount === 1 ? 'scene' : 'scenes'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions: Remove individual video */}
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveVideo(video.id);
                    }}
                    className="p-1.5 rounded-lg opacity-40 group-hover:opacity-100 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 border border-transparent hover:border-rose-500/30 transition-all"
                    title={`Remove "${video.name}" from deck`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
