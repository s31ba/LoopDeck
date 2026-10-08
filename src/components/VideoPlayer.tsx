import React, { useRef, useEffect, useState, forwardRef, useImperativeHandle, useCallback } from 'react';
import { Scene, VideoVRSettings } from '../types/scene';
import { formatTimestamp, formatDuration } from '../utils/time';
import { getVolumeColor, getVolumeTrackStyle } from '../utils/volumeColor';
import { VRCanvas, VRCanvasHandle } from './VRPlayer/VRCanvas';
import { VRControlsOverlay } from './VRPlayer/VRControlsOverlay';
import { Play, Film, Volume2, VolumeX, Minimize2, Video, Upload, Glasses, Link2 } from 'lucide-react';

export interface VideoPlayerRef {
  play: () => Promise<void>;
  pause: () => void;
  seekTo: (time: number, autoPlay?: boolean) => void;
  stepFrame: (frames: number) => void;
  getCurrentTime: () => number;
  getVideoElement: () => HTMLVideoElement | null;
  toggleFullscreen: () => void;
  getVROrientation: () => { yaw: number; pitch: number; fov: number } | null;
  setVROrientation: (yaw: number, pitch: number, fov?: number) => void;
}

interface VideoPlayerProps {
  videoSrc: string | null;
  videoFileName: string;
  activeScene: Scene | null;
  activeLoopCount: number;
  lastTriggeredKey: string | null;
  playbackRate: number;
  volume: number;
  isMuted: boolean;
  currentTime?: number;
  isRecording?: boolean;
  recordingStartTime?: number | null;
  vrSettings?: VideoVRSettings;
  onUpdateVRSettings?: (newSettings: Partial<VideoVRSettings>) => void;
  onToggleRecord?: () => void;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  onPlayStateChange: (isPlaying: boolean) => void;
  onStopSceneLoop: () => void;
  onFileUpload: (file: File) => void;
  onFilesUpload?: (files: FileList | File[]) => void;
  onRemoveVideo?: () => void;
  onLoopIteration?: () => void;
  onVolumeChange?: (volume: number) => void;
  onToggleMute?: () => void;
  onOpenLinkVideo?: () => void;
  repeatWholeVideo?: boolean;
}

