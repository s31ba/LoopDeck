/**
 * GIF to playable video converter utility.
 * Allows animated GIF files to be played, looped, scrubbed, and sliced into scenes in LoopDeck.
 */

export function isGifFile(file: File | Blob | { name?: string; type?: string }): boolean {
  if ('type' in file && file.type === 'image/gif') {
    return true;
  }
  if ('name' in file && typeof file.name === 'string') {
    return /\.gif$/i.test(file.name);
  }
  return false;
}

/**
 * Converts a GIF file into a playable video Blob (H.264 MP4 or WebM).
 * Fast server-side conversion via ffmpeg is prioritized (~20ms), with a seamless
 * client-side WebCodecs / MediaRecorder fallback.
 */
export async function processGifFile(file: File): Promise<Blob> {
  // 1. Prioritize fast server-side conversion via ffmpeg
  try {
    const arrayBuffer = await file.arrayBuffer();
    const response = await fetch('/api/convert-gif', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/octet-stream',
      },
      body: arrayBuffer,
    });

    if (response.ok) {
      const mp4Blob = await response.blob();
      if (mp4Blob.size > 0) {
        return new Blob([mp4Blob], { type: 'video/mp4' });
      }
    }
  } catch (err) {
    console.warn('Server-side GIF conversion failed, falling back to client-side encoding:', err);
  }

  // 2. Client-side fallback using WebCodecs ImageDecoder + MediaRecorder
  try {
    if (typeof window !== 'undefined' && 'ImageDecoder' in window && typeof MediaRecorder !== 'undefined') {
      const decoder = new (window as any).ImageDecoder({
        data: file.stream(),
        type: 'image/gif',
      });

      await decoder.tracks.ready;
      const track = decoder.tracks.selectedTrack;
      const frameCount = track?.frameCount || 1;

      const firstFrameResult = await decoder.decode({ frameIndex: 0 });
      const width = firstFrameResult.image.displayWidth || 320;
      const height = firstFrameResult.image.displayHeight || 240;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(2, Math.floor(width / 2) * 2);
      canvas.height = Math.max(2, Math.floor(height / 2) * 2);
      const ctx = canvas.getContext('2d');

      if (ctx) {
        const stream = canvas.captureStream(30);
        const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp8')
          ? 'video/webm;codecs=vp8'
          : 'video/webm';
        const recorder = new MediaRecorder(stream, { mimeType });
        const recordedChunks: Blob[] = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunks.push(e.data);
          }
        };

        const completionPromise = new Promise<Blob>((resolve) => {
          recorder.onstop = () => {
            resolve(new Blob(recordedChunks, { type: 'video/webm' }));
          };
        });

        recorder.start();

        // Render first frame
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(firstFrameResult.image, 0, 0, canvas.width, canvas.height);
        firstFrameResult.image.close();

        for (let i = 1; i < frameCount; i++) {
          const frameResult = await decoder.decode({ frameIndex: i });
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(frameResult.image, 0, 0, canvas.width, canvas.height);
          const durationMs = (frameResult.image.duration || 100000) / 1000;
          await new Promise((r) => setTimeout(r, Math.min(100, Math.max(16, durationMs))));
          frameResult.image.close();
        }

        // Extra tail frame to ensure last frame is captured
        await new Promise((r) => setTimeout(r, 60));
        recorder.stop();

        const videoBlob = await completionPromise;
        if (videoBlob.size > 0) {
          return videoBlob;
        }
      }
    }
  } catch (clientErr) {
    console.warn('Client-side GIF conversion failed:', clientErr);
  }

  // 3. Fallback to original file
  return file;
}
