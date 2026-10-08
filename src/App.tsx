import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Scene, VideoItem, ProjectData, VideoVRSettings } from './types/scene';
import {
  formatTimestamp,
  getRandomColor,
  getNextVideoColor,
  normalizeKey,
  playChime,
} from './utils/time';
import { generateVideoThumbnail } from './utils/thumbnail';
import { isGifFile, processGifFile } from './utils/gifConverter';
import { VideoPlayer, VideoPlayerRef } from './components/VideoPlayer';
import { VideoDeckSwitcher } from './components/VideoDeckSwitcher';
import { SceneBank } from './components/SceneBank';
import { useSceneThumbnails } from './hooks/useSceneThumbnails';
import { Timeline } from './components/Timeline';
import { PlaybackControls } from './components/PlaybackControls';
import { SceneList } from './components/SceneList';
import { HotkeysSidebar } from './components/HotkeysSidebar';
import { ConfirmModal } from './components/ConfirmModal';
import { MultiBoxModal } from './components/MultiBox/MultiBoxModal';
import { LinkVideoModal } from './components/LinkVideoModal';
import {
  Repeat,
  Upload,
  Layers,
  Film,
  Plus,
  Trash2,
  LayoutGrid,
  Link2,
} from 'lucide-react';

const STORAGE_KEY_PREFIX = 'loopdeck_multiproject_v2';

