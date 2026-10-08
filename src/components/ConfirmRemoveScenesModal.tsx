import React, { useEffect } from 'react';
import { Trash2 } from 'lucide-react';

interface ConfirmRemoveScenesModalProps {
  isOpen: boolean;
  scenesCount?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ConfirmRemoveScenesModal: React.FC<ConfirmRemoveScenesModalProps> = ({
  isOpen,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCancel();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-150 select-none"
    >
      <div
        className="relative w-full max-w-[300px] bg-slate-900/95 border border-slate-800 rounded-2xl p-5 shadow-2xl flex flex-col items-center text-center gap-3 backdrop-blur-md"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="w-10 h-10 rounded-xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400 shrink-0">
          <Trash2 className="w-5 h-5" />
        </div>

        <div>
          <h3 className="text-sm font-extrabold text-white tracking-tight">
            Remove all scenes?
          </h3>
          <p className="text-[11px] text-slate-400 mt-1">
            Are you sure you want to remove all scenes?
          </p>
        </div>

        <div className="flex items-center justify-center gap-2 w-full pt-1">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white text-xs font-bold transition-all border border-slate-700/80 cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-rose-600 to-red-600 hover:from-rose-500 hover:to-red-500 text-white text-xs font-extrabold shadow-md shadow-rose-600/30 transition-all hover:scale-102 active:scale-98 cursor-pointer"
          >
            Yes
          </button>
        </div>
      </div>
    </div>
  );
};
