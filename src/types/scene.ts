export interface VideoVRSettings {
  enabled: boolean;
  projection: '360' | '180';
  eyeMode: 'mono' | 'left' | 'right';
  lens: 'regular' | 'fisheye';
  fov: number; // in degrees, default 75
}

export interface VideoItem {
  id: string;
  name: string;
  src: string;
  duration: number;
  thumbnail?: string;
  file?: File;
  addedAt: number;
  color?: string; // Unique accent color for this video
  vrSettings?: VideoVRSettings;
}

export interface VRCameraView {
  yaw: number;
  pitch: number;
  fov?: number;
}

export interface Scene {
  id: string;
  videoId: string; // The ID of the video this scene belongs to
  videoName?: string; // Cache of video filename for quick display & export
  name: string;
  startTime: number; // in seconds (float)
  endTime: number; // in seconds (float)
  hotkey: string; // e.g. "1", "2", "Q", "Space", "F1", "ArrowUp"
  loop: boolean;
  color: string; // Hex color code or Tailwind color token
  notes?: string;
  vrView?: VRCameraView; // Saved VR camera viewpoint (yaw, pitch, fov)
}

export interface ProjectData {
  version: string;
  createdAt: string;
  updatedAt: string;
  // Multi-video format
  videos?: {
    id: string;
    name: string;
    duration?: number;
    color?: string;
    vrSettings?: VideoVRSettings;
  }[];
  // Backward compatibility with single-video projects
  videoFileName?: string;
  videoDuration?: number;
  scenes: Scene[];
}

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  isMuted: boolean;
  playbackRate: number;
  activeSceneId: string | null;
  activeSceneLoopIteration: number;
}