export const VideoPlayer = forwardRef<VideoPlayerRef, VideoPlayerProps>(
  (
    {
      videoSrc,
      videoFileName,
      activeScene,
      activeLoopCount,
      lastTriggeredKey,
      playbackRate,
      volume,
      isMuted,
      currentTime = 0,
      isRecording = false,
      recordingStartTime = null,
      vrSettings,
      onUpdateVRSettings,
      onToggleRecord,
      onTimeUpdate,
      onPlayStateChange,
      onStopSceneLoop,
      onFileUpload,
      onFilesUpload,
      onRemoveVideo,
      onLoopIteration,
      onVolumeChange,
      onToggleMute,
      onOpenLinkVideo,
      repeatWholeVideo = false,
    },
    ref
  ) => {
    // Dual ping-pong video elements for 100% gapless, seamless looping
    const videoRefA = useRef<HTMLVideoElement>(null);
    const videoRefB = useRef<HTMLVideoElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    const repeatWholeVideoRef = useRef(repeatWholeVideo);
    repeatWholeVideoRef.current = repeatWholeVideo;

    // Track active player: 'A' or 'B'
    const [activeSlot, setActiveSlot] = useState<'A' | 'B'>('A');
    const activeSlotRef = useRef<'A' | 'B'>('A');
    activeSlotRef.current = activeSlot;

    // VR Viewport Handle Ref & State
    const vrCanvasRef = useRef<VRCanvasHandle>(null);
    const isVREnabled = !!vrSettings?.enabled;

    const handleToggleVR = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (onUpdateVRSettings) {
        onUpdateVRSettings({
          enabled: !isVREnabled,
          projection: vrSettings?.projection || '180',
          eyeMode: vrSettings?.eyeMode || 'left',
          lens: vrSettings?.lens || 'regular',
          fov: vrSettings?.fov || 75,
        });
      }
    };

    const [isDraggingFile, setIsDraggingFile] = useState(false);
    const [flashNotification, setFlashNotification] = useState<string | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);

    // Keep references to latest props in refs to avoid stale closures
    const activeSceneRef = useRef<Scene | null>(activeScene);
    activeSceneRef.current = activeScene;

    const playbackRateRef = useRef(playbackRate);
    playbackRateRef.current = playbackRate;

    const volumeRef = useRef(volume);
    volumeRef.current = volume;

    const isMutedRef = useRef(isMuted);
    isMutedRef.current = isMuted;

    const isHandoffBusyRef = useRef(false);

    const clampNativeVolume = (vol: number): number => Math.max(0, Math.min(1, vol));

    // Web Audio API context and GainNode map for 0% to 200% volume amplification
    const audioCtxRef = useRef<AudioContext | null>(null);
    const gainNodesRef = useRef<Map<HTMLVideoElement, GainNode>>(new Map());

    const updateAudioVolume = useCallback((vol: number, muted: boolean) => {
      const safeNative = clampNativeVolume(vol);

      try {
        if (!audioCtxRef.current) {
          const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
          if (AudioContextClass) {
            audioCtxRef.current = new AudioContextClass();
          }
        }
        if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
          audioCtxRef.current.resume().catch(() => {});
        }
      } catch {
        // Ignore audio context init errors
      }

      const ctx = audioCtxRef.current;

      [videoRefA.current, videoRefB.current].forEach((v) => {
        if (!v) return;
        try {
          let gainNode = gainNodesRef.current.get(v);
          if (!gainNode && ctx) {
            try {
              const source = ctx.createMediaElementSource(v);
              gainNode = ctx.createGain();
              source.connect(gainNode);
              gainNode.connect(ctx.destination);
              gainNodesRef.current.set(v, gainNode);
            } catch {
              // Ignore if already connected or CORS
            }
          }

          if (gainNode) {
            v.volume = muted || vol === 0 ? 0 : 1.0;
            gainNode.gain.value = muted ? 0 : Math.max(0, Math.min(2, vol));
          } else {
            v.volume = safeNative;
          }
        } catch {
          try {
            v.volume = safeNative;
          } catch {
            // Ignore
          }
        }
      });

      const activeVideo = activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current;
      const standbyVideo = activeSlotRef.current === 'A' ? videoRefB.current : videoRefA.current;
      if (activeVideo) activeVideo.muted = muted;
      if (standbyVideo) standbyVideo.muted = true;
    }, []);

    // Target seek time when switching videos / before metadata is ready
    const pendingSeekTimeRef = useRef<number | null>(null);
    const shouldAutoPlayRef = useRef<boolean>(true);

    // Whenever videoSrc or activeScene changes, ensure pending seek is armed
    useEffect(() => {
      activeSlotRef.current = 'A';
      setActiveSlot('A');

      if (activeScene) {
        pendingSeekTimeRef.current = activeScene.startTime;
        shouldAutoPlayRef.current = true;
      }
    }, [videoSrc, activeScene]);

    // Flash notification when active scene changes or hotkey is triggered
    useEffect(() => {
      if (lastTriggeredKey && activeScene) {
        setFlashNotification(`[${lastTriggeredKey}] ${activeScene.name} • ${activeScene.loop ? 'Looping' : 'Play Once'}`);
        const timer = setTimeout(() => {
          setFlashNotification(null);
        }, 1500);
        return () => clearTimeout(timer);
      }
    }, [lastTriggeredKey, activeScene]);

    // Pre-buffer standby video whenever activeScene changes
    useEffect(() => {
      if (!activeScene || !videoSrc) return;
      const standbyVideo = activeSlotRef.current === 'A' ? videoRefB.current : videoRefA.current;
      if (standbyVideo) {
        if (standbyVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
          standbyVideo.currentTime = activeScene.startTime;
        }
        standbyVideo.playbackRate = playbackRateRef.current;
        standbyVideo.volume = clampNativeVolume(volumeRef.current);
        standbyVideo.muted = true;
      }
    }, [activeScene, videoSrc]);

    // Handle loadedmetadata: immediately seek to pending or activeScene startTime
    const handleLoadedMetadata = useCallback((slot: 'A' | 'B') => {
      const video = slot === 'A' ? videoRefA.current : videoRefB.current;
      if (!video) return;

      // Ensure video element volume strictly uses current main volume slider value
      video.volume = clampNativeVolume(volumeRef.current);
      video.playbackRate = playbackRateRef.current;
      updateAudioVolume(volumeRef.current, isMutedRef.current);
      if (slot === activeSlotRef.current) {
        video.muted = isMutedRef.current;
      } else {
        video.muted = true;
      }

      const dur = video.duration || 0;
      onTimeUpdate(video.currentTime, dur);

      const currentActiveScene = activeSceneRef.current;
      const targetTime =
        pendingSeekTimeRef.current !== null
          ? pendingSeekTimeRef.current
          : currentActiveScene
          ? currentActiveScene.startTime
          : null;

      if (slot === activeSlotRef.current && targetTime !== null) {
        video.currentTime = Math.max(0, Math.min(targetTime, dur || targetTime));
        pendingSeekTimeRef.current = null;

        if (shouldAutoPlayRef.current || currentActiveScene) {
          video.play().catch(() => {});
        }
      }

      // Also position standby video if available
      const standby = slot === 'A' ? videoRefB.current : videoRefA.current;
      if (standby && currentActiveScene && standby.readyState >= HTMLMediaElement.HAVE_METADATA) {
        standby.currentTime = currentActiveScene.startTime;
        standby.muted = true;
      }
    }, [onTimeUpdate]);

    // Handle canplay: ensure video is precisely positioned at scene start time on initial switch
    const handleCanPlay = useCallback((slot: 'A' | 'B') => {
      const video = slot === 'A' ? videoRefA.current : videoRefB.current;
      if (!video) return;

      // Ensure video element volume strictly uses current main volume slider value
      video.volume = clampNativeVolume(volumeRef.current);
      video.playbackRate = playbackRateRef.current;
      updateAudioVolume(volumeRef.current, isMutedRef.current);
      if (slot === activeSlotRef.current) {
        video.muted = isMutedRef.current;
      } else {
        video.muted = true;
      }

      if (slot === activeSlotRef.current) {
        const currentActiveScene = activeSceneRef.current;

        if (video && currentActiveScene) {
          if (video.currentTime < currentActiveScene.startTime - 0.05 || video.currentTime > currentActiveScene.endTime) {
            video.currentTime = currentActiveScene.startTime;
          }
          if (shouldAutoPlayRef.current) {
            video.play().catch(() => {});
          }
        }
      }
    }, []);

    // High performance sync loop with requestVideoFrameCallback or requestAnimationFrame
    useEffect(() => {
      let isCancelled = false;
      let frameHandle: number;

      const runSyncCheck = () => {
        if (isCancelled) return;

        const currentSlot = activeSlotRef.current;
        const activeVideo = currentSlot === 'A' ? videoRefA.current : videoRefB.current;
        const standbyVideo = currentSlot === 'A' ? videoRefB.current : videoRefA.current;
        const currentActiveScene = activeSceneRef.current;

        if (activeVideo && !activeVideo.paused && currentActiveScene) {
          const cTime = activeVideo.currentTime;
          const speed = playbackRateRef.current || 1;
          const leadTime = Math.max(0.015, 0.025 * speed);

          if (cTime >= currentActiveScene.endTime - leadTime && !isHandoffBusyRef.current) {
            if (currentActiveScene.loop) {
              isHandoffBusyRef.current = true;

              if (standbyVideo && standbyVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
                standbyVideo.currentTime = currentActiveScene.startTime;
                standbyVideo.playbackRate = speed;
                standbyVideo.volume = clampNativeVolume(volumeRef.current);
                standbyVideo.muted = isMutedRef.current;
                updateAudioVolume(volumeRef.current, isMutedRef.current);

                const playPromise = standbyVideo.play();
                if (playPromise) {
                  playPromise.catch(() => {});
                }

                const nextSlot = currentSlot === 'A' ? 'B' : 'A';
                setActiveSlot(nextSlot);
                activeSlotRef.current = nextSlot;

                onLoopIteration?.();

                setTimeout(() => {
                  activeVideo.pause();
                  activeVideo.muted = true;
                  activeVideo.currentTime = currentActiveScene.startTime;
                  isHandoffBusyRef.current = false;
                }, 40);
              } else {
                activeVideo.currentTime = currentActiveScene.startTime;
                isHandoffBusyRef.current = false;
              }
            } else {
              activeVideo.pause();
              onStopSceneLoop();
            }
          }
        } else if (activeVideo && !activeVideo.paused && !currentActiveScene) {
          const dur = activeVideo.duration;
          const speed = playbackRateRef.current || 1;
          const leadTime = Math.max(0.015, 0.03 * speed);
          if (dur > 0 && activeVideo.currentTime >= dur - leadTime && !isHandoffBusyRef.current) {
            if (repeatWholeVideoRef.current) {
              isHandoffBusyRef.current = true;
              activeVideo.currentTime = 0;
              activeVideo.play().catch(() => {});
              onTimeUpdate(0, dur);
              setTimeout(() => {
                isHandoffBusyRef.current = false;
              }, 60);
            }
          }
        }

        if (activeVideo && 'requestVideoFrameCallback' in activeVideo) {
          frameHandle = (activeVideo as unknown as { requestVideoFrameCallback: (cb: () => void) => number }).requestVideoFrameCallback(runSyncCheck);
        } else {
          frameHandle = requestAnimationFrame(runSyncCheck);
        }
      };

      frameHandle = requestAnimationFrame(runSyncCheck);

      return () => {
        isCancelled = true;
        cancelAnimationFrame(frameHandle);
      };
    }, [onStopSceneLoop, onLoopIteration]);

    // Explicitly enforce volume on videoSrc change (newly uploaded video or video deck switch)
    useEffect(() => {
      updateAudioVolume(volumeRef.current, isMutedRef.current);
      [videoRefA.current, videoRefB.current].forEach((v) => {
        if (v) {
          v.playbackRate = playbackRateRef.current;
        }
      });
    }, [videoSrc, updateAudioVolume]);

    // Sync volume, mute, playbackRate across both players
    useEffect(() => {
      updateAudioVolume(volume, isMuted);
      [videoRefA.current, videoRefB.current].forEach((v) => {
        if (v) {
          v.playbackRate = playbackRate;
        }
      });
    }, [volume, isMuted, playbackRate, activeSlot, videoSrc, updateAudioVolume]);

    useImperativeHandle(ref, () => ({
      play: async () => {
        const activeVideo = activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current;
        if (activeVideo) {
          shouldAutoPlayRef.current = true;
          updateAudioVolume(volumeRef.current, isMutedRef.current);
          await activeVideo.play();
        }
      },
      pause: () => {
        shouldAutoPlayRef.current = false;
        videoRefA.current?.pause();
        videoRefB.current?.pause();
      },
      seekTo: (time: number, autoPlay = true) => {
        shouldAutoPlayRef.current = autoPlay;
        const activeVideo = activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current;
        const standbyVideo = activeSlotRef.current === 'A' ? videoRefB.current : videoRefA.current;

        if (activeVideo) {
          if (activeVideo.readyState >= HTMLMediaElement.HAVE_METADATA && activeVideo.duration > 0) {
            activeVideo.currentTime = Math.max(0, Math.min(time, activeVideo.duration));
            if (autoPlay) {
              activeVideo.play().catch(() => {});
            }
          } else {
            // Metadata not yet ready, arm pending seek!
            pendingSeekTimeRef.current = time;
          }
        } else {
          pendingSeekTimeRef.current = time;
        }

        if (standbyVideo && activeSceneRef.current && standbyVideo.readyState >= HTMLMediaElement.HAVE_METADATA) {
          standbyVideo.currentTime = activeSceneRef.current.startTime;
        }
      },
      stepFrame: (frames: number) => {
        const activeVideo = activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current;
        if (activeVideo && activeVideo.duration > 0) {
          const fps = 30;
          const delta = frames / fps;
          const target = Math.max(0, Math.min(activeVideo.currentTime + delta, activeVideo.duration));
          activeVideo.currentTime = target;
        }
      },
      getCurrentTime: () => {
        const activeVideo = activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current;
        return activeVideo?.currentTime || 0;
      },
      getVideoElement: () => {
        return activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current;
      },
      toggleFullscreen: () => {
        toggleFullscreen();
      },
      getVROrientation: () => {
        if (vrCanvasRef.current) {
          return {
            yaw: vrCanvasRef.current.getYaw(),
            pitch: vrCanvasRef.current.getPitch(),
            fov: vrCanvasRef.current.getFov(),
          };
        }
        return null;
      },
      setVROrientation: (yaw: number, pitch: number, fov?: number) => {
        if (vrCanvasRef.current) {
          vrCanvasRef.current.setOrientation(yaw, pitch, fov);
        }
      },
    }));

    // Automatically restore saved VR camera viewpoint when activeScene changes
    useEffect(() => {
      if (!isVREnabled || !vrCanvasRef.current) return;
      if (activeScene?.vrView) {
        vrCanvasRef.current.setOrientation(
          activeScene.vrView.yaw,
          activeScene.vrView.pitch,
          activeScene.vrView.fov
        );
      } else {
        // If scene has no saved viewpoint, restore to center
        vrCanvasRef.current.setOrientation(0, 0, vrSettings?.fov || 75);
      }
    }, [activeScene?.id, isVREnabled]);

    const [isFullscreen, setIsFullscreen] = useState(false);

    useEffect(() => {
      const handleFullscreenChange = () => {
        setIsFullscreen(!!document.fullscreenElement);
      };
      document.addEventListener('fullscreenchange', handleFullscreenChange);
      document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
      return () => {
        document.removeEventListener('fullscreenchange', handleFullscreenChange);
        document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
      };
    }, []);

    const toggleFullscreen = useCallback(() => {
      const container = containerRef.current;
      if (!container) return;

      if (!document.fullscreenElement) {
        if (container.requestFullscreen) {
          container.requestFullscreen().catch(() => {
            const activeVideo = activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current;
            activeVideo?.requestFullscreen?.().catch(() => {});
          });
        } else if ((container as unknown as { webkitRequestFullscreen?: () => void }).webkitRequestFullscreen) {
          (container as unknown as { webkitRequestFullscreen: () => void }).webkitRequestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
        } else if ((document as unknown as { webkitExitFullscreen?: () => void }).webkitExitFullscreen) {
          (document as unknown as { webkitExitFullscreen: () => void }).webkitExitFullscreen();
        }
      }
    }, []);

    const handleDragOver = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(true);
    };

    const handleDragLeave = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);
    };

    const handleDrop = (e: React.DragEvent) => {
      e.preventDefault();
      setIsDraggingFile(false);
      const files = e.dataTransfer.files;
      if (files && files.length > 0) {
        if (onFilesUpload) {
          onFilesUpload(files);
        } else {
          onFileUpload(files[0]);
        }
      }
    };

    const togglePlayPause = () => {
      const activeVideo = activeSlotRef.current === 'A' ? videoRefA.current : videoRefB.current;
      if (!activeVideo) return;
      if (activeVideo.paused) {
        shouldAutoPlayRef.current = true;
        activeVideo.play().catch(() => {});
      } else {
        shouldAutoPlayRef.current = false;
        videoRefA.current?.pause();
        videoRefB.current?.pause();
      }
    };

    return (
      <div
        ref={containerRef}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={`relative w-full bg-slate-950 overflow-hidden shadow-2xl border transition-all duration-300 flex items-center justify-center group select-none ${
          isFullscreen
            ? 'h-full max-h-none min-h-0 rounded-none border-none'
            : 'aspect-video max-h-[64vh] min-h-[340px] rounded-2xl'
        } ${
          activeScene
            ? 'border-cyan-500/50 shadow-cyan-500/10 ring-1 ring-cyan-500/30'
            : 'border-slate-800 hover:border-slate-700'
        }`}
      >
        {videoSrc ? (
          <>
            {/* Primary Video Element A */}
            <video
              ref={videoRefA}
              src={videoSrc}
              playsInline
              onClick={togglePlayPause}
              onTimeUpdate={() => {
                if (activeSlotRef.current === 'A' && videoRefA.current) {
                  const ct = videoRefA.current.currentTime;
                  const dur = videoRefA.current.duration || 0;
                  onTimeUpdate(ct, dur);
                }
              }}
              onLoadedMetadata={() => handleLoadedMetadata('A')}
              onCanPlay={() => handleCanPlay('A')}
              onLoadStart={() => {
                if (videoRefA.current) {
                  videoRefA.current.volume = clampNativeVolume(volumeRef.current);
                  videoRefA.current.muted = activeSlotRef.current === 'A' ? isMutedRef.current : true;
                  updateAudioVolume(volumeRef.current, isMutedRef.current);
                }
              }}
              onLoadedData={() => {
                if (videoRefA.current) {
                  videoRefA.current.volume = clampNativeVolume(volumeRef.current);
                  videoRefA.current.muted = activeSlotRef.current === 'A' ? isMutedRef.current : true;
                  updateAudioVolume(volumeRef.current, isMutedRef.current);
                }
              }}
              onPlay={() => {
                if (videoRefA.current) {
                  videoRefA.current.volume = clampNativeVolume(volumeRef.current);
                  updateAudioVolume(volumeRef.current, isMutedRef.current);
                }
                if (activeSlotRef.current === 'A') {
                  setIsPlaying(true);
                  onPlayStateChange(true);
                }
              }}
              onPause={() => {
                if (activeSlotRef.current === 'A') {
                  setIsPlaying(false);
                  onPlayStateChange(false);
                }
              }}
              onEnded={() => {
                if (activeSlotRef.current === 'A' && !activeSceneRef.current) {
                  if (repeatWholeVideoRef.current && videoRefA.current) {
                    videoRefA.current.currentTime = 0;
                    videoRefA.current.play().catch(() => {});
                    onTimeUpdate(0, videoRefA.current.duration || 0);
                  } else {
                    setIsPlaying(false);
                    onPlayStateChange(false);
                  }
                }
              }}
              className={`absolute inset-0 w-full h-full object-contain cursor-pointer transition-opacity duration-75 ${
                isVREnabled
                  ? 'opacity-0 pointer-events-none z-0'
                  : activeSlot === 'A'
                  ? 'opacity-100 z-10'
                  : 'opacity-0 pointer-events-none z-0'
              }`}
            />

            {/* Seamless Secondary Video Element B */}
            <video
              ref={videoRefB}
              src={videoSrc}
              playsInline
              onClick={togglePlayPause}
              onTimeUpdate={() => {
                if (activeSlotRef.current === 'B' && videoRefB.current) {
                  const ct = videoRefB.current.currentTime;
                  const dur = videoRefB.current.duration || 0;
                  onTimeUpdate(ct, dur);
                }
              }}
              onLoadedMetadata={() => handleLoadedMetadata('B')}
              onCanPlay={() => handleCanPlay('B')}
              onLoadStart={() => {
                if (videoRefB.current) {
                  videoRefB.current.volume = clampNativeVolume(volumeRef.current);
                  videoRefB.current.muted = activeSlotRef.current === 'B' ? isMutedRef.current : true;
                  updateAudioVolume(volumeRef.current, isMutedRef.current);
                }
              }}
              onLoadedData={() => {
                if (videoRefB.current) {
                  videoRefB.current.volume = clampNativeVolume(volumeRef.current);
                  videoRefB.current.muted = activeSlotRef.current === 'B' ? isMutedRef.current : true;
                  updateAudioVolume(volumeRef.current, isMutedRef.current);
                }
              }}
              onPlay={() => {
                if (videoRefB.current) {
                  videoRefB.current.volume = clampNativeVolume(volumeRef.current);
                  updateAudioVolume(volumeRef.current, isMutedRef.current);
                }
                if (activeSlotRef.current === 'B') {
                  setIsPlaying(true);
                  onPlayStateChange(true);
                }
              }}
              onPause={() => {
                if (activeSlotRef.current === 'B') {
                  setIsPlaying(false);
                  onPlayStateChange(false);
                }
              }}
              onEnded={() => {
                if (activeSlotRef.current === 'B' && !activeSceneRef.current) {
                  if (repeatWholeVideoRef.current && videoRefB.current) {
                    videoRefB.current.currentTime = 0;
                    videoRefB.current.play().catch(() => {});
                    onTimeUpdate(0, videoRefB.current.duration || 0);
                  } else {
                    setIsPlaying(false);
                    onPlayStateChange(false);
                  }
                }
              }}
              className={`absolute inset-0 w-full h-full object-contain cursor-pointer transition-opacity duration-75 ${
                isVREnabled
                  ? 'opacity-0 pointer-events-none z-0'
                  : activeSlot === 'B'
                  ? 'opacity-100 z-10'
                  : 'opacity-0 pointer-events-none z-0'
              }`}
            />

            {/* 3D WebGL Spherical VR Canvas (when VR enabled) */}
            {isVREnabled && (
              <div className="absolute inset-0 z-20">
                <VRCanvas
                  ref={vrCanvasRef}
                  videoElement={activeSlot === 'A' ? videoRefA.current : videoRefB.current}
                  vrSettings={
                    vrSettings || {
                      enabled: true,
                      projection: '180',
                      eyeMode: 'left',
                      lens: 'regular',
                      fov: 75,
                    }
                  }
                  initialYaw={activeScene?.vrView?.yaw}
                  initialPitch={activeScene?.vrView?.pitch}
                  initialFov={activeScene?.vrView?.fov}
                  onFovChange={(newFov) => {
                    if (onUpdateVRSettings) onUpdateVRSettings({ fov: newFov });
                  }}
                />
              </div>
            )}

            {/* Top-Left Hover-Only Video Name & VR Button & VR Controls (Requirement 1, 2, 17) */}
            <div className="absolute top-3.5 left-3.5 z-40 opacity-0 group-hover:opacity-100 transition-opacity duration-200 flex flex-col gap-2 max-w-[95%] pointer-events-none">
              <div className="flex flex-wrap items-center gap-2 pointer-events-auto">
                {videoFileName && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-950/85 backdrop-blur-md border border-slate-800 text-xs text-slate-200 shadow-xl font-bold tracking-wide">
                    <Film className="w-3.5 h-3.5 text-cyan-400 shrink-0" />
                    <span className="max-w-[260px] truncate">{videoFileName}</span>
                  </div>
                )}

                {/* VR Toggle Button (Requirement 1) */}
                <button
                  onClick={handleToggleVR}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black tracking-wider transition-all shadow-xl border cursor-pointer ${
                    isVREnabled
                      ? 'bg-gradient-to-r from-cyan-500 to-indigo-600 text-slate-950 border-cyan-300 shadow-cyan-500/40 scale-105'
                      : 'bg-slate-950/85 hover:bg-slate-800 text-cyan-400 hover:text-white border-slate-700/80 hover:border-cyan-500/50'
                  }`}
                  title={isVREnabled ? 'Exit VR Mode' : 'Activate VR Mode for this video'}
                >
                  <Glasses className="w-4 h-4 stroke-[2.5]" />
                  <span>VR</span>
                </button>
              </div>

              {/* Additional VR Controls Overlay Ribbon */}
              {isVREnabled && (
                <div className="pointer-events-auto">
                  <VRControlsOverlay
                    vrSettings={
                      vrSettings || {
                        enabled: true,
                        projection: '180',
                        eyeMode: 'left',
                        lens: 'regular',
                        fov: 75,
                      }
                    }
                    videoElement={activeSlot === 'A' ? videoRefA.current : videoRefB.current}
                    onUpdateVRSettings={(newSettings) => {
                      if (onUpdateVRSettings) onUpdateVRSettings(newSettings);
                    }}
                  />
                </div>
              )}
            </div>

            {/* Center play icon on pause */}
            {!isPlaying && (
              <div
                onClick={togglePlayPause}
                className="absolute inset-0 flex items-center justify-center bg-black/30 cursor-pointer pointer-events-auto opacity-0 group-hover:opacity-100 transition-opacity z-30"
              >
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-cyan-600/90 to-indigo-600/90 border border-white/30 text-white flex items-center justify-center backdrop-blur-md shadow-2xl hover:scale-110 transition-transform">
                  <Play className="w-7 h-7 ml-0.5 text-white fill-white" />
                </div>
              </div>
            )}

            {/* Fullscreen Overlay Controls (Bottom-Right: Volume Slider + Exit Fullscreen) */}
            {isFullscreen && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="absolute bottom-6 right-6 z-40 flex items-center gap-3 px-4 py-2 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-slate-700/80 shadow-2xl opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity duration-300 pointer-events-auto select-none"
              >
                {/* Mute/Unmute Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    if (onToggleMute) {
                      onToggleMute();
                    }
                  }}
                  className="p-1.5 rounded-xl hover:bg-slate-800 text-slate-300 hover:text-white transition-colors"
                  title={isMuted ? 'Unmute (M)' : 'Mute (M)'}
                >
                  {isMuted || volume === 0 ? (
                    <VolumeX className="w-4 h-4 text-rose-400" />
                  ) : (
                    <Volume2
                      className="w-4 h-4 transition-colors"
                      style={{ color: getVolumeColor(volume) }}
                    />
                  )}
                </button>

                {/* Volume Slider (0% to 200%) */}
                <div className="flex items-center gap-2">
                  <div className="relative flex items-center">
                    <input
                      type="range"
                      min={0}
                      max={2}
                      step={0.05}
                      value={volume}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (onVolumeChange) {
                          onVolumeChange(val);
                        }
                      }}
                      style={getVolumeTrackStyle(volume, isMuted)}
                      className="w-20 sm:w-24 h-1.5 rounded-lg appearance-none cursor-pointer transition-all"
                      title={`Volume: ${Math.round(volume * 100)}%${isMuted ? ' (Muted)' : ''}`}
                    />
                    <div
                      className="absolute left-1/2 top-0 bottom-0 w-0.5 pointer-events-none bg-slate-900/90 -translate-x-1/2"
                      title="100% (Default Volume)"
                    />
                  </div>
                  <span
                    className="font-mono text-[10px] font-bold min-w-[38px] text-right transition-colors"
                    style={{ color: isMuted ? '#94a3b8' : getVolumeColor(volume) }}
                  >
                    {isMuted ? 'Muted' : `${Math.round(volume * 100)}%`}
                  </span>
                </div>

                <div className="w-px h-4 bg-slate-800 mx-0.5" />

                {/* Exit Fullscreen Button */}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleFullscreen();
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs border border-slate-700 shadow-sm transition-all hover:scale-105 active:scale-95"
                  title="Exit Fullscreen (F)"
                >
                  <Minimize2 className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Exit Fullscreen</span>
                </button>
              </div>
            )}
          </>
        ) : (
          /* Empty / Upload State */
          <div className="flex flex-col items-center justify-center text-center p-8 max-w-lg z-10">
            <div className="relative mb-6">
              <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-cyan-500 to-indigo-500 opacity-30 blur-xl animate-pulse"></div>
              <div className="relative w-24 h-24 rounded-3xl bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/80 flex items-center justify-center text-cyan-400 shadow-2xl group-hover:scale-105 transition-transform">
                <Video className="w-12 h-12 text-cyan-400" />
              </div>
            </div>

            <h3 className="text-2xl font-extrabold text-white mb-2 tracking-tight">
              Ready to Load Video(s)
            </h3>
            <p className="text-sm text-slate-400 mb-6 leading-relaxed max-w-md">
              Upload one or multiple videos to build your multi-deck sampler. Use hotkeys to instantly trigger scenes across different videos in real time.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 w-full max-w-md">
              <label className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:via-sky-400 hover:to-indigo-500 text-white font-bold text-xs shadow-xl shadow-cyan-500/25 cursor-pointer transition-all hover:scale-102 active:scale-98">
                <Upload className="w-4 h-4" />
                <span>Upload Video Files</span>
                <input
                  type="file"
                  accept="video/*,.mp4,.webm,.mov,.mkv,.avi,.m4v,.gif,image/gif"
                  multiple
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      if (onFilesUpload) onFilesUpload(e.target.files);
                      else onFileUpload(e.target.files[0]);
                      e.target.value = '';
                    }
                  }}
                />
              </label>

              {onOpenLinkVideo && (
                <button
                  type="button"
                  onClick={onOpenLinkVideo}
                  className="w-full sm:w-auto flex-1 flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 hover:text-white font-bold text-xs border border-slate-700 shadow-xl transition-all hover:scale-102 active:scale-98 cursor-pointer"
                >
                  <Link2 className="w-4 h-4 text-cyan-400" />
                  <span>Link Video URL</span>
                </button>
              )}
            </div>

            {/* Supported Formats */}
            <div className="flex items-center gap-1.5 mt-5">
              <span className="text-[11px] text-slate-400 font-semibold mr-1">Formats:</span>
              {['MP4', 'WEBM', 'MOV', 'MKV'].map((fmt) => (
                <span
                  key={fmt}
                  className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-md bg-slate-900/90 text-cyan-400/90 border border-slate-800"
                >
                  {fmt}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Drag Over Visual Indicator */}
        {isDraggingFile && (
          <div className="absolute inset-0 bg-gradient-to-b from-cyan-950/80 to-indigo-950/80 border-4 border-cyan-400 border-dashed rounded-2xl flex flex-col items-center justify-center z-50 backdrop-blur-md pointer-events-none">
            <Upload className="w-16 h-16 text-cyan-300 animate-bounce mb-3" />
            <span className="text-xl font-extrabold text-white drop-shadow-md">
              Drop video files to add to LoopDeck
            </span>
          </div>
        )}
      </div>
    );
  }
);

VideoPlayer.displayName = 'VideoPlayer';
