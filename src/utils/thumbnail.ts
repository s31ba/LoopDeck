// Thumbnail generation and caching service for LoopDeck scenes
const thumbnailCache = new Map<string, string>();

interface QueueItem {
  videoSrc: string;
  time: number;
  cacheKey: string;
  resolve: (url: string) => void;
}

const queue: QueueItem[] = [];
let isProcessing = false;
let workerVideo: HTMLVideoElement | null = null;
let workerCanvas: HTMLCanvasElement | null = null;

function getWorkerElements() {
  if (!workerVideo) {
    workerVideo = document.createElement('video');
    workerVideo.crossOrigin = 'anonymous';
    workerVideo.muted = true;
    workerVideo.playsInline = true;
    workerVideo.preload = 'auto';
  }
  if (!workerCanvas) {
    workerCanvas = document.createElement('canvas');
    workerCanvas.width = 160;
    workerCanvas.height = 90;
  }
  return { video: workerVideo, canvas: workerCanvas };
}

async function processQueue() {
  if (isProcessing || queue.length === 0) return;
  isProcessing = true;

  const item = queue.shift()!;
  const { video, canvas } = getWorkerElements();

  await new Promise<void>((resolveItem) => {
    let settled = false;
    const finish = (result: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.onloadeddata = null;
      video.onseeked = null;
      video.onerror = null;
      if (result) {
        thumbnailCache.set(item.cacheKey, result);
      }
      item.resolve(result);
      resolveItem();
    };

    const timer = setTimeout(() => {
      finish('');
    }, 2000);

    video.onerror = () => finish('');

    const doCapture = () => {
      try {
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const dataUrl = canvas.toDataURL('image/jpeg', 0.65);
          finish(dataUrl);
        } else {
          finish('');
        }
      } catch (e) {
        finish('');
      }
    };

    video.onseeked = doCapture;

    video.onloadeddata = () => {
      const targetTime = Math.max(0, Math.min(item.time, video.duration || item.time));
      if ('fastSeek' in video && typeof (video as unknown as { fastSeek: (t: number) => void }).fastSeek === 'function') {
        (video as unknown as { fastSeek: (t: number) => void }).fastSeek(targetTime);
      } else {
        video.currentTime = targetTime;
      }
    };

    if (video.src !== item.videoSrc) {
      video.src = item.videoSrc;
      video.load();
    } else if (video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA) {
      const targetTime = Math.max(0, Math.min(item.time, video.duration || item.time));
      if ('fastSeek' in video && typeof (video as unknown as { fastSeek: (t: number) => void }).fastSeek === 'function') {
        (video as unknown as { fastSeek: (t: number) => void }).fastSeek(targetTime);
      } else {
        video.currentTime = targetTime;
      }
    } else {
      video.load();
    }
  });

  isProcessing = false;
  if (queue.length > 0) {
    processQueue();
  }
}

export function getCachedThumbnail(videoSrc: string, time: number): string | null {
  const cacheKey = `${videoSrc}_${time.toFixed(1)}`;
  return thumbnailCache.get(cacheKey) || null;
}

export function generateVideoThumbnail(source: File | Blob | string): Promise<string> {
  return new Promise((resolve) => {
    // If source is a GIF image/file, generate thumbnail directly using HTMLImageElement
    if (
      source instanceof Blob &&
      (source.type === 'image/gif' || (source instanceof File && /\.gif$/i.test(source.name)))
    ) {
      const img = new Image();
      const url = URL.createObjectURL(source);
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          canvas.width = 160;
          canvas.height = 90;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            resolve(canvas.toDataURL('image/jpeg', 0.65));
            return;
          }
        } catch {}
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve('');
      };
      img.src = url;
      return;
    }

    const video = document.createElement('video');
    const isFile = source instanceof Blob;
    const srcUrl = isFile ? URL.createObjectURL(source) : source;
    video.crossOrigin = 'anonymous';
    video.muted = true;
    video.playsInline = true;
    video.preload = 'metadata';

    let resolved = false;
    const cleanUp = () => {
      if (isFile) {
        URL.revokeObjectURL(srcUrl);
      }
      video.removeAttribute('src');
      video.load();
      video.remove();
    };

    const finish = (res: string) => {
      if (resolved) return;
      resolved = true;
      cleanUp();
      resolve(res);
    };

    const timeout = setTimeout(() => finish(''), 2500);

    video.onloadeddata = () => {
      video.currentTime = Math.min(1.0, (video.duration || 2) * 0.1);
    };

    video.onseeked = () => {
      clearTimeout(timeout);
      try {
        const canvas = document.createElement('canvas');
        canvas.width = 160;
        canvas.height = 90;
        const ctx = canvas.getContext('2d');
        if (ctx && video.videoWidth > 0) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          finish(canvas.toDataURL('image/jpeg', 0.65));
        } else {
          finish('');
        }
      } catch (e) {
        finish('');
      }
    };

    video.onerror = () => {
      clearTimeout(timeout);
      finish('');
    };

    video.src = srcUrl;
    video.load();
  });
}

export function requestSceneThumbnail(videoSrc: string, time: number): Promise<string> {
  const cacheKey = `${videoSrc}_${time.toFixed(1)}`;
  if (thumbnailCache.has(cacheKey)) {
    return Promise.resolve(thumbnailCache.get(cacheKey)!);
  }

  return new Promise((resolve) => {
    const existing = queue.find((q) => q.cacheKey === cacheKey);
    if (existing) {
      const originalResolve = existing.resolve;
      existing.resolve = (url) => {
        originalResolve(url);
        resolve(url);
      };
      return;
    }

    queue.push({ videoSrc, time, cacheKey, resolve });
    processQueue();
  });
}
