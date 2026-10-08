import { useState, useEffect } from 'react';
import { Scene, VideoItem } from '../types/scene';
import { getCachedThumbnail, requestSceneThumbnail } from '../utils/thumbnail';

export function useSceneThumbnails(scenes: Scene[], videos: VideoItem[]): Record<string, string> {
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});

  useEffect(() => {
    let isCancelled = false;

    scenes.forEach((scene) => {
      const parentVideo = videos.find((v) => v.id === scene.videoId);
      if (!parentVideo?.src) return;

      const cached = getCachedThumbnail(parentVideo.src, scene.startTime);
      if (cached) {
        setThumbnails((prev) => (prev[scene.id] === cached ? prev : { ...prev, [scene.id]: cached }));
      } else {
        requestSceneThumbnail(parentVideo.src, scene.startTime).then((url) => {
          if (!isCancelled && url) {
            setThumbnails((prev) => ({ ...prev, [scene.id]: url }));
          }
        });
      }
    });

    return () => {
      isCancelled = true;
    };
  }, [scenes, videos]);

  return thumbnails;
}
