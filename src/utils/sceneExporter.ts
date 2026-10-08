/**
 * Utility for exporting and downloading a video clip corresponding to a Scene's exact time range.
 * Preserves resolution, aspect ratio, and audio using MediaRecorder and Web Audio API.
 */

export interface ExportSceneOptions {
  videoSrc: string;
  startTime: number;
  endTime: number;
  videoName?: string;
  sceneName?: string;
  onProgress?: (progressPercent: number) => void;
}

export async function exportSceneClip({
  videoSrc,
  startTime,
  endTime,
  videoName = 'video',
  sceneName = 'scene',
  onProgress,
}: ExportSceneOptions): Promise<void> {
  if (!videoSrc) {
    throw new Error('No video source available for download');
  }

  const safeStart = Math.max(0, startTime);
  const safeEnd = Math.max(safeStart + 0.1, endTime);
  const clipDuration = safeEnd - safeStart;

  // 1. Create a dedicated off-screen video element
  const video = document.createElement('video');
  video.src = videoSrc;
  video.crossOrigin = 'anonymous';
  video.preload = 'auto';
  video.playsInline = true;
  video.muted = false; // We route audio through AudioContext so it's not heard via speakers
  video.volume = 1;

  // Ensure element is off-screen and non-intrusive
  video.style.position = 'fixed';
  video.style.left = '-99999px';
  video.style.top = '-99999px';
  video.style.width = '2px';
  video.style.height = '2px';
  video.style.opacity = '0';
  video.style.pointerEvents = 'none';
  document.body.appendChild(video);

  try {
    // 2. Wait for metadata to load
    await new Promise<void>((resolve, reject) => {
      const handleLoaded = () => {
        cleanup();
        resolve();
      };
      const handleError = () => {
        cleanup();
        reject(new Error('Failed to load video source for export'));
      };
      const cleanup = () => {
        video.removeEventListener('loadedmetadata', handleLoaded);
        video.removeEventListener('error', handleError);
      };

      if (video.readyState >= 1) {
        resolve();
      } else {
        video.addEventListener('loadedmetadata', handleLoaded);
        video.addEventListener('error', handleError);
      }
    });

    // 3. Audio setup: Route audio silently via Web Audio API
    let audioContext: AudioContext | null = null;
    let audioDestination: MediaStreamAudioDestinationNode | null = null;
    let capturedAudioTrack: MediaStreamTrack | null = null;

    try {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        audioContext = new AudioCtx();
        const sourceNode = audioContext.createMediaElementSource(video);
        audioDestination = audioContext.createMediaStreamDestination();
        sourceNode.connect(audioDestination);
        // Deliberately DO NOT connect to audioContext.destination
        // This keeps the export process completely silent for the user!
        const audioTracks = audioDestination.stream.getAudioTracks();
        if (audioTracks.length > 0) {
          capturedAudioTrack = audioTracks[0];
        }
      }
    } catch (e) {
      console.warn('Audio routing not fully supported in current context, proceeding with video capture', e);
    }

    // 4. Video stream capture
    let rawVideoStream: MediaStream | null = null;
    if (typeof (video as unknown as { captureStream?: () => MediaStream }).captureStream === 'function') {
      rawVideoStream = (video as unknown as { captureStream: () => MediaStream }).captureStream();
    } else if (typeof (video as unknown as { mozCaptureStream?: () => MediaStream }).mozCaptureStream === 'function') {
      rawVideoStream = (video as unknown as { mozCaptureStream: () => MediaStream }).mozCaptureStream();
    }

    // Combine tracks (video track + audio track)
    const combinedTracks: MediaStreamTrack[] = [];
    if (rawVideoStream) {
      const vTracks = rawVideoStream.getVideoTracks();
      if (vTracks.length > 0) {
        combinedTracks.push(vTracks[0]);
      }
      if (capturedAudioTrack) {
        combinedTracks.push(capturedAudioTrack);
      } else {
        const aTracks = rawVideoStream.getAudioTracks();
        if (aTracks.length > 0) combinedTracks.push(aTracks[0]);
      }
    }

    if (combinedTracks.length === 0) {
      throw new Error('Your browser does not support stream capture for video export');
    }

    const exportStream = new MediaStream(combinedTracks);

    // 5. Determine preferred MIME type (MP4 prioritized if supported)
    let selectedMimeType = '';
    let fileExtension = 'webm';

    const preferredMimes = [
      'video/mp4;codecs=avc1,mp4a.40.2',
      'video/mp4;codecs=avc1',
      'video/mp4',
      'video/webm;codecs=vp9,opus',
      'video/webm;codecs=vp8,opus',
      'video/webm',
    ];

    for (const mime of preferredMimes) {
      if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(mime)) {
        selectedMimeType = mime;
        fileExtension = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
        break;
      }
    }

    // 6. Seek video to scene start
    await new Promise<void>((resolve) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        resolve();
      };
      video.addEventListener('seeked', onSeeked);
      video.currentTime = safeStart;
      setTimeout(resolve, 800); // Safety fallback timeout
    });

    // 7. Setup MediaRecorder
    const recorderOptions: MediaRecorderOptions = {};
    if (selectedMimeType) {
      recorderOptions.mimeType = selectedMimeType;
    }
    // High-definition bitrate (8 Mbps)
    recorderOptions.videoBitsPerSecond = 8000000;

    const mediaRecorder = new MediaRecorder(exportStream, recorderOptions);
    const recordedChunks: Blob[] = [];

    mediaRecorder.ondataavailable = (event: BlobEvent) => {
      if (event.data && event.data.size > 0) {
        recordedChunks.push(event.data);
      }
    };

    // 8. Start recording & playback
    mediaRecorder.start(100);

    if (audioContext && audioContext.state === 'suspended') {
      await audioContext.resume();
    }

    await video.play();

    // 9. Track progress until safeEnd
    await new Promise<void>((resolve, reject) => {
      let rafId: number;

      const checkTime = () => {
        if (video.currentTime >= safeEnd || video.ended) {
          cancelAnimationFrame(rafId);
          video.pause();
          resolve();
          return;
        }

        if (onProgress) {
          const currentProgress = Math.max(0, video.currentTime - safeStart);
          const percent = Math.min(99, Math.round((currentProgress / clipDuration) * 100));
          onProgress(percent);
        }

        rafId = requestAnimationFrame(checkTime);
      };

      rafId = requestAnimationFrame(checkTime);

      video.onerror = (err) => {
        cancelAnimationFrame(rafId);
        reject(err);
      };
    });

    // 10. Wait for MediaRecorder to stop and deliver blob
    const finalBlob = await new Promise<Blob>((resolve) => {
      mediaRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, {
          type: selectedMimeType || 'video/mp4',
        });
        resolve(blob);
      };
      mediaRecorder.stop();
    });

    if (onProgress) {
      onProgress(100);
    }

    // 11. Generate sensible filename based on video name and scene name
    const sanitizedVideoName = (videoName || 'video')
      .replace(/\.[^/.]+$/, '') // Remove existing file extension
      .trim()
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '_');

    const sanitizedSceneName = (sceneName || 'scene')
      .trim()
      .replace(/[^a-zA-Z0-9_\-\s]/g, '')
      .replace(/\s+/g, '_');

    const fileName = `${sanitizedVideoName}_${sanitizedSceneName}.${fileExtension}`;

    // 12. Trigger browser file download
    const blobUrl = URL.createObjectURL(finalBlob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setTimeout(() => {
      URL.revokeObjectURL(blobUrl);
    }, 10000);
  } finally {
    // 13. Comprehensive cleanup
    try {
      video.pause();
      video.removeAttribute('src');
      video.load();
      video.remove();
    } catch {
      // Ignore cleanup error
    }
  }
}