export default function App() {
  const playerRef = useRef<VideoPlayerRef>(null);

  // Multi-Video State
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);

  // Modal State for Video Removal
  const [videoPendingRemoval, setVideoPendingRemoval] = useState<VideoItem | null>(null);

  // Record Scene Mode State
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [recordingStartTime, setRecordingStartTime] = useState<number | null>(null);

  // Playback State
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [duration, setDuration] = useState<number>(0);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  // Volume state: always resets to 100% (1.0) on every fresh launch / reload
  const [volume, setVolume] = useState<number>(1);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [playbackRate, setPlaybackRate] = useState<number>(1);

  // Repeat Whole Video state (resets to OFF when LoopDeck starts fresh)
  const [repeatWholeVideo, setRepeatWholeVideo] = useState<boolean>(false);

  const handleToggleRepeatWholeVideo = useCallback(() => {
    setRepeatWholeVideo((prev) => !prev);
  }, []);

  // Scenes & Loop State
  const [scenes, setScenes] = useState<Scene[]>([]);
  const [activeSceneId, setActiveSceneId] = useState<string | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const [activeLoopCount, setActiveLoopCount] = useState<number>(0);
  const [lastTriggeredKey, setLastTriggeredKey] = useState<string | null>(null);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  // MultiBox Overlay State (Requirement 1 & 2)
  const [isMultiBoxOpen, setIsMultiBoxOpen] = useState<boolean>(false);
  const isMultiBoxOpenRef = useRef(isMultiBoxOpen);
  isMultiBoxOpenRef.current = isMultiBoxOpen;

  // Link Video Modal State
  const [isLinkVideoModalOpen, setIsLinkVideoModalOpen] = useState<boolean>(false);

  // Handle successfully loaded linked video (direct or server-proxied)
  const handleVideoLinked = useCallback(
    (videoData: {
      id: string;
      name: string;
      src: string;
      duration: number;
      thumbnail: string;
    }) => {
      const assignedColors = [...videos.map((v) => ({ color: v.color }))];
      const videoColor = getNextVideoColor(assignedColors);

      const newVideo: VideoItem = {
        id: videoData.id,
        name: videoData.name,
        src: videoData.src,
        duration: videoData.duration || 0,
        thumbnail: videoData.thumbnail,
        color: videoColor,
        addedAt: Date.now(),
      };

      setVideos((prev) => [...prev, newVideo]);

      // If no video is currently selected or this is the first, activate it immediately
      if (!activeVideoId || videos.length === 0) {
        setActiveVideoId(newVideo.id);
        setCurrentTime(0);
        setActiveSceneId(null);
        setActiveLoopCount(0);
      }
    },
    [activeVideoId, videos]
  );

  // Open MultiBox modal and pause main background playback (Requirement 2)
  const handleOpenMultiBox = useCallback(() => {
    if (playerRef.current) {
      const v = playerRef.current.getVideoElement();
      if (v && !v.paused) {
        playerRef.current.pause();
      }
    }
    setIsPlaying(false);
    setIsMultiBoxOpen(true);
  }, []);

  const handleCloseMultiBox = useCallback(() => {
    setIsMultiBoxOpen(false);
  }, []);

  // Current active video object
  const activeVideo = videos.find((v) => v.id === activeVideoId) || null;

  // Active scene reference
  const activeScene = scenes.find((s) => s.id === activeSceneId) || null;

  // Generate and cache thumbnails for all scenes (auto-updates when startTime changes)
  const sceneThumbnails = useSceneThumbnails(scenes, videos);

  // Scenes belonging to the current active video for the timeline
  const activeVideoScenes = scenes.filter((s) => s.videoId === activeVideoId);

  // Fresh Start on Launch: clear any previous session remnants from localStorage
  useEffect(() => {
    try {
      localStorage.removeItem(STORAGE_KEY_PREFIX);
      localStorage.removeItem('loopdeck_volume');
    } catch {
      // Ignore
    }
  }, []);

  // Ensure every loaded video has a unique, persistent color
  useEffect(() => {
    let needsUpdate = false;
    const assigned: { color?: string }[] = [];
    const updated = videos.map((v) => {
      if (!v.color) {
        needsUpdate = true;
        const color = getNextVideoColor(assigned);
        assigned.push({ color });
        return { ...v, color };
      }
      assigned.push({ color: v.color });
      return v;
    });
    if (needsUpdate) {
      setVideos(updated);
    }
  }, [videos]);

  // Handle uploading one or multiple video files
  const handleUploadVideos = useCallback(
    async (fileList: FileList | File[]) => {
      const files = Array.from(fileList);
      if (files.length === 0) return;

      const newVideos: VideoItem[] = [];
      const assignedColors = [...videos.map((v) => ({ color: v.color }))];

      for (const file of files) {
        const isGif = isGifFile(file);
        if (!file.type.startsWith('video/') && !isGif && !/\.(mp4|webm|mov|mkv|avi|m4v)$/i.test(file.name)) {
          continue;
        }

        // Convert GIF into a playable, scrubbable video stream (MP4/WebM)
        let mediaBlob: Blob = file;
        if (isGif) {
          mediaBlob = await processGifFile(file);
        }

        const objectUrl = URL.createObjectURL(mediaBlob);
        const videoId = `video-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
        const videoColor = getNextVideoColor(assignedColors);
        assignedColors.push({ color: videoColor });

        const thumbnail = await generateVideoThumbnail(mediaBlob);

        newVideos.push({
          id: videoId,
          name: file.name,
          src: objectUrl,
          duration: 0,
          thumbnail,
          file: mediaBlob instanceof File ? mediaBlob : new File([mediaBlob], file.name, { type: mediaBlob.type || 'video/mp4' }),
          color: videoColor,
          addedAt: Date.now(),
        });
      }

      if (newVideos.length === 0) return;

      setVideos((prev) => [...prev, ...newVideos]);

      // If no video is currently selected, activate the first newly uploaded video
      if (!activeVideoId && newVideos.length > 0) {
        setActiveVideoId(newVideos[0].id);
        setCurrentTime(0);
        setActiveSceneId(null);
        setActiveLoopCount(0);
      }
    },
    [activeVideoId, videos]
  );

  // Switch active video in the main player (safely cancels recording if active)
  const handleSwitchVideo = useCallback(
    (videoId: string) => {
      if (videoId === activeVideoId) return;

      // Safely cancel any active recording when switching videos
      if (isRecording) {
        setIsRecording(false);
        setRecordingStartTime(null);
      }

      setActiveSceneId(null);
      setActiveLoopCount(0);
      setLastTriggeredKey(null);

      setActiveVideoId(videoId);
      setCurrentTime(0);

      const firstSceneOfNewVideo = scenes.find((s) => s.videoId === videoId);
      if (firstSceneOfNewVideo) {
        setSelectedSceneId(firstSceneOfNewVideo.id);
      } else {
        setSelectedSceneId(null);
      }
    },
    [activeVideoId, isRecording, scenes]
  );

  // Open confirmation modal before removing a video
  const handleRequestRemoveVideo = useCallback(
    (videoId: string) => {
      const target = videos.find((v) => v.id === videoId);
      if (target) {
        setVideoPendingRemoval(target);
      }
    },
    [videos]
  );

  // Execute the confirmed removal of a video
  const handleConfirmRemoveVideo = useCallback(() => {
    if (!videoPendingRemoval) return;

    const videoId = videoPendingRemoval.id;

    // Safely cancel recording if the active video is being removed
    if (isRecording && activeVideoId === videoId) {
      setIsRecording(false);
      setRecordingStartTime(null);
    }

    // Revoke object URL to prevent memory leaks
    if (videoPendingRemoval.src && videoPendingRemoval.src.startsWith('blob:')) {
      URL.revokeObjectURL(videoPendingRemoval.src);
    }

    // Filter out the video and all its scenes/hotkeys
    const remainingVideos = videos.filter((v) => v.id !== videoId);
    const remainingScenes = scenes.filter((s) => s.videoId !== videoId);

    setVideos(remainingVideos);
    setScenes(remainingScenes);

    // If removed video was the active one, switch to next available video or empty state
    if (activeVideoId === videoId) {
      setActiveSceneId(null);
      setActiveLoopCount(0);
      setLastTriggeredKey(null);

      if (remainingVideos.length > 0) {
        setActiveVideoId(remainingVideos[0].id);
        setCurrentTime(0);
        const firstScene = remainingScenes.find((s) => s.videoId === remainingVideos[0].id);
        setSelectedSceneId(firstScene ? firstScene.id : null);
      } else {
        setActiveVideoId(null);
        setSelectedSceneId(null);
        setCurrentTime(0);
        setDuration(0);
      }
    }

    setVideoPendingRemoval(null);
  }, [videoPendingRemoval, videos, scenes, activeVideoId, isRecording]);

  // Record Scene Mode Toggle Handler
  const handleToggleRecordScene = useCallback(() => {
    if (!activeVideoId) return;

    if (!isRecording) {
      // START RECORDING: use current video playback time as START (millisecond precision)
      const exactTime = playerRef.current ? playerRef.current.getCurrentTime() : currentTime;
      setIsRecording(true);
      setRecordingStartTime(exactTime);

      // Keep video playing normally (resume if paused)
      if (playerRef.current) {
        const v = playerRef.current.getVideoElement();
        if (v && v.paused) {
          playerRef.current.play().catch(() => {});
        }
      }

      if (soundEnabled) {
        playChime(880, 0.08, 'sine');
      }
    } else {
      // STOP RECORDING: use current video playback time as END (millisecond precision)
      const exactTime = playerRef.current ? playerRef.current.getCurrentTime() : currentTime;
      const start = recordingStartTime !== null ? recordingStartTime : Math.max(0, exactTime - 5);
      const end = exactTime;

      let validStart = Math.min(start, end);
      let validEnd = Math.max(start, end);

      // Ensure minimum duration (at least 0.2s)
      if (validEnd - validStart < 0.2) {
        validEnd = validStart + 1.0;
      }

      // Find next available key candidate
      const existingKeys = new Set(scenes.map((s) => s.hotkey.toUpperCase()));
      const keyCandidates = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Q', 'W', 'E', 'R', 'T', 'Y', 'A', 'S', 'D'];
      let chosenKey = '1';
      for (const k of keyCandidates) {
        if (!existingKeys.has(k)) {
          chosenKey = k;
          break;
        }
      }

      const currentVid = videos.find((v) => v.id === activeVideoId);
      const isVR = !!currentVid?.vrSettings?.enabled;
      const vrView = isVR && playerRef.current?.getVROrientation
        ? playerRef.current.getVROrientation() || undefined
        : undefined;

      const newScene: Scene = {
        id: `scene-${Date.now()}`,
        videoId: activeVideoId,
        videoName: currentVid?.name || 'Video',
        name: `Recorded Scene ${activeVideoScenes.length + 1}`,
        startTime: validStart,
        endTime: validEnd,
        hotkey: chosenKey,
        loop: true,
        color: currentVid?.color || getRandomColor(scenes.length),
        vrView: vrView ? { yaw: vrView.yaw, pitch: vrView.pitch, fov: vrView.fov } : undefined,
      };

      // Add to scenes list & select newly created scene for immediate editing
      setScenes((prev) => [...prev, newScene]);
      setSelectedSceneId(newScene.id);

      // Turn off recording mode (do not pause video!)
      setIsRecording(false);
      setRecordingStartTime(null);

      if (soundEnabled) {
        playChime(660, 0.08, 'triangle');
      }
    }
  }, [
    activeVideoId,
    isRecording,
    recordingStartTime,
    currentTime,
    scenes,
    activeVideoScenes.length,
    videos,
    soundEnabled,
  ]);

  // Play a specific scene and start looping (with cross-video auto-switch & instant seek!)
  const handlePlayScene = useCallback(
    (scene: Scene) => {
      // If user was recording, safely end/cancel recording before switching scenes
      if (isRecording) {
        setIsRecording(false);
        setRecordingStartTime(null);
      }

      const isDifferentVideo = scene.videoId && scene.videoId !== activeVideoId;
      if (isDifferentVideo) {
        setActiveVideoId(scene.videoId);
      }

      setActiveSceneId(scene.id);
      setSelectedSceneId(scene.id);
      setActiveLoopCount(1);
      setLastTriggeredKey(scene.hotkey);

      if (soundEnabled) {
        playChime(780, 0.08, 'sine');
      }

      if (playerRef.current) {
        playerRef.current.seekTo(scene.startTime, true);
        if (scene.vrView && playerRef.current.setVROrientation) {
          playerRef.current.setVROrientation(scene.vrView.yaw, scene.vrView.pitch, scene.vrView.fov);
        } else if (playerRef.current.setVROrientation) {
          const parentVid = videos.find((v) => v.id === (scene.videoId || activeVideoId));
          if (parentVid?.vrSettings?.enabled) {
            playerRef.current.setVROrientation(0, 0, parentVid.vrSettings.fov || 75);
          }
        }
      }
    },
    [activeVideoId, soundEnabled, isRecording, videos]
  );

  // Update VR Settings for active video (defaults to 180° projection)
  const handleUpdateVRSettings = useCallback(
    (newSettings: Partial<VideoVRSettings>) => {
      if (!activeVideoId) return;
      setVideos((prev) =>
        prev.map((v) => {
          if (v.id === activeVideoId) {
            const currentVR: VideoVRSettings = v.vrSettings || {
              enabled: false,
              projection: '180',
              eyeMode: 'left',
              lens: 'regular',
              fov: 75,
            };
            return {
              ...v,
              vrSettings: {
                ...currentVR,
                ...newSettings,
              },
            };
          }
          return v;
        })
      );
    },
    [activeVideoId]
  );

  // Stop current scene loop and return to normal playback
  const handleStopSceneLoop = useCallback(() => {
    if (activeSceneId) {
      setActiveSceneId(null);
      setActiveLoopCount(0);
      setLastTriggeredKey(null);
      if (soundEnabled) {
        playChime(360, 0.08, 'triangle');
      }
    }
  }, [activeSceneId, soundEnabled]);

  // Seek handler
  const handleSeek = useCallback((time: number) => {
    setCurrentTime(time);
    if (playerRef.current) {
      playerRef.current.seekTo(time, false);
    }
  }, []);

  // Relative seek (±5 seconds), clamped strictly between 0 and duration
  const handleSeekRelative = useCallback((deltaSeconds: number) => {
    if (!playerRef.current) return;
    const cur = playerRef.current.getCurrentTime();
    const dur = duration || 0;
    const target = Math.max(0, Math.min(dur, cur + deltaSeconds));
    setCurrentTime(target);
    playerRef.current.seekTo(target, false);
  }, [duration]);

  // Volume change (±5%), clamped strictly between 0 and 2.0 (0% to 200%)
  const handleVolumeStep = useCallback((delta: number) => {
    setVolume((prev) => {
      const next = Math.max(0, Math.min(2, Math.round((prev + delta) * 100) / 100));
      if (next > 0) {
        setIsMuted(false);
      }
      return next;
    });
  }, []);

  // Moving slider or changing volume immediately updates level, and automatically unmutes if moved above 0
  const handleVolumeChange = useCallback((newVol: number) => {
    const clamped = Math.max(0, Math.min(2, newVol));
    setVolume(clamped);
    if (clamped > 0) {
      setIsMuted(false);
    }
  }, []);

  // Playback speed step (< to decrease, > to increase)
  const handlePlaybackRateStep = useCallback((direction: -1 | 1) => {
    const SPEED_STEPS = [0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2];
    setPlaybackRate((prevRate) => {
      if (direction === -1) {
        for (let i = SPEED_STEPS.length - 1; i >= 0; i--) {
          if (SPEED_STEPS[i] < prevRate - 0.01) {
            return SPEED_STEPS[i];
          }
        }
        return SPEED_STEPS[0];
      } else {
        for (let i = 0; i < SPEED_STEPS.length; i++) {
          if (SPEED_STEPS[i] > prevRate + 0.01) {
            return SPEED_STEPS[i];
          }
        }
        return SPEED_STEPS[SPEED_STEPS.length - 1];
      }
    });
  }, []);

  // Frame step handler
  const handleStepFrame = useCallback((direction: number) => {
    if (playerRef.current) {
      playerRef.current.stepFrame(direction);
    }
  }, []);

  // Previous and Next scene jump
  const handlePrevScene = useCallback(() => {
    if (scenes.length === 0) return;
    const currentList = activeVideoScenes.length > 0 ? activeVideoScenes : scenes;
    const currentIndex = currentList.findIndex((s) => s.id === (activeSceneId || selectedSceneId));
    const nextIndex = currentIndex > 0 ? currentIndex - 1 : currentList.length - 1;
    handlePlayScene(currentList[nextIndex]);
  }, [scenes, activeVideoScenes, activeSceneId, selectedSceneId, handlePlayScene]);

  const handleNextScene = useCallback(() => {
    if (scenes.length === 0) return;
    const currentList = activeVideoScenes.length > 0 ? activeVideoScenes : scenes;
    const currentIndex = currentList.findIndex((s) => s.id === (activeSceneId || selectedSceneId));
    const nextIndex = currentIndex >= 0 && currentIndex < currentList.length - 1 ? currentIndex + 1 : 0;
    handlePlayScene(currentList[nextIndex]);
  }, [scenes, activeVideoScenes, activeSceneId, selectedSceneId, handlePlayScene]);

  // Add new scene for current active video
  const handleAddScene = useCallback(() => {
    if (!activeVideoId) return;

    const start = currentTime;
    const end = Math.min(duration || 100, currentTime + 5);

    const existingKeys = new Set(scenes.map((s) => s.hotkey.toUpperCase()));
    const keyCandidates = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Q', 'W', 'E', 'R', 'T', 'Y', 'A', 'S', 'D'];
    let chosenKey = '1';
    for (const k of keyCandidates) {
      if (!existingKeys.has(k)) {
        chosenKey = k;
        break;
      }
    }

    const currentVid = videos.find((v) => v.id === activeVideoId);
    const isVR = !!currentVid?.vrSettings?.enabled;
    const vrView = isVR && playerRef.current?.getVROrientation
      ? playerRef.current.getVROrientation() || undefined
      : undefined;

    const newScene: Scene = {
      id: `scene-${Date.now()}`,
      videoId: activeVideoId,
      videoName: currentVid?.name || 'Video',
      name: `Scene ${activeVideoScenes.length + 1}`,
      startTime: Math.max(0, start),
      endTime: end > start ? end : start + 3,
      hotkey: chosenKey,
      loop: true,
      color: currentVid?.color || getRandomColor(scenes.length),
      vrView: vrView ? { yaw: vrView.yaw, pitch: vrView.pitch, fov: vrView.fov } : undefined,
    };

    setScenes((prev) => [...prev, newScene]);
    setSelectedSceneId(newScene.id);
  }, [currentTime, duration, scenes, activeVideoId, videos, activeVideoScenes.length]);

  // Create scene from custom timeline range (Shift+Drag)
  const handleCreateSceneFromRange = useCallback(
    (start: number, end: number) => {
      if (!activeVideoId) return;

      const existingKeys = new Set(scenes.map((s) => s.hotkey.toUpperCase()));
      const keyCandidates = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'Q', 'W', 'E', 'R', 'T', 'Y', 'A', 'S', 'D'];
      let chosenKey = '1';
      for (const k of keyCandidates) {
        if (!existingKeys.has(k)) {
          chosenKey = k;
          break;
        }
      }

      const currentVid = videos.find((v) => v.id === activeVideoId);
      const isVR = !!currentVid?.vrSettings?.enabled;
      const vrView = isVR && playerRef.current?.getVROrientation
        ? playerRef.current.getVROrientation() || undefined
        : undefined;

      const newScene: Scene = {
        id: `scene-${Date.now()}`,
        videoId: activeVideoId,
        videoName: currentVid?.name || 'Video',
        name: `Scene ${activeVideoScenes.length + 1}`,
        startTime: start,
        endTime: end,
        hotkey: chosenKey,
        loop: true,
        color: currentVid?.color || getRandomColor(scenes.length),
        vrView: vrView ? { yaw: vrView.yaw, pitch: vrView.pitch, fov: vrView.fov } : undefined,
      };

      setScenes((prev) => [...prev, newScene]);
      setSelectedSceneId(newScene.id);
    },
    [scenes, activeVideoId, videos, activeVideoScenes.length]
  );

  // Update scene times from timeline handle drag
  const handleUpdateSceneTimes = useCallback((sceneId: string, start: number, end: number) => {
    setScenes((prev) =>
      prev.map((s) => (s.id === sceneId ? { ...s, startTime: start, endTime: end } : s))
    );
  }, []);

  // Update single scene
  const handleUpdateScene = useCallback((updated: Scene) => {
    setScenes((prev) => prev.map((s) => (s.id === updated.id ? updated : s)));
  }, []);

  // Delete scene
  const handleDeleteScene = useCallback(
    (sceneId: string) => {
      if (activeSceneId === sceneId) {
        handleStopSceneLoop();
        setActiveSceneId(null);
        setActiveLoopCount(0);
      }
      setScenes((prev) => prev.filter((s) => s.id !== sceneId));
      if (selectedSceneId === sceneId) {
        setSelectedSceneId(null);
      }
    },
    [activeSceneId, selectedSceneId, handleStopSceneLoop]
  );

  // Delete currently selected or active scene via hotkey
  const handleDeleteSelectedScene = useCallback(() => {
    const targetSceneId = activeSceneId || selectedSceneId;
    if (!targetSceneId) return;
    handleDeleteScene(targetSceneId);
  }, [activeSceneId, selectedSceneId, handleDeleteScene]);

  // Duplicate scene
  const handleDuplicateScene = useCallback(
    (scene: Scene) => {
      const parentVid = videos.find((v) => v.id === scene.videoId);
      const newScene: Scene = {
        ...scene,
        id: `scene-${Date.now()}`,
        name: `${scene.name} (Copy)`,
        hotkey: '',
        color: parentVid?.color || scene.color || getRandomColor(),
        vrView: scene.vrView ? { ...scene.vrView } : undefined,
      };
      setScenes((prev) => [...prev, newScene]);
      setSelectedSceneId(newScene.id);
    },
    [videos]
  );

  // Export multi-video project to JSON
  const handleExportProject = useCallback(() => {
    const project: ProjectData = {
      version: '2.0',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      videos: videos.map((v) => ({
        id: v.id,
        name: v.name,
        duration: v.duration,
        color: v.color,
        vrSettings: v.vrSettings,
      })),
      scenes,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(project, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute('href', dataStr);
    downloadAnchor.setAttribute('download', `loopdeck_performance_project.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  }, [videos, scenes]);

  // Import project from JSON
  const handleImportProject = useCallback(
    (data: ProjectData) => {
      if (!data || !Array.isArray(data.scenes)) {
        alert('Invalid project JSON structure.');
        return;
      }

      if (data.videos && Array.isArray(data.videos)) {
        setVideos((prev) =>
          prev.map((v) => {
            const matched = data.videos?.find((dv) => dv.id === v.id || dv.name === v.name);
            return {
              ...v,
              color: matched?.color || v.color,
              vrSettings: matched?.vrSettings || v.vrSettings,
            };
          })
        );
      }

      const remappedScenes = data.scenes.map((sc) => {
        const matchedVid = videos.find((v) => v.name === sc.videoName || v.id === sc.videoId);
        const { vrDirection, customThumbnail, ...rest } = sc as any;
        return {
          ...rest,
          videoId: matchedVid ? matchedVid.id : sc.videoId || activeVideoId || 'video-1',
          videoName: matchedVid ? matchedVid.name : sc.videoName || 'Video',
          color: matchedVid?.color || sc.color,
        } as Scene;
      });

      setScenes(remappedScenes);
      if (remappedScenes.length > 0) {
        setSelectedSceneId(remappedScenes[0].id);
      }
      setActiveSceneId(null);
      setActiveLoopCount(0);
      alert(`Imported ${remappedScenes.length} scenes across project videos!`);
    },
    [videos, activeVideoId]
  );

  // Remove all scenes
  const handleRemoveAllScenes = useCallback(() => {
    handleStopSceneLoop();
    setScenes([]);
    setActiveSceneId(null);
    setActiveLoopCount(0);
    setSelectedSceneId(null);
    try {
      localStorage.removeItem(STORAGE_KEY_PREFIX);
    } catch {}
  }, [handleStopSceneLoop]);

  // Reset all scenes
  const handleResetScenes = useCallback(() => {
    if (window.confirm('Clear all scenes across all videos in LoopDeck?')) {
      handleRemoveAllScenes();
    }
  }, [handleRemoveAllScenes]);

  // Fullscreen toggle for main video player
  const handleToggleFullscreen = useCallback(() => {
    if (playerRef.current?.toggleFullscreen) {
      playerRef.current.toggleFullscreen();
      return;
    }
    const videoElem = playerRef.current?.getVideoElement();
    if (!videoElem) return;
    if (!document.fullscreenElement) {
      videoElem.requestFullscreen?.().catch(() => {});
    } else {
      document.exitFullscreen?.().catch(() => {});
    }
  }, []);

  // Global Keyboard Shortcuts Hook: Controls scenes & player across ANY video!
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;

      const target = e.target as HTMLElement;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.ctrlKey || e.metaKey || e.altKey) {
        return;
      }

      // When MultiBox is open, all keyboard actions (including 'F' and 'Escape')
      // are handled with high priority by MultiBoxModal directly
      if (isMultiBoxOpen || isMultiBoxOpenRef.current || document.querySelector('[data-multibox-modal="true"]')) {
        return;
      }

      // Esc: Stop Scene Loop
      if (e.key === 'Escape') {
        e.preventDefault();
        handleStopSceneLoop();
        return;
      }

      // Space: Play/Pause toggle
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault();
        if (playerRef.current) {
          const video = playerRef.current.getVideoElement();
          if (video) {
            if (video.paused) {
              playerRef.current.play().catch(() => {});
            } else {
              playerRef.current.pause();
            }
          }
        }
        return;
      }

      // ArrowLeft: Move video backward 5 seconds
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        handleSeekRelative(-5);
        return;
      }

      // ArrowRight: Move video forward 5 seconds
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSeekRelative(5);
        return;
      }

      // ArrowUp: Increase volume
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        handleVolumeStep(0.05);
        return;
      }

      // ArrowDown: Decrease volume
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleVolumeStep(-0.05);
        return;
      }

      // < : Decrease playback speed
      if (e.key === '<' || e.key === ',' || (e.shiftKey && e.code === 'Comma')) {
        e.preventDefault();
        handlePlaybackRateStep(-1);
        return;
      }

      // > : Increase playback speed
      if (e.key === '>' || e.key === '.' || (e.shiftKey && e.code === 'Period')) {
        e.preventDefault();
        handlePlaybackRateStep(1);
        return;
      }

      // Match assigned scene hotkeys ACROSS ANY VIDEO!
      const pressedKey = normalizeKey(e);
      const matchedScene = scenes.find(
        (s) => s.hotkey && s.hotkey.toUpperCase() === pressedKey.toUpperCase()
      );

      if (matchedScene) {
        e.preventDefault();
        handlePlayScene(matchedScene);
        return;
      }

      // F: Toggle Main Video Player Fullscreen
      if (pressedKey.toUpperCase() === 'F' || e.key === 'f' || e.key === 'F') {
        e.preventDefault();
        handleToggleFullscreen();
        return;
      }

      // M: Toggle Mute
      if (pressedKey.toUpperCase() === 'M' || e.key === 'm' || e.key === 'M') {
        e.preventDefault();
        setIsMuted((prev) => !prev);
        return;
      }

      // R: Toggle Record Scene (Start Recording -> Stop Recording)
      if (pressedKey.toUpperCase() === 'R' || e.key === 'r' || e.key === 'R') {
        e.preventDefault();
        handleToggleRecordScene();
        return;
      }

      // Delete: Delete Selected or Active Scene
      if (e.key === 'Delete' || e.code === 'Delete') {
        e.preventDefault();
        handleDeleteSelectedScene();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    scenes,
    isMultiBoxOpen,
    handleStopSceneLoop,
    handlePlayScene,
    handleToggleFullscreen,
    handleToggleRecordScene,
    handleDeleteSelectedScene,
    handleSeekRelative,
    handleVolumeStep,
    handlePlaybackRateStep,
  ]);

  return (
    <div className="min-h-screen bg-[#080b11] text-slate-100 flex flex-col font-sans selection:bg-cyan-500 selection:text-black">
      {/* Background Decorative Gradient Orbs */}
      <div className="fixed top-0 left-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl pointer-events-none -z-10" />
      <div className="fixed bottom-10 right-1/4 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -z-10" />

      {/* Top Header Navbar */}
      <header className="w-full bg-slate-900/80 border-b border-slate-800/80 px-6 py-4 flex items-center justify-between shadow-2xl backdrop-blur-xl sticky top-0 z-40">
        <div className="flex items-center gap-3.5">
          <div className="relative group cursor-pointer">
            <div className="absolute -inset-1 rounded-2xl bg-gradient-to-r from-cyan-400 via-sky-500 to-indigo-600 opacity-70 blur group-hover:opacity-100 transition-opacity"></div>
            <div className="relative w-10 h-10 rounded-2xl bg-slate-950 flex items-center justify-center border border-white/20 text-white shadow-xl">
              <Repeat className="w-5 h-5 text-cyan-400 animate-spin" style={{ animationDuration: '8s' }} />
            </div>
          </div>

          <div>
            <span className="text-xl md:text-2xl font-extrabold tracking-tight bg-gradient-to-r from-white via-cyan-200 to-indigo-300 bg-clip-text text-transparent drop-shadow-sm font-sans">
              Loop<span className="text-cyan-400">Deck</span>
            </span>
          </div>
        </div>

        {/* Header Right Actions */}
        <div className="flex items-center gap-3">
          {activeVideo && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-850/80 border border-slate-700/80 text-xs shadow-sm">
              <span className="text-slate-400 font-medium">Active:</span>
              <span className="font-bold text-cyan-300 font-mono max-w-[160px] truncate" title={activeVideo.name}>
                {activeVideo.name}
              </span>
              <button
                onClick={() => handleRequestRemoveVideo(activeVideo.id)}
                className="ml-1 p-1 rounded-md text-slate-400 hover:text-rose-400 hover:bg-rose-500/20 transition-colors"
                title="Remove active video from deck"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {/* MultiBox Button (Requirement 1) */}
          <button
            onClick={handleOpenMultiBox}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-cyan-600 hover:from-indigo-500 hover:via-purple-500 hover:to-cyan-500 text-white text-xs font-extrabold shadow-lg shadow-indigo-600/30 cursor-pointer transition-all hover:scale-103 active:scale-97 border border-white/10 group"
            title="Open MultiBox multi-video workspace"
          >
            <LayoutGrid className="w-3.5 h-3.5 stroke-[2.5] text-cyan-200 group-hover:rotate-12 transition-transform" />
            <span>MultiBox</span>
          </button>

          {/* Link Video Button */}
          <button
            onClick={() => setIsLinkVideoModalOpen(true)}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-slate-800/90 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-bold border border-slate-700/80 shadow-md shadow-slate-950/40 cursor-pointer transition-all hover:scale-103 active:scale-97 group"
            title="Link remote video by URL"
          >
            <Link2 className="w-3.5 h-3.5 text-cyan-400 group-hover:scale-110 transition-transform" />
            <span>Link Video</span>
          </button>

          <label className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-600 hover:from-cyan-400 hover:via-sky-400 hover:to-indigo-500 text-white text-xs font-extrabold shadow-lg shadow-cyan-500/25 cursor-pointer transition-all hover:scale-103 active:scale-97">
            <Upload className="w-3.5 h-3.5" />
            <span>{videos.length === 0 ? 'Upload Videos' : 'Add Videos'}</span>
            <input
              type="file"
              accept="video/*,.mp4,.webm,.mov,.mkv,.avi,.m4v,.gif,image/gif"
              multiple
              className="hidden"
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  handleUploadVideos(e.target.files);
                  e.target.value = '';
                }
              }}
            />
          </label>
        </div>
      </header>

      {/* Main App Container - Desktop Widescreen Layout */}
      <main className="flex-1 w-full max-w-[98%] 2xl:max-w-[2400px] mx-auto px-3 sm:px-6 lg:px-8 py-4 flex flex-col gap-4">
        {/* TOP SECTION: Video Player + Beside Scene Bank */}
        <section className="w-full relative z-10 flex flex-col gap-2.5">
          {/* Loaded Videos Horizontal Selector Strip (when multiple videos loaded) */}
          {videos.length > 1 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider pl-1 shrink-0 flex items-center gap-1.5">
                <Film className="w-3.5 h-3.5 text-cyan-400" />
                Video Deck ({videos.length}):
              </span>
              <button
                onClick={() => setIsLinkVideoModalOpen(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold transition-all shrink-0 cursor-pointer"
                title="Add another video via URL"
              >
                <Link2 className="w-3 h-3 text-cyan-400" />
                <span>Link URL</span>
              </button>
              {videos.map((vid) => {
                const vidColor = vid.color || '#06b6d4';
                const isSelected = vid.id === activeVideoId;
                return (
                  <button
                    key={vid.id}
                    onClick={() => handleSwitchVideo(vid.id)}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-bold transition-all shrink-0 ${
                      isSelected
                        ? 'bg-slate-800 text-white shadow-sm'
                        : 'bg-slate-900/80 hover:bg-slate-800 text-slate-400 hover:text-white border-slate-800'
                    }`}
                    style={{
                      borderColor: isSelected ? vidColor : undefined,
                      boxShadow: isSelected ? `0 0 10px ${vidColor}30` : undefined,
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: vidColor, boxShadow: `0 0 6px ${vidColor}80` }}
                    />
                    <span className="truncate max-w-[160px]">{vid.name}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-slate-950 text-slate-400 border border-slate-800">
                      {scenes.filter((s) => s.videoId === vid.id).length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}

          {/* Main Video Player + Beside Scene Bank (YouTube-style sidebar layout) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
            {/* Left: Main Video Player */}
            <div className="lg:col-span-9 xl:col-span-9 2xl:col-span-10 flex flex-col">
              <VideoPlayer
                ref={playerRef}
                videoSrc={activeVideo?.src || null}
                videoFileName={activeVideo?.name || ''}
                activeScene={activeScene}
                activeLoopCount={activeLoopCount}
                lastTriggeredKey={lastTriggeredKey}
                playbackRate={playbackRate}
                volume={volume}
                isMuted={isMuted}
                currentTime={currentTime}
                isRecording={isRecording}
                recordingStartTime={recordingStartTime}
                vrSettings={activeVideo?.vrSettings}
                onUpdateVRSettings={handleUpdateVRSettings}
                onToggleRecord={handleToggleRecordScene}
                onTimeUpdate={(ct, dur) => {
                  setCurrentTime(ct);
                  setDuration(dur);
                  if (activeVideo && dur > 0 && activeVideo.duration !== dur) {
                    setVideos((prev) =>
                      prev.map((v) => (v.id === activeVideo.id ? { ...v, duration: dur } : v))
                    );
                  }
                }}
                onPlayStateChange={setIsPlaying}
                onStopSceneLoop={handleStopSceneLoop}
                onFileUpload={(file) => handleUploadVideos([file])}
                onFilesUpload={handleUploadVideos}
                onRemoveVideo={activeVideo ? () => handleRequestRemoveVideo(activeVideo.id) : undefined}
                onLoopIteration={() => setActiveLoopCount((c) => c + 1)}
                onVolumeChange={handleVolumeChange}
                onToggleMute={() => setIsMuted((m) => !m)}
                onOpenLinkVideo={() => setIsLinkVideoModalOpen(true)}
                repeatWholeVideo={repeatWholeVideo}
              />
            </div>

            {/* Right: Scene Bank (Positioned directly beside main video, same height, single-column scroll) */}
            <div className="lg:col-span-3 xl:col-span-3 2xl:col-span-2 flex flex-col min-h-[300px]">
              <SceneBank
                scenes={scenes}
                activeSceneId={activeScene ? activeScene.id : null}
                thumbnails={sceneThumbnails}
                videos={videos}
                activeVideoSrc={activeVideo?.src || null}
                isSuspended={isMultiBoxOpen}
                onActivateScene={handlePlayScene}
              />
            </div>
          </div>
        </section>

        {/* BELOW VIDEO: Interactive Timeline (with Zoom & Record Scene integration) */}
        <section className="w-full relative z-30">
          <Timeline
            videoSrc={activeVideo?.src || null}
            duration={duration}
            currentTime={currentTime}
            scenes={activeVideoScenes}
            activeSceneId={activeScene && activeScene.videoId === activeVideoId ? activeScene.id : null}
            selectedSceneId={selectedSceneId}
            isRecording={isRecording}
            recordingStartTime={recordingStartTime}
            onToggleRecord={handleToggleRecordScene}
            onSeek={handleSeek}
            onSelectScene={setSelectedSceneId}
            onPlayScene={handlePlayScene}
            onUpdateSceneTimes={handleUpdateSceneTimes}
            onCreateSceneFromRange={handleCreateSceneFromRange}
          />
        </section>

        {/* BELOW TIMELINE: Playback Controls */}
        <section className="w-full">
          <PlaybackControls
            isPlaying={isPlaying}
            currentTime={currentTime}
            duration={duration}
            volume={volume}
            isMuted={isMuted}
            playbackRate={playbackRate}
            isSceneLooping={activeSceneId !== null}
            onTogglePlay={() => {
              if (playerRef.current) {
                const v = playerRef.current.getVideoElement();
                if (v) {
                  if (v.paused) playerRef.current.play().catch(() => {});
                  else playerRef.current.pause();
                }
              }
            }}
            onSeek={handleSeek}
            onVolumeChange={handleVolumeChange}
            onToggleMute={() => setIsMuted((m) => !m)}
            onPlaybackRateChange={setPlaybackRate}
            onStepFrame={handleStepFrame}
            onPrevScene={handlePrevScene}
            onNextScene={handleNextScene}
            onStopSceneLoop={handleStopSceneLoop}
            onToggleFullscreen={handleToggleFullscreen}
            repeatWholeVideo={repeatWholeVideo}
            onToggleRepeatWholeVideo={handleToggleRepeatWholeVideo}
          />
        </section>

        {/* MAIN LOWER SECTION: Scene Sampler Deck & Hotkeys Sidebar */}
        <section className="w-full grid grid-cols-1 lg:grid-cols-12 gap-5 mt-1">
          {/* Main Lower Left: Scene List (Clean Scene Editor) */}
          <div className="lg:col-span-8 flex flex-col gap-4">
            <SceneList
              scenes={scenes}
              videos={videos}
              activeVideoId={activeVideoId}
              activeSceneId={activeSceneId}
              selectedSceneId={selectedSceneId}
              currentTime={currentTime}
              thumbnails={sceneThumbnails}
              isRecording={isRecording}
              recordingStartTime={recordingStartTime}
              onToggleRecord={handleToggleRecordScene}
              onSelectScene={setSelectedSceneId}
              onPlayScene={handlePlayScene}
              onAddScene={handleAddScene}
              onUpdateScene={handleUpdateScene}
              onDeleteScene={handleDeleteScene}
              onDuplicateScene={handleDuplicateScene}
              onSwitchVideo={handleSwitchVideo}
              onRemoveAllScenes={handleRemoveAllScenes}
            />
          </div>

          {/* Sidebar Right: Performance Hotkeys Pad & Project Workspace */}
          <div className="lg:col-span-4 flex flex-col gap-4">
            <HotkeysSidebar
              scenes={scenes}
              videos={videos}
              activeVideoId={activeVideoId}
              activeSceneId={activeSceneId}
              thumbnails={sceneThumbnails}
              soundEnabled={soundEnabled}
              onToggleSound={() => setSoundEnabled((s) => !s)}
              onTriggerScene={handlePlayScene}
              onExportProject={handleExportProject}
              onImportProject={handleImportProject}
              onResetScenes={handleResetScenes}
            />
          </div>
        </section>
      </main>

      {/* In-App Confirmation Modal for Video Removal */}
      <ConfirmModal
        isOpen={!!videoPendingRemoval}
        video={videoPendingRemoval}
        scenesCount={scenes.filter((s) => s.videoId === videoPendingRemoval?.id).length}
        onConfirm={handleConfirmRemoveVideo}
        onCancel={() => setVideoPendingRemoval(null)}
      />

      {/* MultiBox Overlay Workspace Modal */}
      {isMultiBoxOpen && (
        <MultiBoxModal
          isOpen={isMultiBoxOpen}
          onClose={handleCloseMultiBox}
          videos={videos}
          scenes={scenes}
          thumbnails={sceneThumbnails}
          initialVolume={volume}
        />
      )}

      {/* Link Video Modal */}
      <LinkVideoModal
        isOpen={isLinkVideoModalOpen}
        onClose={() => setIsLinkVideoModalOpen(false)}
        onVideoLoaded={handleVideoLinked}
      />

      {/* Footer */}
      <footer className="w-full bg-slate-900/60 border-t border-slate-800/80 px-6 py-3.5 text-xs text-slate-400 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-slate-300">LoopDeck</span>
          <span className="text-slate-600">•</span>
          <span>Multi-Deck Performance Video Sampler</span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-slate-400">
          <span>Keyboard: Space (Play/Pause) • Esc (Stop Loop) • 1-9/A-Z (Cross-Video Triggers)</span>
        </div>
      </footer>
    </div>
  );
}
