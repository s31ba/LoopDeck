import React from 'react';
import { AlertTriangle, Trash2, X } from 'lucide-react';
import { VideoItem, Scene } from '../types/scene';

interface ConfirmModalProps {
  isOpen: boolean;
  video: VideoItem | null;
  scenesCount: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmModal: React.FC<ConfirmModalProps> = ({
  isOpen,
  video,
  scenesCount,
  onConfirm,
  onCancel,
}) => {
  if (!isOpen || !video) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-2xl flex flex-col gap-4"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onCancel}
          className="absolute top-4 right-4 p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-850 transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Header Icon & Title */}
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
            <Trash2 className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-extrabold text-white tracking-tight">
              Remove Video from Deck?
            </h3>
            <p className="text-xs text-slate-400">
              This action will delete the video and its scene assignments
            </p>
          </div>
        </div>

        {/* Video Details Card */}
        <div className="p-3.5 rounded-xl bg-slate-950/80 border border-slate-800/90 flex items-center gap-3">
          <div className="w-16 h-10 rounded-lg overflow-hidden bg-slate-900 border border-slate-800 shrink-0">
            {video.thumbnail ? (
              <img src={video.thumbnail} alt={video.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-600 font-mono text-xs">
                VIDEO
              </div>
            )}
          </div>
          <div className="min-w-0 flex-1">
            <span className="font-bold text-white text-sm block truncate" title={video.name}>
              {video.name}
            </span>
            <span className="text-xs text-rose-400 font-medium">
              {scenesCount > 0
                ? `${scenesCount} scene marker(s) & hotkey(s) will be removed`
                : 'No scenes attached to this video'}
            </span>
          </div>
        </div>

        <p className="text-xs text-slate-300 leading-relaxed">
          Are you sure you want to remove <strong className="text-white">"{video.name}"</strong>? If other videos are loaded, LoopDeck will automatically switch to the next available video.
        </p>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-800">
          <button
            onClick={onCancel}
            className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-bold transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-extrabold shadow-lg shadow-rose-600/30 transition-all hover:scale-102 active:scale-98 flex items-center gap-1.5"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span>Remove Video</span>
          </button>
        </div>
      </div>
    </div>
  );
};
