import { useState, useEffect, useRef, useCallback } from 'react';

interface UseFullscreenAutoHideOptions {
  isFullscreen: boolean;
  timeoutMs?: number; // default 3000ms
}

export function useFullscreenAutoHide({
  isFullscreen,
  timeoutMs = 3000,
}: UseFullscreenAutoHideOptions) {
  const [isControlsVisible, setIsControlsVisible] = useState(true);
  const hideTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isInteractingRef = useRef(false);

  const clearTimer = useCallback(() => {
    if (hideTimerRef.current) {
      clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  // Reset 3-second countdown and immediately reveal controls & cursor
  const handleUserActivity = useCallback(() => {
    setIsControlsVisible(true);
    clearTimer();

    if (!isFullscreen) return;

    hideTimerRef.current = setTimeout(() => {
      // Do not hide while user is actively holding mouse down (dragging slider or button)
      if (!isInteractingRef.current) {
        setIsControlsVisible(false);
      }
    }, timeoutMs);
  }, [isFullscreen, timeoutMs, clearTimer]);

  // Track active interaction (e.g. mousedown on sliders)
  const handleMouseDown = useCallback(() => {
    isInteractingRef.current = true;
    handleUserActivity();
  }, [handleUserActivity]);

  const handleMouseUp = useCallback(() => {
    isInteractingRef.current = false;
    handleUserActivity();
  }, [handleUserActivity]);

  // When fullscreen changes
  useEffect(() => {
    clearTimer();
    setIsControlsVisible(true);
    isInteractingRef.current = false;

    if (isFullscreen) {
      hideTimerRef.current = setTimeout(() => {
        if (!isInteractingRef.current) {
          setIsControlsVisible(false);
        }
      }, timeoutMs);
    }

    return () => {
      clearTimer();
    };
  }, [isFullscreen, timeoutMs, clearTimer]);

  // Global window listeners while in fullscreen to catch any mouse move anywhere on screen
  useEffect(() => {
    if (!isFullscreen) return;

    const onGlobalMouseMove = () => {
      handleUserActivity();
    };
    const onGlobalMouseUp = () => {
      isInteractingRef.current = false;
      handleUserActivity();
    };

    window.addEventListener('mousemove', onGlobalMouseMove, { passive: true });
    window.addEventListener('mouseup', onGlobalMouseUp);
    window.addEventListener('touchstart', onGlobalMouseMove, { passive: true });

    return () => {
      window.removeEventListener('mousemove', onGlobalMouseMove);
      window.removeEventListener('mouseup', onGlobalMouseUp);
      window.removeEventListener('touchstart', onGlobalMouseMove);
    };
  }, [isFullscreen, handleUserActivity]);

  return {
    isControlsVisible: !isFullscreen || isControlsVisible,
    isCursorHidden: isFullscreen && !isControlsVisible,
    handleUserActivity,
    handleMouseDown,
    handleMouseUp,
    setIsInteracting: (interacting: boolean) => {
      isInteractingRef.current = interacting;
      if (interacting) {
        handleUserActivity();
      }
    },
  };
}
