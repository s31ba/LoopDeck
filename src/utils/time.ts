export const SCENE_COLORS = [
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f59e0b', // amber
  '#ec4899', // pink
  '#8b5cf6', // violet
  '#06b6d4', // cyan
  '#f97316', // orange
  '#14b8a6', // teal
  '#e11d48', // rose
  '#6366f1', // indigo
];

export const VIDEO_ACCENT_COLORS = [
  '#06b6d4', // cyan
  '#8b5cf6', // violet
  '#f59e0b', // amber
  '#10b981', // emerald
  '#ec4899', // pink
  '#3b82f6', // blue
  '#f97316', // orange
  '#14b8a6', // teal
  '#a855f7', // purple
  '#e11d48', // rose
];

export function getNextVideoColor(existingVideos: { color?: string }[]): string {
  const used = new Set(existingVideos.map((v) => v.color?.toLowerCase()).filter(Boolean));
  for (const c of VIDEO_ACCENT_COLORS) {
    if (!used.has(c.toLowerCase())) {
      return c;
    }
  }
  return VIDEO_ACCENT_COLORS[existingVideos.length % VIDEO_ACCENT_COLORS.length];
}

export function getRandomColor(index?: number): string {
  if (typeof index === 'number') {
    return SCENE_COLORS[index % SCENE_COLORS.length];
  }
  return SCENE_COLORS[Math.floor(Math.random() * SCENE_COLORS.length)];
}

/**
 * Formats seconds into HH:MM:SS.mmm format
 * e.g. 83.45 -> "00:01:23.450"
 */
export function formatTimestamp(seconds: number, includeMs = true): string {
  if (isNaN(seconds) || seconds < 0) seconds = 0;

  const totalMilliseconds = Math.round(seconds * 1000);
  const ms = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const s = totalSeconds % 60;
  const totalMinutes = Math.floor(totalSeconds / 60);
  const m = totalMinutes % 60;
  const h = Math.floor(totalMinutes / 60);

  const pad = (n: number, z = 2) => String(n).padStart(z, '0');

  if (includeMs) {
    return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
  }
  return `${pad(h)}:${pad(m)}:${pad(s)}`;
}

/**
 * Parses user input timestamp string into seconds
 * Supports:
 * - "00:01:23.450" (HH:MM:SS.mmm)
 * - "01:23.450" (MM:SS.mmm)
 * - "83.450" (pure seconds)
 * - "1:23" (MM:SS)
 */
export function parseTimestamp(input: string): number | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  // Pure number check: e.g. "12.5"
  if (/^\d+(\.\d+)?$/.test(trimmed)) {
    const val = parseFloat(trimmed);
    return isNaN(val) ? null : Math.max(0, val);
  }

  // Colon separated
  const parts = trimmed.split(':');
  if (parts.length === 2) {
    // MM:SS.mmm
    const minutes = parseInt(parts[0], 10);
    const seconds = parseFloat(parts[1]);
    if (isNaN(minutes) || isNaN(seconds)) return null;
    return Math.max(0, minutes * 60 + seconds);
  } else if (parts.length === 3) {
    // HH:MM:SS.mmm
    const hours = parseInt(parts[0], 10);
    const minutes = parseInt(parts[1], 10);
    const seconds = parseFloat(parts[2]);
    if (isNaN(hours) || isNaN(minutes) || isNaN(seconds)) return null;
    return Math.max(0, hours * 3600 + minutes * 60 + seconds);
  }

  return null;
}

export function formatDuration(seconds: number): string {
  if (isNaN(seconds) || seconds < 0) return '0.0s';
  if (seconds < 60) {
    return `${seconds.toFixed(2)}s`;
  }
  const mins = Math.floor(seconds / 60);
  const remSecs = (seconds % 60).toFixed(1);
  return `${mins}m ${remSecs}s`;
}

/**
 * Normalizes keyboard event key to a standard readable hotkey string
 */
export function normalizeKey(e: KeyboardEvent): string {
  // Function keys F1-F12
  if (/^F\d{1,2}$/.test(e.key)) {
    return e.key;
  }

  // Arrow keys
  if (e.key === 'ArrowUp') return 'Up';
  if (e.key === 'ArrowDown') return 'Down';
  if (e.key === 'ArrowLeft') return 'Left';
  if (e.key === 'ArrowRight') return 'Right';

  // Space
  if (e.key === ' ' || e.code === 'Space') {
    return 'Space';
  }

  // Esc
  if (e.key === 'Escape') {
    return 'Esc';
  }

  // Letters and numbers: normalize uppercase
  if (/^[a-zA-Z]$/.test(e.key)) {
    return e.key.toUpperCase();
  }

  if (/^[0-9]$/.test(e.key)) {
    return e.key;
  }

  // Other common symbols like -, =, [, ], ;, ', ,, ., /
  return e.key;
}

// Simple subtle web audio chime for key presses
let audioCtx: AudioContext | null = null;
export function playChime(freq = 600, duration = 0.06, type: OscillatorType = 'sine') {
  try {
    if (!audioCtx) {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        audioCtx = new AudioContextClass();
      }
    }
    if (!audioCtx) return;
    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.04, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + duration);
  } catch {
    // Ignore audio autoplay restrictions
  }
}
