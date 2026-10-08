import { Scene, VideoItem } from './scene';

export type MultiBoxLayout = '1-box' | '2-box' | '3A' | '3B' | '4-box' | '3-box';

export type MultiBoxItemType = 'scene' | 'video';

export interface MultiBoxAssignment {
  type: MultiBoxItemType;
  videoId: string;
  sceneId?: string;
  scene?: Scene;
  video: VideoItem;
  assignedAt: number;
}

export interface DragItemPayload {
  type: MultiBoxItemType;
  videoId: string;
  sceneId?: string;
}
